import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from '../src/import-csv.js';
import {parseGeoJson} from '../src/import-geojson.js';
import {parseOsmJson} from '../src/import-osm.js';
import {createProject,serializeProject,loadProject} from '../src/project.js';
import {reconcile} from '../src/reconcile.js';
import {exportReferences} from '../src/import-view.js';
import {makeFixture} from './helpers/fixture.js';
const source={namespace:'roundtrip',attribution:'Fixture owner',url:'https://example.com/data'};
const when='2026-10-31T12:00:00.000Z';
const inputs={
 csv:()=>parseCsv('id,latitude,longitude,kind,status,speed,speed_unit,direction,name,extra\na,52,21,camera,unknown,30,mph,90,"A, camera",untouched\nb,53,22,camera,planned,,,,B,second\n',source,when),
 geojson:()=>parseGeoJson(JSON.stringify({type:'FeatureCollection',features:[
  {type:'Feature',id:'a',geometry:{type:'Point',coordinates:[21,52]},properties:{kind:'camera',status:'unknown',speed:30,speed_unit:'mph',direction:90,extra:{nested:['original',null]}}},
  {type:'Feature',id:'b',geometry:{type:'LineString',coordinates:[[22,53],[23,54]]},properties:{kind:'section',status:'planned',extra:'second'}}
 ]}),source,when),
 osm:()=>parseOsmJson(JSON.stringify({elements:[
  {type:'node',id:1,lat:52,lon:21,tags:{highway:'speed_camera',maxspeed:'30 mph',direction:'90',name:'Camera',note:'original'}},
  {type:'node',id:2,lat:53,lon:22,tags:{'proposed:highway':'speed_camera',maxspeed:'signals'}},
  {type:'node',id:3,lat:54,lon:23,tags:{amenity:'bench'}}
 ]}),null,when),
};
for(const [format,parse] of Object.entries(inputs))test(`${format}: every selected observation survives project and reference exports exactly`,async()=>{
 const batch=parse();assert.equal(batch.observations.length,2);
 const initial=await createProject(makeFixture([{}]).bytes);
 const {project}=await reconcile(initial,batch);
 const saved=await serializeProject(project),loaded=await loadProject(saved);
 assert.equal(await serializeProject(loaded),saved);
 const refs=exportReferences(project);assert.equal(exportReferences(loaded),refs);
 const features=JSON.parse(refs).features;assert.equal(features.length,batch.observations.length);
 for(const o of batch.observations){
  const feature=features.find(f=>f.properties.sourceId===o.sourceId);assert.ok(feature);
  assert.deepEqual(feature.geometry,o.geometry);
  for(const field of ['kind','status','name','speedKmh','originalSpeed','direction','url','originalProperties'])assert.deepEqual(feature.properties[field],o[field]);
  assert.equal(feature.properties.namespace,batch.source.namespace);assert.equal(feature.properties.attribution,batch.source.attribution);assert.equal(feature.properties.sourceUrl,batch.source.url);assert.equal(feature.properties.retrievedAt,when);
 }
 const repeat=(await reconcile(loaded,batch)).project;
 assert.equal(exportReferences(repeat),refs);assert.equal(await serializeProject(repeat),saved);
 assert.deepEqual(project.records,initial.records);
});
