import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceCache } from '../web/source-cache.js';
const headers={'Last-Modified':'Thu, 16 Jul 2026 07:39:32 GMT','Content-Length':'1'};
const now=()=> '2026-09-20T00:00:00.000Z';
function setup(fetchImpl){
 let saved=null; const statuses=[];
 const store={getCache:async()=>saved,putCache:async e=>{saved=e;}};
 const validateBytes=async b=>{if(b[0]!==42)throw Error('bad bytes');return 'hash';};
 const cache=createSourceCache({store,fetchImpl,validateBytes,now,onStatus:s=>statuses.push(s)});
 return {cache,store,statuses,get saved(){return saved;}};
}
test('first GET is coalesced; unchanged HEAD avoids downloading body',async()=>{
 let gets=0,heads=0;
 const x=setup(async(_,o)=>{
  assert.equal(o.credentials,'omit');
  if(o.method==='HEAD'){heads++;return new Response(null,{headers});}
  gets++;return new Response(new Uint8Array([42]),{headers});
 });
 const a=x.cache.check(),b=x.cache.check();assert.strictEqual(a,b);await a;
 assert.equal(gets,1);assert.equal(x.saved.source.sha256,'hash');
 await x.cache.check();assert.equal(gets,1);assert.equal(heads,1);assert.equal(x.statuses.at(-1).state,'unchanged');
});
test('missing validators/offline retain usable bytes and never claim freshness',async()=>{
 let mode='first';const x=setup(async()=>{
  if(mode==='offline')throw Error('offline');
  return mode==='first'?new Response(new Uint8Array([42]),{headers}):new Response(null);
 });
 await x.cache.check();mode='missing';await x.cache.check();assert.equal(x.statuses.at(-1).state,'check-unavailable');
 mode='offline';await x.cache.check();assert.equal(x.statuses.at(-1).state,'check-unavailable');assert.equal(x.saved.bytes[0],42);
});
test('changed GET metadata is authoritative; invalid updates and cancelled validation preserve cache',async()=>{
 let mode='first',release;const x=setup(async(_,o)=>{
  if(mode==='first')return new Response(new Uint8Array([42]),{headers});
  if(o.method==='HEAD')return new Response(null,{headers:{...headers,ETag:'new'}});
  if(mode==='cancel')await new Promise(r=>{release=r;});
  return new Response(new Uint8Array([mode==='bad'?0:42]),{headers:{...headers,ETag:'actual'}});
 });
 await x.cache.check();const original=x.saved;mode='bad';await x.cache.check();assert.strictEqual(x.saved,original);
 mode='cancel';const pending=x.cache.check();while(!release)await new Promise(r=>setImmediate(r));
 x.cache.cancel();release();await pending;assert.strictEqual(x.saved,original);
 mode='new';await x.cache.check();assert.equal(x.saved.source.etag,'actual');
});
test('storage failure retains in-memory download; corrupt persisted cache is rejected',async()=>{
 const x=setup(async()=>new Response(new Uint8Array([42]),{headers}));
 x.store.putCache=async()=>{throw Error('quota');};
 const result=await x.cache.check();assert.equal(result.bytes[0],42);assert.ok(x.statuses.some(s=>s.state==='cache-failed'));
 x.store.getCache=async()=>({version:1,bytes:new Uint8Array([0]),source:{}});
 assert.equal(await x.cache.loadCached(),null);
});
