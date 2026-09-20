import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const workflow=readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
const condition=workflow.match(/^  deploy:\n[\s\S]*?^    if: (.+)$/m)?.[1];

// Evaluate this workflow's JS-compatible expression subset, including GitHub's
// implicit success() rule. This is a scheduling regression model, not a full
// Actions expression interpreter; the real Pages run remains the release gate.
function deploys({build='success',cancelled=false,ref='refs/heads/main',ancestorsSucceeded=false}={}){
 assert.ok(condition,'deployment must have an explicit condition');
 const explicitStatus=/\b(always|cancelled|success|failure)\s*\(/.test(condition);
 return (explicitStatus||ancestorsSucceeded)&&runInNewContext(condition,{
  always:()=>true,cancelled:()=>cancelled,success:()=>ancestorsSucceeded,
  failure:()=>build==='failure',needs:{build:{result:build}},github:{ref},
 },{timeout:100});
}

test('Pages deploys successful builds after optional data jobs were skipped',()=>{
 assert.equal(deploys(),true);
 assert.equal(deploys({ancestorsSucceeded:true}),true);
});
test('Pages never deploys failed, skipped, cancelled or non-main builds',()=>{
 for(const build of ['failure','skipped','cancelled'])assert.equal(deploys({build}),false);
 assert.equal(deploys({cancelled:true}),false);
 assert.equal(deploys({ref:'refs/heads/feature'}),false);
});
