import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,loadProject,serializeProject,applyEdit} from '../src/project.js';
import {projectNotices,validateNotices} from '../src/source-notices.js';
import {createWorkerSession} from '../web/worker-session.js';
import {prepareSnapshot,CANARD_NAMESPACE} from '../src/canard-snapshot.js';
import {normalizeCanardLayers} from '../src/canard-adapter.js';
import {makeFixture} from './helpers/fixture.js';
import {makeCanardLayers,review,retrievedAt} from './helpers/canard-fixture.js';
async function prepared(notices=review.notices){return prepareSnapshot({batch:normalizeCanardLayers(makeCanardLayers(),{review,retrievedAt}),notices,checkedAt:retrievedAt,review});}

test('legacy project migration preserves records and opts no source into sync',async()=>{
 const p=await createProject(makeFixture([{}]).bytes);
 for(const version of [1,2]){
  const legacy={...p,projectVersion:version};if(version===1)delete legacy.ingestion;
  else legacy.ingestion={...p.ingestion,sources:[{namespace:'local',attribution:'Local',url:null}]};
  const loaded=await loadProject(JSON.stringify(legacy));assert.equal(loaded.projectVersion,3);
  assert.deepEqual(loaded.records,legacy.records);assert.ok(loaded.ingestion.sources.every(s=>s.syncEnabled===false));
 }
});
test('notices reject unsafe links, new keys and oversized values',()=>{
 assert.equal(validateNotices(review.notices).attribution,'GITD / CANARD');
 for(const change of [{licenceUrl:'javascript:alert(1)'},{sourceUrl:'https://x:y@example.org/'},{attribution:'x'.repeat(4097)},{extra:true}])assert.throws(()=>validateNotices({...review.notices,...change}));
});
test('hosted import atomically attaches sync/notices, repeats without history, and exports attribution',async()=>{
 const worker=createWorkerSession();let id=0;
 const req=(kind,payload={},sessionId='test')=>worker.handle({sessionId,requestId:++id,kind,payload});
 await req('open-bin',{bytes:makeFixture([{}]).bytes});
 const entry=await prepared();
 const imported=await req('import-canard',{...entry,enableSync:true,expectedRevision:0});assert.equal(imported.ok,true);
 const s=imported.result.snapshot;assert.equal(s.revision,1);assert.equal(s.references.length,3);
 assert.deepEqual(s.sourceSync,[{namespace:CANARD_NAMESPACE,enabled:true}]);
 const project=await loadProject(s.projectJson);assert.equal(project.ingestion.sources[0].notices.licenceUrl,review.notices.licenceUrl);
 assert.deepEqual(await loadProject(await serializeProject(project)),project);
 const repeat=await req('import-canard',{...entry,enableSync:true,expectedRevision:1});assert.equal(repeat.result.snapshot.revision,1);
 const refs=JSON.parse((await req('export-references')).result.text);assert.equal(refs.sourceNotices[0].attribution,'GITD / CANARD');
 assert.deepEqual(projectNotices(project,{encodedOnly:true}),[]);
 assert.equal((await req('build')).result.notices.length,0);
 assert.equal((await req('undo')).result.references.length,0);
 assert.equal((await req('redo')).result.projectJson,s.projectJson);
 const disabled=await req('source-sync',{namespace:CANARD_NAMESPACE,enabled:false,expectedRevision:3});assert.equal(disabled.ok,true);
 assert.equal(disabled.result.sourceSync[0].enabled,false);
});
test('bad or stale hosted imports and generic reserved-namespace imports leave history untouched',async()=>{
 const worker=createWorkerSession();let n=0;
 const req=(kind,payload={},sessionId='a')=>worker.handle({sessionId,requestId:++n,kind,payload});
 const original=(await req('open-bin',{bytes:makeFixture([{}]).bytes})).result;
 const entry=await prepared();
 for(const payload of [{...entry,expectedRevision:1,enableSync:true},{...entry,bytes:new Uint8Array(0),expectedRevision:0,enableSync:true},{...entry,expectedRevision:0,enableSync:'yes'}])assert.equal((await req('import-canard',payload)).ok,false);
 assert.equal((await req('import-canard',{...entry,expectedRevision:0,enableSync:true},'old')).ok,false);
 assert.equal((await req('import',{batch:normalizeCanardLayers(makeCanardLayers(),{review,retrievedAt}),expectedRevision:0})).error.code,'RESERVED_SOURCE');
 assert.equal((await req('snapshot')).result.projectJson,original.projectJson);
});
test('notice-only refresh preserves sync and manual records; bound active records carry notices',async()=>{
 const worker=createWorkerSession();let n=0;
 const req=(kind,payload={})=>worker.handle({sessionId:'a',requestId:++n,kind,payload});
 let s=(await req('open-bin',{bytes:makeFixture([{}]).bytes})).result;const recordId=s.view.records[0].id;
 s=(await req('import-canard',{...await prepared(),enableSync:true,expectedRevision:0})).result.snapshot;
 s=(await req('import-resolve',{resolution:{namespace:CANARD_NAMESPACE,sourceId:'["PP","1"]',action:'bind',recordId},expectedRevision:s.revision})).result;
 s=(await req('apply',{operation:{kind:'update',id:recordId,changes:{latitude:37.5}}})).result;
 const notices={...review.notices,transformation:'Clarified transformation'};
 s=(await req('import-canard',{...await prepared(notices),expectedRevision:s.revision})).result.snapshot;
 const p=await loadProject(s.projectJson);assert.equal(p.records[0].edits.latitude,37.5);assert.equal(p.ingestion.sources[0].syncEnabled,true);
 assert.equal(projectNotices(p,{encodedOnly:true})[0].transformation,notices.transformation);
 assert.equal(projectNotices(applyEdit(p,{kind:'delete',id:recordId}),{encodedOnly:true}).length,0);
 assert.equal((await req('build')).result.notices[0].transformation,notices.transformation);
});
