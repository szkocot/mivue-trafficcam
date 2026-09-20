import {validateManifest,validateSnapshot} from '../src/canard-snapshot.js';
const failure=code=>Object.assign(new Error(code),{code});
async function boundedBody(response,limit,signal){
 if(!response.ok)throw failure(`HTTP_${response.status}`);
 if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw failure('CANARD_BODY_LIMIT');}
 const reader=response.body?.getReader();if(!reader)throw failure('CANARD_EMPTY_BODY');
 const chunks=[];let length=0;
 try{while(true){signal.throwIfAborted();const {done,value}=await reader.read();signal.throwIfAborted();if(done)break;length+=value.length;if(length>limit)throw failure('CANARD_BODY_LIMIT');chunks.push(value);}}
 finally{try{await reader.cancel();}catch{}reader.releaseLock();}
 const bytes=new Uint8Array(length);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}return bytes;
}
export function createCanardCache({store,fetchImpl=globalThis.fetch,baseUrl=new URL('../',import.meta.url).href,now=()=>Date.now(),onStatus=()=>{}}){
 const base=new URL(baseUrl);let cached=null,pending=null,controller=null,generation=0,disabled=false,persistenceFailed=false;
 const report=(state,error)=>onStatus({state,error,persistenceFailed,manifest:cached?.manifest??null,
  stale:Boolean(cached&&Number(now())-Date.parse(cached.manifest.checkedAt)>48*3600000)});
 const current=token=>{if(token!==generation||disabled)throw failure('CANCELLED');};
 const disable=()=>{disabled=true;generation++;cached=null;controller?.abort();report('disabled');};
 store.subscribeCanardWithdrawal?.(value=>{try{if(validateManifest(value,{now:Number(now())}).state==='disabled')disable();}catch{}});
 async function loadCached(){
  const token=generation;
  try{const withdrawal=await store.getCanardWithdrawal?.();if(withdrawal){validateManifest(withdrawal,{now:Number(now())});current(token);disable();return null;}
   const entry=await store.getCanardCache();if(!entry)return null;const snapshot=await validateSnapshot(entry.bytes,entry.manifest);current(token);
   cached={manifest:entry.manifest,bytes:entry.bytes,snapshot};report('cached');return cached;
  }catch(error){if(token===generation&&!disabled){persistenceFailed=true;report('cache-failed',error);}return null;}
 }
 async function run(){
  const token=++generation;controller=new AbortController();const signal=controller.signal;
  const timer=setTimeout(()=>controller.abort(failure('CANARD_TIMEOUT')),30000);
  report('checking');
  const fetchBytes=async(path,limit)=>{
   const url=new URL(path,base);
   if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname+'data/canard/'))throw failure('CANARD_UNSAFE_PATH');
   const response=await fetchImpl(url.href,{credentials:'omit',redirect:'error',cache:'no-cache',signal});
   const bytes=await boundedBody(response,limit,signal);current(token);return bytes;
  };
  try{
   const bytes=await fetchBytes('data/canard/manifest.json',65536);
   const manifest=validateManifest(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),{now:Number(now())});
   if(manifest.state==='disabled'){
    disable();
    try{await store.clearCanardCache(manifest);}catch{persistenceFailed=true;}
    report('disabled');return null;
   }
   if(cached&&Date.parse(manifest.checkedAt)<Date.parse(cached.manifest.checkedAt))throw failure('CANARD_STALE_MANIFEST');
   const data=cached?.manifest.sha256===manifest.sha256?cached.bytes:await fetchBytes(manifest.path,manifest.byteLength);
   const snapshot=await validateSnapshot(data,manifest);current(token);
   const next={manifest,bytes:data,snapshot};
   try{await store.putCanardCache({manifest,bytes:data});}catch(error){
    if(error.code==='CANARD_SOURCE_WITHDRAWN'){disable();return null;}
    if(error.code==='CANARD_STALE_MANIFEST'){await loadCached();throw error;}
    persistenceFailed=true;
   }
   current(token);cached=next;report('ready');return cached;
  }catch(error){if(token===generation&&!disabled)report(signal.aborted?'cancelled':'check-failed',error);return disabled?null:cached;}
  finally{clearTimeout(timer);}
 }
 return {loadCached,check(){if(!pending)pending=disabled?Promise.resolve(null):run();return pending;},cancel(){generation++;controller?.abort();report('cancelled');}};
}
