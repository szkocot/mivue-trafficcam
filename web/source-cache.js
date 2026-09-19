import { OFFICIAL_DATABASE_URL } from '../src/sources.js';

function metadata(response){
  const h=response.headers;
  return {etag:h.get('etag'),lastModified:h.get('last-modified'),contentLength:h.get('content-length')};
}
function validator(m){
  if(m.etag)return `etag:${m.etag}`;
  if(m.lastModified && Number.isFinite(Date.parse(m.lastModified)) && /^\d+$/.test(m.contentLength??''))
    return `modified:${m.lastModified}:${m.contentLength}`;
  return null;
}
export function createSourceCache({store,fetchImpl=globalThis.fetch,validateBytes,now=()=>new Date().toISOString(),onStatus=()=>{}}){
  let cached=null,pending=null,controller=null;
  const status=(state,extra={})=>onStatus({state,...extra});
  async function loadCached(){
    try{
      const entry=await store.getCache();
      if(!entry)return null;
      if(entry.version!==1 || !(entry.bytes instanceof Uint8Array) || !entry.source || entry.source.url!==OFFICIAL_DATABASE_URL)throw Error('INVALID_CACHE');
      const sha256=await validateBytes(entry.bytes);
      if(sha256!==entry.source.sha256)throw Error('INVALID_CACHE');
      cached=entry;status('cached');return cached;
    }catch(error){status('cache-failed',{error});return null;}
  }
  async function runCheck({force=false}={}){
    controller=new AbortController();const signal=controller.signal;
    const options={mode:'cors',credentials:'omit',cache:'no-cache',signal};
    status('checking');
    try{
      if(cached && !force){
        const head=await fetchImpl(OFFICIAL_DATABASE_URL,{...options,method:'HEAD'});
        signal.throwIfAborted();
        const remote=head.ok?validator(metadata(head)):null, local=validator(cached.source);
        if(!remote || !local){status('check-unavailable');return cached;}
        if(remote===local){
          cached={...cached,source:{...cached.source,checkedAt:now()}};
          try{await store.putCache(cached);}catch(error){status('cache-failed',{error});}
          status('unchanged');return cached;
        }
      }
      status('downloading');
      const response=await fetchImpl(OFFICIAL_DATABASE_URL,{...options,method:'GET'});
      if(!response.ok)throw Error(`HTTP_${response.status}`);
      const bytes=new Uint8Array(await response.arrayBuffer());signal.throwIfAborted();
      const sha256=await validateBytes(bytes);signal.throwIfAborted();
      const entry={version:1,bytes,source:{url:OFFICIAL_DATABASE_URL,retrievedAt:now(),checkedAt:now(),...metadata(response),sha256}};
      // Validate the entire replacement before touching the last usable copy.
      try{await store.putCache(entry);}catch(error){status('cache-failed',{error});}
      cached=entry;status('ready');return entry;
    }catch(error){status(signal.aborted?'cancelled':cached?'check-unavailable':'failed',{error});return cached;}
  }
  return {loadCached,check(options){if(!pending)pending=runCheck(options).finally(()=>{pending=null;});return pending;},cancel(){controller?.abort();}};
}
