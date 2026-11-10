import {texte,chiffres,nouvelId,dateLocale,distance,pointValide} from './metier.mjs';
export {distance};
const dernier=liste=>liste[liste.length-1];
export const normaliser=v=>texte(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const colonnes=['nif','raison','responsable','telephone','activite','rue','immeuble','niveau','porte','lat','lon','date','source'];
export function lireConnus(reponse){return (reponse.lignes||[]).map(l=>Object.fromEntries(colonnes.map((k,i)=>[k,['lat','lon'].includes(k)?(l[i]===''||l[i]==null?'':Number(l[i])):l[i]||''])));}
export function indexerRecherche(recenses,connus,locales=[]){
  const vus=new Set();
  return [...recenses.map(f=>({...f,source:'Application'})),...connus,...locales.filter(f=>f.type==='RECENSEMENT'&&!f.envoyee).map(f=>({...f,source:'Application'}))].filter(f=>{const cle=f.id&&`${f.source}|${f.id}`;if(cle&&vus.has(cle))return false;if(cle)vus.add(cle);return true;}).map(f=>({fiche:f,texte:normaliser(['nif','raison','responsable','activite','rue','immeuble'].map(k=>f[k]||'').join(' '))+' '+chiffres(f.telephone)}));
}
export function chercher(index,requete){const mots=normaliser(requete).split(/\s+/).filter(Boolean).map(m=>/^[\d()+.-]+$/.test(m)?chiffres(m):m).filter(Boolean),resultats=[];let total=0;for(const x of index)if(mots.every(m=>x.texte.includes(m))){total++;if(resultats.length<50)resultats.push(x.fiche);}return {total,resultats};}
export function miseAJour(f,id=nouvelId()) {const r={id,type:'RECENSEMENT',gps:'AUCUN',immatricule:chiffres(f.nif)?'OUI':'NE SAIT PAS'};for(const k of ['nif','raison','responsable','telephone','activite','rue','immeuble','niveau','porte'])r[k]=f[k]||'';return r;}
export const RESULTATS={FICHE_REMISE:['Fiche remise',true,true],ACTE_REMIS:['Acte remis',true,true],A_PAYE:['A payé (preuve vue)',true,true],PROMESSE:['Promesse de paiement',true,true],ABSENT:['Absent, à repasser',false,false],TROUVEE_FERMEE:['Trouvée fermée',false,false],FERMETURE_OTR:['Fermeture par l’OTR',true,true],REFUS:['Refus de recevoir',true,true],DEMENAGE:['A déménagé',true,false],INTROUVABLE:['Introuvable',true,false],REPORTE:['Reporté',false,false],REOUVERTURE:['Réouverture',false,false]};
export const SANS_GPS=['INTROUVABLE','DEMENAGE','REPORTE'];
export const resultatsVisibles=r=>Object.keys(RESULTATS).filter(k=>k!=='REOUVERTURE'||r.REOUVERTURE_VISIBLE==='OUI');
export const numeros=v=>[...new Set((Array.isArray(v)?v:String(v||'').split(/[;,\n]/)).map(n=>texte(n).replace(/\s/g,'')).filter(Boolean))];
export function localisation(resultat,connu,point,reponse,seuil=50){if(!RESULTATS[resultat]?.[2]||!pointValide(point))return '';if(!pointValide(connu))return 'NOUVELLE';if(distance(connu,point)<=seuil)return 'CONFIRMEE';return reponse===true?'CORRIGEE':reponse===false?'NON':null;}
export function validerVisite(f){const e=[];for(const k of ['id','date','agent','equipe',...(f.origine==='LIBRE'?[]:['nif','lot'])])if(!f[k])e.push(`Renseignez ${k}.`);if(!RESULTATS[f.resultat])e.push('Résultat inconnu.');if(f.type!=='TOURNEE')e.push('Type incorrect.');if(f.annule==='OUI'){if(!f.annule_id)e.push('Visite à annuler manquante.');return e;}
  if(['FICHE_REMISE','ACTE_REMIS'].includes(f.resultat)&&!['RESPONSABLE','EMPLOYE','AUTRE'].includes(f.remise_a))e.push('Choisissez à qui la fiche est remise.');
  if(f.origine==='LIBRE'&&(f.lot!==''||!/^\d*$/.test(f.nif||'')))e.push('Lot ou NIF invalide.');
  if(f.origine==='LIBRE'&&!f.nif&&!texte(f.raison))e.push('Raison sociale obligatoire sans NIF');
  if(f.resultat==='ACTE_REMIS'){
    if(!Array.isArray(f.actes)||!f.actes.length||f.actes.some(a=>!['AMR','MED','INVITATION','AVIS','AUTRE'].includes(a)))e.push('Acte obligatoire');
    if(f.actes?.includes('AUTRE')&&!texte(f.acte_autre))e.push("Précisez l'acte");
  }
  if(f.resultat==='PROMESSE'&&!/^\d{4}-\d{2}-\d{2}$/.test(f.date_promise||''))e.push('Renseignez la date promise.');
  if(f.resultat==='FERMETURE_OTR'&&!numeros(f.cadenas).length)e.push('Renseignez les cadenas.');
  if(['REFUS','INTROUVABLE'].includes(f.resultat)&&!texte(f.observation))e.push('Renseignez l’observation.');
  if(f.montant!==''&&f.montant!=null&&(!Number.isInteger(Number(f.montant))||Number(f.montant)<0))e.push('Le montant doit être un entier positif.');
  if(!['AUCUN','BON','IMPRECIS'].includes(f.gps)||f.gps!=='AUCUN'&&(!pointValide(f)||!Number.isFinite(f.precision)||f.precision<0))e.push('GPS incorrect.');return e;}
export function annulation(f,id=nouvelId(),date=dateLocale()){return {...f,id,date,annule:'OUI',annule_id:f.id,gps:'AUCUN',lat:'',lon:'',precision:'',localisation:'',envoyee:false,envoyee_le:undefined,refus:''};}
export function visitesActives(visites){const annules=new Set(visites.filter(v=>v.annule==='OUI').map(v=>v.annule_id));return visites.filter(v=>v.annule!=='OUI'&&!annules.has(v.id)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));}
// Les dates de réception et d'envoi sont des ISO UTC avec millisecondes.
export function noteAujourdhui(ligne,lotGarde,visitesLocales,jour){
  const ids=new Set(lotGarde.jour_visites===jour?(ligne.visites_jour||[]):[]);
  const ancienneBoite=!Array.isArray(ligne.visites_jour);
  const recentes=visitesLocales.filter(v=>v.type==='TOURNEE'&&v.origine!=='LIBRE'&&v.nif===ligne.nif&&(ancienneBoite||!v.envoyee||!v.envoyee_le||!lotGarde.recu_le||v.envoyee_le>lotGarde.recu_le));
  for(const v of recentes)if(v.annule!=='OUI'&&v.date?.slice(0,10)===jour)ids.add(v.id);
  for(const v of recentes)if(v.annule==='OUI')ids.delete(v.annule_id);
  return ids.size>0;
}
export function etatVisites(visites){const actives=visitesActives(visites),v=dernier(actives);return {etat:actives.some(v=>RESULTATS[v.resultat]?.[1])?'TERMINE':'A_VISITER',dernier_resultat:v?.resultat||''};}
export function appliquerVisitesLocales(ligne,visites){
  const attente=visites.filter(v=>!v.envoyee);if(!attente.length)return ligne;
  const etat=etatVisites(visites);
  if(ligne.etat==='TERMINE'&&!attente.some(v=>v.annule==='OUI'))etat.etat='TERMINE';
  if(ligne.etat==='RETIRE')etat.etat='RETIRE';
  const imprecis=visitesActives(visites).some(v=>v.gps==='IMPRECIS'&&['NOUVELLE','CONFIRMEE','CORRIGEE'].includes(v.localisation));
  return {...ligne,...etat,...(imprecis?{gps:'IMPRECIS'}:{})};
}
export function avertissementsCadenas(cadenas,nif,poses,visites=[]){
  const etats=new Map();
  for(const p of poses){const numero=numeros([p.numero])[0];etats.set(numero,{...p,numero});}
  // Une annulation locale retire aussi la pose déjà connue de la boîte.
  const annules=new Set(visites.filter(v=>v.annule==='OUI').map(v=>v.annule_id));
  for(const v of visites.filter(v=>annules.has(v.id)&&v.resultat==='FERMETURE_OTR'))for(const n of numeros(v.cadenas)){const p=etats.get(n);if(p?.nif===v.nif&&p.pose_le===v.date)etats.delete(n);}
  for(const v of visitesActives(visites))for(const numero of numeros(v.cadenas)){
    const ancien=etats.get(numero);if(ancien&&ancien.pose_le>v.date)continue;
    if(v.resultat==='FERMETURE_OTR')etats.set(numero,{numero,nif:v.nif,raison:v.raison||v.nif,pose_le:v.date});
    if(v.resultat==='REOUVERTURE')etats.delete(numero);
  }
  return numeros(cadenas).flatMap(n=>{const p=etats.get(n);return p&&(p.nif!==nif||!nif)?[p]:[];});
}
export function longueur(depart,points){let total=0,p=depart;for(const q of points){total+=distance(p,q);p=q;}return total;}
export function trajet(depart,points){
  if(!pointValide(depart))return [];
  // Plusieurs départs gloutons évitent les mauvais premiers choix, puis 2-opt ouvert.
  let meilleur=[],cout=Infinity;
  const debuts=[...points].sort((a,b)=>distance(depart,a)-distance(depart,b)).slice(0,8);
  for(const premier of debuts){const reste=points.filter(p=>p!==premier),ordre=[premier];while(reste.length){const p=dernier(ordre);let i=0;for(let j=1;j<reste.length;j++)if(distance(p,reste[j])<distance(p,reste[i]))i=j;ordre.push(...reste.splice(i,1));}
    let change=true;while(change){change=false;for(let i=0;i<ordre.length;i++)for(let j=i+1;j<ordre.length;j++){const avant=i?ordre[i-1]:depart,apres=ordre[j+1];const gain=distance(avant,ordre[i])+(apres?distance(ordre[j],apres):0)-distance(avant,ordre[j])-(apres?distance(ordre[i],apres):0);if(gain>0.001){ordre.splice(i,j-i+1,...ordre.slice(i,j+1).reverse());change=true;}}}
    const c=longueur(depart,ordre);if(c<cout){meilleur=ordre;cout=c;}
  }return meilleur;
}
export function mesPoints(lot,pris,agent,ajouts=[],visites=[],lotGarde={},jour=dateLocale().slice(0,10)){const miens=new Set(pris.filter(p=>p.agent===agent).map(p=>p.nif));const liste=[...lot.filter(f=>miens.has(f.nif)&&!['TERMINE','RETIRE'].includes(f.etat)&&!noteAujourdhui(f,lotGarde,visites,jour)),...ajouts.map(f=>({...f,...etatAjout(f,visites,agent,jour),origine:'LIBRE'})).filter(f=>!f.cache)];return {points:liste.filter(f=>pointValide(f)&&f.gps!=='IMPRECIS'),aVerifier:liste.filter(f=>!pointValide(f)||f.gps==='IMPRECIS')};}
export function liensMaps(depart,points,etapes=3){const taille=Math.min(3,Math.max(0,Math.floor(Number(etapes)||0)))+1,liens=[];let origine=depart;const coord=p=>`${+Number(p.lat).toFixed(7)},${+Number(p.lon).toFixed(7)}`;for(let i=0;i<points.length;i+=taille){const partie=points.slice(i,i+taille),fin=dernier(partie);liens.push(`https://www.google.com/maps/dir/?api=1&origin=${coord(origine)}&destination=${coord(fin)}&waypoints=${partie.slice(0,-1).map(coord).join('|')}&travelmode=walking`);origine=fin;}return liens;}
export function appliquerActions(lot,pris,actions,agent,date){lot=lot.map(f=>({...f}));pris=pris.map(p=>({...p}));for(const a of actions.filter(a=>a.date===date)){for(const nif of a.nifs){if(a.action==='retirer'){const f=lot.find(f=>f.nif===nif);if(f)f.etat='RETIRE';}else{pris=pris.filter(p=>p.nif!==nif);if(a.action==='prendre')pris.push({nif,equipe:a.equipe,agent:a.agent||agent,heure:a.heure});}}}return {lot,pris};}

