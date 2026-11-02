import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeDirections} from '../src/direction-analysis.js';
const row=(direction,chainage='ROSNACY',car='50',truck=null)=>({limitOsobowe:car,limitCiezarowe:truck,typ:{kierunek:direction,kierunekPikietazu:chainage}});
const ref=(rows,device={})=>({direction:null,originalProperties:{canardDetail:{raw:{limity:rows,urzadzenie:device}}}});
const record=(heading=30,mode=1,typeRaw=1)=>({id:'source:100',typeRaw,rawBytes16To19:[50,heading,0,mode]});

test('91359960: passenger row MAL and mast ROS remain separate and flag conflicting claims',()=>{
 const r=ref([row('','MALEJACY')],{masztKierunekPomiaru:'Pikietaz rosnacy'}),before=structuredClone(r),a=analyzeDirections(r,{records:[record()]});
 assert.equal(a.sourceCaptureMode,'unknown');assert.equal(a.sourceTravelDirections[0].chainage,'decreasing');
 assert.equal(a.sourceChainage.mastRaw,'Pikietaz rosnacy');assert.equal(a.sourceChainage.mastDirection,'increasing');assert.equal(a.sourceChainage.conflict,true);
 assert.ok(a.issues.includes('ROW_MAST_CHAINAGE_CONFLICT'));assert.deepEqual(a.physicalAim,{status:'unknown',bearingDegrees:null});
 assert.deepEqual(a.roadAxisAimEstimates,[]);assert.deepEqual(r,before);
});
test('91414277: named passenger directions retain same chainage, truck-only both does not imply car mode or bearing',()=>{
 const a=analyzeDirections(ref([row('najazd i odjazd','ROSNACY',null,'80'),row('w stronę Dobronia','ROSNACY','110'),row('w stronę Petrykoz','ROSNACY','120')],{masztKierunekPomiaru:'Pikietaz rosnacy',nazwaKierunku1:'w stronę Petrykoz',nazwaKierunku2:'w stronę Dobronia'}));
 assert.equal(a.sourceTravelDirections.length,2);assert.deepEqual(a.sourceTravelDirections.map(r=>r.label),['w stronę Dobronia','w stronę Petrykoz']);
 assert.equal(a.sourceCaptureMode,'unknown');assert.equal(a.sourceChainage.conflict,false);assert.deepEqual(a.mioAlertBearings,[]);assert.deepEqual(a.roadAxisAimEstimates,[]);
});
test('only exact positive passenger capture labels derive road-axis estimates, never physical azimuth',()=>{
 for(const label of ['najazd','pojazdy zbliżające się']){
  const a=analyzeDirections(ref([row(label)]),{records:[record(150)]});assert.equal(a.sourceCaptureMode,'approach');
  assert.deepEqual(a.roadAxisAimEstimates,[{recordId:'source:100',bearingDegrees:120,captureMode:'approach',basis:'road-axis-derived'}]);
  assert.equal(a.physicalAim.bearingDegrees,null);assert.ok(a.issues.includes('ROAD_AXIS_ESTIMATE_ONLY'));
 }
 for(const label of ['odjazd','pojazdy oddalające się','oddalające'])assert.equal(analyzeDirections(ref([row(label)]),{records:[record(150)]}).roadAxisAimEstimates[0].bearingDegrees,300);
 for(const label of ['najazd i odjazd','both','northbound','możliwy najazd','w stronę Łodzi']){
  const a=analyzeDirections(ref([row(label)]),{records:[record()]});assert.deepEqual(a.roadAxisAimEstimates,[]);assert.equal(a.physicalAim.status,'unknown');
 }
});
test('explicit both and mixed/unknown passenger modes cannot establish a single physical aiming axis',()=>{
 for(const rows of [[row('najazd i odjazd')],[row('najazd'),row('odjazd')],[row('najazd'),row('w stronę Łodzi')]]){
  const a=analyzeDirections(ref(rows),{records:[record()]});assert.ok(['both','unknown'].includes(a.sourceCaptureMode));assert.deepEqual(a.roadAxisAimEstimates,[]);
 }
 for(const car of [null,'0','-1','signals'])assert.equal(analyzeDirections(ref([row('najazd','ROSNACY',car,'50')])).sourceCaptureMode,'unknown');
});
test('Mio uses 2×heading only in researched type/mode/range and retains unknown raw evidence',()=>{
 for(const type of [1,3,5,964,9128])for(const heading of [0,1,90,179]){
  const a=analyzeDirections({}, {records:[record(heading,1,type)]});assert.equal(a.mioAlertBearings[0].bearingDegrees,2*heading);assert.match(a.mioAlertBearings[0].scope,/955W/);
 }
 for(const r of [record(0,0),record(30,2),record(30,255),record(255),record(-1),record(1.5),record(30,1,4294967295)]){
  const a=analyzeDirections(ref([row('najazd')]),{records:[r]});assert.equal(a.mioAlertBearings[0].bearingDegrees,null);assert.equal(a.mioAlertBearings[0].headingRaw,r.rawBytes16To19[1]);assert.deepEqual(a.roadAxisAimEstimates,[]);assert.ok(a.issues.includes('MIO_ALERT_UNCLASSIFIED'));
 }
});
test('bare source bearing is not classified as travel or physical aim and chainage never becomes degrees',()=>{
 const r=ref([row('odjazd','MAL')],{masztKierunekPomiaru:'Pikietaż malejący'});r.direction=270;
 const a=analyzeDirections(r);assert.equal(a.sourceChainage.mastDirection,'decreasing');assert.equal(a.sourceTravelDirections[0].chainage,'decreasing');assert.deepEqual(a.physicalAim,{status:'unknown',bearingDegrees:null});assert.deepEqual(a.roadAxisAimEstimates,[]);assert.equal(Object.hasOwn(a,'sourceTravelBearingDegrees'),false);
});

test('analysis preserves every input field, raw unknown mode and separate per-record estimates',()=>{
 const r=ref([row('najazd')]),records=[record(0),{...record(179),id:'source:200'},record(255,255)],before=structuredClone({r,records});
 const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};freeze(r);freeze(records);
 const a=analyzeDirections(r,{records});assert.deepEqual({r,records},before);
 assert.deepEqual(a.roadAxisAimEstimates.map(row=>row.bearingDegrees),[180,178]);
 assert.equal(a.mioAlertBearings[2].headingRaw,255);assert.equal(a.mioAlertBearings[2].modeRaw,255);assert.equal(a.physicalAim.bearingDegrees,null);
});
