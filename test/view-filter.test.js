import test from 'node:test';
import assert from 'node:assert/strict';
import { filterView,pageRecords,aggregatePoints } from '../src/view-filter.js';
const records=[
 {id:'a',latitude:52,longitude:179,deleted:false,changed:true,typeRaw:1,provenance:['CANARD'],diagnostics:[]},
 {id:'b',latitude:52,longitude:-179,deleted:false,changed:false,typeRaw:3,provenance:[],diagnostics:[{code:'X'}]},
 {id:'c',latitude:null,longitude:null,deleted:false,changed:false,typeRaw:1,provenance:[],diagnostics:[]},
 {id:'d',latitude:52,longitude:20,deleted:true,changed:true,typeRaw:1,provenance:[],diagnostics:[]}];
test('filters preserve identities and handle wrapped viewport, warnings and deletion',()=>{
 assert.deepEqual(filterView({records},{}).map(r=>r.id),['a','b','c']);
 assert.deepEqual(filterView({records},{viewport:{south:52,north:53,west:170,east:-170}}).map(r=>r.id),['a','b']);
 assert.deepEqual(filterView({records},{query:'canard',changedOnly:true,typeRaw:1}).map(r=>r.id),['a']);
 assert.deepEqual(filterView({records},{warningsOnly:true}).map(r=>r.id),['b']);
 assert.equal(filterView({records},{showDeleted:true}).length,4);
});
test('pagination bounds DOM-sized results and aggregates preserve coincident IDs',()=>{
 const many=Array.from({length:101},(_,id)=>({id}));
 assert.equal(pageRecords(many,1).records.length,100);
 assert.deepEqual(pageRecords(many,99).records,[{id:100}]);
 assert.equal(pageRecords([],1).page,1);
 assert.deepEqual(aggregatePoints([{id:'a',x:10,y:10},{id:'b',x:10,y:10}]),[{x:10,y:10,ids:['a','b']}]);
});
