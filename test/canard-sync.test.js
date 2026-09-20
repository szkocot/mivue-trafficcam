import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanardSync} from '../web/canard-sync.js';
const entry={manifest:{sha256:'a'.repeat(64)}};
const context=()=>({sessionId:'a',revision:0,ready:true,dirty:false,busy:false,enabled:true});
test('draft, recovery, busy and disabled projects defer without losing update',async()=>{
 for(const block of [{dirty:true},{ready:false},{busy:true},{enabled:false}]){
  let c={...context(),...block},calls=0;
  const sync=createCanardSync({getContext:()=>c,importSnapshot:async()=>{calls++;}});
  sync.offer(entry);await sync.flush();assert.equal(calls,0);
  c=context();await sync.flush();assert.equal(calls,1);
 }
});
test('handled hashes suppress undo reapplication until explicit reapply',async()=>{
 let calls=0;const sync=createCanardSync({getContext:context,importSnapshot:async()=>{calls++;}});
 sync.offer(entry);await sync.flush();sync.offer(entry);await sync.flush();assert.equal(calls,1);
 sync.offer(entry,{reapply:true});await sync.flush();assert.equal(calls,2);
});
test('different project sessions each get the candidate with current revision',async()=>{
 let c=context();const requests=[];
 const sync=createCanardSync({getContext:()=>c,importSnapshot:async(_entry,identity)=>requests.push(identity)});
 sync.offer(entry);await sync.flush();c={...c,sessionId:'b',revision:4};await sync.flush();
 assert.deepEqual(requests,[{sessionId:'a',expectedRevision:0},{sessionId:'b',expectedRevision:4}]);
});
test('overlapping flushes commit once; failed import can be explicitly retried',async()=>{
 let release,calls=0;const work=new Promise(r=>{release=r;});
 const sync=createCanardSync({getContext:context,importSnapshot:async()=>{calls++;await work;if(calls===1)throw Error('failure');}});
 sync.offer(entry);const first=sync.flush();await sync.flush();assert.equal(calls,1);release();await first;
 await sync.flush();assert.equal(calls,1); // no automatic error loop
 sync.offer(entry,{reapply:true});await sync.flush();assert.equal(calls,2);
});
test('withdrawal and disposal block previously queued updates',async()=>{
 let calls=0;const sync=createCanardSync({getContext:context,importSnapshot:async()=>calls++});
 sync.offer(entry);sync.setEnabled(false);await sync.flush();assert.equal(calls,0);
 sync.setEnabled(true);sync.offer(entry);sync.dispose();await sync.flush();assert.equal(calls,0);
});
