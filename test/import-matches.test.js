import test from 'node:test';
import assert from 'node:assert/strict';
import {findImportMatches} from '../src/import-matches.js';
import {roadDirectionInputKey} from '../src/road-directions.js';
const record=(id,longitude=21,typeRaw=1,extra={})=>({id,latitude:52,longitude,typeRaw,rawBytes16To19:[50,0,0,1],...extra});
const reference=(sourceId='one',extra={})=>({id:`import:${sourceId}`,namespace:'canard',sourceId,kind:'camera',geometry:{type:'Point',coordinates:[21,52]},speedKmh:null,direction:null,originalProperties:{},...extra});
const section=(extra={})=>reference('section',{kind:'section',geometry:{type:'LineString',coordinates:[[21,52],[21.1,52]]},...extra});
const pair=()=>[record('a',21,964,{linkTargetId:'b'}),record('b',21.1,9128)];

test('point suggestions require compatible raw types, valid positions and100m tolerance without mutating inputs',()=>{
 const records=[record('camera'),record('mobile',21.0005,5),record('red',21,3),record('section',21,964),record('deleted',21,1,{deleted:true}),record('invalid',NaN),record('far',21.01)];
 const references=[reference(),reference('red',{kind:'red-light'}),reference('unknown',{kind:'unknown'})],before=structuredClone({records,references});
 const r=findImportMatches({records,references});
 assert.deepEqual(r.rows[0].candidates.map(c=>c.recordIds),[['camera'],['mobile']]);assert.equal(r.rows[0].status,'ambiguous');
 assert.deepEqual(r.rows[1].candidates.map(c=>c.recordIds),[['red']]);assert.equal(r.rows[1].status,'unique');assert.equal(r.rows[1].bulkSafe,true);
 assert.equal(r.rows[2].status,'unmatched');assert.equal(r.rows[0].identityVerified,false);assert.equal(r.rows[0].candidates[0].records[0].rawSpeed,50);
 assert.deepEqual({records,references},before);
});

test('complete OPP pairs support reverse orientation and preserve multi-vertex source geometry',()=>{
 const geometry={type:'LineString',coordinates:[[21.1,52],[21.05,52.01],[21,52]]};
 const r=findImportMatches({records:pair(),references:[section({geometry})]});const c=r.rows[0].candidates[0];
 assert.equal(r.rows[0].status,'unique');assert.deepEqual(c.recordIds,['a','b']);assert.equal(c.orientation,'reversed');assert.ok(c.endpointMetres.every(n=>n<.001));assert.deepEqual(r.rows[0].geometry,geometry);
 assert.equal(c.identityVerified,false);assert.equal(c.routeVerified,false);
});

test('one-sided ranges, incompatible spans, missing/deleted/wrong targets and degenerate pairs never fit',()=>{
 for(const records of [[record('a',21,964,{linkTargetId:'missing'})],[record('a',21,964,{linkTargetId:'b'}),record('b',21.1,1)],[record('a',21,964,{linkTargetId:'b'}),record('b',21.1,9128,{deleted:true})],[record('a',21,964,{linkTargetId:'b'}),record('b',21,9128)],pair()]){
  assert.equal(findImportMatches({records,references:[section({geometry:{type:'LineString',coordinates:[[21,52],[21.2,52]]}})]}).rows[0].status,'unmatched');
 }
 const records=[record('a',21,964,{linkTargetId:'b'}),record('b',21.0001,9128)];
 assert.equal(findImportMatches({records,references:[section({geometry:{type:'LineString',coordinates:[[21,52],[21.001,52]]}})]}).rows[0].status,'unmatched');
});

test('resolved IDs and original raw offsets can both identify complete pairs',()=>{
 const records=[record('a',21,964,{originalSourceOffset:100,originalLinkRaw:128}),record('b',21.1,9128,{originalSourceOffset:128})];
 assert.equal(findImportMatches({records,references:[section()]}).rows[0].status,'unique');
});

