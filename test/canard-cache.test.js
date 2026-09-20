import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanardCache} from '../web/canard-cache.js';
import {prepareSnapshot} from '../src/canard-snapshot.js';
import {normalizeCanardLayers} from '../src/canard-adapter.js';
import {makeCanardLayers,review,retrievedAt} from './helpers/canard-fixture.js';
const baseUrl='https://example.test/mivue-trafficcam/';
const now=()=>Date.parse(retrievedAt);
async function entry(){return prepareSnapshot({batch:normalizeCanardLayers(makeCanardLayers(),{review,retrievedAt}),notices:review.notices,checkedAt:retrievedAt,review});}
function memory(value=null){return {value,async getCanardCache(){return this.value;},async putCanardCache(v){this.value=v;},async clearCanardCache(){this.value=null;}};}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('first startup downloads once and concurrent/repeated checks share work',async()=>{
 const e=await entry(),store=memory(),calls=[];
 const cache=createCanardCache({store,baseUrl,now,fetchImpl:async(url,o)=>{calls.push(url);assert.equal(o.credentials,'omit');assert.equal(o.redirect,'error');return url.endsWith('manifest.json')?Response.json(e.manifest):new Response(e.bytes);}});
 await cache.loadCached();const results=await Promise.all([cache.check(),cache.check()]);await cache.check();
 assert.equal(results[0].snapshot.batch.observations.length,3);assert.equal(calls.length,2);assert.equal(store.value.manifest.sha256,e.manifest.sha256);
 const requests=[];const next=createCanardCache({store,baseUrl,now,fetchImpl:async url=>{requests.push(url);return Response.json(e.manifest);}});
 await next.loadCached();await next.check();assert.deepEqual(requests,[baseUrl+'data/canard/manifest.json']);
});
test('manifest freshness advances without replacing snapshot bytes',async()=>{
 const e=await entry(),store=memory(e),checkedAt='2026-09-20T10:23:00.000Z';
 const c=createCanardCache({store,baseUrl,now:()=>Date.parse(checkedAt),fetchImpl:async()=>Response.json({...e.manifest,checkedAt})});
 await c.loadCached();const result=await c.check();assert.equal(result.manifest.checkedAt,checkedAt);assert.deepEqual(result.bytes,e.bytes);
});
test('new body 404/corruption/network failure keeps the last validated cache',async()=>{
 const e=await entry();
 for(const mode of ['skew','corrupt','offline']){
  const store=memory(e),statuses=[];
  const c=createCanardCache({store,baseUrl,now,onStatus:s=>statuses.push(s),fetchImpl:async url=>{
   if(mode==='offline')throw Error('offline');
   if(url.endsWith('manifest.json'))return Response.json({...e.manifest,sha256:'0'.repeat(64),path:`data/canard/snapshot-${'0'.repeat(64)}.json`});
   return mode==='skew'?new Response('',{status:404}):new Response(new Uint8Array(e.bytes.length));
  }});
  await c.loadCached();assert.equal((await c.check()).manifest.sha256,e.manifest.sha256);assert.equal(store.value,e);assert.equal(statuses.at(-1).state,'check-failed');
 }
});
test('corrupt cache is not offered on failed network check',async()=>{
 const e=await entry();e.bytes[0]^=1;const store=memory(e);
 const c=createCanardCache({store,baseUrl,now,fetchImpl:async()=>{throw Error('offline');}});
 assert.equal(await c.loadCached(),null);assert.equal(await c.check(),null);
});
test('unsafe manifest does not trigger a request outside the dataset path',async()=>{
 const e=await entry();let calls=0;
 const c=createCanardCache({store:memory(),baseUrl,now,fetchImpl:async()=>{calls++;return Response.json({...e.manifest,path:'https://evil.test/data'});}});
 assert.equal(await c.check(),null);assert.equal(calls,1);
});
test('storage failure remains visible while validated data works in memory',async()=>{
 const e=await entry(),states=[];const store=memory();store.putCanardCache=async()=>{throw Error('quota');};
 const c=createCanardCache({store,baseUrl,now,onStatus:s=>states.push(s),fetchImpl:async url=>url.endsWith('manifest.json')?Response.json(e.manifest):new Response(e.bytes)});
 assert.equal((await c.check()).snapshot.batch.observations.length,3);assert.equal(states.at(-1).persistenceFailed,true);
});
test('cached upstream data older than 48 hours remains explicitly stale',async()=>{
 const e=await entry();const states=[];
 const c=createCanardCache({store:memory(e),baseUrl,now:()=>Date.parse(retrievedAt)+49*3600000,onStatus:s=>states.push(s),fetchImpl:async()=>Response.json(e.manifest)});
 await c.loadCached();await c.check();assert.equal(states.at(-1).stale,true);
});
test('cancellation fences a body fetch that ignores abort',async()=>{
 const e=await entry(),body=deferred(),entered=deferred(),store=memory();
 const c=createCanardCache({store,baseUrl,now,fetchImpl:async url=>{if(url.endsWith('manifest.json'))return Response.json(e.manifest);entered.resolve();return body.promise;}});
 const pending=c.check();await entered.promise;c.cancel();body.resolve(new Response(e.bytes));
 assert.equal(await pending,null);assert.equal(store.value,null);
});
test('disabled manifest clears cache and fences a pending cache read',async()=>{
 const e=await entry(),read=deferred(),states=[];const store=memory(e);store.getCanardCache=()=>read.promise;
 const c=createCanardCache({store,baseUrl,now,onStatus:s=>states.push(s),fetchImpl:async()=>Response.json({schemaVersion:1,state:'disabled',checkedAt:retrievedAt,reasonCode:'RIGHTS_REVIEW',messagePl:'Wyłączone',messageEn:'Disabled'})});
 const loading=c.loadCached();assert.equal(await c.check(),null);read.resolve(e);assert.equal(await loading,null);
 assert.equal(store.value,null);assert.equal(states.at(-1).state,'disabled');
});
