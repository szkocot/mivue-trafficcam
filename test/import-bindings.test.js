import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,applyEdit,serializeProject,loadProject} from '../src/project.js';
import {reconcile,resolveImport} from '../src/reconcile.js';
import {referenceView,exportReferences} from '../src/import-view.js';
import {projectView} from '../src/project-view.js';
import {buildProject} from '../src/encoder.js';
import {createHistory} from '../src/history.js';
import {makeFixture} from './helpers/fixture.js';
import {makeImportBatch} from './helpers/import-fixture.js';
const section=()=>{const b=makeImportBatch();b.observations[0]={...b.observations[0],kind:'section',geometry:{type:'LineString',coordinates:[[-7,37],[-6.9,37.1]]}};return b;};
const bind=(p,ids)=>resolveImport(p,{namespace:'example',sourceId:'a',action:'bind',recordIds:ids});
async function setup(records,batch=section()){const {bytes}=makeFixture(records);const original=await createProject(bytes);return {bytes,original,project:(await reconcile(original,batch)).project};}

test('section binding includes complete multiple pairs, every endpoint projects metadata, binary remains exact',async()=>{
 const {bytes,project}=await setup([{typeRaw:964,linkTo:1},{typeRaw:9128},{typeRaw:964,linkTo:3},{typeRaw:9128}]);
 const ids=project.records.map(r=>r.id),p=await bind(project,ids),ref=referenceView(p)[0];
 assert.deepEqual(p.ingestion.bindings[0],{namespace:'example',sourceId:'a',recordId:ids[0],recordIds:ids});
 assert.deepEqual(ref.recordIds,ids);assert.equal(ref.encoded,true);assert.equal(ref.recordId,ids[0]);
 assert.ok((await projectView(p)).records.every(r=>r.sourceObservations.length===1));
 assert.deepEqual(await loadProject(await serializeProject(p)),p);assert.deepEqual(Buffer.from((await buildProject(p)).bytes),Buffer.from(bytes));
 assert.deepEqual(JSON.parse(exportReferences(p)).features[0].properties.recordIds,ids);
 assert.deepEqual(project.records,p.records);
});
test('point binding can attach several compatible records; proximity alone never binds',async()=>{
 const b=makeImportBatch();b.observations[0].geometry.coordinates=[-7,37];
 const {project}=await setup([{typeRaw:1},{typeRaw:5}],b);assert.deepEqual(referenceView(project)[0].recordIds,[]);
 const p=await bind(project,project.records.map(r=>r.id));assert.ok((await projectView(p)).records.every(r=>r.sourceObservations.length===1));
 await assert.rejects(bind(p,[p.records[0].id,p.records[0].id]));
});
test('binding rejects half/mismatched pairs, wrong point types, duplicate/missing/deleted new targets and primary contradictions',async()=>{
 const {project}=await setup([{typeRaw:964,linkTo:1},{typeRaw:9128},{typeRaw:964,linkTo:3},{typeRaw:9128},{typeRaw:1}]);const ids=project.records.map(r=>r.id);
 for(const targets of [[ids[0]],[ids[1]],[ids[0],ids[3]],[ids[0],ids[1],ids[1]],['source:missing'],[ids[4]]])await assert.rejects(bind(project,targets));
 await assert.rejects(bind(applyEdit(project,{kind:'delete',id:ids[1]}),ids.slice(0,2)));
 await assert.rejects(resolveImport(project,{namespace:'example',sourceId:'a',action:'bind',recordId:ids[1],recordIds:ids.slice(0,2)}));
 const point=(await reconcile(project,makeImportBatch())).project;
 await assert.rejects(bind(point,[ids[0]]));
 const red=makeImportBatch();red.observations[0].kind='red-light';
 await assert.rejects(bind((await reconcile(project,red)).project,[ids[4]]));
});
test('effective link resolution is validated when binding and reopening an untrusted project',async()=>{
 const {project}=await setup([{typeRaw:964,linkRaw:123},{typeRaw:9128},{typeRaw:9128}]);const ids=project.records.map(r=>r.id);
 await assert.rejects(bind(project,ids.slice(0,2)));
 const resolved=applyEdit(project,{kind:'resolve-link',id:ids[0],targetId:ids[2],reason:'Reviewed association'});
 const p=await bind(resolved,[ids[0],ids[2]]);assert.equal(referenceView(p)[0].encoded,true);
 const corrupt=structuredClone(p);corrupt.ingestion.bindings[0].recordIds=[ids[0],ids[1]];
 await assert.rejects(loadProject(JSON.stringify(corrupt)));
});
test('section reimport retains bindings and manual coordinates; deletion stays protected and unbinding is atomic undo',async()=>{
 const {project}=await setup([{typeRaw:964,linkTo:1},{typeRaw:9128}]);const ids=project.records.map(r=>r.id);
 let p=await bind(project,ids);p=applyEdit(p,{kind:'update',id:ids[0],changes:{latitude:37.1}});
 const b=section();b.observations[0].geometry.coordinates=[[-6,38],[-5,39]];
 p=(await reconcile(p,b)).project;assert.deepEqual(p.ingestion.bindings[0].recordIds,ids);assert.equal(p.records[0].edits.latitude,37.1);
 p=applyEdit(p,{kind:'delete',id:ids[1]});assert.equal(referenceView(p)[0].encoded,false);assert.equal(referenceView(p)[0].encodingStatus,'deleted');
 p=(await reconcile(p,b)).project;assert.equal(p.records[1].deleted,true);assert.deepEqual(p.ingestion.bindings[0].recordIds,ids);
 const history=createHistory(p);history.commit(await resolveImport(p,{namespace:'example',sourceId:'a',action:'reference'}));
 assert.deepEqual(referenceView(history.current)[0].recordIds,[]);assert.deepEqual(history.undo(),p);assert.equal(referenceView(history.redo())[0].encoded,false);
});
test('unsupported geometry change detaches all targets without changing binary records; legacy point saves remain readable',async()=>{
 const {project}=await setup([{typeRaw:964,linkTo:1},{typeRaw:9128}]);const ids=project.records.map(r=>r.id),bound=await bind(project,ids);
 const changed=(await reconcile(bound,makeImportBatch())).project;assert.equal(changed.ingestion.bindings.length,0);assert.deepEqual(changed.records,bound.records);
 const point=await setup([{}],makeImportBatch());const legacy=await resolveImport(point.project,{namespace:'example',sourceId:'a',action:'bind',recordId:point.project.records[0].id});delete legacy.ingestion.bindings[0].recordIds;
 for(const version of [2,3]){const p=structuredClone(legacy);p.projectVersion=version;if(version===2)for(const s of p.ingestion.sources){delete s.syncEnabled;delete s.notices;}assert.equal(referenceView(await loadProject(JSON.stringify(p)))[0].recordId,p.records[0].id);}
});