test('same-namespace competition blocks bulk choices even when each row has one nearby candidate',()=>{
 const result=findImportMatches({records:[record('a')],references:[reference('one'),reference('two')]});
 for(const row of result.rows){assert.equal(row.status,'ambiguous');assert.equal(row.bulkSafe,false);assert.deepEqual(row.contestedRecordIds,['a']);assert.equal(row.candidates.length,1);}
 assert.deepEqual(result.summary,{total:2,unique:0,ambiguous:2,unmatched:0,bound:0});
});

test('bound multi-record associations reserve even deleted IDs but different namespaces do not compete',()=>{
 const references=[reference('bound',{recordIds:['a','deleted']}),reference('new'),reference('other',{namespace:'osm'})];
 const r=findImportMatches({records:[record('a'),record('deleted',21,1,{deleted:true})],references});
 assert.equal(r.rows[0].status,'bound');assert.deepEqual(r.rows[0].boundRecordIds,['a','deleted']);assert.equal(r.rows[0].candidates.length,1);
 assert.equal(r.rows[1].status,'ambiguous');assert.equal(r.rows[2].status,'unique');
});

test('a record considered by an ambiguous row also contests a separate otherwise-unique row',()=>{
 const r=findImportMatches({records:[record('a'),record('b',21.002)],references:[reference('many',{geometry:{type:'Point',coordinates:[21.001,52]}}),reference('one')]});
 assert.equal(r.rows[0].candidates.length,2);assert.equal(r.rows[1].candidates.length,1);assert.equal(r.rows[1].status,'ambiguous');
});

test('source direction labels and numeric bearing remain separate; dateline proximity is spherical',()=>{
 const ref=reference('date',{direction:null,geometry:{type:'Point',coordinates:[179.9998,52]},originalProperties:{canardDetail:{raw:{limity:[{typ:{kierunek:'Warszawa'}},{typ:{kierunek:'Gdańsk'}}]}}}});
 const r=findImportMatches({records:[record('date',-179.9998)],references:[ref]});
 assert.equal(r.rows[0].status,'unique');assert.equal(r.rows[0].direction,null);assert.deepEqual(r.rows[0].directions,['Warszawa','Gdańsk']);assert.ok(r.rows[0].candidates[0].metres<100);
});

test('short linked pairs with uncertain orientation remain manual suggestions rather than bulk-safe choices',()=>{
 const records=[record('a',21,964,{linkTargetId:'b'}),record('b',21.0005,9128)];
 const r=findImportMatches({records,references:[section({geometry:{type:'LineString',coordinates:[[21,52],[21.0005,52]]}})]});
 assert.equal(r.rows[0].candidates.length,1);assert.equal(r.rows[0].candidates[0].orientationUncertain,true);assert.equal(r.rows[0].status,'ambiguous');assert.equal(r.rows[0].bulkSafe,false);
});

test('unrelated imported metadata cannot masquerade as a CANARD direction array or break matching',()=>{
 for(const limity of [{},null,[null,{}]]){
  const r=findImportMatches({records:[record('a')],references:[reference('metadata',{originalProperties:{canardDetail:{raw:{limity}}}})]});
  assert.equal(r.rows[0].status,'unique');assert.deepEqual(r.rows[0].directions,[]);
 }
});

