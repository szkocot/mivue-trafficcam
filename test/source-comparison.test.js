import test from 'node:test';
import assert from 'node:assert/strict';
import {compareCanardMio} from '../src/source-comparison.js';
import {parseDatabase} from '../src/parser.js';
import {makeFixture} from './helpers/fixture.js';
import {comparisonCsv,speedInventoryCsv} from '../scripts/verification/report.js';
const point=(id,xy,category='PP')=>({sourceId:JSON.stringify([category,id]),kind:category==='RL'?'red-light':'camera',geometry:{type:'Point',coordinates:xy},speedKmh:null,originalSpeed:null,direction:null,originalProperties:{sourceCategory:category}});
const section=(id,a,b)=>({...point(id,a,'OPP'),kind:'section',geometry:{type:'LineString',coordinates:[a,b]}});
const classify=({longitude})=>({status:longitude<0?'assigned':'border',countryIds:longitude<0?['PL']:['ZZ']});
const run=(records,observations)=>compareCanardMio({database:parseDatabase(makeFixture(records).bytes),batch:{observations},classifier:{classify},countryId:'PL'});
test('coverage differences and ambiguous proximity remain review categories, not import errors',()=>{
 const r=run([{}, {},{longitudeRaw:-600},{longitudeRaw:100}], [point('a',[-7,37]),point('b',[-5,37])]);
 assert.equal(r.points[0].status,'ambiguous');assert.equal(r.points[0].candidates.length,2);
 assert.equal(r.points[1].status,'canard-only');assert.equal(r.mioOnly.length,1);
 assert.equal(r.scope.outsideOrUnassigned,1);assert.equal(r.points[0].candidates[0].rawSpeed,50);
 assert.equal(r.speed.sourceUnknown,2);assert.match(r.speed.binMetadataScope,/MiVue 955W/);
});
test('OPP compares both complete endpoints and reports reversal and stored-speed disagreement',()=>{
 const r=run([{typeRaw:964,linkTo:1},{typeRaw:9128,longitudeRaw:-654,rawBytes16To19:[60,0,0,1]}],[section('a',[-6.9,37],[-7,37])]);
 const s=r.sections[0];assert.equal(s.status,'spatial-candidate');assert.equal(s.candidates[0].orientation,'reversed');
 assert.ok(s.candidates[0].maxEndpointMetres<0.01);assert.equal(s.candidates[0].storedSpeedsAgree,false);
 assert.equal(s.routeVerified,false);assert.equal(s.identityVerified,false);
});
test('a nearby endpoint does not verify a different OPP range',()=>{
 const r=run([{typeRaw:964,linkTo:1},{typeRaw:9128,longitudeRaw:-654}],[section('a',[-7,37],[-6.8,37])]);
 const s=r.sections[0];assert.equal(s.status,'range-review');assert.equal(s.candidates[0].oneSided,true);
 assert.ok(s.candidates[0].maxEndpointMetres>8000);assert.ok(s.candidates[0].lengthRatio<0.51);
});
test('partial overlapping ranges without nearby endpoints remain review candidates',()=>{
 const r=run([{typeRaw:964,linkTo:1},{typeRaw:9128,longitudeRaw:-642}],[section('a',[-6.9,37],[-6.6,37])]);
 assert.equal(r.sections[0].status,'range-review');assert.equal(r.sections[0].candidates[0].connectorOverlap,true);
});
test('broken links, invalid coordinates and zero speed are retained as explicit evidence',()=>{
 const r=run([{typeRaw:964,linkRaw:123,rawBytes16To19:[0,0,0,1]},{latitudeRaw:NaN}],[section('a',[-7,37],[-6.9,37])]);
 assert.equal(r.linkProblems.length,1);assert.equal(r.scope.invalid,1);assert.equal(r.speed.rawZero,1);
 assert.equal(r.sections[0].status,'canard-only');
});
test('saved-project views use stable resolved link IDs and current edited positions',()=>{
 const database={records:[{id:'source:1',originalSourceOffset:1,typeRaw:964,originalLinkRaw:999,linkTargetId:'source:2',latitude:37,longitude:-7,rawBytes16To19:[50,0,0,1]},
  {id:'source:2',originalSourceOffset:2,typeRaw:9128,originalLinkRaw:0,latitude:37,longitude:-6.9,rawBytes16To19:[50,0,0,1]}]};
 const r=compareCanardMio({database,batch:{observations:[section('a',[-7,37],[-6.9,37])]},classifier:{classify},countryId:'PL'});
 assert.equal(r.sections[0].status,'spatial-candidate');assert.equal(r.linkProblems.length,0);
 database.records[1].deleted=true;
 const deleted=compareCanardMio({database,batch:{observations:[]},classifier:{classify},countryId:'PL'});
 assert.equal(deleted.linkProblems[0].code,'LINK_TARGET_DELETED');
});
test('OPP length disagreement remains under review even when both endpoints are within 100 m',()=>{
 const r=run([{typeRaw:964,linkTo:1},{typeRaw:9128,longitudeRaw:-659.82}],[section('short',[-7,37],[-6.998,37])]);
 const c=r.sections[0].candidates[0];assert.ok(c.maxEndpointMetres<100);assert.equal(c.rangeWithinTolerance,false);assert.equal(r.sections[0].status,'range-review');
});
test('cross-boundary OPP pairs remain whole while foreign records stay outside coverage totals',()=>{
 const r=compareCanardMio({database:parseDatabase(makeFixture([{typeRaw:964,linkTo:1},{typeRaw:9128,longitudeRaw:100}]).bytes),
  batch:{observations:[]},classifier:{classify},countryId:'PL'});
 assert.equal(r.scope.validInScope,1);assert.equal(r.scope.outsideOrUnassigned,1);assert.equal(r.mioOnlySections[0].endpoints.length,2);
});
test('known source limits never replace zero or unverified BIN values',()=>{
 const p={...point('known',[-7,37]),speedKmh:50,originalSpeed:{value:50,unit:'km/h'}};
 const r=run([{rawBytes16To19:[0,0,0,1]}],[p]);
 assert.equal(r.speed.sourceKnown,1);assert.equal(r.speed.byCategory.PP.unknown,0);assert.equal(r.speed.byRawType[1].rawZero,1);
 assert.equal(r.points[0].candidates[0].rawSpeed,0);assert.match(r.speed.binMetadataScope,/MiVue 955W/);
});
test('OPP comparisons reject missing or extra endpoints rather than silently verifying a point',()=>{
 for(const geometry of [{type:'Point',coordinates:[-7,37]},{type:'LineString',coordinates:[[-7,37],[-6.95,37],[-6.9,37]]}]){
  const o={...section('bad',[-7,37],[-6.9,37]),geometry};assert.throws(()=>run([{}],[o]),/two endpoints/);
 }
});
test('speed inventory covers foreign BIN points without calling their absence a CANARD discrepancy',()=>{
 const r=run([{},{longitudeRaw:100,typeRaw:3,rawBytes16To19:[0,0,0,1]}],[]);
 assert.equal(r.speed.rawZero,0);assert.equal(r.speed.global.rawZero,1);assert.equal(r.speed.global.total,2);
 assert.equal(r.scope.outsideOrUnassigned,1);assert.equal(r.mioOnly.length,1);
});
test('adjacent OPP ranges extending in opposite directions preserve their shared endpoint',()=>{
 const r=run([{typeRaw:964,linkTo:1},{typeRaw:9128,longitudeRaw:-706}],[section('adjacent',[-7,37],[-6.9,37])]);
 const s=r.sections[0];assert.equal(s.status,'range-review');assert.equal(s.candidates[0].oneSided,true);
 assert.equal(s.candidates[0].orientation,'direct');assert.ok(s.candidates[0].endpointMetres[0]<.01);
 assert.equal(s.candidates[0].connectorOverlap,false);assert.equal(r.mioOnlySections.length,0);
});

