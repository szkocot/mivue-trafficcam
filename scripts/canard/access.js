import {setTimeout as delay} from 'node:timers/promises';

const MAP='https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen';
const ROBOTS='https://www.canard.gitd.gov.pl/robots.txt';
const BODY_LIMIT=20*1024*1024,REQUEST_MS=30000,TOTAL_MS=120000;
const fail=code=>Object.assign(new Error(code),{code});
const defaultSleep=(ms,signal)=>delay(ms,undefined,{signal});

async function cancelBody(response){try{await response.body?.cancel();}catch{/* Already consumed or aborted. */}}

async function readBody(response,signal){
 if(Number(response.headers.get('content-length'))>BODY_LIMIT){await cancelBody(response);throw fail('CANARD_BODY_LIMIT');}
 if(!response.body)return '';
 const reader=response.body.getReader(),chunks=[];let length=0;
 try{
  while(true){
   signal.throwIfAborted();const {done,value}=await reader.read();signal.throwIfAborted();
   if(done)break;
   length+=value.byteLength;
   if(length>BODY_LIMIT)throw fail('CANARD_BODY_LIMIT');
   chunks.push(value);
  }
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw fail('CANARD_INVALID_RESPONSE');}
 }finally{try{await reader.cancel();}catch{/* Preserve the original failure. */}reader.releaseLock();}
}

function inspectPage(html){
 if(typeof html!=='string'||Buffer.byteLength(html)>BODY_LIMIT)throw fail('CANARD_INVALID_RESPONSE');
 for(const key of ['fotoradaryPP','fotoradaryOPP','fotoradaryRL','punktyKontrolne']){
  if(!new RegExp(`\\b${key}\\s*:`).test(html))throw fail('CANARD_INVALID_RESPONSE');
 }
 // Only visible notice text is fingerprinted, never scripts or dynamic page tokens.
 const visible=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'')
  .replace(/<[^>]*>/g,'\n').replace(/&nbsp;|&#160;/g,' ');
 const notices=visible.split(/[\r\n]+/).map(line=>line.replace(/\s+/g,' ').trim())
  .filter(line=>line.startsWith('Treści zamieszczone w serwisie'));
 if(!notices.length||new Set(notices).size!==1)throw fail('CANARD_TERMS_CHANGED');
 return notices[0];
}

/** Public GETs only. The result is private input for a separately gated publisher. */
export async function fetchCanardPage({fetchImpl=globalThis.fetch,signal,previous=null,sleep=defaultSleep,now=()=>new Date()}={}){
 const started=+now();let reservedWait=0;
 const elapsed=()=>Math.max(+now()-started,reservedWait);
 const remaining=()=>TOTAL_MS-elapsed();
 function check(){signal?.throwIfAborted();if(remaining()<=0)throw fail('CANARD_DEFERRED');}
 async function wait(ms){
  check();if(ms>=remaining())throw fail('CANARD_DEFERRED');
  reservedWait+=ms;await sleep(ms,signal);check();
 }
 async function request(url,{conditional=false}={}){
  let retries=0,redirects=0,unconditionalRetry=false,current=url;
  while(true){
   check();
   const controller=new AbortController();
   const combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
   const timer=setTimeout(()=>controller.abort(fail('CANARD_TIMEOUT')),Math.min(REQUEST_MS,remaining()));
   let response,retryDelay=null;
   try{
    const headers={'User-Agent':'MiVue-TrafficCam/1.0 (+https://github.com/szkocot/mivue-trafficcam)','Accept':url===MAP?'text/html':'text/plain'};
    if(conditional&&!unconditionalRetry&&typeof previous?.html==='string'){
     if(previous.validators?.etag)headers['If-None-Match']=previous.validators.etag;
     else if(previous.validators?.lastModified)headers['If-Modified-Since']=previous.validators.lastModified;
    }
    response=await fetchImpl(current,{method:'GET',headers,credentials:'omit',redirect:'manual',signal:combined});
    combined.throwIfAborted();
    if([401,403].includes(response.status))throw fail('CANARD_ACCESS_DENIED');
    if(response.status===304){
     if(conditional&&!unconditionalRetry&&typeof previous?.html==='string'&&(headers['If-None-Match']||headers['If-Modified-Since'])){
      inspectPage(previous.html);
      return {text:previous.html,validators:{etag:previous.validators.etag??null,lastModified:previous.validators.lastModified??null}};
     }
     if(!conditional||unconditionalRetry)throw fail('CANARD_INVALID_RESPONSE');
     unconditionalRetry=true;continue;
    }
    if([301,302,303,307,308].includes(response.status)){
     let next;try{next=new URL(response.headers.get('location'),current);}catch{throw fail('CANARD_UNSAFE_REDIRECT');}
     if(next.href!==url||next.username||next.password||++redirects>3)throw fail('CANARD_UNSAFE_REDIRECT');
     current=next.href;continue;
    }
    if(response.status===429||response.status>=500){
     if(retries>=2)throw fail('CANARD_FETCH_FAILED');
     const header=response.headers.get('retry-after');
     let requested=0;
     if(header!==null){
      requested=/^\d+$/.test(header)?Number(header)*1000:Date.parse(header)-(+now());
      if(!Number.isFinite(requested))throw fail('CANARD_DEFERRED');
     }
     retryDelay=Math.max(1000*2**retries,requested);retries++;
    }else{
     if(!response.ok)throw fail('CANARD_FETCH_FAILED');
     const text=await readBody(response,combined);
     if(url===MAP)inspectPage(text);
     else if(!/^User-agent\s*:/im.test(text)||/<(?:html|script)\b/i.test(text))throw fail('CANARD_INVALID_RESPONSE');
     return {text,validators:{etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')}};
    }
   }catch(error){
    signal?.throwIfAborted();
    if(error.code&&error.code!=='CANARD_TIMEOUT')throw error;
    if(retries>=2)throw fail('CANARD_FETCH_FAILED');
    retryDelay=1000*2**retries;retries++;
   }finally{clearTimeout(timer);if(response)await cancelBody(response);}
   if(retryDelay!==null)await wait(retryDelay);
  }
 }
 const page=await request(MAP,{conditional:true});
 const robots=await request(ROBOTS);check();
 return {html:page.text,termsText:inspectPage(page.text),robotsText:robots.text.trim().replace(/\r\n/g,'\n'),validators:page.validators,checkedAt:new Date(now()).toISOString()};
}
