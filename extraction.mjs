import {RESULTATS,numeros,normaliser} from './tournee.mjs';

export const TITRES_REC='DATE;EQUIPE;AGENT;NIF;RAISON SOCIALE;NOM DU RESPONSABLE;TELEPHONE;ACTIVITE;RUE;IMMEUBLE;NIVEAU;NUMERO DE PORTE;ENSEIGNE;REGIME FISCAL;IMMATRICULE ?;ACTION;LATITUDE;LONGITUDE;PRECISION GPS (M);GPS;OBSERVATION'.split(';');
export const TITRES_TOUR='DATE;EQUIPE;AGENT;NIF;RAISON SOCIALE;ORIGINE;RESULTAT;REMISE A;ACTE;MONTANT;DATE PROMISE;CADENAS;NOUVELLE ADRESSE;OBSERVATION;LOCALISATION;GPS;LATITUDE;LONGITUDE'.split(';');
const libelle=v=>normaliser(v).replace(/[’]/g,"'");
const nombre=v=>v!==''&&v!=null&&Number.isFinite(Number(v));
const formes={FICHE_REMISE:['fiche remise','fiches remises'],ACTE_REMIS:['acte remis','actes remis'],A_PAYE:['paiement déclaré','paiements déclarés'],PROMESSE:['promesse','promesses'],ABSENT:['absent','absents'],TROUVEE_FERMEE:['boutique trouvée fermée','boutiques trouvées fermées'],FERMETURE_OTR:['fermeture','fermetures'],REFUS:['refus','refus'],DEMENAGE:['déménagement','déménagements'],INTROUVABLE:['introuvable','introuvables'],REPORTE:['report','reports'],REOUVERTURE:['réouverture','réouvertures']};
// 1050000 -> « 1 050 000 », avec une espace ordinaire (Helvetica n'a pas l'espace fine).
export const milliers=n=>typeof n==='number'?String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,' '):n;
export function resumeExtraction(quoi,titres,lignes){
  const lire=(r,t)=>r[titres.indexOf(t)]??'';
  const par=t=>{const compte=new Map();for(const r of lignes){const n=String(lire(r,t));compte.set(n,(compte.get(n)||0)+1);}return [...compte].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'fr'));};
  const resume={total:lignes.length,par_equipe:par('EQUIPE'),par_agent:par('AGENT'),chiffres:[]};
  const ajouter=(t,n)=>resume.chiffres.push([t,n]);
  if(quoi==='RECENSEMENT'){
    resume.sans_nif=lignes.filter(r=>!String(lire(r,'NIF')).trim()).length;
    resume.gps=Object.fromEntries(['BON','IMPRECIS','AUCUN'].map(g=>[g,lignes.filter(r=>lire(r,'GPS')===g).length]));
    resume.phrase=`${resume.total} fiche${resume.total===1?'':'s'} de recensement`;
    ajouter('Total des fiches',resume.total);
    for(const [n,c] of resume.par_equipe)ajouter(`Équipe : ${n}`,c);
    for(const [n,c] of resume.par_agent)ajouter(`Agent : ${n}`,c);
    ajouter('Sans NIF',resume.sans_nif);
    for(const [n,c] of Object.entries(resume.gps))ajouter(`GPS ${n}`,c);
  }else{
    resume.par_origine=par('ORIGINE');for(const [n,c] of resume.par_origine)ajouter(`Origine : ${n||'Lot'}`,c);
    resume.par_resultat=[];const morceaux=[];
    for(const [code,[titre]] of Object.entries(RESULTATS)){
      const rs=lignes.filter(r=>libelle(lire(r,'RESULTAT'))===libelle(titre));
      if(!rs.length)continue;
      resume.par_resultat.push([titre,rs.length]);ajouter(titre,rs.length);
      let phrase=`${rs.length} ${formes[code][rs.length===1?0:1]}`;
      if(code==='FERMETURE_OTR'){resume.cadenas=numeros(rs.flatMap(r=>numeros(lire(r,'CADENAS'))));if(resume.cadenas.length)phrase+=` (cadenas n° ${resume.cadenas.join(', ')})`;}
      morceaux.push(phrase);
    }
    resume.phrase=`${resume.total} visité${resume.total===1?'':'s'}${morceaux.length?' : '+morceaux.join(', '):''}`;
    resume.chiffres.unshift(['Nombre de visites',resume.total]);
    for(const [n,c] of resume.par_agent)ajouter(`Agent : ${n}`,c);
    const payes=lignes.filter(r=>libelle(lire(r,'RESULTAT'))===libelle(RESULTATS.A_PAYE[0])&&nombre(lire(r,'MONTANT')));
    resume.montant=payes.length?payes.reduce((n,r)=>n+Number(lire(r,'MONTANT')),0):null;
    if(resume.montant!==null)ajouter('Montant déclaré payé (FCFA)',resume.montant);
    resume.promesses=lignes.filter(r=>libelle(lire(r,'RESULTAT'))===libelle(RESULTATS.PROMESSE[0])).length;
    ajouter('Nombre de promesses',resume.promesses);
  }
  return resume;
}
export function nomExtraction(quoi,du,au,extension){return `${quoi} du ${du}${du===au?'':` au ${au}`}.${extension}`;}

