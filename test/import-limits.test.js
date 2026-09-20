import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from '../src/import-csv.js';
test('100,000 synthetic observations are accepted and one extra rejects the entire batch',()=>{
 const text='id,latitude,longitude,kind\n'+Array.from({length:100000},(_,i)=>`${i},52,19,camera`).join('\n');
 const source={namespace:'limit-test',attribution:'Synthetic',url:null},time='2026-09-20T00:00:00Z';
 const result=parseCsv(text,source,time);assert.equal(result.observations.length,100000);assert.equal(result.observations.at(-1).sourceId,'99999');
 assert.throws(()=>parseCsv(text+'\n100000,52,19,camera',source,time),{code:'INVALID_IMPORT'});
});
