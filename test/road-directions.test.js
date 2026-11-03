import test from 'node:test';import assert from 'node:assert/strict';
import {createRoadResolver} from '../src/road-directions.js';
const source={url:'https://example.org/poland.osm',dataTimestamp:'2026-11-02T00:00:00Z',sha256:'a'.repeat(64),attribution:'OpenStreetMap contributors',licenceUrl:'https://opendatacommons.org/licenses/odbl/',complete:true};
const way=(id,nodeIds,coordinates,tags={})=>({id,nodeIds,coordinates,tags:{highway:'primary',ref:'94',...tags}});
const place=(id,name,coordinates)=>({id,coordinates,tags:{place:'city',name}});
const context=(ways,places=[],complete=true)=>({schemaVersion:1,source:{...source,complete},ways,places});
const reference=(names=['w kierunku Warszawy'],geometry={type:'Point',coordinates:[19,52.01]},road='DK94')=>({geometry,originalProperties:{canardDetail:{raw:{urzadzenie:{lokalizacjaNrDrogi:road},limity:names.map(kierunek=>({limitOsobowe:'50',limitCiezarowe:null,typ:{kierunek}}))}}}});
const curved=()=>context([way('w',[1,2,3],[[19,52],[19,52.02],[20,52.02]])],[place('city','Warszawa',[20,52.02])]);
const near=(a,b)=>Math.abs(((a-b+540)%360)-180)<2;

test('routing uses local curved-road tangent and reviewed destination aliases, not city beeline',()=>{
 const resolver=createRoadResolver(curved());for(const name of ['w kierunku Warszawy','w stronę Warszawy','Warszawa']){const r=resolver.resolve(reference([name]));assert.equal(r.status,'resolved');assert.equal(r.confidence,'medium');assert.ok(near(r.travelBearings[0],0));assert.equal(r.physicalAim,null);assert.equal(r.claims[0].raw,name);assert.equal(r.claims[0].evidence.method,'graph-route');}
});
test('explicit directional destination tags can resolve clipped local context without invented city coordinates',()=>{
 const r=createRoadResolver(context([way('w',[1,2],[[19,52],[19,52.02]],{'destination:forward':'Warszawa'})],[],false)).resolve(reference());
 assert.equal(r.status,'resolved');assert.equal(r.confidence,'high');assert.ok(near(r.travelBearings[0],0));
 assert.equal(r.claims[0].evidence.method,'destination-tag');
});
test('negative-only travel claims retain excluded bearing without an active travel arrow',()=>{
 const r=createRoadResolver(curved()).resolve(reference(['Brak pomiaru w kierunku Warszawy']));assert.deepEqual(r.travelBearings,[]);assert.ok(near(r.excludedBearings[0],0));assert.equal(r.claims[0].excluded,true);
});
test('incomplete coverage, mismatching road refs, namesakes and disconnected graphs remain unresolved/ambiguous',()=>{
 const clipped=curved();clipped.source.complete=false;assert.equal(createRoadResolver(clipped).resolve(reference()).status,'unresolved');
 assert.equal(createRoadResolver(curved()).resolve(reference(['Warszawa'],undefined,'S94')).status,'unresolved');
 const names=curved();names.places.push(place('other','Warszawa',[19,52]));assert.equal(createRoadResolver(names).resolve(reference()).status,'ambiguous');
 const missing=curved();missing.places[0].coordinates=[23,54];assert.equal(createRoadResolver(missing).resolve(reference()).status,'unresolved');
});
test('one-way and implicit one-way roundabout edges are respected',()=>{
 for(const tags of [{oneway:'yes'},{junction:'roundabout'}]){const c=context([way('w',[1,2],[[19,52],[19,52.02]],tags)],[place('city','Warszawa',[19,52.02])]);const a=createRoadResolver(c).resolve(reference());assert.equal(a.status,'resolved');assert.ok(near(a.travelBearings[0],0));}
 const blocked=curved();blocked.ways[0].tags.access='no';assert.equal(createRoadResolver(blocked).resolve(reference()).status,'unresolved');
});
test('opposite parallel carriageways with similar route costs remain ambiguous',()=>{
 const c=context([way('north',[1,2,3],[[19,52],[19,52.02],[19.001,52.02]],{oneway:'yes'}),way('south',[3,4,1],[[19.001,52.02],[19.001,52],[19,52]],{oneway:'yes'})],[place('city','Warszawa',[19.0005,52.02])]);
 const r=createRoadResolver(c).resolve(reference(['Warszawa'],{type:'Point',coordinates:[19.0005,52.0199]}));assert.equal(r.status,'ambiguous');
});
test('OPP requires connected endpoint context, resolves each named destination independently and keeps speed evidence',()=>{
 const c=context([way('w',[1,2,3],[[19,52],[19,52.02],[19,52.04]])],[place('north','Warszawa',[19,52.04]),place('south','Poznań',[19,52])]);
 const ref=reference(['w kierunku Warszawy','w stronę Poznania'],{type:'LineString',coordinates:[[19,52.01],[19,52.03]]}),before=structuredClone(ref),r=createRoadResolver(c).resolve(ref);
 assert.equal(r.status,'resolved');assert.equal(r.travelBearings.length,2);assert.ok(r.travelBearings.some(n=>near(n,0)));assert.ok(r.travelBearings.some(n=>near(n,180)));assert.deepEqual(ref,before);assert.ok(r.claims.every(x=>x.evidence.endpointOrientation));
 const detached=structuredClone(ref);detached.geometry.coordinates[1]=[22,54];assert.equal(createRoadResolver(c).resolve(detached).status,'unresolved');
});
test('truck-only directions are not car directions; blank car rows can use named device directions',()=>{
 const ref=reference();ref.originalProperties.canardDetail.raw.limity=[{limitOsobowe:null,limitCiezarowe:'80',typ:{kierunek:'Katowice'}},{limitOsobowe:'50',typ:{kierunek:'Warszawa'}}];
 assert.equal(createRoadResolver(curved()).resolve(ref).claims.length,1);
 ref.originalProperties.canardDetail.raw.limity[1].typ.kierunek='';ref.originalProperties.canardDetail.raw.urzadzenie.nazwaKierunku1='Warszawa';assert.equal(createRoadResolver(curved()).resolve(ref).status,'resolved');
});
test('malformed context fails closed; batch resolver is pure and reuses the same context evidence',()=>{
 const c=curved(),refs=[reference(),reference(['not a known place'])],before=structuredClone({c,refs});const a=createRoadResolver(c).resolveBatch(refs);assert.equal(a.length,2);assert.deepEqual({c,refs},before);assert.deepEqual(a[0].source,source);
 const bad=curved();bad.ways[0].coordinates.pop();assert.throws(()=>createRoadResolver(bad));
});

