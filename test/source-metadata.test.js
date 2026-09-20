import test from 'node:test';
import assert from 'node:assert/strict';
import {createI18n} from '../web/i18n.js';
const m=await import('../src/source-metadata.js').catch(()=>({}));
test('speed labels preserve unknown, attributed values and conflicts without raw-byte guesses',()=>{
 assert.equal(typeof m.speedLabel,'function');const t=createI18n({languages:['en']}).t;
 assert.match(m.speedLabel([],t),/unknown/i);
 assert.equal(m.speedLabel([{speedKmh:80.4672,attribution:'Owner'}],t),'80.47 km/h · Owner');
 assert.match(m.speedLabel([{speedKmh:50,attribution:'A'},{speedKmh:70,attribution:'B'}],t),/conflict/i);
 const rows=m.metadataRows({sourceId:'x',name:'<img>',speedKmh:80.4672,originalSpeed:{value:50,unit:'mph'},kind:'camera',status:'unknown',direction:null,attribution:'Owner',namespace:'example',encodingStatus:'reference',retrievedAt:'2026-09-20',originalProperties:{x:1}},t);
 assert.ok(rows.some(([,value])=>value==='50 mph'));assert.ok(rows.some(([,value])=>value==='<img>'));
 assert.equal(m.safeSourceUrl('javascript:alert(1)'),null);assert.equal(m.safeSourceUrl('https://example.com'),'https://example.com/');
});
test('point label placement suppresses collisions and bounds every frame to 200 labels',()=>{
 assert.equal(typeof m.placeLabels,'function');
 const items=Array.from({length:1000},(_,i)=>({x:i*100,y:0,text:'50',id:String(i)}));
 assert.equal(m.placeLabels(items,()=>20).length,200);
 assert.equal(m.placeLabels([{x:0,y:0,text:'a'},{x:0,y:0,text:'b'}],()=>30).length,1);
});