test('batch bind/reference decisions commit once, reject late invalid actions atomically and retain ANY active notice',async()=>{
 const {resolveImports}=await import('../src/reconcile.js'),{projectNotices}=await import('../src/source-notices.js'),{review}=await import('./helpers/canard-fixture.js');
 const b=section();b.observations.push({...makeImportBatch().observations[0],sourceId:'b'});
 const {project}=await setup([{typeRaw:964,linkTo:1},{typeRaw:9128},{}],b),ids=project.records.map(r=>r.id),before=structuredClone(project);
 const first={namespace:'example',sourceId:'a',action:'bind',recordIds:ids.slice(0,2)},second={namespace:'example',sourceId:'b',action:'bind',recordIds:[ids[2]]};
 await assert.rejects(resolveImports(project,[first,{...second,recordIds:['missing']} ]));assert.deepEqual(project,before);
 const p=await resolveImports(project,[first,second]);assert.equal(p.ingestion.bindings.length,2);
 const h=createHistory(project);h.commit(p);assert.deepEqual(h.undo(),project);assert.deepEqual(h.redo(),p);
 p.ingestion.sources[0].notices=structuredClone(review.notices);
 const deleted=applyEdit(p,{kind:'delete',id:ids[0]});assert.equal(referenceView(deleted).find(o=>o.sourceId==='a').encoded,false);
 assert.equal(projectNotices(deleted,{encodedOnly:true}).length,1);
 const detached=await resolveImports(deleted,[{...first,action:'reference'},{...second,action:'reference'}]);
 assert.equal(detached.ingestion.bindings.length,0);assert.equal(projectNotices(detached,{encodedOnly:true}).length,0);
});
test('untrusted array bindings reject bad primaries, duplicates, wrong categories and shared endpoints',async()=>{
 const {project}=await setup([{typeRaw:964,linkTo:2},{typeRaw:964,linkTo:2},{typeRaw:9128},{typeRaw:3}]);const ids=project.records.map(r=>r.id);
 await assert.rejects(bind(project,ids.slice(0,3)));
 const point=(await reconcile(project,makeImportBatch())).project;
 for(const target of [[ids[3]],[ids[0]],[ids[3],ids[3]]]){
  const p=structuredClone(point);p.ingestion.bindings=[{namespace:'example',sourceId:'a',recordId:target[0],recordIds:target}];await assert.rejects(loadProject(JSON.stringify(p)));
 }
 const valid=await setup([{},{}],makeImportBatch()),p=await bind(valid.project,valid.project.records.map(r=>r.id));
 const corrupt=structuredClone(p);corrupt.ingestion.bindings[0].recordId=corrupt.ingestion.bindings[0].recordIds[1];await assert.rejects(loadProject(JSON.stringify(corrupt)));
});