const road=(travelBearings=[90],excludedBearings=[],extra={})=>({schemaVersion:1,status:'resolved',travelBearings,excludedBearings,confidence:'high',claims:[...travelBearings.map(bearing=>({raw:'East',destination:'East',excluded:false,status:'resolved',bearings:[bearing],evidence:{method:'destination-tag',wayIds:['way'],snapMetres:0},reason:null})),...excludedBearings.map(bearing=>({raw:'Brak pomiaru w kierunku East',destination:'East',excluded:true,status:'resolved',bearings:[bearing],evidence:{method:'destination-tag',wayIds:['way'],snapMetres:0},reason:null}))],source:{complete:true,url:'https://www.openstreetmap.org/',sha256:'a'.repeat(64),attribution:'OSM',licenceUrl:'https://opendatacommons.org/licenses/odbl/',dataTimestamp:'2026-11-02T00:00:00Z'},physicalAim:null,...extra});
const roadReference=(metadata=road(),extra={})=>{const r=reference('road',{namespace:'pl.gitd.canard.public-map',originalProperties:{canardRoadDirection:metadata},...extra});metadata.inputKey=roadDirectionInputKey(r);return r;};
const headed=(id,heading,extra={})=>record(id,21,1,{rawBytes16To19:[50,heading/2,0,1],...extra});
test('independent road bearings rank an agreeing point ahead of opposite geometry and recommend only it',()=>{
 const records=[headed('opposite',270),headed('agree',90)],references=[roadReference()],before=structuredClone({records,references});
 const {rows}=findImportMatches({records,references}),row=rows[0];
 assert.deepEqual(row.candidates.map(c=>c.directionComparison.status),['agree','opposite']);assert.equal(row.status,'unique');assert.equal(row.bulkSafe,true);assert.deepEqual(row.recommendedRecordIds,['agree']);
 assert.equal(row.candidates[0].directionComparison.deltaDegrees,0);assert.equal(row.candidates[0].directionComparison.basis,'road-derived');assert.equal(row.identityVerified,false);assert.deepEqual({records,references},before);
});
test('excluded-only directions and opposite candidates remain visible but never recommended',()=>{
 for(const metadata of [road([90],[270]),road([],[270])]){
  const row=findImportMatches({records:[headed('opposite',270)],references:[roadReference(metadata)]}).rows[0];
  assert.equal(row.candidates[0].directionComparison.status,'excluded');assert.equal(row.bulkSafe,false);assert.deepEqual(row.recommendedRecordIds,[]);assert.equal(row.status,'ambiguous');
 }
});
test('unknown Mio heading stays manual with resolved road even at medium confidence; absent road keeps prior geometry behavior',()=>{
 for(const confidence of ['high','medium']){
  const row=findImportMatches({records:[headed('unknown',90,{rawBytes16To19:[50,45,0,2]})],references:[roadReference(road([90],[],{confidence}))]}).rows[0];
  assert.equal(row.candidates[0].directionComparison.status,'unknown');assert.equal(row.bulkSafe,false);assert.deepEqual(row.recommendedRecordIds,[]);
 }
 const row=findImportMatches({records:[headed('geometry',90)],references:[reference()]}).rows[0];assert.equal(row.bulkSafe,true);assert.deepEqual(row.recommendedRecordIds,['geometry']);
});
test('circular bearing tolerance includes north wrap and does not reserve contradicted candidates against another source row',()=>{
 const records=[headed('north',0),headed('south',180)],references=[roadReference(road([359])),roadReference(road([180]),{id:'import:second',sourceId:'second'})];
 const rows=findImportMatches({records,references}).rows;assert.deepEqual(rows.map(r=>r.status),['unique','unique']);assert.deepEqual(rows.map(r=>r.recommendedRecordIds),[['north'],['south']]);assert.equal(rows[0].candidates[0].directionComparison.deltaDegrees,1);
});
test('bound associations remain retained and opposite candidates never silently remove them',()=>{
 const row=findImportMatches({records:[headed('bound',270),headed('new',90)],references:[roadReference(road([90]),{recordIds:['bound']})]}).rows[0];
 assert.equal(row.status,'bound');assert.deepEqual(row.boundRecordIds,['bound']);assert.equal(row.candidates.length,2);assert.equal(row.bulkSafe,false);assert.deepEqual(row.recommendedRecordIds,[]);
});

