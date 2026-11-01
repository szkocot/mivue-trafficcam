import test from 'node:test';import assert from 'node:assert/strict';
import{createWorkerSession}from'../web/worker-session.js';import{makeFixture}from'./helpers/fixture.js';import{buildProject}from'../src/encoder.js';import{loadProject}from'../src/project.js';
test('worker previews and atomically merges point and complete OPP matches without changing BIN bytes',async()=>{
 const bytes=makeFixture([{},{typeRaw:964,latitudeRaw:3800,longitudeRaw:-600,linkTo:2},{typeRaw:9128,latitudeRaw:3806,longitudeRaw:-600}]).bytes;
 const w=createWorkerSession();let requestId=0;const send=(kind,payload={})=>w.handle({sessionId:'merge',requestId:++requestId,kind,payload});
 assert.equal((await send('open-bin',{bytes})).ok,true);
 const batch={source:{namespace:'merge-test',attribution:'Synthetic'},retrievedAt:'2026-11-01T00:00:00.000Z',observations:[
  {sourceId:'point',kind:'camera',status:'unknown',geometry:{type:'Point',coordinates:[-7,37]},speedKmh:null,originalSpeed:null,direction:null,originalProperties:{}},
  {sourceId:'section',kind:'section',status:'unknown',geometry:{type:'LineString',coordinates:[[-6,38],[-6,38.1]]},speedKmh:null,originalSpeed:null,direction:null,originalProperties:{}}]};
 const imported=await send('import',{batch,expectedRevision:0});assert.equal(imported.ok,true);const revision=imported.result.snapshot.revision;
 const preview=await send('import-matches',{expectedRevision:revision});assert.equal(preview.ok,true,JSON.stringify(preview.error));assert.equal(preview.result.summary.unique,2);
 const resolutions=preview.result.rows.map(r=>({namespace:r.namespace,sourceId:r.sourceId,action:'bind',recordIds:r.candidates[0].recordIds}));
 const merged=await send('merge-imports',{expectedRevision:revision,resolutions});assert.equal(merged.ok,true,JSON.stringify(merged.error));assert.ok(merged.result.references.every(r=>r.encoded));assert.ok(merged.result.view.records.every(r=>r.sourceObservations.length===1));
 const p=await loadProject(merged.result.projectJson);assert.deepEqual(Buffer.from((await buildProject(p)).bytes),Buffer.from(bytes));assert.ok(p.records.every(r=>Object.keys(r.edits).length===0));
 const exported=await send('export-references');assert.equal(JSON.parse(exported.result.text).features.find(f=>f.properties.sourceId==='section').properties.recordIds.length,2);
 const stale=await send('merge-imports',{expectedRevision:revision,resolutions});assert.equal(stale.ok,false);assert.equal(stale.error.code,'STALE_IMPORT');
 const undone=await send('undo');assert.ok(undone.result.references.every(r=>!r.encoded));const redone=await send('redo');assert.ok(redone.result.references.every(r=>r.encoded));
});
