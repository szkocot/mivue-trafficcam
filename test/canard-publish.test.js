import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {publishPrepared,createGitAdapter} from '../scripts/canard/publish.js';
import {preparedFiles,readDataset,writeDataset} from '../scripts/canard/files.js';
import {prepareSnapshot} from '../src/canard-snapshot.js';
import {buildWeb} from '../scripts/build-web.mjs';
import {prepareUpdate} from '../scripts/canard/update.js';
import {normalizeCanardLayers} from '../src/canard-adapter.js';
import {makeCanardLayers,review,retrievedAt} from './helpers/canard-fixture.js';
const candidate=()=>prepareSnapshot({batch:normalizeCanardLayers(makeCanardLayers(),{review,retrievedAt}),notices:review.notices,checkedAt:retrievedAt,review});
const disabled=()=>({manifest:{schemaVersion:1,state:'disabled',checkedAt:new Date().toISOString(),reasonCode:'RIGHTS_REVIEW',messagePl:'Weryfikacja praw',messageEn:'Rights review'}});
async function temporary(t){const dir=await mkdtemp(join(tmpdir(),'mivue-publish-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
test('concurrent publisher rejects a changed parent before writing',async()=>{
 const prepared=await candidate();let writes=0;
 await assert.rejects(publishPrepared({prepared,expectedParent:'a'.repeat(40),review:{...review,publicationApproved:true},git:{head:async()=> 'b'.repeat(40),commit:async()=>writes++}}),{code:'CANARD_PUBLISH_CONFLICT'});assert.equal(writes,0);
});
test('dataset validation rejects extra files, symlinks, corrupted bodies and mismatched notices',async t=>{
 const dir=await temporary(t),prepared=await candidate();await writeDataset(dir,prepared);
 assert.equal((await readDataset(dir)).manifest.total,3);
 await writeFile(join(dir,'unexpected.bin'),'private');await assert.rejects(readDataset(dir));await rm(join(dir,'unexpected.bin'));
 await symlink('/etc/passwd',join(dir,'data/canard/extra'));await assert.rejects(readDataset(dir));await rm(join(dir,'data/canard/extra'));
 await writeFile(join(dir,prepared.manifest.path),'corrupt');await assert.rejects(readDataset(dir));await writeFile(join(dir,prepared.manifest.path),prepared.bytes);
 await writeFile(join(dir,'data/canard/NOTICE.json'),'{}');await assert.rejects(readDataset(dir));
 await assert.rejects(preparedFiles({...prepared,files:{'.github/workflows/evil.yml':'bad'}}));
});
test('real git publication is data-only, no-op aware, pinned and fast-forward without changing source checkout',async t=>{
 const dir=await temporary(t),remote=join(dir,'remote.git'),repo=join(dir,'repo');
 const run=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
 run('init','--bare',remote);run('init',repo);run('-C',repo,'remote','add','origin',remote);
 await writeFile(join(repo,'untouched.txt'),'source');
 const git=createGitAdapter({cwd:repo}),prepared=await candidate(),approved={...review,publicationApproved:true,reviewedCandidateSha256:prepared.manifest.sha256};
 await assert.rejects(publishPrepared({prepared,expectedParent:null,git,review}));
 const first=await publishPrepared({prepared,expectedParent:null,git,review:approved});
 assert.match(first,/^[a-f0-9]{40}$/);assert.equal(await readFile(join(repo,'untouched.txt'),'utf8'),'source');
 assert.deepEqual(run('--git-dir',remote,'ls-tree','-r','--name-only',first).split('\n').sort(),['data/canard/NOTICE.json','data/canard/manifest.json',prepared.manifest.path].sort());
 assert.equal(await publishPrepared({prepared,expectedParent:first,git,review:approved}),first);
 const heartbeat={...prepared,manifest:{...prepared.manifest,checkedAt:'2026-09-20T10:23:00.000Z'}};
 const second=await publishPrepared({prepared:heartbeat,expectedParent:first,git,review:approved});assert.notEqual(second,first);
 assert.equal(run('--git-dir',remote,'rev-parse',`${second}^`),first);
 assert.equal(JSON.parse(run('--git-dir',remote,'show',`${first}:data/canard/manifest.json`)).checkedAt,retrievedAt);
 await assert.rejects(publishPrepared({prepared,expectedParent:first,git,review:approved}),{code:'CANARD_PUBLISH_CONFLICT'});
 const withdrawn=await publishPrepared({prepared:disabled(),expectedParent:second,git,review});
 assert.equal(run('--git-dir',remote,'ls-tree','-r','--name-only',withdrawn),'data/canard/manifest.json');
 // Disabled data cannot silently become active again from a scheduled update.
 await assert.rejects(publishPrepared({prepared,expectedParent:withdrawn,git,review:approved}),{code:'CANARD_SOURCE_WITHDRAWN'});
});
test('build copies only validated data and removes old dataset files on withdrawal or no-input build',async t=>{
 const dir=await temporary(t),prepared=await candidate();await writeDataset(dir,prepared);
 const outputDir=await temporary(t),build=canardDir=>buildWeb({outputDir,canardDir});
 await writeFile(join(outputDir,'old-private.bin'),'private');await build(dir);assert.equal(JSON.parse(await readFile(join(outputDir,'data/canard/manifest.json'))).total,3);
 await assert.rejects(readFile(join(outputDir,'old-private.bin')),{code:'ENOENT'});
 const disabledDir=join(await temporary(t),'disabled');await writeDataset(disabledDir,disabled());await build(disabledDir);
 await assert.rejects(readFile(join(outputDir,prepared.manifest.path)),{code:'ENOENT'});
 assert.equal(JSON.parse(await readFile(join(outputDir,'data/canard/manifest.json'))).state,'disabled');
 await build();await assert.rejects(readFile(join(outputDir,'data/canard/manifest.json')),{code:'ENOENT'});
 await writeFile(join(dir,'private.bin'),'private');await assert.rejects(build(dir));
});
test('failed source fetch leaves previous bytes/check time untouched and withdrawal never fetches',async()=>{
 const previous=await candidate(),before=structuredClone(previous);let calls=0;
 const fetchPage=async()=>{calls++;throw Error('offline');};
 await assert.rejects(prepareUpdate({previous,review:{...review,publicationApproved:true},fetchPage}),/offline/);
 assert.deepEqual(previous,before);assert.equal(calls,1);
 await assert.rejects(prepareUpdate({previous:disabled(),review:{...review,publicationApproved:true},fetchPage}),{code:'CANARD_SOURCE_WITHDRAWN'});assert.equal(calls,1);
});
test('CLI withdrawal needs no network and active publication refuses a disabled environment gate',async t=>{
 const withdrawn=await temporary(t);execFileSync(process.execPath,['scripts/canard/cli.js','withdraw',withdrawn],{stdio:'pipe'});
 assert.equal((await readDataset(withdrawn)).manifest.state,'disabled');
 const active=await temporary(t);await writeDataset(active,await candidate());
 assert.throws(()=>execFileSync(process.execPath,['scripts/canard/cli.js','publish',active,'-'],{env:{...process.env,CANARD_PUBLICATION_ENABLED:'false'},stdio:'pipe'}),error=>error.stderr.toString().includes('CANARD_PUBLICATION_DISABLED'));
});
test('publisher independently rejects category loss, identity churn and stale candidates',async()=>{
 const before=await candidate(),parent='a'.repeat(40),approved={...review,publicationApproved:true,reviewedCandidateSha256:null};let commits=0;
 const git={head:async()=>parent,files:()=>preparedFiles(before),commit:async()=>{commits++;return 'b'.repeat(40);},push:async()=>{}};
 for(const mode of ['empty','churn','stale']){
  const batch=normalizeCanardLayers(makeCanardLayers(),{review,retrievedAt:mode==='stale'?'2026-09-19T00:00:00Z':retrievedAt});
  if(mode==='empty')batch.observations=[];
  if(mode==='churn')for(const o of batch.observations)o.sourceId=JSON.stringify([JSON.parse(o.sourceId)[0],'999']);
  const prepared=await prepareSnapshot({batch,notices:review.notices,checkedAt:batch.retrievedAt,review});
  await assert.rejects(publishPrepared({prepared,expectedParent:parent,git,review:approved}));
  if(mode!=='stale')assert.equal(await publishPrepared({prepared,expectedParent:parent,git,review:{...approved,reviewedCandidateSha256:prepared.manifest.sha256}}),'b'.repeat(40));
 }
 assert.equal(commits,2);
});