export function cleAjout(f){return chiffres(f.nif)?'N:'+chiffres(f.nif):(f.fiche_id||f.id)?'F:'+(f.fiche_id||f.id):'R:'+texte(f.raison||f.responsable)+'|'+texte(f.rue);}
export function ajouterAjout(ajouts,f,quand=dateLocale()){
  if(!texte(f.raison)&&!texte(f.responsable))return ajouts;
  const cle=cleAjout(f);if(ajouts.some(a=>a.cle===cle))return ajouts;
  const a={cle,nif:chiffres(f.nif),fiche_id:f.fiche_id||f.id||'',ajoute_le:quand};
  for(const k of ['raison','responsable','telephone','activite','rue'])a[k]=texte(f[k]);
  for(const k of ['lat','lon'])a[k]=f[k]??'';
  if(f.gps)a.gps=f.gps;
  return [...ajouts,a];
}
export function etatAjout(ajout,visites,agent,jour=dateLocale().slice(0,10)){
  const actives=visitesActives(visites.filter(v=>v.origine==='LIBRE'&&v.agent===agent&&(v.cle||cleAjout({...v,id:undefined}))===ajout.cle));
  const v=dernier(actives);return {cache:!!RESULTATS[v?.resultat]?.[1]||actives.some(v=>v.date.slice(0,10)===jour),etat:RESULTATS[v?.resultat]?.[1]?'TERMINE':'A_VISITER',dernier_resultat:v?.resultat||'',...(v?.gps==='IMPRECIS'?{gps:'IMPRECIS'}:{})};
}
