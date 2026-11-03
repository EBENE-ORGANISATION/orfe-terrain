import {BOITE_URL,VERSION} from './config.js';
import {texte,chiffres,nifValide,dateLocale,nouvelId,CHOIX,validerFiche,proposerRue,couleurPrecision,accuser} from './metier.mjs';
import {ouvrirStockage} from './stockage.mjs';
import {ecouterGPS} from './gps.mjs';
import {poster,carteRues} from './transport.mjs';

const $=id=>document.getElementById(id);
const factice=new URL(location.href).searchParams.get('factice')==='1';
const echapper=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jour=()=>dateLocale().slice(0,10);
let db,session,equipe,recenses=[],fiches=[],onglet='Recensement',edition=null,point=null,gpsEnCours=null,proposition=null,rueSource='AGENT',rueOrigine='',envoi=false,sauvegarde=false,choixJour=false;
let brouillonId=nouvelId(),rafraichissement=null;
const rueCarte=carteRues();
let simuler,gpsFactice;
function message(t){$('message').textContent=t;}
function erreur(e){message(e.name==='AbortError'?'La demande a pris trop de temps. Réessayez.':e.message||'Une erreur est survenue.');}
function enLigne(){return navigator.onLine;}
function droit(v){return v===true||v==='OUI';}
function reglage(n){const defauts={GPS_OBJECTIF_M:4,GPS_AFFINER_S:10,GPS_DUREE_S:45,GPS_SEUIL_M:15};const v=Number(session?.reglages?.[n]??defauts[n]);if(!Number.isFinite(v)||v<=0)throw new Error(`Le réglage ${n} doit être fourni par la boîte.`);return v;}
function equipeActuelle(){return session?.equipes?.find(e=>e.nom===equipe?.nom);}
async function appel(action,donnees={}){
  const demande={action,code:session?.code,...donnees};
  // Le contrat impose aussi l’équipe du jour dans chaque demande de terrain.
  if(equipe?.nom)demande.equipe=equipe.nom;
  const r=factice?await simuler(demande):await poster(BOITE_URL,demande);
  if(r?.ok===false){
    if(r.raison==='CODE'){await db.garder('session',null);session=null;equipe=null;arreterGPS();afficherConnexion();}
    throw new Error(r.raison==='CODE'?'Ce code n’est plus actif. Saisissez un nouveau code.':r.raison||'La demande a été refusée.');
  }
  return r;
}
function arreterGPS(){gpsEnCours?.stop();gpsEnCours=null;}
function compteur(){const n=fiches.filter(f=>!f.envoyee).length;$('compteur').textContent=`${n} fiche${n===1?'':'s'} pas encore envoyée${n===1?'':'s'}`;}
function entete(){
  $('identite').textContent=session?`${session.agent} · ${equipe?.nom||'Équipe à choisir'}`:'';
  $('changer').hidden=!session||!equipe;$('envoyer').hidden=!session;
  $('reseau').textContent=enLigne()?'Réseau disponible':'Sans réseau';
  compteur();
}
function afficherConnexion(){
  $('onglets').replaceChildren();entete();
  $('contenu').innerHTML='<h1>Votre code d’accès</h1><p>Le code fourni par votre gestionnaire est gardé sur ce téléphone.</p><form id="connexion"><label for="code">Code de 6 caractères</label><input id="code" name="code" maxlength="6" minlength="6" required autocomplete="off" autocapitalize="characters" spellcheck="false"><div class="actions"><button class="principal">Ouvrir mon carnet</button></div></form>'+(factice?'<p class="aide">Essai fictif : DEMO22 (gestionnaire) ou DEMO33 (agent).</p>':'');
  $('code').oninput=()=>{$('code').value=texte($('code').value).replace(/\s/g,'');};
  $('connexion').onsubmit=async e=>{e.preventDefault();const bouton=e.submitter;bouton.disabled=true;try{
    if(!enLigne())throw new Error('Il faut du réseau pour la première ouverture.');
    const code=$('code').value;const r=await appel('bonjour',{code});
    session={...r,code};await db.garder('session',session);await chargerFiches();await choisirEquipe();rafraichir().catch(erreur);
  }catch(e){erreur(e);}finally{bouton.disabled=false;}};
}
async function chargerFiches(){fiches=await db.fiches();compteur();}
function protegerBrouillon(){return !$('fiche')||!$('fiche').dataset.modifie||confirm('Quitter cette fiche sans enregistrer ?');}
async function choisirEquipe(){
  arreterGPS();choixJour=true;entete();$('onglets').replaceChildren();
  $('contenu').innerHTML='<h1>Aujourd’hui, je suis dans :</h1><div id="equipes" class="equipes"></div><div id="acces-bureau" class="actions"></div>';
  for(const e of session.equipes||[]){const b=document.createElement('button');b.textContent=e.nom;b.onclick=async()=>{try{equipe={nom:e.nom,date:jour()};await db.garder('equipe',equipe);choixJour=false;onglet='Recensement';edition=null;afficher();envoyer();}catch(e){erreur(e);}};$('equipes').append(b);}
  for(const [nom,autorise] of [['Gestion',session.peut_gerer],['Extraire',session.peut_extraire]]){if(!droit(autorise))continue;const b=document.createElement('button');b.textContent=nom;b.onclick=()=>{choixJour=false;onglet=nom;edition=null;afficher();};$('acces-bureau').append(b);}
  if(!session.equipes?.length)$('equipes').textContent='Aucune équipe active. Contactez le gestionnaire.';
}
function accesBureau(){return onglet==='Gestion'&&droit(session?.peut_gerer)||onglet==='Extraire'&&droit(session?.peut_extraire);}
function jourCorrect(){return equipe?.date===jour()&&!!equipeActuelle();}
function afficher(){
  if(!session)return afficherConnexion();
  if(!jourCorrect()&&!accesBureau())return choisirEquipe();
  entete();arreterGPS();actualiserOnglets();
  if(onglet==='Recensement')afficherRecensement();
  else if(onglet==='Gestion')gestion().catch(erreur);
  else $('contenu').innerHTML=`<h1>${echapper(onglet)}</h1><p>Bientôt disponible.</p>`;
}
function actualiserOnglets(){
  $('onglets').replaceChildren();
  const onglets=[...(jourCorrect()?['Recensement',...(droit(equipeActuelle()?.fait_la_tournee)?['Tournée']:[]),'Recherche']:['Choisir l’équipe']),...(droit(session.peut_extraire)?['Extraire']:[]),...(droit(session.peut_gerer)?['Gestion']:[])];
  if(!onglets.includes(onglet))onglet='Recensement';
  for(const nom of onglets){const b=document.createElement('button');b.textContent=nom;if(nom===onglet)b.setAttribute('aria-current','page');b.onclick=()=>{if(!protegerBrouillon())return;if(nom==='Choisir l’équipe'){choisirEquipe().catch(erreur);return;}edition=null;onglet=nom;afficher();};$('onglets').append(b);}
}
function champ(nom,titre,options={}){
  const valeur=options.valeur??'';
  const attributs=`id="${nom}" name="${nom}" ${options.obligatoire?'required':''}`;
  const select=options.choix;
  return `<div><label for="${nom}">${titre}</label>${select?`<select ${attributs}><option value="">Choisir…</option>${select.map(v=>`<option ${v===valeur?'selected':''}>${echapper(v)}</option>`).join('')}</select>`:options.aire?`<textarea ${attributs}>${echapper(valeur)}</textarea>`:`<input ${attributs} value="${echapper(valeur)}" ${options.chiffres?'inputmode="numeric"':''} ${options.suggestions?`list="${nom}-suggestions"`:''}>`}</div>`;
}
function afficherRecensement(reprendre={}){
  const f=edition||reprendre;point=f.gps&&f.gps!=='AUCUN'?{lat:f.lat,lon:f.lon,precision:f.precision}:null;
  proposition=null;rueSource=f.rue_source||'AGENT';rueOrigine=f.rue||'';brouillonId=f.id||nouvelId();
  const niveauAutre=f.niveau&&!CHOIX.niveau.includes(f.niveau);
  $('contenu').innerHTML=`<h1>${edition?'Corriger la fiche':'Recenser une boutique'}</h1><p class="aide">Les champs marqués * sont nécessaires. Raison sociale ou responsable : au moins un des deux.</p><form id="fiche" novalidate><div class="grille">${champ('immatricule','Immatriculé ? *',{choix:CHOIX.immatricule,valeur:f.immatricule,obligatoire:true})}${champ('nif','NIF',{valeur:f.nif,chiffres:true})}</div><p id="avertissement-nif" role="status"></p><div class="grille">${champ('raison','Raison sociale',{valeur:f.raison})}${champ('responsable','Nom du responsable',{valeur:f.responsable})}${champ('telephone','Téléphone',{valeur:f.telephone,chiffres:true})}${champ('activite','Activité *',{valeur:f.activite,obligatoire:true,suggestions:true})}</div><datalist id="activite-suggestions"></datalist><section aria-labelledby="titre-gps"><h2 id="titre-gps">Localisation</h2><p id="gps-etat" role="status"></p><button type="button" id="garder-gps" class="principal" disabled>Garder ce point</button><button type="button" id="reprendre-gps">Reprendre le GPS</button><div id="rue-proposee"></div><p class="aide">Suggestion cartographique : © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>.</p></section><div class="grille">${champ('rue','Rue *',{valeur:f.rue,obligatoire:true,suggestions:true})}${champ('immeuble','Immeuble',{valeur:f.immeuble})}${champ('niveau','Niveau',{choix:CHOIX.niveau,valeur:niveauAutre?'AUTRE':f.niveau})}${champ('niveau_autre','Précisez le niveau',{valeur:niveauAutre?f.niveau:''})}${champ('porte','Numéro de porte',{valeur:f.porte})}${champ('enseigne','Y a-t-il une enseigne ?',{choix:CHOIX.enseigne,valeur:f.enseigne})}${champ('regime','Régime déclaré',{choix:CHOIX.regime,valeur:f.regime})}</div><datalist id="rue-suggestions"></datalist>${champ('observation','Observation',{valeur:f.observation,aire:true})}<div id="erreurs" role="alert" tabindex="-1"></div><div class="actions"><button class="principal" id="enregistrer">Enregistrer la fiche</button>${edition?'<button type="button" id="annuler-edition">Annuler la correction</button>':''}</div></form><details id="mes-fiches"><summary>Mes fiches du jour</summary><div id="liste-fiches"></div></details>`;
  $('fiche').oninput=()=>{$('fiche').dataset.modifie='oui';};
  for(const n of ['nif','telephone'])$(n).oninput=()=>{$(n).value=chiffres($(n).value);if(n==='nif')avertirNif();};
  $('immatricule').onchange=avertirNif;
  $('niveau').onchange=()=>{$('niveau_autre').parentElement.hidden=$('niveau').value!=='AUTRE';};$('niveau').onchange();
  $('rue').oninput=()=>{rueSource='AGENT';rueOrigine=$('rue').value;};
  $('garder-gps').onclick=()=>gpsEnCours?.stop();
  $('reprendre-gps').onclick=()=>prendreGPS().catch(erreur);
  $('fiche').onsubmit=enregistrer;
  if($('annuler-edition'))$('annuler-edition').onclick=()=>{if(protegerBrouillon()){edition=null;afficherRecensement();}};
  suggestions();listeFiches();avertirNif();afficherPoint();
  if(!point)prendreGPS().catch(erreur);else proposer().catch(erreur);
}
function avertirNif(){const oui=$('immatricule').value==='OUI';$('nif').required=oui;$('avertissement-nif').textContent=oui&&$('nif').value&&!nifValide($('nif').value)?'À vérifier : le NIF devrait avoir 10 chiffres et commencer par 1. Vous pouvez enregistrer.':'';}
function suggestions(){for(const n of ['rue','activite']){const liste=$(`${n}-suggestions`);if(!liste)continue;liste.replaceChildren();const valeurs=[...new Set([...recenses,...fiches.filter(f=>f.agent===session.agent)].map(f=>texte(f[n])).filter(Boolean))].sort();for(const v of valeurs){const o=document.createElement('option');o.value=v;liste.append(o);}}}
function afficherPoint(note=''){
  const el=$('gps-etat');if(!el)return;
  if($('garder-gps'))$('garder-gps').disabled=!point||!gpsEnCours;
  if(!point){el.className='';el.textContent=note||'Aucun point GPS. Vous pouvez enregistrer sans GPS.';return;}
  const seuil=reglage('GPS_SEUIL_M');el.className=couleurPrecision(point.precision,seuil,reglage('GPS_OBJECTIF_M'));
  el.textContent=`Précision : ${Math.round(point.precision)} m · ${point.precision<=seuil?'bon point':'point imprécis, conservé'}${note?' · '+note:''}`;
}
async function prendreGPS(){
  arreterGPS();point=null;proposition=null;$('rue-proposee')?.replaceChildren();afficherPoint("Recherche d'un point plus précis…");
  const id=brouillonId;
  const t=ecouterGPS({...(factice?{geolocalisation:gpsFactice}:{}),objectif:reglage('GPS_OBJECTIF_M'),affiner:reglage('GPS_AFFINER_S'),duree:reglage('GPS_DUREE_S'),surMesure:(p,note)=>{if(brouillonId===id){point=p;afficherPoint(note);}}});gpsEnCours=t;afficherPoint("Recherche d'un point plus précis…");
  const resultat=await t.promesse;if(gpsEnCours!==t)return;gpsEnCours=null;
  point=resultat.point;afficherPoint(resultat.raison);if(point)await proposer();
}
async function proposer(){
  if(!point||!$('rue-proposee'))return;const id=brouillonId;
  proposition=proposerRue(point,[...recenses,...fiches.filter(f=>f.agent===session.agent)]);
  if(!proposition&&enLigne()){
    // Le mode factice ne transmet pas les positions d’essai à un tiers.
    const rue=factice?'RUE DES NUAGES FICTIFS':await rueCarte(id,point);
    if(id!==brouillonId||!$('rue-proposee'))return;
    if(rue)proposition={rue:texte(rue),source:'CARTE'};
  }
  if(!proposition)return;
  const p=proposition,zone=$('rue-proposee');zone.replaceChildren();const label=document.createElement('p');
  label.textContent=p.source==='VOISINS'?`Rue proposée : ${p.rue} (${p.nombre} voisins)`:`Rue proposée d’après la carte : ${p.rue}`;
  const b=document.createElement('button');b.type='button';b.textContent='Utiliser cette rue';b.onclick=()=>{
    if($('rue').value.trim()){message('La rue déjà saisie est conservée. Effacez-la si vous souhaitez utiliser la proposition.');return;}
    $('rue').value=p.rue;rueSource=p.source;rueOrigine=p.rue;$('fiche').dataset.modifie='oui';
  };zone.append(label,b);
}
async function enregistrer(e){
  e.preventDefault();if(envoi||sauvegarde){message('Envoi en cours. Réessayez dans un instant ; votre saisie est conservée.');return;}
  if(!jourCorrect()){message('La journée a changé. Enregistrez après avoir choisi l’équipe du jour.');return;}
  arreterGPS();const donnees=Object.fromEntries(new FormData($('fiche')));const f={};for(const [k,v]of Object.entries(donnees))f[k]=texte(v);
  f.nif=chiffres(f.nif);f.telephone=chiffres(f.telephone);
  if(f.niveau==='AUTRE'){if(!f.niveau_autre){$('erreurs').textContent='Précisez le niveau choisi avec AUTRE.';$('niveau_autre').focus();return;}f.niveau=f.niveau_autre;}delete f.niveau_autre;
  Object.assign(f,{id:brouillonId,type:'RECENSEMENT',date:edition?.date||dateLocale(),agent:edition?.agent||session.agent,equipe:edition?.equipe||equipe.nom,rue_source:rueSource!=='AGENT'&&f.rue===texte(rueOrigine)?rueSource:'AGENT',gps:point?(point.precision<=reglage('GPS_SEUIL_M')?'BON':'IMPRECIS'):'AUCUN'});
  if(point)Object.assign(f,{lat:Number(point.lat.toFixed(7)),lon:Number(point.lon.toFixed(7)),precision:Math.round(point.precision)});
  const erreurs=validerFiche(f);if(erreurs.length){$('erreurs').textContent=erreurs.join('\n');$('erreurs').focus();return;}
  sauvegarde=true;$('enregistrer').disabled=true;
  try{
    const actuelle=(await db.fiches()).find(x=>x.id===f.id);if(actuelle?.envoyee)throw new Error('Cette fiche a été envoyée et ne peut plus être corrigée.');
    await db.fiche({...f,envoyee:false});await chargerFiches();edition=null;
    afficherRecensement({rue:f.rue,immeuble:f.immeuble,rue_source:f.rue_source});message('Fiche enregistrée sur ce téléphone. Vous pouvez commencer la suivante.');
  }catch(e){erreur(e);if($('enregistrer'))$('enregistrer').disabled=false;}finally{sauvegarde=false;}
  envoyer();
}
function listeFiches(){
  const zone=$('liste-fiches');if(!zone)return;zone.replaceChildren();
  const liste=fiches.filter(f=>f.agent===session.agent&&f.date.slice(0,10)===jour()).sort((a,b)=>b.date.localeCompare(a.date));
  if(!liste.length)zone.textContent='Aucune fiche aujourd’hui.';
  for(const f of liste){const div=document.createElement('article');div.className='carte';const titre=document.createElement('strong');titre.textContent=f.raison||f.responsable;const p=document.createElement('p');p.textContent=`${f.date.slice(11,16)} · ${f.equipe} · ${f.rue} · ${f.envoyee?'envoyée':'en attente'}${f.refus?' · Refus : '+f.refus:''}`;div.append(titre,p);if(!f.envoyee){const b=document.createElement('button');b.textContent='Ouvrir et corriger';b.onclick=()=>{if(envoi){message('Attendez la fin de l’envoi.');return;}if(!protegerBrouillon())return;edition=f;arreterGPS();afficherRecensement();window.scrollTo(0,0);};div.append(b);}zone.append(div);}
}
async function envoyer(){
  if(!session||!enLigne()||envoi||sauvegarde||!jourCorrect())return;
  envoi=true;$('envoyer').disabled=true;
  try{
    await chargerFiches();const file=fiches.filter(f=>!f.envoyee&&f.agent===session.agent&&f.id!==edition?.id);if(!file.length)return;
    const r=await appel('envoyer',{fiches:file.map(({envoyee,refus,...f})=>f)});
    for(const f of accuser(file,r))await db.fiche(f);
    await chargerFiches();listeFiches();
    if(r.refuses?.length)message('Certaines fiches ont été refusées. Consultez « Mes fiches du jour ». Elles restent sur le téléphone.');
  }catch(e){erreur(e);}finally{envoi=false;$('envoyer').disabled=false;}
}
async function rafraichir(){
  if(!session||!enLigne())return;
  if(rafraichissement)return rafraichissement;
  rafraichissement=(async()=>{
    const ancien=session;const r=await appel('bonjour');session={...r,code:ancien.code};await db.garder('session',session);
    if(!jourCorrect()&&!accesBureau()&&!$('fiche')?.dataset.modifie)await choisirEquipe();else{
      entete();if(!choixJour){const avant=onglet;actualiserOnglets();if(avant!==onglet)afficher();}
    }
    const liste=await appel('recenses');recenses=Array.isArray(liste)?liste:liste.recenses;
    if(!Array.isArray(recenses))throw new Error('La liste des recensés reçue est illisible.');
    await db.garder('recenses',recenses);await db.garder('recenses_jour',jour());suggestions();
  })();
  try{await rafraichissement;}finally{rafraichissement=null;}
}
async function montrerCode(code){
  const d=$('code-neuf');$('code-affiche').textContent=code;
  $('copier').onclick=async()=>{try{await navigator.clipboard.writeText(code);message('Code copié. Transmettez-le à l’agent.');}catch{message('Copie indisponible : notez le code affiché.');}};
  const nettoyer=()=>{$('code-affiche').textContent='';$('copier').onclick=null;};
  $('fermer-code').onclick=()=>{if(d.close)d.close();else{d.removeAttribute('open');nettoyer();}};d.onclose=nettoyer;
  if(d.showModal)d.showModal();else d.setAttribute('open','');
}
async function gestion(){
  $('contenu').innerHTML='<h1>Gestion</h1>';
  if(!enLigne()){$('contenu').append(document.createTextNode('Il faut du réseau pour la gestion'));return;}
  if(!droit(session.peut_gerer))return;
  const resultat=await appel('agents');if(onglet!=='Gestion'||!session)return;
  const agents=Array.isArray(resultat)?resultat:resultat.agents;
  if(!Array.isArray(agents))throw new Error('La liste des agents reçue est illisible.');
  $('contenu').innerHTML=`<h1>Gestion</h1><h2>Agents</h2><div id="agents"></div><form id="ajout-agent" class="carte"><h2>Ajouter un agent</h2>${champ('nom-agent','Nom *',{obligatoire:true})}<label><input type="checkbox" name="peut_extraire">Peut extraire</label><label><input type="checkbox" name="peut_gerer">Peut gérer</label><button class="principal">Ajouter l’agent</button></form><h2>Équipes actives</h2><div id="gestion-equipes"></div><form id="ajout-equipe" class="carte"><h2>Ajouter une équipe</h2>${champ('nom-equipe','Nom de l’équipe *',{obligatoire:true})}<label><input type="checkbox" name="fait_la_tournee">Fait la tournée</label><button class="principal">Ajouter l’équipe</button></form>`;
  async function mutation(action,data){if(!enLigne())throw new Error('Il faut du réseau pour la gestion');const r=await appel(action,data);if(r.code_nouveau)await montrerCode(r.code_nouveau);await rafraichir();if(onglet==='Gestion'&&droit(session?.peut_gerer))await gestion();return r;}
  function branche(form,fn){form.onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await fn(new FormData(form));}catch(e){erreur(e);}finally{b.disabled=false;}};}
  const oui=(fd,k)=>fd.has(k)?'OUI':'NON';
  branche($('ajout-agent'),fd=>mutation('agent_ajouter',{nom:texte(fd.get('nom-agent')),peut_extraire:oui(fd,'peut_extraire'),peut_gerer:oui(fd,'peut_gerer')}));
  branche($('ajout-equipe'),fd=>mutation('equipe_ajouter',{nom:texte(fd.get('nom-equipe')),fait_la_tournee:oui(fd,'fait_la_tournee')}));
  for(const a of agents){
    const form=document.createElement('form');form.className='carte';
    const titre=document.createElement('h2');titre.textContent=`${a.nom} · ${droit(a.actif)?'actif':'retiré'}`;form.append(titre);
    const info=document.createElement('p');info.textContent=`Code : …${a.code_fin||a.code_4||a.code_dernier4||''}`;form.append(info);
    for(const [k,label]of [['peut_extraire','Peut extraire'],['peut_gerer','Peut gérer']]){const l=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name=k;input.checked=droit(a[k]);input.disabled=!droit(a.actif);l.append(input,label);form.append(l);}
    if(droit(a.actif)){
      for(const [label,action]of [['Enregistrer les droits','droits'],['Nouveau code','nouveau'],['Retirer l’agent','retirer']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{if(action!=='droits'&&!confirm(`${label} : ${a.nom} ?`))return;b.disabled=true;try{const fd=new FormData(form);await mutation(action==='retirer'?'agent_retirer':'agent_modifier',{nom:a.nom,...(action==='retirer'?{}:{peut_extraire:oui(fd,'peut_extraire'),peut_gerer:oui(fd,'peut_gerer'),nouveau_code:action==='nouveau'?'OUI':'NON'})});}catch(e){erreur(e);}finally{b.disabled=false;}};form.append(b);}
    }
    form.onsubmit=e=>e.preventDefault();$('agents').append(form);
  }
  for(const e of session.equipes||[]){const form=document.createElement('form');form.className='carte';const id=`eq-${nouvelId()}`;form.innerHTML=`${champ(id,'Nom',{valeur:e.nom,obligatoire:true})}<label><input type="checkbox" name="tournee" ${droit(e.fait_la_tournee)?'checked':''}>Fait la tournée</label><button>Enregistrer l’équipe</button>`;branche(form,fd=>mutation('equipe_modifier',{nom:e.nom,nouveau_nom:texte(fd.get(id)),fait_la_tournee:oui(fd,'tournee')}));const b=document.createElement('button');b.type='button';b.textContent='Retirer l’équipe';b.onclick=async()=>{if(!confirm(`Retirer l’équipe ${e.nom} ?`))return;b.disabled=true;try{await mutation('equipe_retirer',{nom:e.nom});}catch(e){erreur(e);}finally{b.disabled=false;}};form.append(b);$('gestion-equipes').append(form);}
}
let enregistrement=null,rechargement=false;
// Une nouvelle version prend la main dès qu’elle est prête, mais jamais pendant une saisie.
function appliquerVersion(){
  const attente=enregistrement?.waiting;
  if(!attente||rechargement||!navigator.serviceWorker.controller||$('fiche')?.dataset.modifie)return;
  rechargement=true;attente.postMessage('ACTIVER');
}
function chercherVersion(){if(enregistrement&&enLigne())enregistrement.update().catch(()=>{});appliquerVersion();}
async function serviceWorker(){
  if(!('serviceWorker'in navigator))return;
  const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  enregistrement=reg;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(rechargement)location.reload();});
  if(reg.waiting){rechargement=true;reg.waiting.postMessage('ACTIVER');return;}
  reg.addEventListener('updatefound',()=>{const neuf=reg.installing;neuf?.addEventListener('statechange',()=>{if(neuf.state==='installed')appliquerVersion();});});
  navigator.serviceWorker.addEventListener('message',e=>{if(e.data==='NOUVELLE_VERSION')message('Nouvelle version installée');});
  const ancienne=await db.lire('version');if(ancienne&&ancienne!==VERSION)message('Nouvelle version installée');await db.garder('version',VERSION);
}
async function demarrer(){
  if(factice){document.body.classList.add('factice');({repondre:simuler,gpsFactice}=await import('../essais/telephone/boite-factice.js'));}
  db=await ouvrirStockage(factice);session=await db.lire('session');equipe=await db.lire('equipe');recenses=await db.lire('recenses')||[];await chargerFiches();
  $('version').textContent=`v${VERSION}${factice?' · Données fictives':''}`;
  $('changer').onclick=()=>{if(protegerBrouillon())choisirEquipe().catch(erreur);};
  $('envoyer').onclick=envoyer;
  afficher();
  serviceWorker().catch(erreur);
  if(session&&enLigne()){try{await rafraichir();}catch(e){erreur(e);}await envoyer();}
}
window.addEventListener('online',()=>{entete();rafraichir().then(envoyer).catch(erreur);if(onglet==='Gestion')gestion().catch(erreur);});
window.addEventListener('offline',()=>{entete();if(onglet==='Gestion')gestion().catch(erreur);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')chercherVersion();if(document.visibilityState==='visible'&&session){if(!jourCorrect()&&!accesBureau()&&!$('fiche')?.dataset.modifie)choisirEquipe().catch(erreur);if(enLigne())rafraichir().then(envoyer).catch(erreur);}});
setInterval(()=>{chercherVersion();if(!session)return;if(!jourCorrect()&&!accesBureau()&&!choixJour&&!$('fiche')?.dataset.modifie)choisirEquipe().catch(erreur);if(enLigne())(db.lire('recenses_jour').then(d=>d!==jour()?rafraichir():null).then(envoyer)).catch(erreur);},120000);
window.addEventListener('pagehide',arreterGPS);
window.addEventListener('beforeunload',e=>{if($('fiche')?.dataset.modifie){e.preventDefault();e.returnValue='';}});
demarrer().catch(e=>{erreur(e);if(!db)$('contenu').textContent='Le carnet local ne peut pas être ouvert. Autorisez le stockage dans ce navigateur, puis rechargez la page.';});
