import test from 'node:test';import assert from 'node:assert/strict';
import {selectCountries} from '../src/country-selection.js';
import {selectionFixture} from './helpers/country-fixture.js';
const options=(countryIds=['BB'],extra={})=>({countryIds,decisions:{},componentDecisions:{},acknowledgeExtras:false,...extra});
test('target-country inclusion preserves sources and requires extras acknowledgement',()=>{
 for(const reverse of [false,true]){const f=selectionFixture();if(reverse)f.view.records.reverse();
 const p=selectCountries({...f,options:options()});assert.deepEqual(p.records.keptIds,['a','b']);assert.deepEqual(p.records.excludedIds,['c']);assert.equal(p.linkedExtras[0].id,'a');assert.equal(p.ready,false);
 assert.equal(selectCountries({...f,options:options(['BB'],{acknowledgeExtras:true})}).ready,true);}
});
test('many-to-one links close transitively, but deleted or wrong-type targets are not restored',()=>{
 const f=selectionFixture();f.view.records[2]={...f.view.records[2],typeRaw:964,linkTargetId:'b',originalLinkRaw:100};
 assert.deepEqual(selectCountries({...f,options:options()}).records.keptIds,['a','b','c']);
 f.view.records[1].deleted=true;const p=selectCountries({...f,options:options(['AA'])});assert.deepEqual(p.records.keptIds,['a','c']);assert.ok(p.diagnostics.some(d=>d.code==='LINK_TARGET_DELETED'));
 f.view.records[1].deleted=false;f.view.records[1].typeRaw=1;assert.deepEqual(selectCountries({...f,options:options()}).records.keptIds,['b']);
 f.view.records.pop();f.view.records[0].linkTargetId='missing';assert.ok(selectCountries({...f,options:options(['AA'])}).diagnostics.some(d=>d.code==='LINK_TARGET_MISSING'));
});
test('uncertain decisions cannot cut a retained component and whole-component decisions are explicit',()=>{
 const f=selectionFixture();f.classifications.set('a',{status:'border',countryIds:['AA','BB']});
 let p=selectCountries({...f,options:options(['AA'])});assert.deepEqual(p.records.unresolvedIds,['a','b']);assert.equal(p.ready,false);
 p=selectCountries({...f,options:options(['BB'],{decisions:{a:'exclude'}})});assert.deepEqual(p.records.unresolvedIds,['a','b']);
 p=selectCountries({...f,options:options(['BB'],{componentDecisions:{a:'exclude'}})});assert.deepEqual(p.records.excludedIds,['a','b','c']);assert.equal(p.ready,true);
 p=selectCountries({...f,options:options(['AA'],{decisions:{a:'keep'},acknowledgeExtras:true})});assert.deepEqual(p.records.keptIds,['a','b','c']);
});
test('invalid options fail closed without changing input',()=>{
 const f=selectionFixture(),before=structuredClone(f);
 for(const opt of [options([]),options(['ZZ']),options(['AA','AA']),options(['AA'],{decisions:{missing:'keep'}}),options(['AA'],{decisions:{a:'exclude'}}),options(['AA'],{componentDecisions:{c:'exclude'}}),options(['AA'],{acknowledgeExtras:'yes'}),{...options(),extra:true}])assert.throws(()=>selectCountries({...f,options:opt}));
 selectCountries({...f,options:options()});assert.deepEqual(f,before);
});
test('explicitly keeping an independent unknown point is already its review decision',()=>{
 const f=selectionFixture();f.classifications.set('c',{status:'unassigned',countryIds:[]});
 const p=selectCountries({...f,options:options(['AA'],{componentDecisions:{a:'exclude'},decisions:{c:'keep'}})});
 assert.deepEqual(p.records.keptIds,['c']);assert.equal(p.ready,true);assert.deepEqual(p.linkedExtras,[]);
});
test('sections remain whole and deleted/excluded bindings never become free references',()=>{
 const f=selectionFixture();f.references=[{id:'section',recordId:null,geometry:{type:'LineString',coordinates:[[0,0],[5,5],[10,10]]}},{id:'crossing',recordId:null,geometry:{type:'LineString',coordinates:[[0,0],[5,5],[10,10]]}},{id:'bound',recordId:'c',geometry:{type:'Point',coordinates:[1,1]}},{id:'gone',recordId:'deleted',geometry:{type:'Point',coordinates:[1,1]}}];
 for(const [id,country]of [['section:start','AA'],['section:end','BB'],['crossing:start','AA'],['crossing:end','AA'],['bound','BB'],['gone','BB']])f.classifications.set(id,{status:'assigned',countryIds:[country]});
 const before=structuredClone(f),p=selectCountries({...f,options:options(['BB'],{acknowledgeExtras:true})});assert.deepEqual(p.references.keptIds,['section']);assert.deepEqual(p.references.excludedIds,['bound','crossing','gone']);assert.deepEqual(f,before);
 f.classifications.set('section:start',{status:'invalid',countryIds:[]});assert.equal(selectCountries({...f,options:options()}).ready,false);
 assert.equal(selectCountries({...f,options:options(['BB'],{acknowledgeExtras:true})}).ready,true);
});