// Une promesse par bibliothèque : pas de double chargement, nouvel essai possible après erreur.
const chargements=new Map();
export async function chargerOutils(document=globalThis.document){
  for(const nom of ['xlsx.full.min.js','jspdf.umd.min.js','jspdf.plugin.autotable.min.js']){
    if(!chargements.has(nom))chargements.set(nom,new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src=`./lib/${nom}`;
      s.onload=resolve;s.onerror=()=>{s.remove();chargements.delete(nom);reject(new Error('Impossible de charger les outils d’extraction. Réessayez.'));};document.head.append(s);
    }));
    await chargements.get(nom);
  }
}
export function creerExcel(extraction,resume,XLSX=globalThis.XLSX){
  const {quoi,titres,lignes}=extraction;
  const donnees=lignes.map(r=>titres.map((t,i)=>{
    const v=r[i]??'';
    if(['NIF','TELEPHONE'].includes(t))return String(v);
    return ['LATITUDE','LONGITUDE','PRECISION GPS (M)','MONTANT'].includes(t)&&nombre(v)?Number(v):v;
  }));
  const feuille=XLSX.utils.aoa_to_sheet([titres,...donnees]);
  feuille['!cols']=titres.map(t=>({wch:['OBSERVATION','RAISON SOCIALE','RUE','IMMEUBLE','NOUVELLE ADRESSE'].includes(t)?30:t==='DATE'?18:20}));
  titres.forEach((_,i)=>{feuille[XLSX.utils.encode_cell({r:0,c:i})].s={font:{bold:true}};});
  const livre=XLSX.utils.book_new();XLSX.utils.book_append_sheet(livre,feuille,quoi);
  return new Blob([XLSX.write(livre,{bookType:'xlsx',type:'array'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export const textePDF=v=>String(v??'').replace(/[’‘]/g,"'").replace(/[«»“”]/g,'"').replace(/…/g,'...').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
const dateFR=v=>v.slice(0,10).split('-').reverse().join('/');
export function creerPDF(extraction,resume,{agent,filtres={},quand},JsPDF=globalThis.jspdf.jsPDF){
  const {quoi,du,au,titres,lignes}=extraction,rec=quoi==='RECENSEMENT';
  const doc=new JsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  doc.setFont('helvetica','normal');doc.setFontSize(15);
  doc.text(textePDF(`ORFE TERRAIN : ${rec?'Recensement':'Rapport de tournée'} du ${dateFR(du)}${du===au?'':` au ${dateFR(au)}`}`),12,15);
  doc.setFontSize(9);doc.text(textePDF(`Extrait le ${dateFR(quand)} à ${quand.slice(11,16)} par ${agent}`),12,21);
  // Chaque colonne porte son titre : un titre ne peut plus se décaler de sa donnée.
  const tableau=rec?[['AGENT','Agent'],['NIF','NIF'],['RAISON SOCIALE','Raison sociale'],['NOM DU RESPONSABLE','Responsable'],['TELEPHONE','Téléphone'],['ACTIVITE','Activité'],['ENSEIGNE','Enseigne'],['ACTION','Action'],['RUE','Rue'],['IMMEUBLE','Immeuble'],['NIVEAU','Niveau'],['GPS','GPS']]:[['DATE','Date'],['AGENT','Agent'],['NIF','NIF'],['RAISON SOCIALE','Raison sociale'],['ORIGINE','Origine'],['RESULTAT','Résultat'],['ACTE','Acte'],['MONTANT','Montant'],['DATE PROMISE','Date promise'],['CADENAS','Cadenas'],['OBSERVATION','Observation']];
  const colonnes=tableau.map(c=>c[0]),labels=tableau.map(c=>c[1]);
  doc.autoTable({startY:26,head:[labels],body:lignes.map(r=>colonnes.map(t=>textePDF(r[titres.indexOf(t)]))),margin:{left:12,right:12,top:12,bottom:14},styles:{font:'helvetica',fontSize:7,cellPadding:1.5,overflow:'linebreak'},headStyles:{fillColor:[9,44,80]}});
  const pages=doc.getNumberOfPages();doc.setFontSize(8);
  for(let n=1;n<=pages;n++){doc.setPage(n);doc.text(`page ${n} / ${pages}`,285,204,{align:'right'});}
  return doc.output('blob');
}
export function telecharger(blob,nom,document=globalThis.document,url=globalThis.URL){
  const lien=document.createElement('a'),adresse=url.createObjectURL(blob);lien.href=adresse;lien.download=nom;document.body.append(lien);lien.click();lien.remove();setTimeout(()=>url.revokeObjectURL(adresse),30000);
}
