import test from 'node:test';
import assert from 'node:assert/strict';
import {createCountryCache} from '../web/country-cache.js';
import {packCountryData,boxCountry} from './helpers/country-fixture.js';
const baseUrl=new URL('https://example.test/app/');
test('loader is lazy, deduplicates successful data and retries failed loads',async()=>{
 const e=await packCountryData([boxCountry('AA',0,0,1,1)]),calls=[];let offline=true;
 const cache=createCountryCache({baseUrl,fetchImpl:async url=>{
  calls.push(String(url));if(offline)throw Error('offline');
  return new Response(String(url).endsWith('manifest.json')?JSON.stringify(e.manifest):String(url).endsWith('NOTICE.json')?e.noticeBytes:e.bytes);
 }});
 assert.equal(calls.length,0);await assert.rejects(cache.load({}),{code:'COUNTRY_DATA_UNAVAILABLE'});offline=false;
 const [a,b]=await Promise.all([cache.load({}),cache.load({})]);assert.equal(a,b);await cache.load({});
 assert.equal(calls.filter(x=>x.endsWith('countries.json')).length,1);
 assert.ok(calls.every(x=>x.startsWith('https://example.test/app/data/countries/')));
});
test('loader rejects corrupt, truncated and overlimit streams, then retries',async()=>{
 const e=await packCountryData([boxCountry('AA',0,0,1,1)]);
 for(const mode of ['http','declared','streamed','truncated','corrupt','abort']){
  let bad=true;const controller=new AbortController();
  const cache=createCountryCache({baseUrl,fetchImpl:async url=>{
   if(!String(url).endsWith('manifest.json'))return new Response(String(url).endsWith('NOTICE.json')?e.noticeBytes:e.bytes);
   if(!bad)return new Response(JSON.stringify(e.manifest));
   if(mode==='http')return new Response('',{status:500});
   if(mode==='declared')return new Response('',{headers:{'content-length':'99999999'}});
   if(mode==='streamed')return new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(65537));c.close();}}));
   if(mode==='abort')return new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([123]));controller.abort();c.close();}}));
   return new Response(mode==='truncated'?'{':JSON.stringify({...e.manifest,sha256:'0'.repeat(64)}));
  }});
  await assert.rejects(cache.load({signal:controller.signal}));bad=false;
  assert.equal((await cache.load({})).dataset.countries.length,1);
 }
});
