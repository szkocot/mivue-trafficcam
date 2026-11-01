import test from 'node:test';
import assert from 'node:assert/strict';
import {findImportMatches} from '../src/import-matches.js';
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