test('stale input key excludes annotations/retrieval but changes with geometry, road and eligible claims',async()=>{
 const {roadDirectionInputKey}=await import('../src/road-directions.js');const ref=reference(),key=roadDirectionInputKey(ref);
 ref.originalProperties.canardRoadDirection={inputKey:key};ref.retrievedAt='2099-01-01';assert.equal(roadDirectionInputKey(ref),key);
 for(const mutate of [r=>r.geometry.coordinates[0]+=.001,r=>r.originalProperties.canardDetail.raw.urzadzenie.lokalizacjaNrDrogi='S94',r=>r.originalProperties.canardDetail.raw.limity[0].limitOsobowe=null,r=>r.originalProperties.canardDetail.raw.limity[0].typ.kierunek='Poznań']){const changed=structuredClone(ref);mutate(changed);assert.notEqual(roadDirectionInputKey(changed),key);}
 assert.equal(createRoadResolver(curved()).resolve(ref).inputKey,key);
});
test('curved OPP preserves different local bearings at its first and last endpoints in either orientation',()=>{
 const c=context([way('w',[1,2,3,4],[[19,52],[19,52.02],[19.04,52.02],[19.08,52.02]])],[place('north','Warszawa',[19.08,52.02]),place('south','Poznań',[19,52])]);
 const r=createRoadResolver(c).resolve(reference(['Warszawa','Poznań'],{type:'LineString',coordinates:[[19,52.01],[19.06,52.02]]}));assert.equal(r.status,'resolved');
 const forward=r.claims.find(c=>c.evidence.endpointOrientation==='forward'),reverse=r.claims.find(c=>c.evidence.endpointOrientation==='reverse');
 assert.ok(forward&&reverse);assert.ok(near(forward.evidence.endpointBearings[0],0));assert.ok(near(forward.evidence.endpointBearings[1],90));
 assert.ok(near(reverse.evidence.endpointBearings[0],180));assert.ok(near(reverse.evidence.endpointBearings[1],270));assert.ok(near(reverse.bearings[0],180));
});
test('reversed one-way routing and finite aliases distinguish S/A road refs from numeric roads',()=>{
 const c=context([way('w',[1,2],[[19,52],[19,52.02]],{ref:'S8',oneway:'-1'})],[place('city','Katowice',[19,52])]);
 const r=createRoadResolver(c).resolve(reference(['W kier. Katowic'],undefined,'S8'));assert.equal(r.status,'resolved');assert.ok(near(r.travelBearings[0],180));
 assert.equal(createRoadResolver(c).resolve(reference(['Katowice'],undefined,'8')).status,'unresolved');
});

