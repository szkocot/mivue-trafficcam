import test from 'node:test';
import assert from 'node:assert/strict';
import LZ from 'lz-string';
import {createHash} from 'node:crypto';
import {fetchCanardDetails} from '../scripts/canard/details.js';
import {makeCanardDetail} from './helpers/canard-detail-fixture.js';
import {makeCanardLayers,review,retrievedAt} from './helpers/canard-fixture.js';
import {normalizeCanardLayers} from '../src/canard-adapter.js';
const batch=()=>normalizeCanardLayers(makeCanardLayers(),{review,retrievedAt});
const opts={now:()=>new Date(retrievedAt),sleep:async()=>{}};
const response=(category='PP')=>new Response(LZ.compressToUTF16(JSON.stringify(makeCanardDetail(category,1))));
const category=o=>new URLSearchParams(o.body).get('_pl_canard_cms_portlet_mapa_INSTANCE_URMGfsNrnTYd_type');

test('details fetch serial credential-free identified POSTs with spacing and complete provenance',async()=>{
 const calls=[],waits=[],progress=[];let active=0;
 const result=await fetchCanardDetails({...opts,batch:batch(),onProgress:p=>progress.push(p),sleep:async ms=>waits.push(ms),fetchImpl:async(url,o)=>{
  assert.equal(active++,0);calls.push([url,o]);await Promise.resolve();active--;return response(category(o));
 }});
 assert.equal(calls.length,3);assert.deepEqual(waits,[250,250]);assert.deepEqual(calls.map(([,o])=>category(o)),['PP','OPP','RL']);
 for(const [url,o]of calls){assert.ok(url.startsWith('https://www.canard.gitd.gov.pl/'));assert.equal(o.method,'POST');assert.equal(o.credentials,'omit');assert.equal(o.redirect,'error');assert.match(o.headers['User-Agent'],/MiVue-TrafficCam/);assert.equal(new URLSearchParams(o.body).get('_pl_canard_cms_portlet_mapa_INSTANCE_URMGfsNrnTYd_id'),'1');assert.equal(o.headers.Authorization,undefined);}
 assert.equal(Object.keys(result.details).length,3);assert.equal(progress.at(-1).completed,3);
 const entry=result.details['["PP","1"]'];assert.equal(entry.raw.id,1);assert.equal(entry.retrievedAt,retrievedAt);assert.match(entry.responseSha256,/^[a-f0-9]{64}$/);
});

test('24-hour cache reuses only matching serial, geometry, hash and identity; removes old entries',async()=>{
 const first=await fetchCanardDetails({...opts,batch:batch(),fetchImpl:async(_,o)=>response(category(o))});
 const original=JSON.stringify(first.cache);let calls=0;
 const cached=await fetchCanardDetails({...opts,batch:batch(),previous:{...first.cache,obsolete:{}},fetchImpl:async()=>{throw Error('Unexpected fetch');}});
 assert.equal(Object.keys(cached.cache).length,3);assert.deepEqual(cached.details,first.details);
 for(const change of ['serial','geometry','hash','expired']){
  const b=batch(),prior=structuredClone(first.cache);
  if(change==='serial')b.observations[0].originalProperties.nrSeryjny='different';
  if(change==='geometry')b.observations[0].geometry.coordinates[0]+=.01;
  if(change==='hash')prior[b.observations[0].sourceId].responseSha256='0'.repeat(64);
  if(change==='expired')prior[b.observations[0].sourceId].fetchedAt='2026-09-19T10:22:00.000Z';
  await fetchCanardDetails({...opts,batch:b,previous:prior,fetchImpl:async(_,o)=>{calls++;return response(category(o));}});
 }
 assert.equal(calls,4);assert.equal(JSON.stringify(first.cache),original);
});

for(const [status,code]of [[403,'CANARD_DETAIL_ACCESS_DENIED'],[429,'CANARD_DETAIL_RATE_LIMITED'],[503,'CANARD_DETAIL_FETCH_FAILED'],[302,'CANARD_DETAIL_FETCH_FAILED']])test(`status ${status} stops immediately without retries or partial results`,async()=>{
 let calls=0;
 await assert.rejects(fetchCanardDetails({...opts,batch:batch(),fetchImpl:async()=>{calls++;return new Response(null,{status});}}),{code});assert.equal(calls,1);
});