test('OPP road evidence uses the964entry heading and independently resolved endpoint orientation',()=>{
 const records=[record('start',21,964,{linkTargetId:'finish',rawBytes16To19:[50,45,0,1]}),record('finish',21.1,9128,{rawBytes16To19:[50,135,0,1]}),
  record('reverse-start',21.1,964,{linkTargetId:'reverse-finish',rawBytes16To19:[50,135,0,1]}),record('reverse-finish',21,9128,{rawBytes16To19:[50,45,0,1]})];
 const metadata=road([90],[],{confidence:'medium',claims:[{raw:'East',destination:'East',excluded:false,status:'resolved',bearings:[90],evidence:{method:'graph-route',wayIds:['way'],placeId:'city',snapMetres:0,routeMetres:1000,endpointOrientation:'forward',entryEndpointIndex:0,exitEndpointIndex:1,endpointBearings:[90,90]}}]});
 const reference=section({namespace:'pl.gitd.canard.public-map',originalProperties:{canardRoadDirection:metadata}});metadata.inputKey=roadDirectionInputKey(reference);const row=findImportMatches({records,references:[reference]}).rows[0];
 assert.equal(row.candidates.length,2);assert.deepEqual(row.recommendedRecordIds,['start','finish']);assert.equal(row.candidates[0].directionComparison.status,'agree');assert.equal(row.candidates[0].directionComparison.mioBearingDegrees,90);
 assert.equal(row.candidates[1].directionComparison.status,'opposite');assert.equal(row.candidates[1].directionComparison.reason,'section-entry-opposite');
 metadata.claims[0].evidence={method:'graph-route',wayIds:['way'],placeId:'city',snapMetres:0,routeMetres:1000,endpointOrientation:'reverse',entryEndpointIndex:1,exitEndpointIndex:0,endpointBearings:[270,270]};metadata.claims[0].bearings=[270];metadata.travelBearings=[270];
 const reversed=findImportMatches({records,references:[reference]}).rows[0];assert.deepEqual(reversed.recommendedRecordIds,['reverse-start','reverse-finish']);assert.equal(reversed.candidates[0].directionComparison.mioBearingDegrees,270);
});
test('unresolved, incomplete or malformed independent road evidence never supplies bulk defaults',()=>{
 for(const metadata of [road([90],[],{status:'ambiguous',confidence:'none'}),road([90],[],{status:'unresolved'}),road([NaN]),road([90],[],{source:{complete:false}}),road([90],[],{schemaVersion:999})]){
  const row=findImportMatches({records:[headed('candidate',90)],references:[roadReference(metadata)]}).rows[0];assert.equal(row.candidates[0].directionComparison.status,'unknown');assert.equal(row.bulkSafe,false);assert.deepEqual(row.recommendedRecordIds,[]);
 }
});

test('stale input fingerprints cannot rank candidates after source geometry or labels change',()=>{
 const ref=roadReference(),before=structuredClone(ref);ref.geometry.coordinates[0]+=.0001;
 const row=findImportMatches({records:[headed('candidate',90)],references:[ref]}).rows[0];assert.equal(row.directionComparison,undefined);assert.equal(row.candidates[0].directionComparison.status,'unknown');assert.equal(row.candidates[0].directionComparison.reason,'invalid-road-evidence');assert.equal(row.bulkSafe,false);
 assert.equal(before.originalProperties.canardRoadDirection.inputKey,ref.originalProperties.canardRoadDirection.inputKey);
});

test('60-degree tolerance is inclusive and multiple agreeing records remain ambiguous',()=>{
 const row=findImportMatches({records:[headed('edge',60),headed('outside',62)],references:[roadReference(road([0]))]}).rows[0];
 assert.deepEqual(row.recommendedRecordIds,['edge']);assert.equal(row.candidates[0].directionComparison.deltaDegrees,60);assert.equal(row.candidates[1].directionComparison.status,'opposite');
 const multiple=findImportMatches({records:[headed('first',0),headed('second',30)],references:[roadReference(road([0]))]}).rows[0];assert.equal(multiple.status,'ambiguous');assert.equal(multiple.bulkSafe,false);assert.deepEqual(multiple.recommendedRecordIds,[]);
});

test('an exclusion alone never invents the permitted opposite travel direction',()=>{
 const row=findImportMatches({records:[headed('not-excluded',90)],references:[roadReference(road([],[270]))]}).rows[0];
 assert.equal(row.candidates[0].directionComparison.status,'unknown');assert.equal(row.candidates[0].directionComparison.reason,'no-allowed-road-bearing');assert.equal(row.bulkSafe,false);assert.deepEqual(row.recommendedRecordIds,[]);
});
test('qualified Mio heading stays visible even without independent road direction evidence',()=>{
 const result=findImportMatches({records:[record('mio',21,1,{rawBytes16To19:[50,50,0,1]})],references:[reference()]});
 assert.equal(result.rows[0].candidates[0].directionComparison.mioBearingDegrees,100);assert.equal(result.rows[0].candidates[0].directionComparison.status,'unknown');
});
