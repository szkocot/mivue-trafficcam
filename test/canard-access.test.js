import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchCanardPage} from '../scripts/canard/access.js';

const map='https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen';
const robots='https://www.canard.gitd.gov.pl/robots.txt';
const terms='Treści zamieszczone w serwisie — synthetic reuse notice.';
const html=`<html><p>${terms}</p><script>const m={fotoradaryPP:"test",fotoradaryOPP:"test",fotoradaryRL:"test",punktyKontrolne:"[{}]"};</script></html>`;
const robotText='User-Agent: *\nDisallow:';
const date='2026-09-20T00:00:00.000Z';
const opts={now:()=>new Date(date),sleep:async()=>{}};
const valid=url=>new Response(url===robots?robotText:html,{headers:{etag:'"map-1"'}});

test('retrieval uses only identified credential-free public GETs and keeps private validators',async()=>{
 const calls=[];
 const result=await fetchCanardPage({...opts,fetchImpl:async(url,options)=>{calls.push([url,options]);return valid(url);}});
 assert.deepEqual(calls.map(c=>c[0]),[map,robots]);
 for(const [,o] of calls){assert.equal(o.method,'GET');assert.equal(o.credentials,'omit');assert.equal(o.redirect,'manual');assert.match(o.headers['User-Agent'],/szkocot\/mivue-trafficcam/);}
 assert.equal(result.html,html);assert.equal(result.termsText,terms);assert.equal(result.robotsText,robotText);
 assert.deepEqual(result.validators,{etag:'"map-1"',lastModified:null});assert.equal(result.checkedAt,date);
});

test('access denial stops immediately without retry',async()=>{
 let calls=0;
 await assert.rejects(fetchCanardPage({...opts,fetchImpl:async()=>{calls++;return new Response('',{status:403});}}),{code:'CANARD_ACCESS_DENIED'});
 assert.equal(calls,1);
});

test('transient failures retry twice and then stop without fetching robots',async()=>{
 let calls=0;const delays=[];
 await assert.rejects(fetchCanardPage({...opts,sleep:async ms=>delays.push(ms),fetchImpl:async()=>{calls++;return new Response('',{status:503});}}),{code:'CANARD_FETCH_FAILED'});
 assert.equal(calls,3);assert.deepEqual(delays,[1000,2000]);
});

test('conditional map 304 reuses a valid prior body but still fetches robots',async()=>{
 const calls=[];
 const result=await fetchCanardPage({...opts,previous:{html,validators:{etag:'"prior"',lastModified:null}},fetchImpl:async(url,o)=>{
  calls.push([url,o.headers]);return url===map?new Response(null,{status:304}):valid(url);
 }});
 assert.equal(calls[0][1]['If-None-Match'],'"prior"');assert.equal(result.html,html);assert.equal(result.validators.etag,'"prior"');assert.equal(calls.length,2);
});

test('304 without a prior body retries once unconditionally',async()=>{
 const headers=[];
 const result=await fetchCanardPage({...opts,previous:{validators:{etag:'"lost"'}},fetchImpl:async(url,o)=>{
  if(url===map){headers.push(o.headers);if(headers.length===1)return new Response(null,{status:304});}return valid(url);
 }});
 assert.equal(result.html,html);assert.equal(headers.length,2);assert.equal(headers[1]['If-None-Match'],undefined);
});

test('repeated 304 without body cannot loop',async()=>{
 let calls=0;
 await assert.rejects(fetchCanardPage({...opts,fetchImpl:async()=>{calls++;return new Response(null,{status:304});}}),{code:'CANARD_INVALID_RESPONSE'});
 assert.equal(calls,2);
});

for(const location of ['https://example.org/map','http://www.canard.gitd.gov.pl/robots.txt','https://www.canard.gitd.gov.pl/login','https://www.canard.gitd.gov.pl/robots.txt','https://user:pass@www.canard.gitd.gov.pl/cms/en/mapa-urzadzen']){
 test(`unsafe or cross-resource redirect is rejected: ${location}`,async()=>{
  let calls=0;
  await assert.rejects(fetchCanardPage({...opts,fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location}});}}),{code:'CANARD_UNSAFE_REDIRECT'});
  assert.equal(calls,1);
 });
}

test('redirect loop is bounded',async()=>{
 let calls=0;
 await assert.rejects(fetchCanardPage({...opts,fetchImpl:async()=>{calls++;return new Response(null,{status:302,headers:{location:map}});}}),{code:'CANARD_UNSAFE_REDIRECT'});
 assert.ok(calls<=4);
});

test('HTTP 200 login page cannot be mistaken for valid source content',async()=>{
 let calls=0;
 await assert.rejects(fetchCanardPage({...opts,fetchImpl:async()=>{calls++;return new Response('<html>Please sign in</html>');}}),{code:'CANARD_INVALID_RESPONSE'});
 assert.equal(calls,1);
});

test('missing or conflicting visible reuse notice stops retrieval',async()=>{
 for(const body of [html.replace(`<p>${terms}</p>`,''),html+`<p>${terms} changed</p>`]){
  await assert.rejects(fetchCanardPage({...opts,fetchImpl:async()=>new Response(body)}),{code:'CANARD_TERMS_CHANGED'});
 }
});

test('Retry-After beyond total budget defers without sleeping or retrying',async()=>{
 for(const retryAfter of ['121','Sun, 20 Sep 2026 00:03:00 GMT']){
  let calls=0,sleeps=0;
  await assert.rejects(fetchCanardPage({...opts,sleep:async()=>{sleeps++;},fetchImpl:async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':retryAfter}});}}),{code:'CANARD_DEFERRED'});
  assert.equal(calls,1);assert.equal(sleeps,0);
 }
});

test('bounded Retry-After is honored before successful retry',async()=>{
 let calls=0;const delays=[];
 const result=await fetchCanardPage({...opts,sleep:async ms=>delays.push(ms),fetchImpl:async url=>{
  calls++;return calls===1?new Response('',{status:429,headers:{'Retry-After':'2'}}):valid(url);
 }});
 assert.equal(result.html,html);assert.deepEqual(delays,[2000]);assert.equal(calls,3);
});

test('cancellation during backoff prevents additional requests',async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(fetchCanardPage({...opts,signal:controller.signal,sleep:async()=>controller.abort(),fetchImpl:async()=>{calls++;throw new TypeError('network failure');}}),{name:'AbortError'});
 assert.equal(calls,1);
});

test('streamed body limit cancels before collecting an oversized response',async()=>{
 let cancelled=false;
 const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(1024*1024));},cancel(){cancelled=true;}});
 await assert.rejects(fetchCanardPage({...opts,fetchImpl:async()=>new Response(stream)}),{code:'CANARD_BODY_LIMIT'});
 assert.equal(cancelled,true);
});

test('declared oversized body is cancelled without reading it',async()=>{
 let cancelled=false;
 const stream=new ReadableStream({cancel(){cancelled=true;}});
 await assert.rejects(fetchCanardPage({...opts,fetchImpl:async()=>new Response(stream,{headers:{'content-length':String(21*1024*1024)}})}),{code:'CANARD_BODY_LIMIT'});
 assert.equal(cancelled,true);
});

test('request deadline aborts stalled fetch and makes only two retries',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let calls=0;
 const pending=fetchCanardPage({...opts,fetchImpl:async(_url,{signal})=>{calls++;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}});
 const rejection=assert.rejects(pending,{code:'CANARD_FETCH_FAILED'});
 for(let i=0;i<3;i++){t.mock.timers.tick(30000);await new Promise(resolve=>setImmediate(resolve));}
 await rejection;assert.equal(calls,3);
});
