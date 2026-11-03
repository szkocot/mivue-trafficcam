import test from 'node:test';import assert from 'node:assert/strict';
import {createRoadResolver} from '../src/road-directions.js';
import {applyRoadDirectionData,getRoadDirection,ROAD_DIRECTION_NOTICE} from '../src/road-direction-data.js';
import {createProject,serializeProject,loadProject,applyEdit} from '../src/project.js';
import {reconcile,resolveImport} from '../src/reconcile.js';
import {projectNotices} from '../src/source-notices.js';
import {referenceView,exportReferences} from '../src/import-view.js';
import {projectView} from '../src/project-view.js';
import {buildProject} from '../src/encoder.js';
import {makeFixture} from './helpers/fixture.js';
import {makeImportBatch} from './helpers/import-fixture.js';
import {review} from './helpers/canard-fixture.js';
import {CANARD_NAMESPACE} from '../src/canard-snapshot.js';
const source={url:'https://download.geofabrik.de/europe/poland.osm.pbf',dataTimestamp:'2026-11-02T00:00:00Z',sha256:'a'.repeat(64),attribution:'© OpenStreetMap contributors',licenceUrl:'https://opendatacommons.org/licenses/odbl/1-0/',complete:true};
async function setup(){
 const b=makeImportBatch();b.source.namespace=CANARD_NAMESPACE;b.observations[0]={...b.observations[0],sourceId:'["OPP","1"]',kind:'section',geometry:{type:'LineString',coordinates:[[-7,37],[-6.99,37]]},originalProperties:{canardDetail:{raw:{limity:[{limitOsobowe:'50',typ:{kierunek:'Warszawa'}}],urzadzenie:{lokalizacjaNrDrogi:'94'}}}}};
 const resolver=createRoadResolver({schemaVersion:1,source,ways:[{id:'w',nodeIds:[1,2],coordinates:[[-7.01,37],[-6.98,37]],tags:{highway:'primary',ref:'94','destination:forward':'Warszawa'}}],places:[]});
 const annotation=resolver.resolve(b.observations[0]);assert.equal(annotation.status,'resolved');
 const enriched=applyRoadDirectionData(b,{schema:'mivue-canard-road-directions',version:1,source,resolutions:{'["OPP","1"]':annotation}});
 const {bytes}=makeFixture([{typeRaw:964,linkTo:1},{typeRaw:9128}]);let p=(await reconcile(await createProject(bytes),enriched)).project;
 p.ingestion.sources[0].notices=structuredClone(review.notices);
 p=await resolveImport(p,{namespace:CANARD_NAMESPACE,sourceId:'["OPP","1"]',action:'bind',recordIds:p.records.map(r=>r.id)});
 return {p,bytes,annotation};
}
test('road annotations, ODbL notices and every endpoint preserve across repeated project/reference exports and exact BIN builds',async()=>{
 const {p,bytes,annotation}=await setup();let current=p;
 for(let i=0;i<2;i++){
  current=await loadProject(await serializeProject(current));const ref=referenceView(current)[0];
  assert.deepEqual(getRoadDirection(ref),annotation);assert.deepEqual(JSON.parse(exportReferences(current)).features[0].properties.originalProperties.canardRoadDirection,annotation);
  assert.ok(JSON.parse(exportReferences(current)).sourceNotices.some(n=>n.licenceUrl===ROAD_DIRECTION_NOTICE.licenceUrl));
  assert.ok((await projectView(current)).records.every(r=>r.sourceObservations[0].originalProperties.canardRoadDirection.inputKey===annotation.inputKey));
  assert.deepEqual(Buffer.from((await buildProject(current)).bytes),Buffer.from(bytes));
 }
 assert.deepEqual(current,p);
});
test('road attribution follows any actually active bound record; missing IDs and all-deleted bindings do not qualify',async()=>{
 const {p}=await setup(),ids=p.records.map(r=>r.id);const firstDeleted=applyEdit(p,{kind:'delete',id:ids[0]});
 assert.ok(projectNotices(firstDeleted,{encodedOnly:true}).some(n=>n.licenceUrl===ROAD_DIRECTION_NOTICE.licenceUrl));
 const allDeleted=applyEdit(firstDeleted,{kind:'delete',id:ids[1]});assert.equal(projectNotices(allDeleted,{encodedOnly:true}).length,0);
 const stale=structuredClone(allDeleted);stale.ingestion.bindings[0].recordIds=['missing'];stale.ingestion.bindings[0].recordId='missing';
 assert.equal(projectNotices(stale,{encodedOnly:true}).length,0);
 assert.ok(projectNotices(allDeleted).some(n=>n.licenceUrl===ROAD_DIRECTION_NOTICE.licenceUrl));
});
