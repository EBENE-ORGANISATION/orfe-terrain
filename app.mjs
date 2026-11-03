import {BOITE_URL,VERSION} from './config.js';
import {texte,chiffres,nifValide,dateLocale,nouvelId,CHOIX,validerFiche,proposerRue,couleurPrecision,accuser} from './metier.mjs';
import {ouvrirStockage} from './stockage.mjs';
import {ecouterGPS} from './gps.mjs';
import {poster,carteRues} from './transport.mjs';
import {cleAjout,ajouterAjout,etatAjout,indexerRecherche,lireConnus,chercher,miseAJour,distance,RESULTATS,resultatsVisibles,numeros,localisation,validerVisite,annulation,appliquerVisitesLocales,visitesActives,avertissementsCadenas,mesPoints,trajet,liensMaps,appliquerActions} from './tournee.mjs';
import {pointValide} from './metier.mjs';
import {resumeExtraction,milliers,nomExtraction,chargerOutils,creerExcel,creerPDF,telecharger} from './extraction.mjs';

const $=id=>document.getElementById(id);
const factice=new URL(location.href).searchParams.get('factice')==='1';
const echapper=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICONES={enveloppe:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',"liste":"<path d=\"M4 6h16M4 12h16M4 18h10\"/>","plus":"<path d=\"M12 5v14M5 12h14\"/>","loupe":"<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-4-4\"/>","extraire":"<path d=\"M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6\"/>","gestion":"<circle cx=\"9\" cy=\"7\" r=\"3\"/><path d=\"M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 2 4v3\"/>","coche":"<path d=\"m5 12 5 5 9-10\"/>","billet":"<rect x=\"3\" y=\"6\" width=\"18\" height=\"12\" rx=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>","calendrier":"<rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"2\"/><path d=\"M4 10h16M9 3v4M15 3v4\"/>","horloge":"<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 8v4l3 2\"/>","maison":"<path d=\"M4 20V9l8-5 8 5v11M9 20v-6h6v6\"/>","cadenas":"<rect x=\"5\" y=\"11\" width=\"14\" height=\"9\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0v3\"/>","interdit":"<circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M7 17 17 7\"/>","fleche":"<path d=\"M5 12h14m-6-6 6 6-6 6\"/>","question":"<path d=\"M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6V15M12 18v1\"/>","retour":"<path d=\"M4 12a8 8 0 1 0 3-6.2M4 4v4h4\"/>","ouvert":"<rect x=\"5\" y=\"11\" width=\"14\" height=\"9\" rx=\"2\"/><path d=\"M8 11V8a4 4 0 0 1 8 0\"/>"};
function icone(n){return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[n]||ICONES.liste}</svg>`;}
const ICONES_RESULTATS={FICHE_REMISE:'coche',ACTE_REMIS:'enveloppe',A_PAYE:'billet',PROMESSE:'calendrier',ABSENT:'horloge',TROUVEE_FERMEE:'maison',FERMETURE_OTR:'cadenas',REFUS:'interdit',DEMENAGE:'fleche',INTROUVABLE:'question',REPORTE:'retour',REOUVERTURE:'ouvert'};
const jour=()=>dateLocale().slice(0,10);
let db,session,equipe,recenses=[],fiches=[],onglet='Recensement',edition=null,point=null,gpsEnCours=null,proposition=null,rueSource='AGENT',rueOrigine='',envoi=false,sauvegarde=false,choixJour=false;
let brouillonId=nouvelId(),rafraichissement=null;
const rueCarte=carteRues();
let simuler,gpsFactice;
let ajoutsParCode={},ajouts=[];
let connus=[],indexRecherche=[],lotGarde={lot:[],pris:[],cadenas_poses:[]},actions=[],depart=null,ordre=[],veille=null,dernierePosition=0,visiteEnCours=null,actionsEnvoi=false;
function reindexer(){indexRecherche=indexerRecherche(recenses,connus,fiches.filter(f=>f.agent===session?.agent));}
async function garderCadenas(r){if(Array.isArray(r.cadenas_poses)){lotGarde={...lotGarde,cadenas_poses:r.cadenas_poses};await db.garder('lot',lotGarde);}}
function visitesLocales(){return fiches.filter(f=>f.type==='TOURNEE');}
function lotAffiche(){const r=appliquerActions(lotGarde.lot,lotGarde.pris,actions,session.agent,lotGarde.date_lot);r.lot=r.lot.map(f=>appliquerVisitesLocales(f,visitesLocales().filter(v=>v.nif===f.nif&&v.lot===lotGarde.date_lot)));return r;}
function arreterVeille(){if(veille!==null)(factice?gpsFactice:navigator.geolocation)?.clearWatch(veille);veille=null;}
function message(t){$('message').textContent=t;}
function erreur(e){message(e.name==='AbortError'?'La demande a pris trop de temps. Réessayez.':e.message||'Une erreur est survenue.');}
function enLigne(){return navigator.onLine;}
function droit(v){return v===true||v==='OUI';}
function reglage(n){const defauts={GPS_OBJECTIF_M:4,GPS_AFFINER_S:10,GPS_DUREE_S:45,GPS_SEUIL_M:15,DIST_CONFIRME_M:50,DIST_ARRIVE_M:50,MAPS_ETAPES:3};const v=Number(session?.reglages?.[n]??defauts[n]);if(!Number.isFinite(v)||v<=0)throw new Error(`Le réglage ${n} doit être fourni par la boîte.`);return v;}
function equipeActuelle(){return session?.equipes?.find(e=>e.nom===equipe?.nom);}
async function appel(action,donnees={}){
  const demande={action,code:session?.code,...donnees};
  // Le contrat impose aussi l’équipe du jour dans chaque demande de terrain.
  if(equipe?.nom&&!Object.prototype.hasOwnProperty.call(donnees,'equipe'))demande.equipe=equipe.nom;
  const r=factice?await simuler(demande):await poster(BOITE_URL,demande);
  if(r?.ok===false){
    if(r.raison==='CODE'){await db.garder('session',null);session=null;equipe=null;arreterGPS();arreterVeille();afficherConnexion();}
    throw new Error(r.raison==='CODE'?'Ce code n’est plus actif. Saisissez un nouveau code.':r.raison||'La demande a été refusée.');
  }
  return r;
}
function arreterGPS(){gpsEnCours?.stop();gpsEnCours=null;}
function compteur(){const n=fiches.filter(f=>!f.envoyee).length;$('compteur-texte').textContent=`${n} fiche${n===1?'':'s'} pas encore envoyée${n===1?'':'s'}`;}
function entete(){
  $('identite').innerHTML=session?`${echapper(session.agent)}<br>${echapper(equipe?.nom||'Équipe à choisir')}`:'';
  $('changer').hidden=!session||!equipe;$('envoyer').hidden=!session;
  $('reseau').textContent=enLigne()?'Réseau disponible':'Sans réseau';
  compteur();
}
function afficherConnexion(){
  $('onglets').replaceChildren();entete();
  $('contenu').innerHTML='<h1>Votre code d’accès</h1><p>Le code fourni par votre gestionnaire est gardé sur ce téléphone.</p><form id="connexion" class="carte"><label for="code">Code de 6 caractères</label><input id="code" name="code" maxlength="6" minlength="6" required autocomplete="off" autocapitalize="characters" spellcheck="false"><div class="actions"><button class="principal">Ouvrir mon carnet</button></div></form>'+(factice?'<p class="aide">Essai fictif : DEMO22 (gestionnaire) ou DEMO33 (agent).</p>':'');
  $('code').oninput=()=>{$('code').value=texte($('code').value).replace(/\s/g,'');};
  $('connexion').onsubmit=async e=>{e.preventDefault();const bouton=e.submitter;bouton.disabled=true;try{
    if(!enLigne())throw new Error('Il faut du réseau pour la première ouverture.');
    const code=$('code').value;const r=await appel('bonjour',{code});
    session={...r,code};await garderCadenas(r);await db.garder('session',session);await chargerFiches();await choisirEquipe();rafraichir().catch(erreur);
  }catch(e){erreur(e);}finally{bouton.disabled=false;}};
}
async function chargerFiches(){ajoutsParCode=await db.lire('ajouts')||{};ajouts=ajoutsParCode[session?.code]||[];fiches=await db.fiches();reindexer();compteur();}
function protegerBrouillon(){return !$('fiche')||!$('fiche').dataset.modifie||confirm('Quitter cette fiche sans enregistrer ?');}
async function choisirEquipe(){
  arreterGPS();arreterVeille();choixJour=true;entete();actualiserOnglets();
  $('contenu').innerHTML='<h1>Aujourd’hui, je suis dans :</h1><div id="equipes" class="equipes"></div><div id="acces-bureau" class="actions"></div>';
  for(const e of session.equipes||[]){const b=document.createElement('button');b.textContent=e.nom;b.onclick=async()=>{try{equipe={nom:e.nom,date:jour()};await db.garder('equipe',equipe);choixJour=false;onglet='Recensement';edition=null;afficher();await rafraichir();envoyer();}catch(e){erreur(e);}};$('equipes').append(b);}
  for(const [nom,autorise] of [['Gestion',session.peut_gerer],['Extraire',session.peut_extraire]]){if(!droit(autorise))continue;const b=document.createElement('button');b.textContent=nom;b.onclick=()=>{choixJour=false;onglet=nom;edition=null;afficher();};$('acces-bureau').append(b);}
  if(!session.equipes?.length)$('equipes').textContent='Aucune équipe active. Contactez le gestionnaire.';
}
function accesBureau(){return onglet==='Gestion'&&droit(session?.peut_gerer)||onglet==='Extraire'&&droit(session?.peut_extraire);}
function jourCorrect(){return equipe?.date===jour()&&!!equipeActuelle();}
function afficher(){
  if(!session)return afficherConnexion();
  if(!jourCorrect()&&!accesBureau())return choisirEquipe();
  entete();arreterGPS();arreterVeille();actualiserOnglets();
  if(onglet==='Recensement')afficherRecensement();
  else if(onglet==='Gestion')gestion().catch(erreur);
  else if(onglet==='Recherche')afficherRecherche();
  else if(onglet==='Tournée')afficherTournee();
  else if(onglet==='Extraire')afficherExtraction();
  else $('contenu').innerHTML=`<h1>${echapper(onglet)}</h1><p>Bientôt disponible.</p>`;
}
function actualiserOnglets(){
  $('onglets').replaceChildren();
  const onglets=[...(jourCorrect()&&!choixJour?['Tournée','Recensement','Recherche']:['Choisir l’équipe']),...(droit(session.peut_extraire)?['Extraire']:[]),...(droit(session.peut_gerer)?['Gestion']:[])];
  if(!onglets.includes(onglet))onglet='Recensement';
  for(const nom of onglets){const b=document.createElement('button');b.innerHTML=icone(({Tournée:'liste',Recensement:'plus',Recherche:'loupe',Extraire:'extraire',Gestion:'gestion'})[nom])+`<span>${echapper(({Recensement:'Recenser',Recherche:'Chercher'})[nom]||nom)}</span>`;if(nom===onglet&&!choixJour)b.setAttribute('aria-current','page');b.onclick=()=>{if(!protegerBrouillon())return;if(nom==='Choisir l’équipe'){choisirEquipe().catch(erreur);return;}edition=null;onglet=nom;afficher();};$('onglets').append(b);}
}
function champ(nom,titre,options={}){
  const valeur=options.valeur??'';
  const attributs=`id="${nom}" name="${nom}" ${options.obligatoire?'required':''}`;
  const select=options.choix;
  return `<div><label for="${nom}">${titre}</label>${select?`<select ${attributs}><option value="">Choisir…</option>${select.map(v=>`<option ${v===valeur?'selected':''}>${echapper(v)}</option>`).join('')}</select>`:options.aire?`<textarea ${attributs}>${echapper(valeur)}</textarea>`:`<input ${attributs} value="${echapper(valeur)}" ${options.chiffres?'inputmode="numeric"':''} ${options.suggestions?`list="${nom}-suggestions"`:''}>`}</div>`;
}
function afficherExtraction(){
  if(!droit(session?.peut_extraire))return;
  if(!enLigne()){$('contenu').innerHTML="<p>L'extraction demande internet.</p>";return;}
  $('contenu').innerHTML=`<section id="extraction"><h1>Extraire</h1><form id="choix-extraction" class="carte"><label for="ex-quoi">Extraire</label><select id="ex-quoi"><option value="RECENSEMENT">Recensement</option><option value="TOURNEE">Rapport de tournée</option></select><div class="grille"><div><label for="ex-du">Du</label><input id="ex-du" type="date" value="${jour()}" required></div><div><label for="ex-au">Au</label><input id="ex-au" type="date" value="${jour()}" required></div><div><label for="ex-equipe">Équipe</label><select id="ex-equipe"><option value="">Toutes</option>${(session.equipes||[]).map(e=>`<option value="${echapper(e.nom)}">${echapper(e.nom)}</option>`).join('')}</select></div><div><label for="ex-agent">Agent (contient)</label><input id="ex-agent"></div></div><div id="ex-rec"><label for="ex-rue">Rue ou immeuble</label><input id="ex-rue"><label><input id="ex-sans-nif" type="checkbox">Sans NIF seulement</label></div><div class="actions"><button class="principal" id="ex-preparer">Préparer</button></div></form><div id="ex-resultat" role="status" aria-live="polite"></div></section>`;
  const form=$('choix-extraction'),zone=$('ex-resultat');
  const vider=()=>zone.replaceChildren();
  form.oninput=vider;
  $('ex-quoi').onchange=()=>{$('ex-rec').hidden=$('ex-quoi').value!=='RECENSEMENT';vider();};
  form.onsubmit=async e=>{
    e.preventDefault();vider();
    if(!enLigne())return afficherExtraction();
    const p={quoi:$('ex-quoi').value,du:$('ex-du').value,au:$('ex-au').value,equipe:$('ex-equipe').value,agent:$('ex-agent').value};
    if(p.quoi==='RECENSEMENT')Object.assign(p,{rue:$('ex-rue').value,sans_nif:$('ex-sans-nif').checked});
    if(p.du>p.au){zone.textContent='La date Du doit précéder ou égaler la date Au.';return;}
    const bouton=$('ex-preparer');bouton.disabled=true;zone.textContent='Préparation en cours…';
    const saisie=JSON.stringify(p);
    const toujoursIci=()=>onglet==='Extraire'&&$('choix-extraction')===form&&enLigne();
    try{
      // Même le premier clic charge les scripts locaux ; aucun téléchargement au démarrage.
      const r=await appel('extraire',p);
      await chargerOutils();
      if(!toujoursIci())return;
      if(!r.lignes.length){zone.textContent='Aucune fiche pour ces choix.';return;}
      // Ne pas afficher un ancien résultat si les filtres ont changé pendant la demande.
      const actuels={quoi:$('ex-quoi').value,du:$('ex-du').value,au:$('ex-au').value,equipe:$('ex-equipe').value,agent:$('ex-agent').value};
      if(actuels.quoi==='RECENSEMENT')Object.assign(actuels,{rue:$('ex-rue').value,sans_nif:$('ex-sans-nif').checked});
      if(JSON.stringify(actuels)!==saisie){vider();return;}
      const resume=resumeExtraction(r.quoi,r.titres,r.lignes),quand=dateLocale();
      const fichiers=[['xlsx',creerExcel(r,resume)],['pdf',creerPDF(r,resume,{agent:session.agent,filtres:p,quand})]];
      zone.replaceChildren();const phrase=document.createElement('p');phrase.textContent=resume.phrase;zone.append(phrase);
      const liste=document.createElement('dl');for(const [t,n] of resume.chiffres){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=t;dd.textContent=milliers(n);liste.append(dt,dd);}zone.append(liste);
      const actions=document.createElement('div');actions.className='actions';zone.append(actions);
      for(const [extension,blob] of fichiers){const b=document.createElement('button');b.textContent=extension==='xlsx'?"Télécharger l’Excel":"Télécharger le PDF";b.onclick=()=>telecharger(blob,nomExtraction(r.quoi,r.du,r.au,extension));actions.append(b);}
      const partages=typeof File==='function'?fichiers.map(([ext,blob])=>new File([blob],nomExtraction(r.quoi,r.du,r.au,ext),{type:blob.type})):[];
      if(partages.length&&navigator.canShare?.({files:partages})){const b=document.createElement('button');b.textContent='Partager';b.onclick=async()=>{try{await navigator.share({files:partages});}catch(e){if(e.name!=='AbortError')erreur(e);}};actions.append(b);}
    }catch(e){if(toujoursIci())zone.textContent=e.message==='DROIT'?"Votre code n'a pas le droit d'extraire.":e.message;}
    finally{bouton.disabled=false;}
  };
}
function afficherRecensement(reprendre={}){
  const f=edition||reprendre;point=f.gps&&f.gps!=='AUCUN'?{lat:f.lat,lon:f.lon,precision:f.precision}:null;
  proposition=null;rueSource=f.rue_source||'AGENT';rueOrigine=f.rue||'';brouillonId=f.id||nouvelId();
  const niveauAutre=f.niveau&&!CHOIX.niveau.includes(f.niveau);
  $('contenu').innerHTML=`<h1>${edition?'Corriger la fiche':'Recenser une boutique'}</h1><p class="aide">Les champs marqués * sont nécessaires. Raison sociale ou responsable : au moins un des deux.</p><form id="fiche" novalidate><div class="carte"><div class="grille">${champ('immatricule','Immatriculé ? *',{choix:CHOIX.immatricule,valeur:f.immatricule,obligatoire:true})}${champ('nif','NIF',{valeur:f.nif,chiffres:true})}</div><p id="avertissement-nif" role="status"></p></div><div class="carte grille">${champ('raison','Raison sociale',{valeur:f.raison})}${champ('responsable','Nom du responsable',{valeur:f.responsable})}${champ('telephone','Téléphone',{valeur:f.telephone,chiffres:true})}</div><div class="carte">${champ('activite','Activité *',{valeur:f.activite,obligatoire:true,suggestions:true})}</div><datalist id="activite-suggestions"></datalist><section class="carte gps-tuile" aria-labelledby="titre-gps"><h2 id="titre-gps">Localisation</h2><p id="gps-etat" role="status"></p><button type="button" id="garder-gps" class="principal" disabled>Garder ce point</button><button type="button" id="reprendre-gps">Reprendre le GPS</button><div id="rue-proposee"></div><p class="aide">Suggestion cartographique : © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>.</p></section><div class="carte grille">${champ('rue','Rue *',{valeur:f.rue,obligatoire:true,suggestions:true})}${champ('immeuble','Immeuble',{valeur:f.immeuble})}${champ('niveau','Niveau',{choix:CHOIX.niveau,valeur:niveauAutre?'AUTRE':f.niveau})}${champ('niveau_autre','Précisez le niveau',{valeur:niveauAutre?f.niveau:''})}${champ('porte','Numéro de porte',{valeur:f.porte})}${champ('enseigne','Y a-t-il une enseigne ?',{choix:CHOIX.enseigne,valeur:f.enseigne})}</div><div class="carte">${champ('regime','Régime déclaré',{choix:CHOIX.regime,valeur:f.regime})}<datalist id="rue-suggestions"></datalist>${champ('observation','Observation',{valeur:f.observation,aire:true})}</div><div id="erreurs" role="alert" tabindex="-1"></div><div class="actions enregistrement"><button class="principal" id="enregistrer">Enregistrer la fiche</button>${edition?'<button type="button" id="annuler-edition">Annuler la correction</button>':''}</div></form><details id="mes-fiches"><summary>Mes fiches du jour</summary><div id="liste-fiches"></div></details>`;
  $('fiche').prepend($('titre-gps').closest('section'));
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
  el.innerHTML=`<span class="gps-metres"><strong>${Math.round(point.precision)}</strong><small>mètres</small></span><span><b>${point.precision<=seuil?'GPS correct':'GPS imprécis, conservé'}</b><br>${echapper(note)}</span>`;
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
  const liste=fiches.filter(f=>f.type==='RECENSEMENT'&&f.agent===session.agent&&f.date.slice(0,10)===jour()).sort((a,b)=>b.date.localeCompare(a.date));
  if(!liste.length)zone.textContent='Aucune fiche aujourd’hui.';
  for(const f of liste){const div=document.createElement('article');div.className='carte';const titre=document.createElement('strong');titre.textContent=f.raison||f.responsable;const p=document.createElement('p');p.textContent=`${f.date.slice(11,16)} · ${f.equipe} · ${f.rue} · ${f.envoyee?'envoyée':'en attente'}${f.refus?' · Refus : '+f.refus:''}`;div.append(titre,p);if(!f.envoyee){const b=document.createElement('button');b.textContent='Ouvrir et corriger';b.onclick=()=>{if(envoi){message('Attendez la fin de l’envoi.');return;}if(!protegerBrouillon())return;edition=f;arreterGPS();afficherRecensement();window.scrollTo(0,0);};div.append(b);}zone.append(div);}
}
async function envoyer(){
  if(!session||!enLigne()||envoi||sauvegarde||!jourCorrect())return;
  envoi=true;$('envoyer').disabled=true;
  try{
    await envoyerActions();
    await chargerFiches();const file=fiches.filter(f=>!f.envoyee&&f.agent===session.agent&&f.id!==edition?.id);if(!file.length)return;
    const r=await appel('envoyer',{fiches:file.map(({envoyee,refus,cle,...f})=>f)});
    // Le prochain lot reçu fera foi pour les résultats déjà acquittés, y compris
    // ceux d'un autre téléphone. Garder entre-temps l'état affiché hors ligne.
    lotGarde={...lotGarde,...lotAffiche()};await db.garder('lot',lotGarde);
    for(const f of accuser(file,r))await db.fiche(f);
    await chargerFiches();listeFiches();
    if(r.refuses?.length)message('Certaines fiches ont été refusées. Consultez « Mes fiches du jour ». Elles restent sur le téléphone.');
  }catch(e){erreur(e);}finally{envoi=false;$('envoyer').disabled=false;}
}
async function rafraichir(){
  if(!session||!enLigne())return;
  if(rafraichissement)return rafraichissement;
  rafraichissement=(async()=>{
    const ancien=session;const r=await appel('bonjour');session={...r,code:ancien.code};await garderCadenas(r);await db.garder('session',session);
    if(!jourCorrect()&&!accesBureau()&&!$('fiche')?.dataset.modifie)await choisirEquipe();else{
      entete();if(!choixJour){const avant=onglet;actualiserOnglets();if(avant!==onglet)afficher();}
    }
    const liste=await appel('recenses');recenses=Array.isArray(liste)?liste:liste.recenses;
    if(!Array.isArray(recenses))throw new Error('La liste des recensés reçue est illisible.');
    await db.garder('recenses',recenses);await db.garder('recenses_jour',jour());suggestions();
    if(await db.lire('connus_demande_jour')!==jour()){
      await db.garder('connus_demande_jour',jour());
      try{const r=await appel('connus',{version:await db.lire('connus_version')||''});if(!r.inchange){connus=lireConnus(r);await db.garder('connus',connus);}await db.garder('connus_version',r.version);}catch(e){erreur(e);}
    }
    reindexer();
    if(droit(equipeActuelle()?.fait_la_tournee)){const nouveau=await appel('lot');lotGarde=nouveau;await db.garder('lot',nouveau);}
    if(!$('fiche')?.dataset.modifie){if(onglet==='Recherche')afficherRecherche();if(onglet==='Tournée'&&!visiteEnCours)afficherTournee();}
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
function lienItineraire(f){return pointValide(f)?`<a class="bouton" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lon}&travelmode=walking">Itinéraire</a>`:'';}
function sourceFiche(f){const d=(f.date||'').slice(0,10).split('-');return `${f.source||'Application'}${d.length===3?`${f.source==='Application'?', ':', visite du '}${d[2]}/${d[1]}`:''}`;}
async function garderAjouts(liste){ajouts=liste;ajoutsParCode[session.code]=liste;await db.garder('ajouts',ajoutsParCode);}
function boutonAjout(f){
  const b=document.createElement('button'),deja=ajouts.some(a=>a.cle===cleAjout(f));b.type='button';b.className='ajouter-tournee';b.textContent=deja?'Dans ma tournée':'Ajouter à ma tournée';b.disabled=deja||!texte(f.raison)&&!texte(f.responsable);
  b.onclick=async()=>{try{
    if(droit(equipeActuelle()?.fait_la_tournee)&&chiffres(f.nif)&&lotAffiche().lot.some(l=>l.nif===chiffres(f.nif)&&l.etat!=='RETIRE')){message('Déjà dans le lot du jour : prenez-le dans le lot.');return;}
    await garderAjouts(ajouterAjout(ajouts,f));b.textContent='Dans ma tournée';b.disabled=true;message('Ajout enregistré dans votre tournée.');
  }catch(e){erreur(e);}};return b;
}
function afficherAjouts(){
  const zone=$('mes-ajouts');zone.replaceChildren();
  if(!ajouts.length)zone.textContent='Aucun ajout. Dans Chercher, touchez « Ajouter à ma tournée ».';
  for(const a of ajouts){const etat=etatAjout(a,visitesLocales(),session.agent),f={...a,...etat,origine:'LIBRE'},div=document.createElement('article');div.className='carte lot-tuile'+(etat.etat==='TERMINE'?' terminee':'');div.innerHTML=`<strong>${echapper(a.raison||a.responsable)}</strong><p class="sous">${echapper(a.rue)} · ${echapper(a.nif?'NIF '+a.nif:'sans NIF')}</p><p class="sous">${echapper(RESULTATS[etat.dernier_resultat]?.[0]||'À visiter')}</p><div class="actions"><button class="principal">Noter</button><button>Retirer</button></div>`;
    const [noter,retirer]=div.querySelectorAll('button');noter.onclick=()=>ouvrirVisite(f);retirer.onclick=async()=>{if(!confirm('Retirer cet ajout de votre tournée ?'))return;try{await garderAjouts(ajouts.filter(x=>x.cle!==a.cle));afficherTournee();}catch(e){erreur(e);}};zone.append(div);
  }
  $('retirer-termines').disabled=!ajouts.some(a=>etatAjout(a,visitesLocales(),session.agent).etat==='TERMINE');
  $('retirer-termines').onclick=async()=>{if(!confirm('Retirer les ajouts terminés ?'))return;try{await garderAjouts(ajouts.filter(a=>etatAjout(a,visitesLocales(),session.agent).etat!=='TERMINE'));afficherTournee();}catch(e){erreur(e);}};
}
function afficherRecherche(){
  visiteEnCours=null;
  const saisie=$('recherche')?.value||'';
  $('contenu').innerHTML='<h1>Chercher</h1><div class="carte"><label for="recherche">NIF, nom, téléphone, activité ou rue</label><input id="recherche" type="search" autocomplete="off"><p id="total-recherche" role="status"></p></div><div id="resultats-recherche"></div>';
  $('recherche').value=saisie;
  const rendre=()=>{const r=chercher(indexRecherche,$('recherche').value);$('total-recherche').textContent=`${r.total} résultat(s)${r.total>50?' · 50 affichés':''}`;const zone=$('resultats-recherche');zone.replaceChildren();for(const f of r.resultats){const b=document.createElement('button');b.className='carte resultat';b.innerHTML=`<span class="ligne-nom"><strong>${echapper(f.raison||f.responsable||f.nif)}</strong>${pointValide(depart)&&pointValide(f)?`<span class="distance">${Math.round(distance(depart,f))} m</span>`:''}</span><span class="sous">${echapper([f.rue,f.immeuble,f.niveau,f.porte].filter(Boolean).join(' · '))}</span><span class="sous">${echapper([f.nif&&'NIF '+f.nif,f.telephone].filter(Boolean).join(' · '))}</span><span class="source">${echapper(sourceFiche(f))}</span>`;b.onclick=()=>detailRecherche(f);const carte=document.createElement('article');carte.className='resultat-ajout';carte.append(b,boutonAjout(f));zone.append(carte);}};
  $('recherche').oninput=rendre;rendre();
  const geo=factice?gpsFactice:navigator.geolocation;
  if(geo){let id;const timer=setTimeout(()=>geo.clearWatch(id),10000);id=geo.watchPosition(p=>{const q={lat:p.coords.latitude,lon:p.coords.longitude};if(pointValide(q)){depart=q;if($('recherche'))rendre();geo.clearWatch(id);clearTimeout(timer);}},()=>{clearTimeout(timer);geo.clearWatch(id);},{enableHighAccuracy:false,maximumAge:0,timeout:10000});}
}
function detailRecherche(f){
  $('contenu').innerHTML=`<h1>${echapper(f.raison||f.responsable||f.nif)}</h1><p>${echapper(sourceFiche(f))}</p><dl class="carte">${['nif','responsable','telephone','activite','rue','immeuble','niveau','porte'].map(k=>`<dt>${({nif:'NIF',responsable:'Responsable',telephone:'Téléphone',activite:'Activité',rue:'Rue',immeuble:'Immeuble',niveau:'Niveau',porte:'Porte'})[k]}</dt><dd>${echapper(f[k])}</dd>`).join('')}</dl><div class="actions detail-actions">${lienItineraire(f)}<button id="mettre-a-jour" class="principal">Mettre à jour</button><button id="retour-recherche">Retour à la recherche</button></div>`;
  $('retour-recherche').onclick=afficherRecherche;document.querySelector('.detail-actions').prepend(boutonAjout(f));
  $('mettre-a-jour').onclick=()=>{edition=null;onglet='Recensement';arreterGPS();actualiserOnglets();afficherRecensement(miseAJour(f));$('fiche').dataset.modifie='oui';};
}
async function envoyerActions(){
  if(actionsEnvoi||!enLigne()||!session||!droit(equipeActuelle()?.fait_la_tournee))return;actionsEnvoi=true;
  try{while(true){const a=actions.find(a=>a.agent===session.agent);if(!a)break;await appel(a.action,{equipe:a.equipe,nifs:a.nifs});
    // Conserver l'effet local jusqu'au prochain téléchargement réussi.
    const local=appliquerActions(lotGarde.lot,lotGarde.pris,[a],session.agent,lotGarde.date_lot);lotGarde={...lotGarde,...local};await db.garder('lot',lotGarde);
    actions=actions.filter(x=>x.id!==a.id);await db.garder('actions',actions);
  }}finally{actionsEnvoi=false;}
}
async function actionLot(action){
  if(!jourCorrect()||!droit(equipeActuelle()?.fait_la_tournee))return;
  const nifs=[...document.querySelectorAll('input[name="selection-lot"]:checked')].map(n=>n.value);if(!nifs.length){message('Cochez au moins un contribuable.');return;}
  const r=lotAffiche(),autres=r.pris.filter(p=>nifs.includes(p.nif)&&p.agent!==session.agent);
  if(action==='prendre'&&autres.length&&!confirm(`Déjà pris par ${autres.map(p=>p.agent).join(', ')}. Prendre quand même ?`))return;
  if(action==='retirer'&&!confirm(`Retirer ${nifs.length} contribuable(s) de la liste ?`))return;
  const a={id:nouvelId(),action,nifs,equipe:equipe.nom,agent:session.agent,date:lotGarde.date_lot,heure:dateLocale()};
  actions.push(a);await db.garder('actions',actions);afficherTournee();message(enLigne()?'Sélection enregistrée.':'Sélection gardée sur ce téléphone, à envoyer.');
  try{await envoyerActions();if(enLigne())await rafraichir();}catch(e){erreur(e);}
}
function afficherTournee(){
  arreterGPS();arreterVeille();visiteEnCours=null;
  if(!jourCorrect())return;
  const avecLot=droit(equipeActuelle()?.fait_la_tournee);
  const {lot,pris}=avecLot?lotAffiche():{lot:[],pris:[]};
  $('contenu').innerHTML=`<h1>Tournée</h1><p>Lot du ${echapper(lotGarde.date_lot?lotGarde.date_lot.split('-').reverse().join('/'):'jour non encore téléchargé')}${lotGarde.date_lot&&lotGarde.date_lot!==jour()?' · Dernier lot conservé hors ligne':''}</p><p>${actions.filter(a=>a.agent===session.agent).length} action(s) à envoyer</p><div class="chiffres-lot"><div class="carte"><strong>${lot.filter(f=>f.etat!=='RETIRE').length}</strong><span>dans le lot</span></div><div class="carte active"><strong>${lot.filter(f=>f.etat!=='RETIRE'&&pris.some(p=>p.nif===f.nif&&p.agent===session.agent)).length}</strong><span>à moi</span></div><div class="carte"><strong>${visitesActives(visitesLocales()).filter(v=>v.agent===session.agent&&v.date.slice(0,10)===jour()).length}</strong><span>faits</span></div></div><div id="arrivee" role="status"></div><h2>Le lot du jour</h2><div id="liste-lot"></div><div class="actions"><button id="prendre" class="principal">Je prends</button><button id="lacher">Lâcher</button><button id="retirer">Retirer de la liste</button></div><h2>Mes ajouts</h2><div id="mes-ajouts"></div><button id="retirer-termines">Retirer les terminés</button><h2>Mon trajet</h2><button id="recalculer">Recalculer</button><div id="trajet"></div><h2>Résultats notés aujourd’hui</h2><div id="visites-jour"></div>`;
  for(const f of lot.filter(f=>f.etat!=='RETIRE')){const p=pris.find(p=>p.nif===f.nif),div=document.createElement('article');div.className='carte lot-tuile'+(p?(p.agent===session.agent?' active':' autre'):'');div.innerHTML=`<div class="ligne-nom"><label><input type="checkbox" name="selection-lot" value="${echapper(f.nif)}">${echapper(f.raison||f.responsable||f.nif)}</label>${p?.agent===session.agent?'<span class="a-moi">À MOI</span>':''}</div><p class="sous">${echapper(f.adresse||f.rue||'')}${f.attente_jours>=1?' · attend '+Number(f.attente_jours)+' jour(s)':''}</p><p class="sous">${echapper(RESULTATS[f.dernier_resultat]?.[0]||f.dernier_resultat||'À visiter')}</p>${p&&p.agent!==session.agent?`<p class="pris-autre">Pris par ${echapper(p.agent)}</p>`:''}<div class="lot-bas"><span class="rar">${echapper(Number(f.rar||0).toLocaleString('fr-FR'))} <small>FCFA</small></span><button class="principal">Noter</button></div>`;div.querySelector('button').onclick=()=>ouvrirVisite(f);$('liste-lot').append(div);}
  if(!lot.length)$('liste-lot').textContent='Aucun contribuable dans le lot conservé.';
  for(const a of ['prendre','lacher','retirer'])$(a).onclick=()=>actionLot(a).catch(erreur);
  $('recalculer').onclick=()=>recalculerTrajet().catch(erreur);
  for(const v of visitesActives(visitesLocales()).filter(v=>v.agent===session.agent&&v.date.slice(0,10)===jour())){const div=document.createElement('article');div.className='carte';div.textContent=`${v.raison||v.nif} · ${RESULTATS[v.resultat]?.[0]||v.resultat}${v.refus?' · Refus : '+v.refus:''} `;const b=document.createElement('button');b.textContent='Annuler ce résultat';b.onclick=async()=>{if(!confirm('Annuler ce résultat ?'))return;try{const f=annulation(v);await db.fiche(f);await chargerFiches();afficherTournee();envoyer();}catch(e){erreur(e);}};div.append(b);$('visites-jour').append(div);}
  if(!avecLot){
    const chiffres=document.querySelector('.chiffres-lot');chiffres.innerHTML=`<div class="carte"><strong>${ajouts.length}</strong><span>ajouts</span></div><div class="carte"><strong>${visitesActives(visitesLocales()).filter(v=>v.agent===session.agent&&v.date.slice(0,10)===jour()).length}</strong><span>faits</span></div>`;
    chiffres.classList.add('deux');
    $('liste-lot').previousElementSibling.remove();$('liste-lot').remove();$('prendre').parentElement.remove();
    for(const p of [...$('contenu').children].filter(e=>e.tagName==='P'))p.remove();
  }
  afficherAjouts();rendreTrajet();recalculerTrajet().catch(erreur);demarrerVeille();
}
function rendreTrajet(){
  if(!$('trajet'))return;const r=lotAffiche(),m=mesPoints(droit(equipeActuelle()?.fait_la_tournee)?r.lot:[],r.pris,session.agent,ajouts,visitesLocales());ordre=trajet(depart,m.points);
  $('trajet').innerHTML=`${!pointValide(depart)?'<p>Position actuelle nécessaire pour calculer le trajet.</p>':''}<ol>${ordre.map(f=>`<li>${echapper(f.raison||f.responsable||f.nif)}</li>`).join('')}</ol>${pointValide(depart)?liensMaps(depart,ordre,reglage('MAPS_ETAPES')).map((l,i)=>`<p><a class="bouton" href="${echapper(l)}" target="_blank" rel="noopener">Itinéraire · partie ${i+1}</a></p>`).join(''):''}<h3>À vérifier</h3>${m.aVerifier.map(f=>`<p>${echapper(f.raison||f.responsable||f.nif)} · GPS absent ou imprécis</p>`).join('')||'<p>Aucun.</p>'}`;
}
async function recalculerTrajet(){
  const geo=factice?gpsFactice:navigator.geolocation;if(!geo){depart=null;rendreTrajet();return;}
  const p=await new Promise(resolve=>{let id,fini=false;const terminer=p=>{if(fini)return;fini=true;clearTimeout(timer);geo.clearWatch(id);resolve(p);};const timer=setTimeout(()=>terminer(null),10000);id=geo.watchPosition(p=>terminer({lat:p.coords.latitude,lon:p.coords.longitude}),()=>terminer(null),{enableHighAccuracy:false,maximumAge:0,timeout:10000});});
  depart=p;if(onglet==='Tournée'&&!visiteEnCours)rendreTrajet();
}
function demarrerVeille(){
  const geo=factice?gpsFactice:navigator.geolocation;if(!geo)return;
  veille=geo.watchPosition(p=>{if(Date.now()-dernierePosition<30000)return;dernierePosition=Date.now();const q={lat:p.coords.latitude,lon:p.coords.longitude};if(!pointValide(q)||!$('arrivee'))return;const f=ordre.find(f=>distance(q,f)<reglage('DIST_ARRIVE_M'));$('arrivee').replaceChildren();if(f){const b=document.createElement('button');b.className='principal';b.textContent=`Arrivé chez ${f.raison||f.responsable||f.nif} ?`;b.onclick=()=>ouvrirVisite(f);$('arrivee').append(b);}},()=>{},{enableHighAccuracy:false,maximumAge:0,timeout:30000});
}
function ouvrirVisite(f){
  arreterGPS();arreterVeille();visiteEnCours=f;point=null;brouillonId=nouvelId();const id=brouillonId;
  $('contenu').innerHTML=`<button type="button" id="retour-lot" class="retour-lot">← Retour à la tournée</button><div class="carte"><h1>${echapper(f.raison||f.responsable||f.nif)}</h1><p>${echapper(f.adresse||f.rue||'')} · <b class="distance">${f.origine==='LIBRE'?'':echapper(Number(f.rar||0).toLocaleString('fr-FR'))+' FCFA'}</b></p></div><form id="fiche" novalidate><h2>Résultat de la visite</h2><div id="boutons-resultats" class="actions"></div><input type="hidden" id="resultat" name="resultat"><div id="champs-visite" class="carte"></div><section class="carte gps-tuile"><h2>GPS sur place</h2><p id="gps-etat" role="status"></p><button type="button" class="principal" id="garder-gps" disabled>Garder ce point</button><button type="button" id="reprendre-gps">Reprendre le GPS</button></section><div id="erreurs" role="alert" tabindex="-1"></div><div class="actions enregistrement"><button class="principal" id="enregistrer-visite">Enregistrer le résultat</button></div></form>`;
  $('fiche').oninput=()=>{$('fiche').dataset.modifie='oui';};
  for(const code of resultatsVisibles(session.reglages||{})){const b=document.createElement('button');b.type='button';b.innerHTML=icone(ICONES_RESULTATS[code])+`<span>${echapper(RESULTATS[code][0])}</span>`;b.setAttribute('aria-pressed','false');b.onclick=()=>{const precedent=$('resultat').value;if(precedent&&precedent!==code&&!confirm('Changer le résultat et effacer ses champs ?'))return;$('resultat').value=code;$('fiche').dataset.modifie='oui';for(const x of $('boutons-resultats').children){x.classList.toggle('principal',x===b);x.setAttribute('aria-pressed',String(x===b));}$('champs-visite').innerHTML=(['FICHE_REMISE','ACTE_REMIS'].includes(code)?champ('remise_a','Remise à *',{choix:['RESPONSABLE','EMPLOYE','AUTRE']}):'')+(code==='ACTE_REMIS'?'<h3>Acte remis</h3><fieldset><legend>Actes remis *</legend>'+[['AMR','AMR'],['MED','Mise en demeure'],['INVITATION','Invitation'],['AVIS','Avis'],['AUTRE','Autre']].map(([v,l])=>`<label><input type="checkbox" name="actes" value="${v}">${l}</label>`).join('')+'</fieldset>'+champ('acte_autre','Précisez si Autre'):'')+(code==='A_PAYE'?champ('montant','Montant FCFA (facultatif)',{chiffres:true}):'')+(code==='PROMESSE'?'<label for="date_promise">Date promise *</label><input id="date_promise" name="date_promise" type="date">':'')+(['FERMETURE_OTR','REOUVERTURE'].includes(code)?champ('cadenas','Numéros de cadenas, séparés par ;',{aire:true}):'')+(code==='DEMENAGE'?champ('adresse','Nouvelle adresse (facultatif)'):'')+champ('observation',`Observation${['REFUS','INTROUVABLE'].includes(code)?' *':''}`,{aire:true});};$('boutons-resultats').append(b);}
  const gps=async()=>{arreterGPS();point=null;afficherPoint();const t=ecouterGPS({...(factice?{geolocalisation:gpsFactice}:{}),objectif:reglage('GPS_OBJECTIF_M'),affiner:reglage('GPS_AFFINER_S'),duree:reglage('GPS_DUREE_S'),surMesure:(p,note)=>{if(id===brouillonId&&visiteEnCours){point=p;afficherPoint(note);}}});gpsEnCours=t;const r=await t.promesse;if(gpsEnCours!==t)return;gpsEnCours=null;point=r.point;afficherPoint(r.raison);};
  $('garder-gps').onclick=()=>gpsEnCours?.stop();$('reprendre-gps').onclick=()=>gps().catch(erreur);$('retour-lot').onclick=()=>{if(protegerBrouillon())afficherTournee();};
  $('fiche').onsubmit=async e=>{e.preventDefault();if(sauvegarde||envoi)return;if(!jourCorrect()||(f.origine!=='LIBRE'&&!droit(equipeActuelle()?.fait_la_tournee))){message('Choisissez une équipe autorisée pour cette journée.');return;}arreterGPS();
    const valeurs=Object.fromEntries(new FormData($('fiche'))),v={};for(const [k,x]of Object.entries(valeurs))v[k]=texte(x);
    Object.assign(v,{id,type:'TOURNEE',date:dateLocale(),agent:session.agent,equipe:equipe.nom,cle:f.cle,nif:f.nif||'',raison:f.raison||f.responsable||'',origine:f.origine==='LIBRE'?'LIBRE':'LOT',fiche_id:f.fiche_id||'',lot:f.origine==='LIBRE'?'':lotGarde.date_lot,actes:new FormData($('fiche')).getAll('actes'),cadenas:numeros(v.cadenas),gps:point?(point.precision<=reglage('GPS_SEUIL_M')?'BON':'IMPRECIS'):'AUCUN'});
    if(v.montant!=='')v.montant=v.montant==null?'':Number(v.montant);if(point)Object.assign(v,{lat:Number(point.lat.toFixed(7)),lon:Number(point.lon.toFixed(7)),precision:Math.round(point.precision)});
    const erreurs=validerVisite(v);if(erreurs.length){$('erreurs').textContent=erreurs.join('\n');$('erreurs').focus();return;}
    let loc=localisation(v.resultat,f,point,undefined,reglage('DIST_CONFIRME_M'));if(loc===null)loc=localisation(v.resultat,f,point,confirm('Le contribuable est-il bien ici ?'),reglage('DIST_CONFIRME_M'));v.localisation=loc;
    if(v.resultat==='FERMETURE_OTR'){const avertissements=avertissementsCadenas(v.cadenas,v.nif,lotGarde.cadenas_poses||[],visitesLocales());for(const p of avertissements)if(!confirm(`Le cadenas n° ${p.numero} est déjà posé chez ${p.raison||p.nif} depuis le ${(p.pose_le||'').slice(0,10).split('-').reverse().join('/')}. Continuer ?`))return;}
    sauvegarde=true;$('enregistrer-visite').disabled=true;try{await db.fiche({...v,envoyee:false});await chargerFiches();afficherTournee();message('Résultat enregistré sur ce téléphone.');}catch(e){erreur(e);if($('enregistrer-visite'))$('enregistrer-visite').disabled=false;}finally{sauvegarde=false;}envoyer();
  };gps().catch(erreur);
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
  if(reg.waiting){appliquerVersion();}
  reg.addEventListener('updatefound',()=>{const neuf=reg.installing;neuf?.addEventListener('statechange',()=>{if(neuf.state==='installed')appliquerVersion();});});
  navigator.serviceWorker.addEventListener('message',e=>{if(e.data==='NOUVELLE_VERSION')message('Nouvelle version installée');});
  const ancienne=await db.lire('version');if(ancienne&&ancienne!==VERSION)message('Nouvelle version installée');await db.garder('version',VERSION);
}
async function demarrer(){
  if(factice){document.body.classList.add('factice');({repondre:simuler,gpsFactice}=await import('../essais/telephone/boite-factice.js'));}
  db=await ouvrirStockage(factice,new URL(location.href).searchParams.get('carnet')||'');session=await db.lire('session');equipe=await db.lire('equipe');recenses=await db.lire('recenses')||[];connus=await db.lire('connus')||[];lotGarde=await db.lire('lot')||lotGarde;actions=await db.lire('actions')||[];await chargerFiches();
  $('version').textContent=`v${VERSION}${factice?' · Données fictives':''}`;
  $('changer').onclick=()=>{if(protegerBrouillon())choisirEquipe().catch(erreur);};
  $('envoyer').onclick=envoyer;
  afficher();
  serviceWorker().catch(erreur);
  if(session&&enLigne()){try{await rafraichir();}catch(e){erreur(e);}await envoyer();}
}
window.addEventListener('online',()=>{entete();rafraichir().then(envoyer).catch(erreur);if(onglet==='Gestion')gestion().catch(erreur);if(onglet==='Extraire')afficherExtraction();});
window.addEventListener('offline',()=>{entete();if(onglet==='Gestion')gestion().catch(erreur);if(onglet==='Extraire')afficherExtraction();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')chercherVersion();if(document.visibilityState==='visible'&&session){if(!jourCorrect()&&!accesBureau()&&!$('fiche')?.dataset.modifie)choisirEquipe().catch(erreur);if(enLigne())rafraichir().then(envoyer).catch(erreur);}});
setInterval(()=>{chercherVersion();if(!session)return;if(!jourCorrect()&&!accesBureau()&&!choixJour&&!$('fiche')?.dataset.modifie)choisirEquipe().catch(erreur);if(enLigne())rafraichir().then(envoyer).catch(erreur);},120000);
window.addEventListener('pagehide',()=>{arreterGPS();arreterVeille();});
window.addEventListener('beforeunload',e=>{if($('fiche')?.dataset.modifie){e.preventDefault();e.returnValue='';}});
demarrer().catch(e=>{erreur(e);if(!db)$('contenu').textContent='Le carnet local ne peut pas être ouvert. Autorisez le stockage dans ce navigateur, puis rechargez la page.';});
