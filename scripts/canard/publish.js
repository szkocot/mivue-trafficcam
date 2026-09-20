import {execFileSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {preparedFiles,fail} from './files.js';
import {prepareSnapshot,validateSnapshot} from '../../src/canard-snapshot.js';
const branch='refs/heads/canard-data',oid=/^[a-f0-9]{40}$/;
const sameFiles=(a,b)=>Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([p,v])=>b[p]&&Buffer.from(v).equals(Buffer.from(b[p])));
export async function publishPrepared({prepared,expectedParent,git,review}){
 if(expectedParent!==null&&!oid.test(expectedParent))fail('CANARD_PUBLISH_CONFLICT');
 const files=await preparedFiles(prepared);
 if(prepared.manifest.state==='active'){
  if(review?.publicationApproved!==true)fail('CANARD_PUBLICATION_DISABLED');
  if(!expectedParent&&review.reviewedCandidateSha256!==prepared.manifest.sha256)fail('CANARD_INITIAL_REVIEW_REQUIRED');
 }
 if(await git.head()!==expectedParent)fail('CANARD_PUBLISH_CONFLICT');
 const prior=expectedParent?await git.files(expectedParent):{};
 if(prepared.manifest.state==='active'&&prior['data/canard/manifest.json']&&JSON.parse(prior['data/canard/manifest.json']).state==='disabled')fail('CANARD_SOURCE_WITHDRAWN');
 if(prepared.manifest.state==='active'&&expectedParent){
  const manifest=JSON.parse(prior['data/canard/manifest.json']),previous={manifest,bytes:prior[manifest.path],noticeBytes:prior[manifest.noticePath]};
  const expected=await preparedFiles(previous);
  if(!sameFiles(expected,prior))fail('CANARD_INVALID_FILES');
  const snapshot=await validateSnapshot(prepared.bytes,prepared.manifest);
  const checked=await prepareSnapshot({batch:snapshot.batch,notices:snapshot.notices,previous,checkedAt:prepared.manifest.checkedAt,review});
  if(checked.manifest.sha256!==prepared.manifest.sha256)fail('CANARD_INVALID_SNAPSHOT');
 }
 if(sameFiles(files,prior))return expectedParent;
 const commit=await git.commit(files,expectedParent);
 if(await git.head()!==expectedParent)fail('CANARD_PUBLISH_CONFLICT');
 await git.push(commit);return commit;
}
/** Git plumbing uses an isolated index. It never switches/stages the source worktree. */
export function createGitAdapter({cwd=process.cwd()}={}){
 const run=(args,input,env={})=>execFileSync('git',['-C',cwd,...args],{input,env:{...process.env,...env},maxBuffer:24*1024*1024,timeout:60000,stdio:['pipe','pipe','pipe']});
 const text=(args,input,env)=>run(args,input,env).toString('utf8').trim();
 async function head(ref=branch){
  if(![branch,'refs/heads/main'].includes(ref))fail('CANARD_INVALID_REF');
  const lines=text(['ls-remote','--refs','origin',ref]);if(!lines)return null;
  const [sha,name]=lines.split(/\s+/);if(!oid.test(sha)||name!==ref)fail('CANARD_INVALID_REF');return sha;
 }
 return {head,
  async files(sha){
   if(!oid.test(sha))fail('CANARD_INVALID_REF');run(['fetch','--no-tags','origin',sha]);
   const entries=run(['ls-tree','-rz',sha]).toString().split('\0').filter(Boolean),files={};
   for(const entry of entries){const match=/^100644 blob ([a-f0-9]{40})\t(data\/canard\/(?:manifest\.json|NOTICE\.json|snapshot-[a-f0-9]{64}\.json))$/.exec(entry);if(!match)fail('CANARD_INVALID_FILES');files[match[2]]=run(['cat-file','blob',match[1]]);}
   return files;
  },
  async commit(files,parent){
   const dir=await mkdtemp(join(tmpdir(),'mivue-canard-index-'));
   const env={GIT_INDEX_FILE:join(dir,'index'),GIT_AUTHOR_NAME:'CANARD snapshot publisher',GIT_AUTHOR_EMAIL:'actions@users.noreply.github.com',GIT_COMMITTER_NAME:'CANARD snapshot publisher',GIT_COMMITTER_EMAIL:'actions@users.noreply.github.com'};
   try{
    run(['read-tree','--empty'],undefined,env);
    for(const [path,bytes] of Object.entries(files)){const blob=text(['hash-object','-w','--stdin'],bytes);run(['update-index','--add','--cacheinfo',`100644,${blob},${path}`],undefined,env);}
    const tree=text(['write-tree'],undefined,env);return text(['commit-tree',tree,...(parent?['-p',parent]:[]),'-m','Update validated CANARD snapshot'],undefined,env);
   }finally{await rm(dir,{recursive:true,force:true});}
  },
  async push(sha){if(!oid.test(sha))fail('CANARD_INVALID_REF');run(['push','origin',`${sha}:${branch}`]);}
 };
}
