import test from 'node:test';
import assert from 'node:assert/strict';
const registry=await import('../web/import-sources.js').catch(()=>({}));
test('local formats remain available while CANARD has an explicit browser access blocker',()=>{
 assert.equal(typeof registry.listImportSources,'function');
 const sources=registry.listImportSources();
 for(const id of ['csv','geojson'])assert.equal(sources.find(s=>s.id===id).available,true);
 const canard=sources.find(s=>s.id==='canard');
 assert.equal(canard.available,false);assert.equal(canard.reasonCode,'CORS_BLOCKED');
 assert.ok(canard.attribution);assert.ok(canard.url.startsWith('https://'));
 sources[0].available=false;assert.equal(registry.listImportSources()[0].available,true);
});
test('disabled, unknown and aborted fetches cannot return a partial batch',async()=>{
 assert.equal(typeof registry.fetchImportSource,'function');
 for(const id of ['canard','unknown','csv'])await assert.rejects(registry.fetchImportSource(id),{code:'SOURCE_UNAVAILABLE'});
 const abort=new AbortController();abort.abort();
 await assert.rejects(registry.fetchImportSource('canard',{signal:abort.signal}),{name:'AbortError'});
});
