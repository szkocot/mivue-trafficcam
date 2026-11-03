import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,truncate,access as fileAccess} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readRoadData,writeRoadData} from '../scripts/roads/files.js';
import {resolveRoadData} from '../scripts/roads/resolve.mjs';
import {createRoadResolver} from '../src/road-directions.js';
import {getRoadDirection} from '../src/road-direction-data.js';
import {normalizeCanardLayers} from '../src/canard-adapter.js';
import {prepareSnapshot,sha256,validateSnapshot} from '../src/canard-snapshot.js';
import {writeDataset} from '../scripts/canard/files.js';
import {inspectCanard,normalizeCanardAccess,prepareCanard} from '../scripts/canard/prepare.js';
import {prepareUpdate} from '../scripts/canard/update.js';
import {enrichCanardBatch} from '../src/canard-details.js';
import {makeCanardLayers,makeCanardHtml,review,retrievedAt} from './helpers/canard-fixture.js';
import {makeCanardDetail,detailRow} from './helpers/canard-detail-fixture.js';
const source={url:'https://example.org/poland.osm.pbf',dataTimestamp:retrievedAt,sha256:'a'.repeat(64),attribution:'© OpenStreetMap contributors',licenceUrl:'https://opendatacommons.org/licenses/odbl/1-0/',complete:true};
const context={schemaVersion:1,source,ways:[{id:'way/1',nodeIds:[1,2],coordinates:[[21,51.99],[21,52.01]],tags:{highway:'primary',ref:'94','destination:forward':'Warszawa'}}],places:[]};
const named=batch=>({...batch,observations:batch.observations.map(o=>({...o,originalProperties:{...o.originalProperties,canardDetail:{raw:{urzadzenie:{lokalizacjaNrDrogi:'94',nazwaKierunku1:'Warszawa'},limity:[]}}}}))});
const lookup=batch=>({schema:'mivue-canard-road-directions',version:1,source,resolutions:Object.fromEntries(createRoadResolver(context).resolveBatch(batch.observations).map((r,i)=>[batch.observations[i].sourceId,r]))});
const batch=()=>named(normalizeCanardLayers(makeCanardLayers(),{review,retrievedAt}));
async function temporary(fn){const root=await mkdtemp(join(tmpdir(),'mivue-road-files-'));try{await fn(root);}finally{await rm(root,{recursive:true,force:true});}}
test('compact road files verify hashes/counts/notices, tolerate only absent optional manifest and refuse overwrite',()=>temporary(async root=>{
 assert.equal(await readRoadData(root,{optional:true}),null);
 const directory=join(root,'data'),data=lookup(batch()),manifest=await writeRoadData(directory,data);
 assert.equal(manifest.count,3);assert.deepEqual(await readRoadData(directory),data);
 await assert.rejects(writeRoadData(directory,data),{code:'EEXIST'});
 const path=join(directory,'data/roads/directions.json'),original=await readFile(path);await writeFile(path,Buffer.concat([original,Buffer.from(' ')]));
 await assert.rejects(readRoadData(directory,{optional:true}),{code:'ROAD_DIRECTION_DATA_INVALID'});
 await writeFile(path,original);await rm(path);await assert.rejects(readRoadData(directory,{optional:true}),{code:'ENOENT'});
}));
test('road resolution CLI validates a CANARD dataset and writes every selected identity without changing source observations',()=>temporary(async root=>{
 const input=batch(),prepared=await prepareSnapshot({batch:input,notices:review.notices,checkedAt:retrievedAt,review}),canard=join(root,'canard'),contextPath=join(root,'context.json'),output=join(root,'roads');
 await writeDataset(canard,prepared);await writeFile(contextPath,JSON.stringify(context));
 const result=await resolveRoadData({canardDir:canard,contextPath,outputDir:output}),data=await readRoadData(output);
 assert.equal(result.manifest.count,input.observations.length);assert.deepEqual(Object.keys(data.resolutions).sort(),input.observations.map(o=>o.sourceId).sort());
 assert.equal(Object.values(result.counts).reduce((a,b)=>a+b,0),3);assert.equal((await validateSnapshot(prepared.bytes,prepared.manifest)).batch.observations[0].direction,null);
 const oversized=join(root,'oversized.json');await writeFile(oversized,'');await truncate(oversized,512*1024*1024+1);
 await assert.rejects(resolveRoadData({canardDir:canard,contextPath:oversized,outputDir:join(root,'failed')}),/oversized/);await assert.rejects(fileAccess(join(root,'failed')),{code:'ENOENT'});
}));
test('pure CANARD preparation applies optional road lookup after car-limit enrichment and keeps upstream gates',async()=>{
 const hash=value=>sha256(new TextEncoder().encode(value)),terms=await hash('terms');
 const checkedReview={...review,details:{enabled:true},termsSha256:terms,robotsSha256:await hash('robots'),notices:{...review.notices,reviewedTermsSha256:terms}};
 const details=Object.fromEntries(['PP','OPP','RL'].map(category=>{const raw=makeCanardDetail(category,1,[detailRow('50','80',{kierunek:'Warszawa'})]);raw.urzadzenie.lokalizacjaNrDrogi='94';return [JSON.stringify([category,'1']),{raw,retrievedAt,sourceUrl:'https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen',responseSha256:'b'.repeat(64)}];}));
 const access={html:makeCanardHtml(),termsText:'terms',robotsText:'robots',checkedAt:retrievedAt,details};
 const enriched=enrichCanardBatch(await normalizeCanardAccess(access,checkedReview),details),roadData=lookup(enriched);
 const prepared=await inspectCanard({access,review:checkedReview,roadData}),out=(await validateSnapshot(prepared.bytes,prepared.manifest)).batch;
 assert.equal(out.observations[0].speedKmh,50);assert.equal(out.observations[0].direction,null);assert.ok(getRoadDirection(out.observations[0]));
 const approved={...checkedReview,publicationApproved:true,reviewedCandidateSha256:prepared.manifest.sha256};
 assert.equal((await prepareCanard({access,review:approved,roadData})).manifest.sha256,prepared.manifest.sha256);
 const updated=await prepareUpdate({review:approved,roadData,fetchPage:async()=>access,fetchDetails:async()=>({details,cache:{}})});assert.equal(updated.prepared.manifest.sha256,prepared.manifest.sha256);
 const without=await inspectCanard({access,review:checkedReview});assert.equal((await validateSnapshot(without.bytes,without.manifest)).batch.observations[0].originalProperties.canardRoadDirection,undefined);
 await assert.rejects(inspectCanard({access,review:{...checkedReview,termsSha256:'0'.repeat(64)},roadData}),{code:'CANARD_TERMS_CHANGED'});
});
test('compact lookup generation rejects semantically invalid bearings despite valid source fingerprints',()=>temporary(async root=>{
 const data=lookup(batch()),entry=Object.values(data.resolutions).find(r=>r.status==='resolved');assert.ok(entry);entry.travelBearings=[999];
 await assert.rejects(writeRoadData(join(root,'invalid'),data),{code:'ROAD_DIRECTION_DATA_INVALID'});
}));
