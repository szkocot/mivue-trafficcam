import test from 'node:test';
import assert from 'node:assert/strict';
import { makeImportBatch } from './helpers/import-fixture.js';
let parseCsv,parseGeoJson,normalizeBatch;
try{({parseCsv}=await import('../src/import-csv.js'));({parseGeoJson}=await import('../src/import-geojson.js'));({normalizeBatch}=await import('../src/import-normalize.js'));}
catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const source={namespace:'example',attribution:'Example owner',url:null},when='2026-09-20T12:00:00.000Z';
const csv=text=>{assert.equal(typeof parseCsv,'function');return parseCsv(text,source,when);};
const geo=features=>{assert.equal(typeof parseGeoJson,'function');return parseGeoJson(JSON.stringify({type:'FeatureCollection',features}),source,when);};
const feature=(properties={},geometry={type:'Point',coordinates:[19,52]})=>({type:'Feature',id:'a',properties:{kind:'camera',...properties},geometry});
const invalid=fn=>assert.throws(fn,e=>e.code==='INVALID_IMPORT'&&e.issues.length>0);

test('CSV preserves quoted multiline metadata, units, ids and explicit unknowns',()=>{
 const b=csv('\ufeffid,latitude,longitude,kind,status,speed,speed_unit,name,extra\r\n" a ",52,19,camera,active,30,mph,"a, ""b""\nline",x\r\n__proto__,0,0,unknown,,,,,\r\n');
 assert.equal(b.observations[0].sourceId,' a ');assert.equal(b.observations[0].speedKmh,48.28032);
 assert.deepEqual(b.observations[0].originalSpeed,{value:30,unit:'mph'});
 assert.equal(b.observations[0].name,'a, "b"\nline');assert.equal(b.observations[0].originalProperties.extra,'x');
 assert.deepEqual(b.observations[1].geometry.coordinates,[0,0]);assert.equal(b.observations[1].speedKmh,null);assert.equal(b.observations[1].status,'unknown');
});
test('CSV requires the full contract and rejects malformed batches atomically',()=>{
 assert.equal(typeof parseCsv,'function');
 for(const text of ['', 'id,latitude,longitude\na,52,19', 'id,id,latitude,longitude,kind\na,b,52,19,camera',
 'id,latitude,longitude,kind\na,52,19,camera\na,53,20,camera', 'id,latitude,longitude,kind\n,52,19,camera',
 'id,latitude,longitude,kind\na,52,19,camera,extra','id,latitude,longitude,kind\n"a"x,52,19,camera',
 'id,latitude,longitude,kind\n"a,52,19,camera','id,latitude,longitude,kind\na"b,52,19,camera',
 'id,latitude,longitude,kind\na,,19,camera','id,latitude,longitude,kind\na,52junk,19,camera'])invalid(()=>csv(text));
});
test('GeoJSON supports numeric IDs, properties IDs and source section geometry without guessing links',()=>{
 const f=feature({id:0,kind:'section',speed:null},{type:'LineString',coordinates:[[19,52],[20,53]]});delete f.id;
 const b=geo([f]);assert.equal(b.observations[0].sourceId,'0');assert.equal(b.observations[0].speedKmh,null);
 assert.deepEqual(b.observations[0].geometry,f.geometry);
 const point=geo([feature({status:'planned',direction:359})]).observations[0];assert.equal(point.direction,359);
});
test('GeoJSON rejects inconsistent identity and geometry instead of dropping features',()=>{
 assert.equal(typeof parseGeoJson,'function');
 for(const f of [feature({id:'different'}),feature({kind:'foo'}),feature({status:'open'}),feature({direction:360}),
 feature({},null),feature({},{type:'Point',coordinates:[181,52]}),feature({},{type:'Point',coordinates:['19',52]}),
 feature({},{type:'MultiPoint',coordinates:[[19,52]]}),feature({},{type:'LineString',coordinates:[[19,52],[20,53]]}),
 feature({kind:'section'},{type:'LineString',coordinates:[[19,52]]})])invalid(()=>geo([f]));
 invalid(()=>parseGeoJson('{',source,when));invalid(()=>parseGeoJson('{}',source,when));
});
test('speed values require explicit supported units and cannot be negative or nonfinite',()=>{
 assert.equal(typeof parseGeoJson,'function');
 for(const properties of [{speed:50},{speed:-1,speed_unit:'km/h'},{speed:'NaN',speed_unit:'km/h'},
 {speed:50,speed_unit:'knots'},{speed:true,speed_unit:'km/h'}])invalid(()=>geo([feature(properties)]));
 assert.equal(geo([feature({speed:0,speed_unit:'km/h'})]).observations[0].speedKmh,0);
});
test('normalization clones metadata safely and rejects inconsistent normalized speed or cyclic data',()=>{
 assert.equal(typeof normalizeBatch,'function');
 const b=makeImportBatch();b.observations[0].originalProperties=JSON.parse('{"__proto__":{"polluted":true},"constructor":"text","x":[1,null]}');
 const out=normalizeBatch(b);assert.equal({}.polluted,undefined);assert.equal(out.observations[0].originalProperties.__proto__.polluted,true);
 b.observations[0].originalProperties.x[0]=9;assert.equal(out.observations[0].originalProperties.x[0],1);
 const bad=makeImportBatch();bad.observations[0].speedKmh=100;invalid(()=>normalizeBatch(bad));
 bad.observations[0].originalProperties.self=bad;invalid(()=>normalizeBatch(bad));
 invalid(()=>normalizeBatch({...makeImportBatch(),retrievedAt:'not-a-date'}));
 invalid(()=>normalizeBatch({...makeImportBatch(),source:{...source,namespace:''}}));
});
test('input, metadata, identifier, count and geometry limits reject rather than truncate',()=>{
 assert.equal(typeof normalizeBatch,'function');
 invalid(()=>parseCsv('x'.repeat(20*1024*1024+1),source,when));
 const b=makeImportBatch();b.observations[0].sourceId='x'.repeat(257);invalid(()=>normalizeBatch(b));
 b.observations[0].sourceId='x';b.observations[0].originalProperties={x:'x'.repeat(65536)};invalid(()=>normalizeBatch(b));
 invalid(()=>geo([feature({kind:'section'},{type:'LineString',coordinates:Array.from({length:1001},()=>[19,52])})]));
 const many=makeImportBatch();many.observations=Array.from({length:100001},(_,i)=>({...many.observations[0],sourceId:String(i)}));invalid(()=>normalizeBatch(many));
});