test('complete CANARD details clear a removed car limit while OPP association and BIN stay exact',async()=>{
 const {CANARD_NAMESPACE}=await import('../src/canard-snapshot.js'),{enrichCanardBatch}=await import('../src/canard-details.js');
 const {makeCanardDetail,detailRow}=await import('./helpers/canard-detail-fixture.js');
 const batch=section();batch.source.namespace=CANARD_NAMESPACE;batch.observations[0].sourceId='["OPP","1"]';
 const detail=limits=>enrichCanardBatch(batch,{'["OPP","1"]':{raw:makeCanardDetail('OPP',1,limits),retrievedAt:batch.retrievedAt,sourceUrl:'https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen',responseSha256:'a'.repeat(64)}});
 const known=detail([detailRow('50')]);known.observations[0].name='Old name';known.observations[0].direction=90;
 const {bytes,project}=await setup([{typeRaw:964,linkTo:1},{typeRaw:9128}],known),ids=project.records.map(r=>r.id);
 const bound=await resolveImport(project,{namespace:CANARD_NAMESPACE,sourceId:'["OPP","1"]',action:'bind',recordIds:ids});
 const partial=structuredClone(batch);partial.observations[0].speedKmh=null;partial.observations[0].originalSpeed=null;
 const sticky=(await reconcile(bound,partial)).project;assert.equal(referenceView(sticky)[0].speedKmh,50);
 const refreshed=(await reconcile(bound,detail([]))).project,ref=referenceView(refreshed)[0];
 assert.equal(ref.speedKmh,null);assert.equal(ref.originalSpeed,null);assert.equal(ref.name,null);assert.equal(ref.direction,null);
 assert.deepEqual(ref.originalProperties.canardDetail.raw.limity,[]);assert.deepEqual(ref.recordIds,ids);assert.equal(ref.encoded,true);
 assert.deepEqual(refreshed.records,bound.records);assert.deepEqual((await projectView(refreshed)).records.map(r=>r.sourceObservations[0].speedKmh),[null,null]);
 const reopened=await loadProject(await serializeProject(refreshed));assert.deepEqual(Buffer.from((await buildProject(reopened)).bytes),Buffer.from(bytes));
});