test('malformed detail, declared size, streamed size and invalid UTF-8 stop the batch',async()=>{
 for(const [make,code]of [
  [()=>new Response('garbage'),'CANARD_INVALID_DETAIL'],
  [()=>new Response('x',{headers:{'content-length':String(1024*1024+1)}}),'CANARD_DETAIL_BODY_LIMIT'],
  [()=>new Response(new Uint8Array(1024*1024+1)),'CANARD_DETAIL_BODY_LIMIT'],
  [()=>new Response(new Uint8Array([255])),'CANARD_INVALID_DETAIL']
 ]){let calls=0;await assert.rejects(fetchCanardDetails({...opts,batch:batch(),fetchImpl:async()=>{calls++;return make();}}),{code});assert.equal(calls,1);}
});

test('invalid canonical IDs, duplicates and over1000 observations fail before network access',async()=>{
 for(const b of [{observations:Array(1001).fill(batch().observations[0])},{observations:[batch().observations[0],batch().observations[0]]},{observations:[{...batch().observations[0],sourceId:'["PP","01"]'}]}]){
  let calls=0;await assert.rejects(fetchCanardDetails({...opts,batch:b,fetchImpl:async()=>{calls++;return response();}}));assert.equal(calls,0);
 }
});

test('request timeout aborts even a noncooperating mocked network without retry',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0;
 const pending=fetchCanardDetails({...opts,batch:batch(),fetchImpl:async()=>{calls++;return new Promise(()=>{});}});
 const rejected=assert.rejects(pending,{code:'CANARD_DETAIL_TIMEOUT'});t.mock.timers.tick(30000);await rejected;assert.equal(calls,1);
});

test('external cancellation and20-minute budget stop without further requests',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(fetchCanardDetails({...opts,batch:batch(),signal:controller.signal,fetchImpl:async()=>{throw Error('Unexpected fetch');}}),{name:'AbortError'});
 let clock=Date.parse(retrievedAt),calls=0;
 await assert.rejects(fetchCanardDetails({...opts,batch:batch(),now:()=>new Date(clock),fetchImpl:async(_,o)=>{calls++;clock+=20*60*1000;return response(category(o));}}),{code:'CANARD_DETAIL_DEFERRED'});assert.equal(calls,1);
});

test('later access failure leaves supplied cache unchanged and returns no partial batch',async()=>{
 const previous={stale:{raw:'private cached text'}},before=JSON.stringify(previous);let calls=0;
 await assert.rejects(fetchCanardDetails({...opts,batch:batch(),previous,fetchImpl:async(_,o)=>++calls===1?response(category(o)):new Response(null,{status:429})}),{code:'CANARD_DETAIL_RATE_LIMITED'});
 assert.equal(calls,2);assert.equal(JSON.stringify(previous),before);
});

test('cached and fresh encoded bodies share a20MiB retained-result budget',async()=>{
 const seed=await fetchCanardDetails({...opts,batch:{...batch(),observations:[batch().observations[0]]},fetchImpl:async()=>response()});
 const sourceUrl=Object.values(seed.cache)[0].sourceUrl,observations=[],previous={},texts=new Map();
 for(let id=1;id<=21;id++){
  const o=structuredClone(batch().observations[0]);o.sourceId=JSON.stringify(['PP',String(id)]);o.originalProperties.id=id;o.originalProperties.nrSeryjny=`TEST-${id}`;observations.push(o);
  const compressed=LZ.compressToUTF16(JSON.stringify(makeCanardDetail('PP',id)));
  const raw=compressed+'\n'.repeat(1024*1024-Buffer.byteLength(compressed));texts.set(String(id),raw);
  if(id>10)previous[o.sourceId]={raw,fetchedAt:retrievedAt,identity:JSON.stringify({geometry:o.geometry,serial:o.originalProperties.nrSeryjny}),sourceUrl,responseSha256:createHash('sha256').update(raw).digest('hex')};
 }
 let calls=0,completed=0;
 await assert.rejects(fetchCanardDetails({...opts,batch:{...batch(),observations},previous,onProgress:p=>{completed=p.completed;},fetchImpl:async(_,o)=>{calls++;return new Response(texts.get(new URLSearchParams(o.body).get('_pl_canard_cms_portlet_mapa_INSTANCE_URMGfsNrnTYd_id')));}}),{code:'CANARD_DETAIL_TOTAL_LIMIT'});
 assert.equal(calls,10);assert.equal(completed,20);
});
