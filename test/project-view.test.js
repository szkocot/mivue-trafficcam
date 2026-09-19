import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers/fixture.js';
import { createProject, applyEdit } from '../src/project.js';
import { projectView, exportView } from '../src/project-view.js';

test('projection exposes effective values without mutating baseline or requiring a build', async () => {
  const p = await createProject(makeFixture([{}, {typeRaw:964,linkTo:2}, {typeRaw:9128}]).bytes);
  let draft = applyEdit(p, {kind:'update',id:p.records[0].id,changes:{latitude:37.1,rawBytes16To19:[1,2,3,4]}});
  draft = applyEdit(draft, {kind:'delete',id:p.records[2].id});
  const view = await projectView(draft);
  assert.equal(view.records[0].latitude,37.1);
  assert.deepEqual(view.records[0].rawBytes16To19,[1,2,3,4]);
  assert.equal(view.records[1].linkTargetId,p.records[2].id);
  assert.ok(view.records[1].diagnostics.some(d=>d.code==='LINK_TARGET_DELETED' && d.scope==='current'));
  assert.equal(p.records[0].edits.latitude,undefined);
  assert.equal(view.source.bytesHex,undefined);
  assert.equal(JSON.parse(exportView(view,'json')).records.length,2);
});
test('clones retain template identity and invalid geometry is null', async () => {
  let p = await createProject(makeFixture([{}, {latitudeRaw:NaN}]).bytes);
  p = applyEdit(p,{kind:'clone',templateId:p.records[0].id,latitude:38,longitude:-6});
  const view = await projectView(p);
  assert.equal(view.records[2].originalSourceOffset,null);
  assert.equal(view.records[2].id,'new:1');
  assert.equal(view.records[2].templateId,p.records[0].id);
  const geo = JSON.parse(exportView(view,'geojson'));
  assert.deepEqual(geo.features[2].geometry.coordinates,[-6,38]);
  assert.equal(geo.features[1].geometry,null);
  assert.ok(view.records[1].diagnostics.some(d=>d.scope==='baseline'));
});
test('restored original values are not marked changed; explicit link resolution is projected',async()=>{
  let p=await createProject(makeFixture([{typeRaw:964,linkRaw:123},{typeRaw:9128}]).bytes);
  p=applyEdit(p,{kind:'update',id:p.records[1].id,changes:{latitude:37}});
  p=applyEdit(p,{kind:'resolve-link',id:p.records[0].id,targetId:p.records[1].id,reason:'checked'});
  const v=await projectView(p);
  assert.equal(v.records[1].changed,false);
  assert.equal(v.records[0].linkTargetId,p.records[1].id);
  assert.equal(v.records[0].diagnostics.filter(d=>d.scope==='current').length,0);
});
test('CSV quotes cells and neutralizes source-name formulas without altering numbers',async()=>{
  const p=await createProject(makeFixture([{}]).bytes,{name:' \t=HYPERLINK("bad")\nnext'});
  p.records[0].provenance.push({note:'<img src=x onerror=alert(1)>',text:'a,"b"\nc'});
  const csv=exportView(await projectView(p),'csv');
  assert.ok(csv.includes('"\' \t=HYPERLINK(""bad"")\nnext"'));
  assert.ok(csv.includes('"-7"'));
  assert.ok(csv.includes('<img src=x onerror=alert(1)>'));
  assert.throws(()=>exportView({},'xml'),/format/i);
});
