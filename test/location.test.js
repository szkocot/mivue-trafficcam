import test from 'node:test';
import assert from 'node:assert/strict';

// Dynamic import keeps the initial RED an explicit missing-interface assertion.
let createLocation;
try { ({createLocation}=await import('../web/location.js')); }
catch(e) { if(e.code!=='ERR_MODULE_NOT_FOUND')throw e; }

function setup(options={}) {
  assert.equal(typeof createLocation,'function','location controller must exist');
  const calls=[],states=[],positions=[];let clears=0;
  const geolocation={getCurrentPosition(ok,fail,settings){calls.push({ok,fail,settings});}};
  const controller=createLocation({geolocation,secureContext:true,
    onState:s=>states.push(s),onPosition:p=>positions.push(p),onClear:()=>clears++, ...options});
  return {controller,calls,states,positions,get clears(){return clears;}};
}
const fix=(coords={})=>({coords:{latitude:52.2297,longitude:21.0122,accuracy:20,altitude:null,altitudeAccuracy:null,speed:99,heading:123,...coords},timestamp:1790000000000});

test('location is click-only, coalesces pending requests and exposes only the permitted fix fields',()=>{
  const s=setup();assert.equal(s.calls.length,0);
  s.controller.locate();s.controller.locate();assert.equal(s.calls.length,1);
  assert.deepEqual(s.calls[0].settings,{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  assert.deepEqual(s.states.at(-1),{code:'pending'});
  s.calls[0].ok(fix());
  assert.deepEqual(s.positions,[{latitude:52.2297,longitude:21.0122,accuracy:20,timestamp:1790000000000}]);
  assert.deepEqual(s.states.at(-1),{code:'located'});
  s.controller.locate();assert.equal(s.calls.length,2);
});

for(const [error,code] of [[1,'denied'],[2,'unavailable'],[3,'timeout'],[9,'unavailable']]) {
  test(`location error ${error} exposes only ${code} and permits explicit retry`,()=>{
    const s=setup();s.controller.locate();s.calls[0].fail({code:error,message:'private provider detail'});
    assert.deepEqual(s.states.at(-1),{code});assert.deepEqual(s.positions,[]);
    assert.equal(s.calls.length,1);s.controller.locate();s.calls[1].ok(fix());assert.equal(s.positions.length,1);
  });
}
for(const [options,code] of [[{secureContext:false},'insecure'],[{geolocation:null},'unsupported'],[{geolocation:{}},'unsupported'],
  [{geolocation:{getCurrentPosition(){throw new Error('provider detail');}}},'unavailable']]) {
  test(`location gracefully reports ${code}`,()=>{
    const s=setup(options);s.controller.locate();assert.deepEqual(s.states.at(-1),{code});assert.deepEqual(s.positions,[]);
  });
}
for(const action of ['cancel','clear','destroy']) {
  test(`${action} invalidates a pending callback, including delayed errors`,()=>{
    const s=setup();s.controller.locate();s.controller[action]();
    const previous=[...s.states];s.calls[0].ok(fix());s.calls[0].fail({code:1});
    assert.deepEqual(s.states,previous);assert.deepEqual(s.positions,[]);
    assert.equal(s.clears,action==='cancel'?0:1);
    s.controller.locate();assert.equal(s.calls.length,action==='destroy'?1:2);
  });
}
test('old requests cannot complete newer requests, or deliver a callback twice',()=>{
  const s=setup();s.controller.locate();s.controller.cancel();s.controller.locate();
  s.calls[0].ok(fix());assert.deepEqual(s.states.at(-1),{code:'pending'});
  s.calls[1].ok(fix());s.calls[1].ok(fix());s.calls[1].fail({code:1});
  assert.equal(s.positions.length,1);assert.deepEqual(s.states.at(-1),{code:'located'});
});
for(const coords of [{latitude:NaN},{latitude:91},{longitude:-181},{accuracy:-1},{accuracy:Infinity},{latitude:'52'}]) {
  test(`invalid fix ${JSON.stringify(coords)} is unavailable, not sent to map`,()=>{
    const s=setup();s.controller.locate();s.calls[0].ok(fix(coords));
    assert.deepEqual(s.states.at(-1),{code:'unavailable'});assert.deepEqual(s.positions,[]);
  });
}
test('missing fields and unrenderable timestamps are rejected; zero coordinates/accuracy are valid',()=>{
  const s=setup();
  for(const bad of [null,{}, {coords:null}, {...fix(),timestamp:NaN},{...fix(),timestamp:1e20}]){
    s.controller.locate();s.calls.at(-1).ok(bad);assert.deepEqual(s.states.at(-1),{code:'unavailable'});
  }
  assert.deepEqual(s.positions,[]);
  s.controller.locate();s.calls.at(-1).ok(fix({latitude:0,longitude:0,accuracy:0}));assert.equal(s.positions.length,1);
});
