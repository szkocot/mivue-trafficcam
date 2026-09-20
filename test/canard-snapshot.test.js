import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSnapshot,validateSnapshot,validateManifest,sha256} from '../src/canard-snapshot.js';
import {prepareCanard} from '../scripts/canard/prepare.js';
import {normalizeCanardLayers} from '../src/canard-adapter.js';
import {makeCanardLayers,makeCanardHtml,review,retrievedAt} from './helpers/canard-fixture.js';
const t1=retrievedAt,t2='2026-09-20T10:23:00.000Z';
const makeBatch=()=>normalizeCanardLayers(makeCanardLayers(),{review,retrievedAt:t1});
const input=()=>({batch:makeBatch(),notices:structuredClone(review.notices),previous:null,checkedAt:t1,review});

test('same data at a later check reuses exact bytes, digest and retrieval date',async()=>{
 const first=await prepareSnapshot(input());
 const next=await prepareSnapshot({...input(),batch:{...makeBatch(),retrievedAt:t2},previous:first,checkedAt:t2});
 assert.deepEqual(next.bytes,first.bytes);assert.equal(next.manifest.retrievedAt,t1);assert.equal(next.manifest.checkedAt,t2);assert.equal(next.changed,false);
 assert.deepEqual(next.manifest.counts,{PP:1,OPP:1,RL:1,PK:null});assert.equal(next.manifest.total,3);
 assert.equal((await validateSnapshot(next.bytes,next.manifest)).coverage.PK,'unavailable');
});
test('ordering has no effect, but provenance and observed metadata changes do',async()=>{
 const first=await prepareSnapshot(input());const reversed=makeBatch();reversed.observations.reverse();
 const same=await prepareSnapshot({...input(),batch:reversed});assert.deepEqual(same.bytes,first.bytes);
 const changed=await prepareSnapshot({...input(),notices:{...review.notices,transformation:'Reviewed metadata normalization v2'}});
 assert.notEqual(changed.manifest.sha256,first.manifest.sha256);
 const batch=makeBatch();batch.observations[0].originalProperties.nrSeryjny='TEST-2';
 assert.notEqual((await prepareSnapshot({...input(),batch})).manifest.sha256,first.manifest.sha256);
});
test('corrupt bytes, incorrect size/hash/counts and absent notices reject',async()=>{
 const first=await prepareSnapshot(input());
 for(const change of [{sha256:'0'.repeat(64)},{byteLength:first.bytes.length+1},{total:4},{counts:{PP:2,OPP:1,RL:1,PK:null}},{counts:{PP:1,OPP:1,RL:1,PK:0}}]){
  await assert.rejects(validateSnapshot(first.bytes,{...first.manifest,...change}));
 }
 const bytes=first.bytes.slice();bytes[0]^=1;await assert.rejects(validateSnapshot(bytes,first.manifest));
 await assert.rejects(prepareSnapshot({...input(),notices:null}));
});
test('manifest rejects nonlocal paths, unsupported versions, unsafe dates and extras',async()=>{
 const {manifest}=await prepareSnapshot(input());
 for(const change of [{path:'https://evil.test/x'},{path:'data/canard/../secret'},{schemaVersion:2},{checkedAt:'2099-01-01T00:00:00Z'},{checkedAt:'invalid'},{extra:true}])assert.throws(()=>validateManifest({...manifest,...change}));
 assert.equal(validateManifest({schemaVersion:1,state:'disabled',checkedAt:t1,reasonCode:'RIGHTS_REVIEW',messagePl:'Wyłączone',messageEn:'Disabled'}).state,'disabled');
});
test('a greater than 20 percent loss of counts or identity is held for review',async()=>{
 const batch=makeBatch();const point=batch.observations[0];
 batch.observations=[...Array.from({length:5},(_,i)=>({...structuredClone(point),sourceId:JSON.stringify(['PP',String(i+1)])})),...batch.observations.slice(1)];
 const first=await prepareSnapshot({...input(),batch});
 const atBoundary={...batch,observations:batch.observations.slice(1)};
 assert.equal((await prepareSnapshot({...input(),batch:atBoundary,previous:first,checkedAt:t2})).manifest.counts.PP,4);
 await assert.rejects(prepareSnapshot({...input(),batch:{...batch,observations:batch.observations.slice(2)},previous:first,checkedAt:t2}),{code:'CANARD_REVIEW_REQUIRED'});
 const churn=structuredClone(batch);for(const o of churn.observations)o.sourceId=JSON.stringify([JSON.parse(o.sourceId)[0],String(Number(JSON.parse(o.sourceId)[1])+100)]);
 await assert.rejects(prepareSnapshot({...input(),batch:churn,previous:first,checkedAt:t2}),{code:'CANARD_REVIEW_REQUIRED'});
 const candidate=await prepareSnapshot({...input(),batch:churn,checkedAt:t2});
 assert.equal((await prepareSnapshot({...input(),batch:churn,previous:first,checkedAt:t2,review:{...review,reviewedCandidateSha256:candidate.manifest.sha256}})).changed,true);
});
test('one invalid observation rejects whole candidate even with review exemption',async()=>{
 const batch=makeBatch();batch.observations[0].geometry.coordinates=[999,52];
 await assert.rejects(prepareSnapshot({...input(),batch,review:{...review,reviewedCandidateSha256:'a'.repeat(64)}}));
});
test('publication gate requires approved terms, robots, identities and initial exact candidate',async()=>{
 const access={html:makeCanardHtml(),termsText:'synthetic terms',robotsText:'User-Agent: *\nDisallow:',checkedAt:t1,validators:{etag:'PRIVATE'}};
 const approved={...review,publicationApproved:true,termsSha256:await sha256(new TextEncoder().encode(access.termsText)),robotsSha256:await sha256(new TextEncoder().encode(access.robotsText))};
 approved.notices={...review.notices,reviewedTermsSha256:approved.termsSha256};
 const candidate=await prepareSnapshot({...input(),notices:approved.notices});approved.reviewedCandidateSha256=candidate.manifest.sha256;
 const output=await prepareCanard({access,review:approved,previous:null});
 assert.equal(output.manifest.total,3);assert.doesNotMatch(new TextDecoder().decode(output.bytes),/PRIVATE|<script>/);
 for(const change of [{publicationApproved:false},{termsSha256:'0'.repeat(64)},{robotsSha256:'0'.repeat(64)},{identityEvidence:null},{reviewedCandidateSha256:null}])await assert.rejects(prepareCanard({access,review:{...approved,...change},previous:null}));
});
