const cancelled=()=>Object.assign(new Error('Operation cancelled'),{code:'CANCELLED'});
export function createWorkerClient({workerFactory=()=>new Worker(new URL('./worker.js',import.meta.url),{type:'module'})}={}){
  let worker=null,sessionId=null,counter=0,snapshot=null;
  const requests=new Map(),validators=new Set();
  function stop(){worker?.terminate();worker=null;for(const p of requests.values())p.reject(cancelled());requests.clear();}
  function send(kind,payload={}){
    if(!worker)return Promise.reject(cancelled());
    const requestId=++counter;
    return new Promise((resolve,reject)=>{requests.set(requestId,{resolve,reject});worker.postMessage({sessionId,requestId,kind,payload});});
  }
  return {
    get sessionId(){return sessionId;},get snapshot(){return snapshot;},
    open(kind,payload){
      stop();sessionId=crypto.randomUUID();worker=workerFactory();
      const id=sessionId;
      worker.onmessage=({data:m})=>{
        if(m.sessionId!==sessionId || id!==sessionId)return;
        const p=requests.get(m.requestId);if(!p)return;requests.delete(m.requestId);
        if(m.ok){
          if(m.result?.projectJson && (!snapshot || snapshot.sessionId!==id || m.result.revision>=snapshot.revision))snapshot={...m.result,sessionId:id};
          p.resolve(m.result);
        }else p.reject(Object.assign(new Error(m.error.message),m.error));
      };
      worker.onerror=()=>{if(id===sessionId)stop();};
      return send(kind,payload);
    },
    request:send,
    validateSource(bytes){
      const w=workerFactory(),id=crypto.randomUUID(),requestId=++counter;
      return new Promise((resolve,reject)=>{
        const item={w,reject};validators.add(item);
        const done=()=>{w.terminate();validators.delete(item);};
        w.onmessage=({data:m})=>{if(m.sessionId!==id || m.requestId!==requestId)return;done();m.ok?resolve(m.result):reject(Object.assign(new Error(m.error.message),m.error));};
        w.onerror=()=>{done();reject(new Error('SOURCE_VALIDATION_FAILED'));};
        w.postMessage({sessionId:id,requestId,kind:'validate-source',payload:{bytes}});
      });
    },
    cancel:stop,
    close(){stop();for(const {w,reject} of validators){w.terminate();reject(cancelled());}validators.clear();}
  };
}
