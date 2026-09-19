import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutosave } from '../web/autosave.js';
import { openStorage } from '../web/storage.js';
test('serialized saves fence old sessions and report only committed latest revision',async()=>{
 let release,stored;const statuses=[];
 const store={putWorking:async e=>{if(e.sessionId==='a')await new Promise(r=>{release=r;});stored=e;}};
 const a=createAutosave({store,onStatus:s=>statuses.push(s)});a.begin('a');
 const first=a.save({sessionId:'a',revision:1,projectJson:'old'});
 while(!release)await new Promise(r=>setImmediate(r));
 a.begin('b');const second=a.save({sessionId:'b',revision:0,projectJson:'new'});
 release();await Promise.all([first,second]);await a.flush();
 assert.equal(stored.projectJson,'new');
 assert.deepEqual(statuses.filter(s=>s.state==='saved').map(s=>s.sessionId),['b']);
});
test('save failure is not success; subsequent revision can recover',async()=>{
 let fail=true;const statuses=[];const a=createAutosave({store:{putWorking:async()=>{if(fail)throw Error('quota');}},onStatus:s=>statuses.push(s)});
 a.begin('a');await assert.rejects(a.save({sessionId:'a',revision:1,projectJson:'one'}));
 await assert.rejects(a.flush());assert.equal(statuses.at(-1).state,'failed');
 fail=false;await a.save({sessionId:'a',revision:2,projectJson:'two'});await a.flush();assert.equal(statuses.at(-1).state,'saved');
});
test('request success followed by transaction abort cannot report a persisted write',async()=>{
 let tx;const db={transaction(){tx={objectStore:()=>({put(){const r={};queueMicrotask(()=>{r.onsuccess?.();queueMicrotask(()=>tx.onabort());});return r;}})};return tx;},close(){}};
 const indexedDB={open(){const r={};queueMicrotask(()=>{r.result=db;r.onsuccess();});return r;}};
 const store=await openStorage({indexedDB});await assert.rejects(store.putWorking({version:1}),/abort/i);
});
test('queued pre-reset revision is skipped and committed reset remains the latest',async()=>{
 let release,stored;const statuses=[];
 const store={putWorking:async entry=>{if(entry.revision===1)await new Promise(r=>{release=r;});stored=entry;}};
 const a=createAutosave({store,onStatus:s=>statuses.push(s)});a.begin('a');
 const first=a.save({sessionId:'a',revision:1,projectJson:'edit'});
 while(!release)await new Promise(r=>setImmediate(r));
 const next=a.save({sessionId:'a',revision:2,projectJson:'another edit'}),reset=a.save({sessionId:'a',revision:3,projectJson:'baseline'});
 release();await Promise.all([first,next,reset]);assert.equal(stored.projectJson,'baseline');
 assert.deepEqual(statuses.filter(s=>s.state==='saved').map(s=>s.revision),[3]);
});
