import test from 'node:test';
import assert from 'node:assert/strict';
import {createCountryClassifier} from '../src/country-classifier.js';
import {validateCountryData} from '../src/country-data.js';
import {boxCountry,packCountryData} from './helpers/country-fixture.js';
async function classifier(countries){const e=await packCountryData(countries);return createCountryClassifier(await validateCountryData(e.bytes,e.manifest,e.noticeBytes));}
test('border review includes outside-box points, exact edges and vertices',async()=>{
 const c=await classifier([boxCountry('AA',0,0,2,2)]);
 for(const [lat,lon,status]of [[1,1,'assigned'],[1,2.005,'border'],[0,0,'border'],[1,2,'border'],[1,3,'unassigned'],[NaN,1,'invalid'],[91,1,'invalid']])assert.equal(c.classify({latitude:lat,longitude:lon}).status,status);
 const deg=180/Math.PI/6371008.8;
 assert.equal(c.classify({latitude:1,longitude:2+999*deg/Math.cos(Math.PI/180)}).status,'border');
 assert.equal(c.classify({latitude:1,longitude:2+1001*deg/Math.cos(Math.PI/180)}).status,'unassigned');
});
test('holes, overlap and islands are not rectangular country approximations',async()=>{
 const a=boxCountry('AA',0,0,4,4);a.geometry.coordinates.push([[1,1],[3,1],[3,3],[1,3],[1,1]]);
 const b=boxCountry('BB',3.5,0,5,4);b.geometry={type:'MultiPolygon',coordinates:[b.geometry.coordinates,boxCountry('BB',10,10,12,12).geometry.coordinates]};
 for(const countries of [[a,b],[b,a]]){
  const c=await classifier(countries);
  assert.equal(c.classify({latitude:2,longitude:2}).status,'unassigned');
  assert.equal(c.classify({latitude:2,longitude:1.001}).status,'border');
  assert.deepEqual(c.classify({latitude:2,longitude:3.75}),{status:'border',countryIds:['AA','BB']});
  assert.deepEqual(c.classify({latitude:11,longitude:11}),{status:'assigned',countryIds:['BB']});
 }
});
test('wrapped dateline polygons and polar rings do not contain their antipodes',async()=>{
 const a=boxCountry('AA',179,-2,-179,2);
 const polar={...boxCountry('BB',0,0,1,1),geometry:{type:'Polygon',coordinates:[[[-135,85],[-45,85],[45,85],[135,85],[-135,85]]]}};
 const c=await classifier([a,polar]);
 for(const lon of [180,-180])assert.deepEqual(c.classify({latitude:0,longitude:lon}),{status:'assigned',countryIds:['AA']});
 assert.equal(c.classify({latitude:0,longitude:0}).status,'unassigned');
 assert.deepEqual(c.classify({latitude:89,longitude:0}),{status:'assigned',countryIds:['BB']});
 assert.equal(c.classify({latitude:-89,longitude:0}).status,'unassigned');
});
test('batch cancellation returns no partial result and validates stable IDs',async()=>{
 const c=await classifier([boxCountry('AA',0,0,2,2)]),controller=new AbortController();
 const items=Array.from({length:600},(_,i)=>({id:String(i),latitude:1,longitude:1}));
 await assert.rejects(c.classifyMany(items,{signal:controller.signal,yieldControl:async()=>controller.abort()}),{code:'COUNTRY_CANCELLED'});
 const result=await c.classifyMany(items,{});assert.equal(result.size,600);assert.deepEqual(result.get('599'),{status:'assigned',countryIds:['AA']});
 await assert.rejects(c.classifyMany([items[0],items[0]],{}));
});
test('duplicate vertices use endpoint distance, not an infinite segment',async()=>{
 const a=boxCountry('AA',0,0,2,2);a.geometry.coordinates[0].splice(1,0,[0,0]);
 const c=await classifier([a]);assert.equal(c.classify({latitude:-.008,longitude:-.008}).status,'unassigned');
});
