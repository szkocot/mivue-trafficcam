/** Transaction completion, not request success, is the durability boundary. */
export function openStorage({indexedDB=globalThis.indexedDB}={}) {
  return new Promise((resolve,reject)=>{
    if(!indexedDB) return reject(new Error('STORAGE_UNAVAILABLE'));
    let blocked=false;
    const request=indexedDB.open('mivue-trafficcam',2);
    request.onupgradeneeded=()=>{for(const name of ['source','working','canard']) if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>{blocked=true;reject(new Error('STORAGE_BLOCKED'));};
    request.onsuccess=()=>{
      const db=request.result;
      if(blocked){db.close();return;}
      db.onversionchange=()=>db.close();
      const run=(name,value,write=false,remove=false)=>new Promise((res,rej)=>{
        const tx=db.transaction(name,write?'readwrite':'readonly');
        const r=remove?tx.objectStore(name).delete('current'):write?tx.objectStore(name).put(value,'current'):tx.objectStore(name).get('current');
        tx.oncomplete=()=>res(r.result??null);
        tx.onerror=()=>rej(tx.error??new Error('STORAGE_ERROR'));
        tx.onabort=()=>rej(tx.error??new Error('STORAGE_ABORTED'));
      });
      resolve({getCache:()=>run('source'),putCache:e=>run('source',e,true),
        getCanardCache:()=>run('canard'),putCanardCache:e=>run('canard',e,true),clearCanardCache:()=>run('canard',null,true,true),
        getWorking:()=>run('working'),putWorking:e=>run('working',e,true),close:()=>db.close()});
    };
  });
}
