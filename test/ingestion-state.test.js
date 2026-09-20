import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject,applyEdit,loadProject,serializeProject,validateProject } from '../src/project.js';
import { createHistory } from '../src/history.js';
import { buildProject } from '../src/encoder.js';
import { makeFixture } from './helpers/fixture.js';
import { makeImportBatch } from './helpers/import-fixture.js';
let upgradeProject,isProjectModified;
try{({upgradeProject,isProjectModified}=await import('../src/ingestion-state.js'));}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
test('current projects protect manual coordinates even when equal to baseline and undo atomically',async()=>{
 const p=await createProject(makeFixture([{}]).bytes);assert.equal(p.projectVersion,3);const id=p.records[0].id;
 const edited=applyEdit(p,{kind:'update',id,changes:{latitude:37,longitude:-7}});
 assert.equal(edited.ingestion.ownership[0].coordinates,'manual');assert.equal(isProjectModified(edited),true);
 assert.equal(isProjectModified(p),false);assert.deepEqual(await loadProject(await serializeProject(edited)),edited);
 const h=createHistory(p);h.commit(edited);assert.equal(h.revision,1);h.commit(edited);assert.equal(h.revision,1);
 h.undo();assert.strictEqual(h.current,p);h.redo();assert.strictEqual(h.current.source,p.source);
 await h.reset();assert.equal(isProjectModified(h.current),false);
});
test('v1 migrates without changing bytes or dropping deletions, edits and provenance',async()=>{
 const bytes=makeFixture([{}]).bytes,p=await createProject(bytes);assert.equal(typeof upgradeProject,'function');
 const legacy={...p,projectVersion:1};delete legacy.ingestion;legacy.records=structuredClone(p.records);
 legacy.records[0].edits={latitude:37};legacy.records[0].deleted=true;
 await validateProject(legacy);const migrated=await loadProject(JSON.stringify(legacy));
 assert.equal(migrated.projectVersion,3);assert.equal(migrated.records[0].deleted,true);
 assert.equal(migrated.ingestion.ownership[0].coordinates,'manual');assert.equal(legacy.projectVersion,1);
 const unchanged={...legacy,records:p.records};assert.deepEqual((await buildProject(await loadProject(JSON.stringify(unchanged)))).bytes,bytes);
});
test('metadata-only state is modified and round-trips; invalid identities and bindings reject',async()=>{
 const p=await createProject(makeFixture([{}]).bytes);assert.equal(p.projectVersion,3);
 const b=makeImportBatch(),o={...b.observations[0],namespace:b.source.namespace,retrievedAt:b.retrievedAt,disposition:'auto',codes:[]};
 const withData={...p,ingestion:{...p.ingestion,sources:[b.source],observations:[o]}};
 assert.equal(isProjectModified(withData),true);assert.deepEqual(await loadProject(await serializeProject(withData)),withData);
 for(const edit of [q=>q.ingestion.observations.push({...o}),q=>q.ingestion.sources.push({...b.source}),
  q=>q.ingestion.bindings.push({namespace:'example',sourceId:'a',recordId:'missing'}),
  q=>q.ingestion.ownership.push({recordId:p.records[0].id,coordinates:{namespace:'example',sourceId:'a'}}),
  q=>q.ingestion.policies.push({namespace:'example',kind:'section',templateId:p.records[0].id}),
  q=>q.ingestion.extra=true,q=>q.ingestion.observations[0].geometry.coordinates[0]=181]){
   const bad=structuredClone(withData);edit(bad);await assert.rejects(loadProject(JSON.stringify(bad)));
 }
 const h=createHistory(p);const bad={...withData,source:{...p.source,name:'other'}};assert.throws(()=>h.commit(bad));assert.strictEqual(h.current,p);
});
test('identity tuples with special keys are distinct and clone deletion persists',async()=>{
 let p=await createProject(makeFixture([{}]).bytes);assert.equal(p.projectVersion,3);
 const b=makeImportBatch();p={...p,ingestion:{...p.ingestion,sources:[{...b.source,namespace:'__proto__'},{...b.source,namespace:'a:b'}],
  observations:[{...b.observations[0],namespace:'__proto__',sourceId:'a:b',retrievedAt:b.retrievedAt,disposition:'auto',codes:[]},
   {...b.observations[0],namespace:'a:b',sourceId:'__proto__',retrievedAt:b.retrievedAt,disposition:'auto',codes:[]}]}};
 p=applyEdit(p,{kind:'clone',templateId:p.records[0].id,latitude:52,longitude:19});p=applyEdit(p,{kind:'delete',id:'new:1'});
 assert.equal((await loadProject(await serializeProject(p))).records[1].deleted,true);assert.equal({}.polluted,undefined);
});
