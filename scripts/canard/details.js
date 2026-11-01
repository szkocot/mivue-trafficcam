import {setTimeout as delay} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {decodeCanardDetail} from '../../src/canard-details.js';

const RESOURCE='https://www.canard.gitd.gov.pl/cms/en/web/guest/mapa-urzadzen?p_p_id=pl_canard_cms_portlet_mapa_INSTANCE_URMGfsNrnTYd&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=%2Fobjdata&p_p_cacheability=cacheLevelPage';
const PREFIX='_pl_canard_cms_portlet_mapa_INSTANCE_URMGfsNrnTYd_';
const LIMIT=1024*1024,TOTAL_LIMIT=20*1024*1024,TOTAL_MS=20*60*1000,TTL=24*60*60*1000;
const fail=code=>Object.assign(new Error(code),{code});
const hash=text=>createHash('sha256').update(text).digest('hex');
const defaultSleep=(ms,signal)=>delay(ms,undefined,{signal});
async function cancel(response){try{await response?.body?.cancel();}catch{/* Preserve the original failure. */}}
async function bodyText(response,signal){
 if(Number(response.headers.get('content-length'))>LIMIT)throw fail('CANARD_DETAIL_BODY_LIMIT');
 if(!response.body)throw fail('CANARD_INVALID_DETAIL');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{
  while(true){
   signal.throwIfAborted();const {done,value}=await reader.read();signal.throwIfAborted();if(done)break;
   size+=value.byteLength;if(size>LIMIT)throw fail('CANARD_DETAIL_BODY_LIMIT');chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw fail('CANARD_INVALID_DETAIL');}
 }finally{try{await reader.cancel();}catch{/* Preserve the original failure. */}reader.releaseLock();}
}

/** Serial public resource reads only; callers publish only after the complete batch succeeds. */
export async function fetchCanardDetails({batch,previous={},fetchImpl=globalThis.fetch,sleep=defaultSleep,now=()=>new Date(),signal,onProgress}={}){
 if(!Array.isArray(batch?.observations)||batch.observations.length>1000)throw fail('CANARD_DETAIL_COUNT_LIMIT');
 const started=+now();let reservedWait=0,requests=0,retainedBytes=0;
 const remaining=()=>TOTAL_MS-Math.max(+now()-started,reservedWait);
 function check(){signal?.throwIfAborted();if(remaining()<=0)throw fail('CANARD_DETAIL_DEFERRED');}
 const entries=batch.observations.map(o=>{
  let pair;try{pair=JSON.parse(o.sourceId);}catch{throw fail('CANARD_INVALID_DETAIL');}
  if(!Array.isArray(pair)||pair.length!==2||!['PP','OPP','RL'].includes(pair[0])||typeof pair[1]!=='string'||!/^\d+$/.test(pair[1])||!Number.isSafeInteger(Number(pair[1]))||String(Number(pair[1]))!==pair[1]||JSON.stringify(pair)!==o.sourceId||pair[0]!==o.originalProperties?.sourceCategory||String(o.originalProperties.id)!==pair[1])throw fail('CANARD_INVALID_DETAIL');
  return {o,category:pair[0],id:pair[1],identity:JSON.stringify({geometry:o.geometry,serial:o.originalProperties.nrSeryjny})};
 });
 if(new Set(entries.map(e=>e.o.sourceId)).size!==entries.length)throw fail('CANARD_INVALID_DETAIL');
 const details={},cache={};
 for(const [index,{o,category,id,identity}]of entries.entries()){
  check();let raw,decoded,fetchedAt,responseSha256;
  const prior=previous?.[o.sourceId],age=+now()-Date.parse(prior?.fetchedAt);
  if(prior?.identity===identity&&prior.sourceUrl===RESOURCE&&typeof prior.raw==='string'&&Buffer.byteLength(prior.raw)<=LIMIT&&age>=0&&age<TTL&&hash(prior.raw)===prior.responseSha256){
   try{decoded=decodeCanardDetail(prior.raw,{category,sourceId:o.sourceId});raw=prior.raw;fetchedAt=prior.fetchedAt;responseSha256=prior.responseSha256;}catch{/* Invalid cache entries are refreshed, never accepted. */}
  }
  if(raw===undefined){
   if(requests){check();if(remaining()<=250)throw fail('CANARD_DETAIL_DEFERRED');reservedWait+=250;await sleep(250,signal);check();}
   const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
   const timeoutCode=remaining()<30000?'CANARD_DETAIL_DEFERRED':'CANARD_DETAIL_TIMEOUT';
   const timer=setTimeout(()=>controller.abort(fail(timeoutCode)),Math.min(30000,remaining()));let response;
   let abortListener;const aborted=new Promise((_,reject)=>{abortListener=()=>reject(combined.reason);combined.addEventListener('abort',abortListener,{once:true});});
   try{
    requests++;
    raw=await Promise.race([(async()=>{
     response=await fetchImpl(RESOURCE,{method:'POST',headers:{'User-Agent':'MiVue-TrafficCam/1.0 (+https://github.com/szkocot/mivue-trafficcam)','Accept':'text/plain, application/json','Content-Type':'application/x-www-form-urlencoded'},credentials:'omit',redirect:'error',body:new URLSearchParams({[PREFIX+'type']:category,[PREFIX+'id']:id}).toString(),signal:combined});
     combined.throwIfAborted();
     if([401,403].includes(response.status))throw fail('CANARD_DETAIL_ACCESS_DENIED');
     if(response.status===429)throw fail('CANARD_DETAIL_RATE_LIMITED');
     if(!response.ok)throw fail('CANARD_DETAIL_FETCH_FAILED');
     return bodyText(response,combined);
    })(),aborted]);
    check();decoded=decodeCanardDetail(raw,{category,sourceId:o.sourceId});fetchedAt=new Date(now()).toISOString();responseSha256=hash(raw);
   }catch(error){signal?.throwIfAborted();if(combined.aborted)throw combined.reason;if(error.code)throw error;throw fail('CANARD_DETAIL_FETCH_FAILED');}
   finally{clearTimeout(timer);combined.removeEventListener('abort',abortListener);await cancel(response);}
  }
  retainedBytes+=Buffer.byteLength(raw);if(retainedBytes>TOTAL_LIMIT)throw fail('CANARD_DETAIL_TOTAL_LIMIT');
  cache[o.sourceId]={raw,fetchedAt,identity,sourceUrl:RESOURCE,responseSha256};
  details[o.sourceId]={raw:decoded,retrievedAt:fetchedAt,sourceUrl:RESOURCE,responseSha256};
  onProgress?.({completed:index+1,total:entries.length,requests});
 }
 check();return {details,cache};
}
