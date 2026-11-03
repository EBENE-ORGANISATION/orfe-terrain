export const texte = v => String(v ?? '').trim().replace(/\s+/gu,' ').toLocaleUpperCase('fr');
export const chiffres = v => String(v ?? '').replace(/\D/g,'');
export const nifValide = v => /^1\d{9}$/.test(v);
// Repli pour les premières versions de Safari 15.
export function nouvelId(cryptoSource=globalThis.crypto) {
  if(cryptoSource.randomUUID)return cryptoSource.randomUUID();
  const b=cryptoSource.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
  const h=[...b].map(v=>v.toString(16).padStart(2,'0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export function dateLocale(d=new Date()) {
  const z=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}
export function pointValide(p) {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.lat>=5.5 && p.lat<=11.5 && p.lon>=-0.5 && p.lon<=2.5;
}
export function meilleurPoint(a,b) {
  if(!pointValide(b)||!Number.isFinite(b.precision)||b.precision<0) return a;
  return !a||b.precision<a.precision ? b : a;
}
export const couleurPrecision=(m,seuil)=> m<=seuil?'vert':m<=3*seuil?'orange':'rouge';
export function distance(a,b) {
  const rad=n=>n*Math.PI/180, dlat=rad(b.lat-a.lat), dlon=rad(b.lon-a.lon);
  const h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;
  return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function cleRue(v) {
  return texte(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9 ]/g,' ').split(/\s+/).filter(m=>m&&!['RUE','AV','AVENUE','BD','BOULEVARD','DE','DU','DES','LA','LE','LES','L','D'].includes(m)).join(' ');
}
export function proposerRue(point,fiches) {
  const groupes=new Map(), vus=new Set();
  for(const f of fiches) {
    if(f.id && vus.has(f.id)) continue;
    if(f.id) vus.add(f.id);
    if(!pointValide(f)||!f.rue||distance(point,f)>=50) continue;
    const cle=cleRue(f.rue); if(!cle) continue;
    const g=groupes.get(cle)||{nombre:0,graphies:new Map()};
    const rue=texte(f.rue); g.nombre++; g.graphies.set(rue,(g.graphies.get(rue)||0)+1); groupes.set(cle,g);
  }
  const g=[...groupes.values()].sort((a,b)=>b.nombre-a.nombre)[0];
  return g?{rue:[...g.graphies].sort((a,b)=>b[1]-a[1])[0][0],nombre:g.nombre,source:'VOISINS'}:null;
}
export const CHOIX={immatricule:['OUI','NON','NE SAIT PAS'],niveau:['RDC','R+1','R+2','R+3','R+4','R+5','AUTRE'],enseigne:['OUI','NON'],regime:['TPU','REEL','CIME','DGE','NE SAIT PAS']};
export function validerFiche(f) {
  const erreurs=[];
  for(const k of ['id','date','agent','equipe','activite','rue']) if(!texte(f[k])) erreurs.push(`Renseignez ${ {activite:"l’activité",rue:'la rue',equipe:"l’équipe"}[k]||k }.`);
  if(!texte(f.raison)&&!texte(f.responsable)) erreurs.push('Renseignez la raison sociale ou le responsable.');
  if(!CHOIX.immatricule.includes(f.immatricule)) erreurs.push('Choisissez « Immatriculé ? ».');
  if(f.immatricule==='OUI'&&!chiffres(f.nif)) erreurs.push('Renseignez le NIF.');
  for(const k of ['enseigne','regime']) if(f[k]&&!CHOIX[k].includes(f[k])) erreurs.push(`Choix incorrect : ${k}.`);
  if(f.type!=='RECENSEMENT') erreurs.push('Type de fiche incorrect.');
  if(!['BON','IMPRECIS','AUCUN'].includes(f.gps)) erreurs.push('État GPS incorrect.');
  if(f.gps!=='AUCUN'&&(!pointValide(f)||!Number.isFinite(f.precision)||f.precision<0)) erreurs.push('Point GPS incorrect.');
  return erreurs;
}
export function accuser(file,reponse) {
  const ids=new Set([...(reponse.recus||[]),...(reponse.deja||[])]);
  const refus=new Map((reponse.refuses||[]).map(f=>[f.id,f.raison]));
  return file.map(f=>({...f,envoyee:f.envoyee||ids.has(f.id),refus:ids.has(f.id)?'':refus.get(f.id)||f.refus||''}));
}
