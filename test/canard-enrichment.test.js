import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchCanardInput,prepareUpdate} from '../scripts/canard/update.js';
import {inspectCanard} from '../scripts/canard/prepare.js';
import {makeCanardHtml,review,retrievedAt} from './helpers/canard-fixture.js';
import {sha256} from '../src/canard-snapshot.js';
const enabled={...review,details:{enabled:true}};
async function access(){return {html:makeCanardHtml(),termsText:'terms',robotsText:'robots',checkedAt:retrievedAt};}
async function checkedReview(){return {...enabled,termsSha256:await sha256(new TextEncoder().encode('terms')),robotsSha256:await sha256(new TextEncoder().encode('robots')),notices:{...review.notices,reviewedTermsSha256:await sha256(new TextEncoder().encode('terms'))}};}
test('detail acquisition occurs only after map terms/schema gates and retains cache for next run',async()=>{
 const r=await checkedReview();let calls=0;
 const fetchDetails=async({batch,previous})=>{calls++;assert.equal(batch.observations.length,3);assert.deepEqual(previous,{old:true});return {details:{},cache:{updated:true}};};
 const result=await fetchCanardInput({review:r,previousAccess:{detailCache:{old:true}},fetchPage:access,fetchDetails});
 assert.equal(calls,1);assert.deepEqual(result.details,{});assert.deepEqual(result.detailCache,{updated:true});
 await assert.rejects(fetchCanardInput({review:{...r,termsSha256:'0'.repeat(64)},fetchPage:access,fetchDetails}),{code:'CANARD_TERMS_CHANGED'});assert.equal(calls,1);
});
test('enabled enrichment refuses incomplete details rather than publishing unknown speeds silently',async()=>{
 const r=await checkedReview();await assert.rejects(inspectCanard({access:await access(),review:r}),{code:'CANARD_DETAILS_INCOMPLETE'});
 await assert.rejects(inspectCanard({access:{...await access(),details:{}},review:r}),{code:'CANARD_DETAILS_INCOMPLETE'});
});
test('failed detail fetch leaves accepted input and cache unchanged',async()=>{
 const r=await checkedReview(),previousAccess={detailCache:{old:true}},before=structuredClone(previousAccess);
 await assert.rejects(prepareUpdate({review:r,previousAccess,fetchPage:access,fetchDetails:async()=>{throw Error('details offline');}}),/details offline/);
 assert.deepEqual(previousAccess,before);
});
