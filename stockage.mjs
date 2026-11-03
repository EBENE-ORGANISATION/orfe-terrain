// Chaque opération se termine à la validation de la transaction, pas à la requête.
export function ouvrirStockage(factice=false) {
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(factice?'orfe-terrain-factice':'orfe-terrain',1);
    r.onupgradeneeded=()=>{r.result.createObjectStore('meta');r.result.createObjectStore('fiches',{keyPath:'id'});};
    r.onerror=()=>reject(r.error);
    r.onsuccess=()=>resolve(new Stockage(r.result));
  });
}
class Stockage {
  constructor(db){this.db=db;}
  operation(table,mode,fn){return new Promise((resolve,reject)=>{
    const tx=this.db.transaction(table,mode);let valeur;
    const r=fn(tx.objectStore(table));r.onsuccess=()=>{valeur=r.result;};
    tx.oncomplete=()=>resolve(valeur);tx.onabort=()=>reject(tx.error||new Error('Enregistrement interrompu.'));tx.onerror=()=>{};
  });}
  lire(cle){return this.operation('meta','readonly',s=>s.get(cle));}
  garder(cle,v){return this.operation('meta','readwrite',s=>s.put(v,cle));}
  fiches(){return this.operation('fiches','readonly',s=>s.getAll());}
  fiche(f){return this.operation('fiches','readwrite',s=>s.put(f));}
}
