/** Transaction completion, not request success, is the durability boundary. */
export function openStorage({indexedDB=globalThis.indexedDB}={}) {
  return new Promise((resolve,reject)=>{
    if(!indexedDB) return reject(new Error('STORAGE_UNAVAILABLE'));
    const request=indexedDB.open('mivue-trafficcam',1);
    request.onupgradeneeded=()=>{for(const name of ['source','working']) if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error('STORAGE_BLOCKED'));
    request.onsuccess=()=>{
      const db=request.result;
      db.onversionchange=()=>db.close();
      const run=(name,value,write=false)=>new Promise((res,rej)=>{
        const tx=db.transaction(name,write?'readwrite':'readonly');
        const r=write?tx.objectStore(name).put(value,'current'):tx.objectStore(name).get('current');
        tx.oncomplete=()=>res(r.result??null);
        tx.onerror=()=>rej(tx.error??new Error('STORAGE_ERROR'));
        tx.onabort=()=>rej(tx.error??new Error('STORAGE_ABORTED'));
      });
      resolve({getCache:()=>run('source'),putCache:e=>run('source',e,true),
        getWorking:()=>run('working'),putWorking:e=>run('working',e,true),close:()=>db.close()});
    };
  });
}
