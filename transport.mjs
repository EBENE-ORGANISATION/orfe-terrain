export async function poster(url,demande,fetcher=fetch) {
  if(!url) throw new Error('L’adresse de la boîte n’est pas encore configurée.');
  const controle=new AbortController();
  const delai=setTimeout(()=>controle.abort(),30000);
  try {
    const r=await fetcher(url,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(demande),signal:controle.signal,redirect:'follow',credentials:'omit'});
    if(!r.ok) throw new Error('La boîte est indisponible. Réessayez plus tard.');
    return await r.json();
  } finally {clearTimeout(delai);}
}
// Un seul essai par fiche, résultat (même vide) mémorisé, demandes espacées.
export function carteRues(fetcher=fetch,maintenant=()=>Date.now(),attendre=ms=>new Promise(r=>setTimeout(r,ms))) {
  const memoire=new Map();let derniere=0,queue=Promise.resolve();
  return (id,point)=>{
    if(memoire.has(id))return memoire.get(id);
    const p=queue.then(async()=>{
      await attendre(Math.max(0,1000-(maintenant()-derniere))); derniere=maintenant();
      const controle=new AbortController(),delai=setTimeout(()=>controle.abort(),10000);
      try {
        const url=`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lon}&zoom=17&accept-language=fr`;
        const r=await fetcher(url,{signal:controle.signal,credentials:'omit'});
        if(!r.ok)return null;
        return (await r.json()).address?.road||null;
      }catch{return null;}finally{clearTimeout(delai);}
    });
    queue=p.catch(()=>null);memoire.set(id,p);return p;
  };
}
