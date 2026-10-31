import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOsmJson} from '../src/import-osm.js';
const date='2026-10-31T12:00:00Z';
const parse=elements=>parseOsmJson(JSON.stringify({version:0.6,elements}),null,date);
const camera={type:'node',id:1,lat:52,lon:21,tags:{highway:'speed_camera',maxspeed:'30 mph',direction:'90',name:'Test'}};
test('OSM nodes preserve identity, original evidence, units and unknown operational status',()=>{
 const b=parse([camera]);const o=b.observations[0];
 assert.equal(b.source.namespace,'openstreetmap');assert.match(b.source.attribution,/ODbL/);
 assert.equal(o.sourceId,'node/1');assert.equal(o.speedKmh,30*1.609344);assert.equal(o.originalSpeed.unit,'mph');
 assert.equal(o.direction,90);assert.equal(o.status,'unknown');assert.deepEqual(o.originalProperties,camera);
});
test('unknown tag values remain evidence; explicit proposed camera stays planned',()=>{
 const o=parse([{...camera,tags:{'proposed:highway':'speed_camera',maxspeed:'signals',direction:'forward'}}]).observations[0];
 assert.equal(o.status,'planned');assert.equal(o.speedKmh,null);assert.equal(o.direction,null);assert.equal(o.originalProperties.tags.maxspeed,'signals');
});
test('OSM import fails closed on unsupported enforcement geometry, empty selection and malformed identity',()=>{
 for(const elements of [[{type:'relation',id:1,tags:{type:'enforcement',enforcement:'maxspeed'},members:[]}],[],[{...camera,id:-1}],[{...camera,lon:181}],[camera,camera]])assert.throws(()=>parse(elements),{code:'INVALID_IMPORT'});
});
test('OSM imports obey file, element and metadata limits and reject deleted geometry',()=>{
 assert.throws(()=>parseOsmJson(' '.repeat(20*1024*1024+1),null,date),e=>e.issues[0].code==='INPUT_LIMIT');
 assert.throws(()=>parse(Array.from({length:100001},()=>camera)),e=>e.issues[0].code==='COUNT_LIMIT');
 assert.throws(()=>parse([{...camera,visible:false}]),{code:'INVALID_IMPORT'});
 assert.throws(()=>parse([{...camera,tags:{highway:'speed_camera',note:'x'.repeat(65536)}}]),e=>e.issues[0].code==='METADATA_LIMIT');
});
test('OSM refresh clears obsolete metadata without touching manually edited binary coordinates',async()=>{
 const {createProject,applyEdit}=await import('../src/project.js');
 const {reconcile,resolveImport}=await import('../src/reconcile.js');
 const {makeFixture}=await import('./helpers/fixture.js');
 let p=(await reconcile(await createProject(makeFixture([{}]).bytes),parse([camera]))).project;
 p=await resolveImport(p,{namespace:'openstreetmap',sourceId:'node/1',action:'bind',recordId:p.records[0].id});
 p=applyEdit(p,{kind:'update',id:p.records[0].id,changes:{latitude:40}});
 p=(await reconcile(p,parse([{...camera,tags:{highway:'speed_camera',maxspeed:'signals'}}]))).project;
 const o=p.ingestion.observations[0];assert.equal(o.speedKmh,null);assert.equal(o.direction,null);assert.equal(o.name,null);
 assert.equal(p.records[0].edits.latitude,40);assert.equal(o.originalProperties.tags.maxspeed,'signals');
});
