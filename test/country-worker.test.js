import test from 'node:test';import assert from 'node:assert/strict';
import {createWorkerSession} from '../web/worker-session.js';
import {makeFixture} from './helpers/fixture.js';
import {packCountryData,boxCountry} from './helpers/country-fixture.js';
import {validateCountryData} from '../src/country-data.js';
const options={countryIds:['AA'],decisions:{},componentDecisions:{},acknowledgeExtras:true};
async function setup(load){const e=await packCountryData([boxCountry('AA',-8,36,-6,38)]),worker=createWorkerSession({loadCountryData:load??(()=>validateCountryData(e.bytes,e.manifest,e.noticeBytes))});let n=0;const req=(kind,payload={},sessionId='country')=>worker.handle({kind,payload,sessionId,requestId:++n});const opened=(await req('open-bin',{bytes:makeFixture([{}]).bytes})).result;return {worker,req,opened};}
test('worker preview/export neither modifies history nor accepts stale/forged requests',async()=>{
 const {req,opened}=await setup();const payload={expectedRevision:0,generation:1,options};
 const bad=await req('country-preview',{...payload,expectedRevision:9});assert.equal(bad.error.code,'COUNTRY_PREVIEW_STALE');
 const preview=await req('country-preview',payload);assert.equal(preview.ok,true);
 const exp=await req('country-export',{expectedRevision:0,generation:1,token:preview.result.token,format:'json'});assert.equal(exp.ok,true);
 assert.deepEqual((await req('snapshot')).result,opened);
 assert.equal((await req('export',{format:'json',countryIds:['AA']})).ok,false);
 await req('apply',{operation:{kind:'update',id:opened.view.records[0].id,changes:{latitude:37.1}}});
 assert.equal((await req('country-export',{expectedRevision:1,generation:1,token:preview.result.token,format:'bin'})).error.code,'COUNTRY_PREVIEW_STALE');
});
test('cancellation aborts pending and queued generations but preserves full backups',async()=>{
 let release;const gate=new Promise(r=>release=r);const e=await packCountryData([boxCountry('AA',-8,36,-6,38)]);
 const {worker,req,opened}=await setup(async()=>{await gate;return validateCountryData(e.bytes,e.manifest,e.noticeBytes);});
 const first=req('country-preview',{expectedRevision:0,generation:1,options});
 await new Promise(r=>setTimeout(r,0));const queued=req('country-preview',{expectedRevision:0,generation:2,options});
 worker.cancelCountry({sessionId:'country',generation:2});release();
 assert.equal((await queued).error.code,'COUNTRY_CANCELLED');
 // Cancelling a newer generation must also make older pending results unusable.
 assert.equal((await first).error.code,'COUNTRY_CANCELLED');
 assert.equal((await req('export',{format:'project'})).result.text,opened.projectJson);
});
test('boundary failure does not prevent full backup or a later successful retry',async()=>{
 const e=await packCountryData([boxCountry('AA',-8,36,-6,38)]);let fail=true;
 const {req,opened}=await setup(async()=>{if(fail)throw Error('offline');return validateCountryData(e.bytes,e.manifest,e.noticeBytes);});
 assert.equal((await req('country-list',{generation:1})).ok,false);assert.equal((await req('export',{format:'project'})).result.text,opened.projectJson);fail=false;
 assert.equal((await req('country-preview',{expectedRevision:0,generation:2,options})).ok,true);
});
