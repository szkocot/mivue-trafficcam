import test from 'node:test';
import assert from 'node:assert/strict';
import lz from 'lz-string';
import {decodeBase64Bounded} from '../src/canard-decode.js';
import {decodeCanardPage,normalizeCanardLayers} from '../src/canard-adapter.js';
import {makeCanardLayers,makeCanardHtml,review,retrievedAt} from './helpers/canard-fixture.js';
const normalize=layers=>normalizeCanardLayers(layers,{review,retrievedAt});

test('three categories keep qualified IDs, unknown metadata and unavailable PK',()=>{
 const layers=decodeCanardPage(makeCanardHtml(),{review});
 assert.equal(layers.PK,null);
 const batch=normalize(layers);
 assert.deepEqual(batch.observations.map(o=>o.sourceId),['["PP","1"]','["OPP","1"]','["RL","1"]']);
 assert.deepEqual(batch.observations.map(o=>o.kind),['camera','section','red-light']);
 assert.ok(batch.observations.every(o=>o.status==='unknown'&&o.speedKmh===null&&o.direction===null&&o.name===null));
 assert.deepEqual(batch.observations[1].geometry,{type:'LineString',coordinates:[[21,52],[21.1,52.1]]});
 assert.equal(batch.observations[1].originalProperties.geometryBasis,'endpoints-not-road-route');
});

test('known unavailable PK is not accepted as an empty or newly populated array',()=>{
 for(const value of [[],[{}],[{id:1,lat:52,lon:21}]]){
  const layers=makeCanardLayers();layers.PK=value;
  assert.throws(()=>decodeCanardPage(makeCanardHtml(layers),{review}),{code:'CANARD_SCHEMA_CHANGED'});
 }
});

test('absent and duplicate layer assignments reject, explicit usable empty layer survives',()=>{
 const layers=makeCanardLayers();delete layers.RL;
 assert.throws(()=>decodeCanardPage(makeCanardHtml(layers),{review}));
 assert.throws(()=>decodeCanardPage(makeCanardHtml()+makeCanardHtml(),{review}));
 const empty=makeCanardLayers();empty.PP=[];
 assert.deepEqual(decodeCanardPage(makeCanardHtml(empty),{review}).PP,[]);
});

test('only literal compressed data is read; expressions never execute',()=>{
 const html=makeCanardHtml().replace(/fotoradaryPP:"[^"]+"/,'fotoradaryPP: (()=>{throw Error("executed")})()');
 assert.throws(()=>decodeCanardPage(html,{review}),{code:'CANARD_SCHEMA_CHANGED'});
});

for(const [name,mutate] of [
 ['new field',r=>{r.speed=50;}],['nested unknown field',r=>{r.extra={private:true};}],
 ['string ID not reviewed',r=>{r.id='1';}],['unsafe ID',r=>{r.id=Number.MAX_SAFE_INTEGER+1;}],
 ['bad coordinate',r=>{r.lon=181;}],['missing field',r=>{delete r.lat;}],
 ['wrong category',r=>{r.rodzajPomiaru='PO';}],['malformed Unicode',r=>{r.nrSeryjny='\ud800';}]
])test(`rejects ${name}`,()=>{const layers=makeCanardLayers();mutate(layers.PP[0]);assert.throws(()=>normalize(layers));});

test('duplicate identity rejects the whole batch',()=>{
 const layers=makeCanardLayers();layers.PP.push({...layers.PP[0]});assert.throws(()=>normalize(layers));
});
test('missing or coincident OPP endpoints reject rather than imply route geometry',()=>{
 for(const mutate of [r=>{r.lok2PktDlugosc=null;},r=>{r.lok2PktDlugosc=21;r.lok2PktSzerokosc=52;}]){
  const layers=makeCanardLayers();mutate(layers.OPP[0]);assert.throws(()=>normalize(layers));
 }
});
test('original serial text is retained without using it as a location name',()=>{
 const layers=makeCanardLayers();layers.PP[0].nrSeryjny='<img src=x onerror=alert(1)>';
 const o=normalize(layers).observations[0];assert.equal(o.originalProperties.nrSeryjny,layers.PP[0].nrSeryjny);assert.equal(o.name,null);
});

test('bounded decoder agrees with hand-authored Unicode and repetitive content',()=>{
 for(const text of ['', '[]','Zażółć gęślą jaźń 🚗','abc'.repeat(2000),JSON.stringify(makeCanardLayers())]){
  assert.equal(decodeBase64Bounded(lz.compressToBase64(text),20000),text);
 }
});
test('decoder rejects malformed/truncated streams and expansion beyond budget',()=>{
 for(const text of ['[{}]','%%%%','AAA=','',lz.compressToBase64('abc'.repeat(100)).slice(0,4)])assert.throws(()=>decodeBase64Bounded(text,1000));
 assert.throws(()=>decodeBase64Bounded(lz.compressToBase64('a'.repeat(100000)),1000),{code:'CANARD_DECODE_LIMIT'});
 assert.throws(()=>decodeBase64Bounded(lz.compressToBase64('ą'.repeat(600)),1000),{code:'CANARD_DECODE_LIMIT'});
});
