import test from 'node:test';
import assert from 'node:assert/strict';
import {benchmarkCountries,syntheticPoints} from '../scripts/countries/benchmark.mjs';
test('benchmark is deterministic, aggregate-only and honours early abort',async()=>{
 const items=syntheticPoints(100),a=await benchmarkCountries(items),b=await benchmarkCountries(items);
 assert.equal(a.points,100);assert.deepEqual(a.counts,b.counts);assert.equal(Object.values(a.counts).reduce((n,v)=>n+v,0),100);
 assert.equal(a.boundarySha256,b.boundarySha256);assert.ok(a.assetBytes>0);assert.ok(a.elapsedMs>=0);assert.ok(!JSON.stringify(a).includes('longitude'));
 await assert.rejects(benchmarkCountries(items,{signal:AbortSignal.abort()}),{code:'COUNTRY_CANCELLED'});
 assert.throws(()=>syntheticPoints(-1));assert.throws(()=>syntheticPoints(1.5));
});
