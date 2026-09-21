import test from 'node:test';import assert from 'node:assert/strict';
import {createCountryExportController} from '../src/country-export.js';
import {createProject,serializeProject,applyEdit} from '../src/project.js';
import {parseDatabase} from '../src/parser.js';
import {makeFixture} from './helpers/fixture.js';
import {packCountryData,boxCountry} from './helpers/country-fixture.js';
import {validateCountryData} from '../src/country-data.js';
import {reconcile} from '../src/reconcile.js';
import {makeImportBatch} from './helpers/import-fixture.js';
async function controller(){const e=await packCountryData([boxCountry('AA',-7.2,36.8,-6.95,37.3),boxCountry('BB',-6.94,36.8,-6.7,37.3)]);return createCountryExportController({loadData:()=>validateCountryData(e.bytes,e.manifest,e.noticeBytes)});}
const options={countryIds:['AA'],decisions:{},componentDecisions:{},acknowledgeExtras:true};
async function prepare(project,c,opts=options){return c.preview({project,sessionId:'x',revision:0,generation:1,options:opts});}
test('reduced BIN reparses without changing project bytes or raw fields',async()=>{
 const project=await createProject(makeFixture([{}, {longitudeRaw:-654}]).bytes),before=await serializeProject(project),c=await controller(),p=await prepare(project,c);
 const result=await c.export({project,sessionId:'x',revision:0,generation:1,token:p.token,format:'bin'}),records=parseDatabase(result.bytes).records;
 assert.equal(records.length,1);assert.equal(records[0].longitude,-7);assert.deepEqual(records[0].rawBytes16To19,[50,0,0,1]);assert.equal(await serializeProject(project),before);
 const data=await c.export({project,sessionId:'x',revision:0,generation:1,token:p.token,format:'geojson'});assert.equal(JSON.parse(data.text).features.length,1);assert.equal(JSON.parse(data.text).exportSelection.boundary.sha256,p.preview.boundary.sha256);
});
test('country builds relocate understood links and preserve safety errors',async()=>{
 const fixture=makeFixture([{longitudeRaw:-654},{typeRaw:964,linkTo:2},{typeRaw:9128}]);const project=await createProject(fixture.bytes),c=await controller(),p=await prepare(project,c);
 const result=await c.export({project,sessionId:'x',revision:0,generation:1,token:p.token,format:'bin'}),records=parseDatabase(result.bytes).records;
 assert.equal(records.length,2);assert.equal(records[0].linkRaw,records[1].offset);
 for(const [input,code]of [[[{typeRaw:964,linkRaw:123},{longitudeRaw:-654}],'UNRESOLVED_LINK'],[[{regionIndex:1,latitudeRaw:3700,longitudeRaw:600},{regionIndex:0,longitudeRaw:-654}],'UNKNOWN_HEADER_DEPENDENCY']]){
  const proj=await createProject(makeFixture(input).bytes),cc=await controller();
  const opts=code==='UNKNOWN_HEADER_DEPENDENCY'?{...options,countryIds:['AA'],decisions:{[proj.records.find(r=>r.sourceOffset===makeFixture(input).recordOffsets[0]).id]:'keep'}}:options;
  const pp=await prepare(proj,cc,opts);await assert.rejects(cc.export({project:proj,sessionId:'x',revision:0,generation:1,token:pp.token,format:'bin'}),{code});
 }
 const deleted=applyEdit(project,{kind:'delete',id:project.records.find(r=>r.sourceOffset===fixture.recordOffsets[2]).id});const dc=await controller(),dp=await prepare(deleted,dc);
 await assert.rejects(dc.export({project:deleted,sessionId:'x',revision:0,generation:1,token:dp.token,format:'bin'}),{code:'DANGLING_LINK'});
});
test('empty non-BIN export is valid, empty BIN and stale tokens are blocked',async()=>{
 const project=await createProject(makeFixture([{}]).bytes),c=await controller(),p=await prepare(project,c,{...options,countryIds:['BB']});
 const args={project,sessionId:'x',revision:0,generation:1,token:p.token};
 assert.equal(JSON.parse((await c.export({...args,format:'geojson'})).text).features.length,0);
 await assert.rejects(c.export({...args,format:'bin'}),{code:'COUNTRY_EMPTY_BIN'});
 for(const patch of [{revision:1},{generation:2},{token:'wrong'},{sessionId:'old'}])await assert.rejects(c.export({...args,...patch,format:'json'}),{code:'COUNTRY_PREVIEW_STALE'});
 c.invalidate();await assert.rejects(c.export({...args,format:'csv'}),{code:'COUNTRY_PREVIEW_STALE'});
});
test('invalid coordinates remain exportable as diagnostics but not a country BIN',async()=>{
 const project=await createProject(makeFixture([{latitudeRaw:NaN}]).bytes),id=project.records[0].id,c=await controller();
 const p=await prepare(project,c,{...options,decisions:{[id]:'keep'}}),args={project,sessionId:'x',revision:0,generation:1,token:p.token};
 await assert.rejects(c.export({...args,format:'bin'}),{code:'INVALID_COORDINATE'});
 assert.equal(JSON.parse((await c.export({...args,format:'geojson'})).text).features[0].geometry,null);
});
test('reference scope preserves geometry and attribution without changing backup',async()=>{
 const project=await createProject(makeFixture([{}]).bytes),batch=makeImportBatch();
 batch.observations[0].geometry={type:'Point',coordinates:[-7,37]};
 const imported=(await reconcile(project,batch)).project,before=await serializeProject(imported),c=await controller(),p=await prepare(imported,c);
 const args={project:imported,sessionId:'x',revision:0,generation:1,token:p.token};
 const result=JSON.parse((await c.export({...args,format:'references'})).text);
 assert.equal(result.features.length,1);assert.deepEqual(result.features[0].geometry.coordinates,[-7,37]);assert.equal(result.features[0].properties.attribution,batch.source.attribution);
 assert.equal(result.exportSelection.boundaryNotice.licence,'Public domain');
 const csv=await c.export({...args,format:'csv'});assert.ok(csv.text.includes('source:'));assert.deepEqual(csv.selectionReport.records.keptIds,p.preview.records.keptIds);
 assert.equal(await serializeProject(imported),before);
});
