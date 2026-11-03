import {meilleurPoint} from './metier.mjs';
// stop() rend aussi le meilleur point déjà obtenu.
export function ecouterGPS({seuil,duree,surMesure,geolocalisation=navigator.geolocation}) {
  let meilleur=null,watch,timer,termine=false,terminer;
  const promesse=new Promise(resolve=>{terminer=(raison)=>{if(termine)return;termine=true;clearTimeout(timer);if(watch!==undefined)geolocalisation?.clearWatch(watch);resolve({point:meilleur,raison});};});
  if(!geolocalisation){terminer('Le GPS est indisponible.');return {promesse,stop:()=>terminer('Arrêt')};}
  timer=setTimeout(()=>terminer(meilleur?'Durée écoulée.':'Aucun point GPS obtenu.'),duree*1000);
  watch=geolocalisation.watchPosition(p=>{
    if(termine)return;
    const candidat={lat:p.coords.latitude,lon:p.coords.longitude,precision:p.coords.accuracy};
    const suivant=meilleurPoint(meilleur,candidat);
    if(suivant===meilleur&&suivant!==candidat){surMesure(meilleur,'Point hors du Togo ou mesure moins précise.');return;}
    meilleur=suivant;surMesure(meilleur,'');if(meilleur.precision<=seuil)terminer('Point obtenu.');
  },e=>{if(e.code===1)terminer('Autorisez la localisation dans le navigateur.');else surMesure(meilleur,'Recherche du GPS…');},{enableHighAccuracy:true,maximumAge:0,timeout:duree*1000});
  return {promesse,stop:()=>terminer('Arrêt')};
}
