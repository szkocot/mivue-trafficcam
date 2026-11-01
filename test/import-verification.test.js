import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyHostedImport} from '../scripts/verification/import-check.js';
import {prepareSnapshot} from '../src/canard-snapshot.js';
import {normalizeCanardLayers} from '../src/canard-adapter.js';
import {makeCanardLayers,review,retrievedAt} from './helpers/canard-fixture.js';
import {makeFixture} from './helpers/fixture.js';
for(const suppliedSpeed of [false,true])test(`actual hosted import preserves every observation, notices, project and original BIN (supplied speed: ${suppliedSpeed})`,async()=>{
 const batch=normalizeCanardLayers(makeCanardLayers(),{review,retrievedAt});
 if(suppliedSpeed)Object.assign(batch.observations[0],{speedKmh:50*1.609344,originalSpeed:{value:50,unit:'mph'}});
 const prepared=await prepareSnapshot({batch,notices:review.notices,checkedAt:retrievedAt,termsSha256:review.notices.reviewedTermsSha256,robotsSha256:review.robotsSha256,review});
 const result=await verifyHostedImport(makeFixture([{}]).bytes,prepared);
 assert.equal(result.passed,true);assert.equal(result.observations,3);assert.equal(result.baselineBinByteIdentical,true);
});
