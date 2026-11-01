import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceDirectionLabel,sourceChainageLabel} from '../src/source-direction.js';
const t=key=>({valueUnknown:'Unknown',roadChainage:'Road chainage direction'}[key]??key);
const reference=raw=>({direction:null,originalProperties:{canardDetail:{raw}}});
test('named CANARD direction rows and device directions are deduplicated without guessing bearings',()=>{
 const r=reference({limity:[{typ:{kierunek:'Warszawa'}},{typ:{kierunek:'Katowice'}},{typ:{kierunek:'Warszawa'}}],urzadzenie:{nazwaKierunku1:'Warszawa',nazwaKierunku2:'Katowice',masztKierunekPomiaru:'Pikietaz rosnacy'}});
 assert.equal(sourceDirectionLabel(r,t),'Warszawa / Katowice');assert.equal(r.direction,null);assert.equal(sourceChainageLabel(r),'Pikietaz rosnacy');
});
test('OPP device direction names remain useful when all per-row kierunek strings are empty',()=>{
 const r=reference({limity:[{typ:{kierunek:'',kierunekPikietazu:'ROSNACY'}}],urzadzenie:{nazwaKierunku1:'Lublin → Warszawa',nazwaKierunku2:'Warszawa → Lublin'}});
 assert.equal(sourceDirectionLabel(r,t),'Lublin → Warszawa / Warszawa → Lublin');assert.equal(sourceChainageLabel(r),'ROSNACY');
});
test('road chainage is explicitly labelled and never converted to compass bearing',()=>{
 const r=reference({limity:[{typ:{kierunek:' ',kierunekPikietazu:'ROSNACY'}},{typ:{kierunekPikietazu:'ROSNACY'}}],urzadzenie:{masztKierunekPomiaru:'Pikietaz rosnacy'}});
 assert.equal(sourceDirectionLabel(r,t),'Road chainage direction: Pikietaz rosnacy / ROSNACY');assert.equal(r.direction,null);
 assert.equal(sourceDirectionLabel({direction:90},t),'90°');assert.equal(sourceDirectionLabel({},t),'Unknown');
});
test('source strings remain plain text and display is bounded while source metadata stays intact',()=>{
 const raw={limity:[{typ:{kierunek:'<img src=x onerror=alert(1)>'}}],urzadzenie:{nazwaKierunku1:'<b>East</b>'}},r=reference(raw);
 assert.equal(sourceDirectionLabel(r,t),'<img src=x onerror=alert(1)> / <b>East</b>');
 const many=reference({limity:Array.from({length:100},(_,i)=>({typ:{kierunek:`Direction ${i} ${'x'.repeat(100)}`}}))});
 assert.ok(sourceDirectionLabel(many,t).length<=241);assert.equal(many.originalProperties.canardDetail.raw.limity.length,100);
 assert.equal(sourceDirectionLabel({...r,direction:90},t),'90° · <img src=x onerror=alert(1)> / <b>East</b>');
});
