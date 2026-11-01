import test from 'node:test';
import assert from 'node:assert/strict';
import LZ from 'lz-string';
import {decodeCanardDetail,enrichCanardBatch} from '../src/canard-details.js';
import {makeCanardDetail,detailRow} from './helpers/canard-detail-fixture.js';
import {normalizeCanardLayers} from '../src/canard-adapter.js';
import {makeCanardLayers,review,retrievedAt} from './helpers/canard-fixture.js';
const id=(category='PP')=>JSON.stringify([category,'1']);
const entry=raw=>({raw,retrievedAt,sourceUrl:'https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen',responseSha256:'a'.repeat(64)});
for(const category of ['PP','OPP','RL'])test(`bounded UTF16 decoder validates ${category} full detail identity`,()=>{
 const raw=makeCanardDetail(category,1,[detailRow('50')]);
 assert.deepEqual(decodeCanardDetail(LZ.compressToUTF16(JSON.stringify(raw))+'\r\n',{category,sourceId:id(category)}),raw);
 for(const change of [{id:2},{urzadzenie:{...raw.urzadzenie,id:2}},{urzadzenie:{...raw.urzadzenie,rodzajPomiaru:'wrong'}},{rodzaj:'PUNKT_KONTROLNY'},{limity:{}}])assert.throws(()=>decodeCanardDetail(LZ.compressToUTF16(JSON.stringify({...raw,...change})),{category,sourceId:id(category)}));
});
test('passenger minimum spans all times and directions, excludes trucks and preserves full raw conditions',()=>{
 const batch=normalizeCanardLayers(makeCanardLayers(),{review,retrievedAt});
 const raw=makeCanardDetail('PP',1,[detailRow('90','10',{godziny:'06:00-18:00',kierunek:'A'}),detailRow('50','5',{godziny:'18:00-06:00',kierunek:'B'}),detailRow('0'),detailRow('signals'),detailRow(null)]);
 const out=enrichCanardBatch(batch,{[id()]:entry(raw)}),o=out.observations.find(o=>o.sourceId===id());
 assert.equal(o.speedKmh,50);assert.deepEqual(o.originalSpeed,{value:50,unit:'km/h'});assert.deepEqual(o.originalProperties.canardDetail.raw,raw);
 assert.equal(o.originalProperties.canardDetail.selectionPolicy,'minimum-passenger-car-any-time-any-direction');
 assert.equal(o.originalProperties.canardDetail.unitPolicy,'km/h-assumed-by-user-policy');assert.deepEqual(o.originalProperties.canardDetail.selectedRows,[1]);
 assert.equal(batch.observations.find(o=>o.sourceId===id()).speedKmh,null);assert.deepEqual(out.observations.map(o=>o.geometry),batch.observations.map(o=>o.geometry));
 assert.equal(o.status,'unknown');assert.equal(o.direction,null);
});
test('empty/nonpositive/symbolic passenger limits stay unknown and mismatched details fail',()=>{
 const batch=normalizeCanardLayers(makeCanardLayers(),{review,retrievedAt});
 for(const limits of [[],[detailRow('0'),detailRow('-50'),detailRow('50/70'),detailRow('signals'),detailRow('Infinity')]]){
  const out=enrichCanardBatch(batch,new Map([[id(),entry(makeCanardDetail('PP',1,limits))]]));assert.equal(out.observations.find(o=>o.sourceId===id()).speedKmh,null);
 }
 assert.throws(()=>enrichCanardBatch(batch,{[id()]:entry(makeCanardDetail('PP',2))}));
 assert.throws(()=>enrichCanardBatch(batch,{'["PP","999"]':entry(makeCanardDetail('PP',999))}));
});
test('compressed invalid/truncated/bomb details fail within bounds',()=>{
 for(const text of ['', 'garbage', '\u0000 ',LZ.compressToUTF16('null'),LZ.compressToUTF16('x'.repeat(70000))])assert.throws(()=>decodeCanardDetail(text,{category:'PP',sourceId:id()}));
 const valid=LZ.compressToUTF16(JSON.stringify(makeCanardDetail()));assert.throws(()=>decodeCanardDetail(valid.slice(0,Math.floor(valid.length/2)),{category:'PP',sourceId:id()}));
});
test('passenger selection retains tied rows and rejects untrusted provenance without changing input',()=>{
 const batch=normalizeCanardLayers(makeCanardLayers(),{review,retrievedAt}),raw=makeCanardDetail('PP',1,[detailRow(' 60 '),detailRow('60.0'),detailRow('90')]);
 const out=enrichCanardBatch(batch,{[id()]:entry(raw)}),o=out.observations.find(o=>o.sourceId===id());
 assert.equal(o.speedKmh,60);assert.deepEqual(o.originalProperties.canardDetail.selectedRows,[0,1]);
 for(const change of [{sourceUrl:'https://untrusted.example/'},{responseSha256:'bad'},{retrievedAt:'yesterday'}])assert.throws(()=>enrichCanardBatch(batch,{[id()]:{...entry(raw),...change}}));
 assert.equal(batch.observations.find(o=>o.sourceId===id()).originalProperties.canardDetail,undefined);
});
test('enriched detail metadata and passenger limit survive repeat import and project/reference exports',async()=>{
 const {createProject,loadProject,serializeProject}=await import('../src/project.js');const {reconcile}=await import('../src/reconcile.js');const {exportReferences}=await import('../src/import-view.js');const {makeFixture}=await import('./helpers/fixture.js');
 const batch=enrichCanardBatch(normalizeCanardLayers(makeCanardLayers(),{review,retrievedAt}),{[id()]:entry(makeCanardDetail('PP',1,[detailRow('90'),detailRow('50')]))});
 const project=(await reconcile(await createProject(makeFixture([{}]).bytes),batch)).project,saved=await serializeProject(project),loaded=await loadProject(saved);
 assert.equal(await serializeProject((await reconcile(loaded,batch)).project),saved);
 const feature=JSON.parse(exportReferences(loaded)).features.find(f=>f.properties.sourceId===id());assert.equal(feature.properties.speedKmh,50);assert.deepEqual(feature.properties.originalProperties,batch.observations.find(o=>o.sourceId===id()).originalProperties);
});
