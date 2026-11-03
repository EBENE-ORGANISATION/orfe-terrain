// Worker classique pour Safari 15. Garder ce numéro identique à config.js (essai automatique).
const VERSION='1.0.5';
const CACHE=`orfe-terrain-${VERSION}`;
const FICHIERS=['./','./index.html','./style.css','./app.mjs','./config.js','./metier.mjs','./gps.mjs','./transport.mjs','./stockage.mjs','./manifest.webmanifest','./icone-192.png','./icone-512.png'];
self.addEventListener('install',e=>{e.waitUntil((async()=>{
  const c=await caches.open(CACHE);await c.addAll(FICHIERS);
  // Facultatif sur l’hébergement réel ; nécessaire à l’essai factice hors ligne.
  try{await c.add('../essais/telephone/boite-factice.js');}catch{}
})());});
self.addEventListener('message',e=>{if(e.data==='ACTIVER')self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  for(const nom of await caches.keys())if(nom.startsWith('orfe-terrain-')&&nom!==CACHE)await caches.delete(nom);
  await self.clients.claim();
  for(const client of await self.clients.matchAll())client.postMessage('NOUVELLE_VERSION');
})());});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  // Cache applicatif seulement : aucune réponse de la boîte ni de la carte.
  e.respondWith((async()=>{
    const cache=await caches.open(CACHE),url=new URL(e.request.url);
    const canonique=e.request.mode==='navigate'?new URL('./index.html',self.location.href).href:e.request;
    const garde=await cache.match(canonique);if(garde)return garde;
    const r=await fetch(e.request);
    // Le simulateur réside dans essais ; il est mis en cache à sa première utilisation.
    if(r.ok&&url.pathname.endsWith('/essais/telephone/boite-factice.js'))await cache.put(e.request,r.clone());
    return r;
  })());
});
