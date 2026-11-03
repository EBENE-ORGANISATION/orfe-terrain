import {meilleurPoint} from './metier.mjs';
// stop() rend aussi le meilleur point déjà obtenu.
export function ecouterGPS({objectif=4,affiner=10,duree=45,surMesure=()=>{},geolocalisation=globalThis.navigator?.geolocation,horloge=globalThis}={}) {
  let meilleur=null,watch,timer,affinage,termine=false,terminer;
  const promesse=new Promise(resolve=>{terminer=raison=>{
    if(termine)return;termine=true;horloge.clearTimeout(timer);horloge.clearTimeout(affinage);
    if(watch!==undefined)geolocalisation?.clearWatch(watch);resolve({point:meilleur,raison});
  };});
  if(!geolocalisation){terminer('Le GPS est indisponible.');return {promesse,stop:()=>terminer('Arrêt')};}
  timer=horloge.setTimeout(()=>terminer(meilleur?'Point obtenu':'Aucun point GPS obtenu.'),duree*1000);
  watch=geolocalisation.watchPosition(p=>{
    if(termine)return;
    meilleur=meilleurPoint(meilleur,{lat:p.coords.latitude,lon:p.coords.longitude,precision:p.coords.accuracy});
    surMesure(meilleur,"Recherche d'un point plus précis…");
    if(meilleur&&meilleur.precision<=objectif&&affinage===undefined)affinage=horloge.setTimeout(()=>terminer('Point obtenu'),affiner*1000);
  },e=>{if(termine)return;if(e.code===1)terminer('Autorisez la localisation dans le navigateur.');else surMesure(meilleur,"Recherche d'un point plus précis…");},{enableHighAccuracy:true,maximumAge:0,timeout:duree*1000});
  if(termine)geolocalisation.clearWatch(watch);
  return {promesse,stop:()=>terminer(meilleur?'Point obtenu':'Arrêt')};
}