test('reviewed BIN metadata distinguishes known, unspecified and unclassified without changing raw values',()=>{
 const r=run([{rawBytes16To19:[50,0,0,1]},{typeRaw:3,rawBytes16To19:[0,0,0,1]},{typeRaw:5,rawBytes16To19:[139,0,0,1]},{longitudeRaw:100,rawBytes16To19:[5,0,0,1]}],[point('a',[-7,37])]);
 assert.deepEqual(r.speed.decodedCounts,{known:1,unspecified:1,unclassified:1});
 assert.deepEqual(r.speed.global.decodedCounts,{known:1,unspecified:1,unclassified:2});
 const c=r.points[0].candidates;assert.equal(c.find(x=>x.rawSpeed===50).decodedSpeed.speedKmh,50);
 assert.equal(c.find(x=>x.rawSpeed===0).decodedSpeed.status,'unspecified');
 assert.equal(c.find(x=>x.rawSpeed===139).decodedSpeed.speedKmh,null);
 assert.equal(c.find(x=>x.rawType===3).decodedType.kind,'red-light');
 assert.equal(c.find(x=>x.rawType===5).decodedType.kind,'mobile');
 assert.equal(r.speed.sourceUnknown,1);
 const csv=comparisonCsv(r);assert.ok(csv.includes('decodedSpeedKmh'));assert.ok(csv.includes('unspecified'));assert.ok(csv.includes('unclassified'));assert.ok(csv.includes('MiVue 955W'));
 const inventory=speedInventoryCsv([{id:'raw',typeRaw:5,rawBytes16To19:[139,0,0,1],latitude:37,longitude:-7}]);assert.ok(inventory.includes('\"139\"'));assert.ok(inventory.includes('\"unclassified\",\"\",\"mobile\"'));
});
