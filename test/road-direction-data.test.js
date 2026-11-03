import test from 'node:test';import assert from 'node:assert/strict';
import {getRoadDirection,applyRoadDirectionData} from '../src/road-direction-data.js';
import {createRoadResolver,roadDirectionInputKey} from '../src/road-directions.js';
import {CANARD_NAMESPACE} from '../src/canard-snapshot.js';
const source={url:'https://download.geofabrik.de/europe/poland.osm.pbf',dataTimestamp:'2026-11-01T00:00:00Z',sha256:'a'.repeat(64),attribution:'© OpenStreetMap contributors',licenceUrl:'https://opendatacommons.org/licenses/odbl/1-0/',complete:true};
const o={sourceId:'p',kind:'camera',status:'unknown',geometry:{type:'Point',coordinates:[19,52]},speedKmh:null,originalSpeed:null,direction:null,originalProperties:{canardDetail:{raw:{limity:[{limitOsobowe:'50',typ:{kierunek:'Warszawa'}}],urzadzenie:{lokalizacjaNrDrogi:'94'}}}}};
const resolution=()=>createRoadResolver({schemaVersion:1,source,ways:[{id:'w',nodeIds:[1,2],coordinates:[[18.99,52],[19.01,52]],tags:{highway:'primary',ref:'94','destination:forward':'Warszawa'}}],places:[]}).resolve(o);
const withRoad=r=>({...o,originalProperties:{...o.originalProperties,canardRoadDirection:r}});
const data=r=>({schema:'mivue-canard-road-directions',version:1,source,resolutions:{p:r}});
const batch=()=>({source:{namespace:CANARD_NAMESPACE,attribution:'Synthetic'},retrievedAt:'2026-11-01T00:00:00Z',observations:[o]});
test('road annotations require current source identity/geometry and a distinct travel estimate',()=>{
 const r=resolution(),ref=withRoad(r);assert.equal(getRoadDirection(ref),r);assert.equal(getRoadDirection({...ref,geometry:{type:'Point',coordinates:[20,52]}}),null);
 for(const change of [{travelBearings:[NaN]},{travelBearings:[360]},{physicalAim:90},{confidence:'absolute'},{claims:[{raw:'x',destination:'x',excluded:false,status:'resolved',bearings:[90],evidence:{endpointBearings:[90]}}]}])assert.equal(getRoadDirection(withRoad({...r,...change})),null);
});
test('prepared road estimates preserve fields; absent/stale rows become explicit unknowns',()=>{
 const input=batch(),before=structuredClone(input),result=applyRoadDirectionData(input,data(resolution()));assert.equal(result.observations[0].originalProperties.canardRoadDirection.status,'resolved');assert.equal(result.observations[0].direction,null);assert.deepEqual(input,before);
 const stale=applyRoadDirectionData({...input,observations:[{...o,geometry:{type:'Point',coordinates:[20,52]}}]},data(resolution()));assert.equal(stale.observations[0].originalProperties.canardRoadDirection.reason,'stale-road-context');
 assert.equal(applyRoadDirectionData(input,{...data(null),resolutions:{}}).observations[0].originalProperties.canardRoadDirection.reason,'missing-road-context');
});
test('explicit foreign namespaces and candidate provenance different from the dataset cannot claim reviewed evidence',()=>{
 assert.equal(getRoadDirection({...withRoad(resolution()),namespace:'untrusted.local'}),null);
 assert.throws(()=>applyRoadDirectionData({...batch(),source:{namespace:'untrusted.local',attribution:'Local'}},data(resolution())));
 const r=resolution();r.source={...r.source,sha256:'b'.repeat(64)};
 assert.equal(applyRoadDirectionData(batch(),data(r)).observations[0].originalProperties.canardRoadDirection.status,'unresolved');
});
test('malformed, cyclic, oversized and contradictory claim evidence fails closed without throwing',()=>{
 const corrupt=[r=>r.claims[0].evidence=null,r=>r.claims[0].evidence.wayIds=[],r=>r.claims[0].evidence.snapMetres=-1,r=>r.claims[0].evidence.method='city-beeline',r=>r.claims[0].evidence.endpointOrientation='reverse',r=>r.travelBearings=[180],r=>r.claims[0].excluded=true,r=>r.claims[0].raw='x'.repeat(70000),r=>r.claims[0].evidence.cycle=r,r=>r.inputKey=1n];
 for(const mutate of corrupt){const r=resolution();mutate(r);assert.equal(getRoadDirection(withRoad(r)),null);}
 assert.equal(getRoadDirection(null),null);
 const bad={...o,geometry:{type:'LineString',coordinates:[1n]}};assert.doesNotThrow(()=>getRoadDirection({...bad,originalProperties:{canardRoadDirection:resolution()}}));
});
test('OPP evidence requires coherent orientation, both endpoint bearings and matching first-point bearing',()=>{
 const ref={...o,geometry:{type:'LineString',coordinates:[[19,52],[19,52.02]]}};
 const r={schemaVersion:1,inputKey:roadDirectionInputKey(ref),status:'resolved',confidence:'medium',travelBearings:[0],excludedBearings:[],source,physicalAim:null,claims:[{raw:'Warszawa',destination:'warszawa',excluded:false,status:'resolved',bearings:[0],reason:null,evidence:{method:'graph-route',wayIds:['w'],placeId:'city',snapMetres:0,routeMetres:1000,endpointOrientation:'forward',entryEndpointIndex:0,exitEndpointIndex:1,endpointBearings:[0,90]}}]};
 const wrap=r=>({...ref,originalProperties:{...ref.originalProperties,canardRoadDirection:r}});assert.equal(getRoadDirection(wrap(r)),r);
 for(const change of [{entryEndpointIndex:1},{exitEndpointIndex:0},{endpointBearings:[90,90]},{endpointBearings:[0]},{placeId:null}]){const c=structuredClone(r);Object.assign(c.claims[0].evidence,change);assert.equal(getRoadDirection(wrap(c)),null);}
});
