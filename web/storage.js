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
      let channel=null;
      const notifications=()=>channel??=typeof globalThis.BroadcastChannel==='function'?new BroadcastChannel('mivue-canard-withdrawal'):null;
      const run=(name,value,write=false,remove=false,key='current')=>new Promise((res,rej)=>{
        const tx=db.transaction(name,write?'readwrite':'readonly');
        const r=remove?tx.objectStore(name).delete(key):write?tx.objectStore(name).put(value,key):tx.objectStore(name).get(key);
        tx.oncomplete=()=>res(r.result??null);
        tx.onerror=()=>rej(tx.error??new Error('STORAGE_ERROR'));
        tx.onabort=()=>rej(tx.error??new Error('STORAGE_ABORTED'));
      });
      const putCanardCache=value=>new Promise((res,rej)=>{
        const tx=db.transaction('canard','readwrite'),store=tx.objectStore('canard');let rejected=null;
        const reject=code=>{rejected=Object.assign(new Error(code),{code});tx.abort();};
        const withdrawal=store.get('withdrawal');
        withdrawal.onsuccess=()=>{
          const stamp=Date.parse(value?.manifest?.checkedAt);
          if(withdrawal.result){reject('CANARD_SOURCE_WITHDRAWN');return;}
          const current=store.get('current');current.onsuccess=()=>{
            if(Date.parse(current.result?.manifest?.checkedAt)>stamp){reject('CANARD_STALE_MANIFEST');return;}
            try{store.put(value,'current');}catch(error){rejected=error;tx.abort();}
          };
        };
        tx.oncomplete=()=>res();tx.onerror=tx.onabort=()=>rej(rejected??tx.error??new Error('STORAGE_ABORTED'));
      });
      const clearCanardCache=manifest=>{
        if(!manifest)return run('canard',null,true,true);
        notifications()?.postMessage(manifest);
        return new Promise((res,rej)=>{
          const tx=db.transaction('canard','readwrite'),store=tx.objectStore('canard'),prior=store.get('withdrawal');let rejected=null;
          prior.onsuccess=()=>{try{if(!prior.result||Date.parse(prior.result.checkedAt)<Date.parse(manifest.checkedAt))store.put(manifest,'withdrawal');store.delete('current');}catch(error){rejected=error;tx.abort();}};
          tx.oncomplete=()=>res();tx.onerror=tx.onabort=()=>rej(rejected??tx.error??new Error('STORAGE_ABORTED'));
        });
      };
      resolve({getCache:()=>run('source'),putCache:e=>run('source',e,true),
        getCanardCache:()=>run('canard'),putCanardCache,clearCanardCache,
        getCanardWithdrawal:()=>run('canard',undefined,false,false,'withdrawal'),
        subscribeCanardWithdrawal:listener=>{const c=notifications(),fn=e=>listener(e.data);c?.addEventListener('message',fn);return ()=>c?.removeEventListener('message',fn);},
        getWorking:()=>run('working'),putWorking:e=>run('working',e,true),close:()=>{channel?.close();db.close();}});
    };
  });
}