test('both OPP endpoints inside one directed geometry edge are connected without a fabricated turnaround',()=>{
 const c=context([way('w',[1,2],[[19,52],[19,52.04]],{oneway:'yes'})],[place('city','Warszawa',[19,52.04])]);
 const r=createRoadResolver(c).resolve(reference(['Warszawa'],{type:'LineString',coordinates:[[19,52.01],[19,52.03]]}));assert.equal(r.status,'resolved');assert.equal(r.claims[0].evidence.endpointOrientation,'forward');
});
test('explicit OPP destination tags need connected endpoints, even in clipped context',()=>{
 const c=context([way('w',[1,2],[[19,52],[19,52.04]],{oneway:'yes','destination:forward':'Warszawa'})],[],false);
 const r=createRoadResolver(c).resolve(reference(['Warszawa'],{type:'LineString',coordinates:[[19,52.01],[19,52.03]]}));assert.equal(r.status,'resolved');assert.equal(r.confidence,'high');
});

test('degree-two geometry over the routing-node budget remains usable without losing full polyline evidence',()=>{
 const count=500010,nodeIds=Array.from({length:count},(_,i)=>i+1),coordinates=Array.from({length:count},(_,i)=>[19+i/10000000,52]);
 const resolver=createRoadResolver(context([way('long',nodeIds,coordinates)]));assert.deepEqual(resolver.resolveBatch([]),[]);
});
test('actual inflected destinations and explicit tunnel suffixes normalize without reversing origin claims',()=>{
 const names=[['W kierunku Gliwic','Gliwice'],['W stronę Częstochowy','Częstochowa'],['w stronę Dobronia','Dobroń'],['w stronę Petrykoz','Petrykozy'],['Tunel S2, w stronę Mińska Mazowieckiego','Mińsk Mazowiecki'],['Tunel S3, Nowe Bogaczowice, kier. Bolków','Bolków']];
 for(const [raw,name]of names){const c=context([way('w',[1,2],[[19,52],[19,52.02]],{'destination:forward':name})]);const result=createRoadResolver(c).resolve(reference([raw]));assert.equal(result.status,'resolved',raw);assert.ok(near(result.travelBearings[0],0));}
 const r=createRoadResolver(curved()).resolve(reference(['od strony Warszawy']));assert.equal(r.status,'unresolved');assert.deepEqual(r.travelBearings,[]);
});
test('generic destination follows reversed one-way travel, including clipped context',()=>{
 const c=context([way('w',[1,2],[[19,52],[19,52.02]],{oneway:'-1',destination:'Warszawa'})],[],false),r=createRoadResolver(c).resolve(reference());assert.equal(r.status,'resolved');assert.equal(r.confidence,'high');assert.ok(near(r.travelBearings[0],180));
});
test('motorway city destinations can distinguish a unique city from homonymous hamlets with explicit evidence',()=>{
 const c=context([way('w',[1,2],[[19,52],[19,52.02]],{highway:'motorway',ref:'A2'})],[place('city','Warszawa',[19,52.02]),{id:'hamlet',coordinates:[19,52],tags:{place:'hamlet',name:'Warszawa'}}]);
 const r=createRoadResolver(c).resolve(reference(['w kierunku Warszawy'],undefined,'A2'));assert.equal(r.status,'resolved');assert.ok(near(r.travelBearings[0],0));assert.equal(r.confidence,'medium');assert.equal(r.claims[0].evidence.placeSelection,'unique-city-on-motorway-or-expressway');
 c.ways[0].tags.ref='94';assert.equal(createRoadResolver(c).resolve(reference()).status,'ambiguous');
 c.ways[0].tags.ref='A2';c.places[1].tags.place='city';assert.equal(createRoadResolver(c).resolve(reference(undefined,undefined,'A2')).status,'ambiguous');
});
test('OPP destination at the exit resolves forward without accepting a turnaround through opposite carriageways',()=>{
 const c=context([way('entry',[1,2],[[19,52],[19,52.015]],{oneway:'yes'}),way('exit',[2,3],[[19,52.015],[19,52.06]],{oneway:'yes',destination:'Warszawa'}),way('return',[3,4,1],[[19,52.06],[19.0002,52],[19,52]],{oneway:'yes'})],[],false);
 const ref=reference(['Warszawa'],{type:'LineString',coordinates:[[19,52.005],[19,52.015]]}),r=createRoadResolver(c).resolve(ref);
 assert.equal(r.status,'resolved');assert.equal(r.claims[0].evidence.endpointOrientation,'forward');assert.ok(near(r.travelBearings[0],0));assert.ok(r.claims[0].evidence.sectionRouteMetres<1200);
});
test('reported section lengths participate in direction fingerprint freshness',async()=>{
 const {roadDirectionInputKey}=await import('../src/road-directions.js'),r=reference();const before=roadDirectionInputKey(r);r.originalProperties.canardDetail.raw.urzadzenie.dlugoscOdcinka1=1500;assert.notEqual(roadDirectionInputKey(r),before);
});
