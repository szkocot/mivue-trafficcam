import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,access,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {makeFixture} from './helpers/fixture.js';
import {makeCanardLayers,review,retrievedAt} from './helpers/canard-fixture.js';
import {normalizeCanardLayers} from '../src/canard-adapter.js';
import {prepareSnapshot} from '../src/canard-snapshot.js';
import {writeDataset} from '../scripts/canard/files.js';
import {parseGeoJson} from '../src/import-geojson.js';
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'mivue-comparison-')),mio=join(root,'input.bin'),canard=join(root,'canard'),output=join(root,'nested','report');
 const bytes=Buffer.from(makeFixture([{}]).bytes);await writeFile(mio,bytes);
 const batch=normalizeCanardLayers(makeCanardLayers(),{review,retrievedAt});
 const prepared=await prepareSnapshot({batch,notices:review.notices,checkedAt:retrievedAt,termsSha256:review.notices.reviewedTermsSha256,robotsSha256:review.robotsSha256,review});
 await writeDataset(canard,prepared);return {mio,canard,output,bytes,prepared};
}
const command=f=>[process.execPath,['scripts/compare-sources.mjs','--mio',f.mio,'--canard-dir',f.canard,'--output',f.output]];
test('comparison CLI validates both datasets, exports evidence, and never overwrites files',async()=>{
 const f=await fixture();const result=JSON.parse(execFileSync(...command(f),{encoding:'utf8'}));
 assert.equal(result.importVerification.passed,true);assert.equal(result.importVerification.observations,3);
 const json=await readFile(join(f.output,'comparison.json'),'utf8');
 const report=JSON.parse(json);assert.equal(report.inputs.canard.sha256,f.prepared.manifest.sha256);
 assert.equal(JSON.parse(await readFile(join(f.output,'comparison.geojson'),'utf8')).features.filter(x=>x.properties.source==='CANARD').length,3);
 const evidence=await readFile(join(f.output,'comparison.geojson'),'utf8');const overlay=parseGeoJson(evidence,{namespace:'audit-evidence',attribution:'Local audit'},retrievedAt);assert.equal(overlay.observations.length,JSON.parse(evidence).features.length);assert.ok(overlay.observations.every(o=>o.status==='unknown'));
 assert.ok((await readFile(join(f.output,'comparison.csv'),'utf8')).startsWith('"sourceId","category"'));
 assert.ok((await readFile(join(f.output,'index.html'),'utf8')).startsWith('<!doctype html>'));
 const inventory=await readFile(join(f.output,'bin-speed-inventory.csv'),'utf8');assert.equal(inventory.trim().split('\r\n').length,2);assert.ok(inventory.includes('known'));assert.ok(inventory.includes('speedKmh'));assert.ok(inventory.includes('MiVue 955W'));assert.ok(inventory.includes('"-7"'));
 assert.throws(()=>execFileSync(...command(f),{stdio:'pipe'}));
 assert.equal(await readFile(join(f.output,'comparison.json'),'utf8'),json);assert.deepEqual(await readFile(f.mio),f.bytes);
 const second={...f,output:f.output+'-repeat'};execFileSync(...command(second),{stdio:'pipe'});assert.equal(await readFile(join(second.output,'comparison.json'),'utf8'),json);
});
test('corrupt snapshot fails before creating any report output',async()=>{
 const f=await fixture();await writeFile(join(f.canard,f.prepared.manifest.path),'{}');
 assert.throws(()=>execFileSync(...command(f),{stdio:'pipe'}),e=>e.stderr.toString().includes('CANARD_INVALID_SNAPSHOT'));await assert.rejects(access(f.output),{code:'ENOENT'});
});
test('saved-project audit reports protected manual coordinates and bindings without rewriting the project',async()=>{
 const {createWorkerSession}=await import('../web/worker-session.js');
 const {loadProject,serializeProject,applyEdit}=await import('../src/project.js');
 const {resolveImport}=await import('../src/reconcile.js');
 const f=await fixture(),worker=createWorkerSession();
 await worker.handle({sessionId:'t',requestId:1,kind:'open-bin',payload:{bytes:f.bytes,name:'fixture.bin'}});
 const imported=await worker.handle({sessionId:'t',requestId:2,kind:'import-canard',payload:{bytes:f.prepared.bytes,manifest:f.prepared.manifest,expectedRevision:0,enableSync:false}});
 let p=await loadProject(imported.result.snapshot.projectJson);
 p=await resolveImport(p,{namespace:'pl.gitd.canard.public-map',sourceId:'["PP","1"]',action:'bind',recordId:p.records[0].id});
 p=applyEdit(p,{kind:'update',id:p.records[0].id,changes:{latitude:52.001,longitude:21}});
 const text=await serializeProject(p),path=f.mio.replace('.bin','.json');await writeFile(path,text);
 execFileSync(...command({...f,mio:path}),{stdio:'pipe'});
 const r=JSON.parse(await readFile(join(f.output,'comparison.json'),'utf8'));
 assert.equal(r.scope.validInScope,1);assert.equal(r.projectBindings[0].manuallyOwnedCoordinates,true);
 assert.equal(r.currentProjectBuild.passed,false);assert.equal(r.currentProjectBuild.code,'UNKNOWN_HEADER_DEPENDENCY');
 assert.deepEqual(r.projectBindings[0].binCoordinates,[21,52.001]);assert.equal(r.projectBindings[0].geometryMatchesLatest,true);
 assert.equal(await readFile(path,'utf8'),text);assert.notEqual(r.inputs.projectFileSha256,r.inputs.mio.sha256);
});
test('source coordinate ownership is not mislabelled as manual merely because edits exist',async()=>{
 const {createProject,serializeProject,applyEdit}=await import('../src/project.js');
 const {reconcile,resolveImport}=await import('../src/reconcile.js');
 const {validateSnapshot}=await import('../src/canard-snapshot.js');
 const f=await fixture(),hosted=await validateSnapshot(f.prepared.bytes,f.prepared.manifest);
 let p=(await reconcile(await createProject(f.bytes),hosted.batch)).project;
 p=await resolveImport(p,{namespace:'pl.gitd.canard.public-map',sourceId:'["PP","1"]',action:'bind',recordId:p.records[0].id});
 p=applyEdit(p,{kind:'update',id:p.records[0].id,changes:{latitude:52,longitude:21}});
 p.ingestion.ownership[0].coordinates={namespace:'pl.gitd.canard.public-map',sourceId:'["PP","1"]'};
 const path=f.mio.replace('.bin','.json');await writeFile(path,await serializeProject(p));execFileSync(...command({...f,mio:path}),{stdio:'pipe'});
 const r=JSON.parse(await readFile(join(f.output,'comparison.json'),'utf8'));assert.equal(r.projectBindings[0].manuallyOwnedCoordinates,false);
});
test('comparison cannot contaminate its accepted CANARD input directory',async()=>{
 const f=await fixture();assert.throws(()=>execFileSync(...command({...f,output:join(f.canard,'report')}),{stdio:'pipe'}),e=>e.stderr.toString().includes('must not be inside'));
 await assert.rejects(access(join(f.canard,'report')),{code:'ENOENT'});
});

test('ancestor symlinks cannot bypass accepted-input containment',async()=>{
 const f=await fixture(),alias=join(dirname(f.canard),'alias');await symlink(f.canard,alias,'dir');
 assert.throws(()=>execFileSync(...command({...f,output:join(alias,'nested','report')}),{stdio:'pipe'}),e=>e.stderr.toString().includes('must not be inside'));
 await assert.rejects(access(join(f.canard,'nested')),{code:'ENOENT'});
});
