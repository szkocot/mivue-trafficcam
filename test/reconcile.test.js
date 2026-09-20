import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject,applyEdit,loadProject,serializeProject } from '../src/project.js';
import { buildProject } from '../src/encoder.js';
import { parseDatabase } from '../src/parser.js';
import { makeFixture } from './helpers/fixture.js';
import { makeImportBatch } from './helpers/import-fixture.js';
let reconcile,setImportPolicy,resolveImport;
try{({reconcile,setImportPolicy,resolveImport}=await import('../src/reconcile.js'));}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const batch=(items=[{}],namespace='example')=>{const b=makeImportBatch();return {...b,source:{...b.source,namespace},observations:items.map((o,i)=>({...b.observations[0],sourceId:String(i),...o}))};};
async function base(policy=true){assert.equal(typeof reconcile,'function');let p=await createProject(makeFixture([{}]).bytes);return policy?setImportPolicy(p,{namespace:'example',kind:'camera',templateId:p.records[0].id}):p;}
test('active additions copy explicit templates; repeats are identity no-ops and speed is not encoded',async()=>{
 const p=await base(),b=batch([{geometry:{type:'Point',coordinates:[-6,37]},speedKmh:80,originalSpeed:{value:80,unit:'km/h'}}]);
 const a=await reconcile(p,b);assert.equal(a.summary.added,1);assert.equal(p.records.length,1);
 const clone=a.project.records[1];assert.deepEqual(clone.edits,{latitude:37,longitude:-6});
 const built=await buildProject(a.project),raw=parseDatabase(built.bytes).records.find(r=>r.longitude===-6);
 assert.deepEqual(raw.rawBytes16To19,[50,0,0,1]);assert.equal(raw.typeRaw,1);
 const same=await reconcile(a.project,{...b,retrievedAt:'2026-09-21T00:00:00.000Z'});assert.strictEqual(same.project,a.project);
 const moved=await reconcile(a.project,batch([{geometry:{type:'Point',coordinates:[-5,37.2]}}]));
 assert.equal(moved.summary.updated,1);assert.equal(moved.project.records.length,2);assert.equal(moved.project.records[1].edits.latitude,37.2);
 assert.deepEqual(await loadProject(await serializeProject(moved.project)),moved.project);
});
test('manual coordinate group and deleted bound records survive source changes/reopen',async()=>{
 let p=(await reconcile(await base(),batch())).project;
 p=applyEdit(p,{kind:'update',id:'new:1',changes:{latitude:52}}); // explicit same-value edit owns both coordinates
 p=await loadProject(await serializeProject(p));
 const b=batch([{geometry:{type:'Point',coordinates:[20,53]},name:'new name'}]);
 const result=await reconcile(p,b);assert.equal(result.summary.protected,1);assert.deepEqual(result.project.records[1].edits,{latitude:52,longitude:19});
 assert.equal(result.project.ingestion.observations[0].name,'new name');
 p=applyEdit(result.project,{kind:'delete',id:'new:1'});const deleted=await reconcile(p,batch([{geometry:{type:'Point',coordinates:[21,54]}}]));
 assert.equal(deleted.project.records.length,2);assert.equal(deleted.project.records[1].deleted,true);
});
test('new observations without templates or active status stay reference-only; later policy reconsiders same content',async()=>{
 const p=await base(false),b=batch();const first=await reconcile(p,b);assert.equal(first.summary.referenceOnly,1);
 const configured=setImportPolicy(first.project,{namespace:'example',kind:'camera',templateId:p.records[0].id});
 assert.equal((await reconcile(configured,b)).summary.added,1);
 for(const status of ['planned','inactive','unknown'])assert.equal((await reconcile(await base(),batch([{status}]))).summary.added,0);
 const section=await reconcile(await base(),batch([{kind:'section',geometry:{type:'LineString',coordinates:[[19,52],[20,53]]}}]));assert.equal(section.project.records.length,1);
 assert.throws(()=>setImportPolicy(p,{namespace:'example',kind:'section',templateId:p.records[0].id}));
 const linked=await createProject(makeFixture([{typeRaw:964},{typeRaw:9128}]).bytes);
 assert.throws(()=>setImportPolicy(linked,{namespace:'example',kind:'camera',templateId:linked.records[0].id}));
});
test('nearby baseline and within-batch identities hold without order-dependent additions',async()=>{
 const p=await base();const b=batch([{sourceId:'z',geometry:{type:'Point',coordinates:[19,52]}},{sourceId:'a',geometry:{type:'Point',coordinates:[19.0001,52]}}]);
 const a=await reconcile(p,b),r=await reconcile(p,{...b,observations:[...b.observations].reverse()});
 assert.equal(a.summary.ambiguous,2);assert.equal(a.summary.added,0);assert.deepEqual(a.project,r.project);
 assert.equal((await reconcile(p,batch([{geometry:{type:'Point',coordinates:[-7.0001,37]}}]))).summary.ambiguous,1);
});
test('duplicate search includes dateline and poles and excludes separated points',async()=>{
 for(const coords of [[[179.9999,0],[-179.9999,0]],[[0,89.9999],[179,89.9999]]]){
  const r=await reconcile(await base(),batch(coords.map(coordinates=>({geometry:{type:'Point',coordinates}}))));assert.equal(r.summary.ambiguous,2);
 }
 const r=await reconcile(await base(),batch([{geometry:{type:'Point',coordinates:[19,52]}},{geometry:{type:'Point',coordinates:[20,52]}}]));assert.equal(r.summary.added,2);
});
test('missing rows and optional metadata do not remove existing data',async()=>{
 let p=(await reconcile(await base(),batch([{name:'known'}]))).project;
 const empty=await reconcile(p,batch([]));assert.equal(empty.project.records.length,2);assert.equal(empty.project.ingestion.observations.length,1);
 const absent=await reconcile(p,batch([{name:null,speedKmh:null,originalSpeed:null}]));
 assert.equal(absent.project.ingestion.observations[0].name,'known');assert.equal(absent.project.ingestion.observations[0].speedKmh,50);
});
test('explicit reference/bind/distinct resolutions persist and secondary sources cannot overwrite owner',async()=>{
 let p=await base(),id=p.records[0].id;
 p=(await reconcile(p,batch([{geometry:{type:'Point',coordinates:[-7,37]}}]))).project;
 p=await resolveImport(p,{namespace:'example',sourceId:'0',action:'reference'});
 assert.equal((await reconcile(p,batch([{geometry:{type:'Point',coordinates:[20,52]}}]))).summary.added,0);
 p=await resolveImport(p,{namespace:'example',sourceId:'0',action:'bind',recordId:id});
 const bound=await reconcile(p,batch([{geometry:{type:'Point',coordinates:[20,53]}}]));assert.equal(bound.summary.protected,1);assert.deepEqual(bound.project.records[0].edits,{});
 let automatic=(await reconcile(await base(),batch())).project;
 automatic=(await reconcile(automatic,batch([{}],'second'))).project;
 automatic=await resolveImport(automatic,{namespace:'second',sourceId:'0',action:'bind',recordId:'new:1'});
 const second=await reconcile(automatic,batch([{geometry:{type:'Point',coordinates:[22,54]}}],'second'));
 assert.deepEqual(second.project.records[1].edits,{latitude:52,longitude:19});
 const distinct=await resolveImport(p,{namespace:'example',sourceId:'0',action:'add-distinct'});assert.equal(distinct.records.length,2);
});
test('malformed batch does not mutate project or bypass existing binary blockers',async()=>{
 const p=await base(),before=structuredClone(p);await assert.rejects(reconcile(p,batch([{geometry:{type:'Point',coordinates:[200,52]}}])));assert.deepEqual(p,before);
 let blocked=await createProject(makeFixture([{typeRaw:964,linkRaw:999},{}]).bytes);
 blocked=setImportPolicy(blocked,{namespace:'example',kind:'camera',templateId:blocked.records[1].id});
 const added=await reconcile(blocked,batch());await assert.rejects(buildProject(added.project));
});
test('source category changes retain the binary record and display the new unsupported observation',async()=>{
 const original=(await reconcile(await base(),batch())).project;
 const changed=await reconcile(original,batch([{kind:'section',geometry:{type:'LineString',coordinates:[[19,52],[20,53]]}}]));
 assert.equal(changed.project.records.length,2);assert.deepEqual(changed.project.records[1],original.records[1]);
 assert.equal(changed.project.ingestion.bindings.length,0);assert.equal(changed.project.ingestion.ownership[0].coordinates,'manual');
 assert.deepEqual(changed.project.ingestion.observations[0].codes,['UNSUPPORTED']);
});
test('inactive bound observations are retained and flagged, without deleting the record',async()=>{
 const original=(await reconcile(await base(),batch())).project;
 const changed=await reconcile(original,batch([{status:'inactive',originalProperties:{status:'inactive'}}]));
 assert.equal(changed.project.records[1].deleted,false);assert.ok(changed.project.ingestion.observations[0].codes.includes('NOT_ACTIVE'));
});
test('category transitions never automatically resurrect a deleted or retained source identity after reopen',async()=>{
 for(const deleted of [false,true]){
  let p=(await reconcile(await base(),batch())).project;
  if(deleted)p=applyEdit(p,{kind:'delete',id:'new:1'});
  p=(await reconcile(p,batch([{kind:'section',geometry:{type:'LineString',coordinates:[[19,52],[20,53]]}}]))).project;
  p=await loadProject(await serializeProject(p));
  const result=await reconcile(p,batch([{geometry:{type:'Point',coordinates:[24,54]}}]));
  assert.equal(result.summary.added,0);assert.equal(result.project.records.length,2);assert.equal(result.project.records[1].deleted,deleted);
  assert.equal(result.project.ingestion.observations[0].disposition,'reference');assert.equal(result.project.ingestion.bindings.length,0);
 }
});
