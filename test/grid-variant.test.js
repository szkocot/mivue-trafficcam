import test from 'node:test';
import assert from 'node:assert/strict';
import { assertBinaryRoundTrips } from './helpers/binary-roundtrip.js';
import { makeFixture } from './helpers/fixture.js';
import { parseDatabase } from '../src/parser.js';
import { reconstructDatabase, buildProject } from '../src/encoder.js';
import { createProject, applyEdit } from '../src/project.js';

test('researched 22×22 variant reconstructs and relocates linked records', async () => {
  const { bytes } = makeFixture([{typeRaw:964,linkTo:1},{typeRaw:9128}],22);
  const db = parseDatabase(bytes);
  assert.equal(db.cells.length,484); assert.deepEqual(db.diagnostics,[]);
  assert.deepEqual(reconstructDatabase(db),bytes);
  const project=await createProject(bytes);
  assert.deepEqual((await buildProject(project)).bytes,bytes);
  const changed=applyEdit(project,{kind:'update',id:project.records[1].id,changes:{latitude:38}});
  const rebuilt=parseDatabase((await buildProject(changed)).bytes);
  assert.equal(rebuilt.records.find(r=>r.typeRaw===9128).cellIndex,67);
  assert.equal(rebuilt.records[0].linkRaw,rebuilt.records[1].offset);
  assert.deepEqual(rebuilt.diagnostics,[]);
});
test('unresearched and nonsquare cell grids stay unsupported',()=>{
  for(const width of [21,23]) assert.throws(()=>parseDatabase(makeFixture([{}],width).bytes),e=>e.code==='UNSUPPORTED_GRID');
  const {bytes}=makeFixture([{}],22);new DataView(bytes.buffer).setUint16(10,20,true);
  assert.throws(()=>parseDatabase(bytes),e=>e.code==='UNSUPPORTED_GRID');
});

test('22×22 fractional boundaries and later regions use 66 global divisions', async()=>{
 const {bytes}=makeFixture([{regionIndex:1,cellIndex:37,latitudeRaw:3654.1383,longitudeRaw:1425.67406}],22);
 assert.deepEqual(parseDatabase(bytes).diagnostics,[]);
 const p=await createProject(bytes);
 const result=await buildProject(applyEdit(p,{kind:'update',id:p.records[0].id,changes:{latitude:37.1}}));
 assert.deepEqual(parseDatabase(result.bytes).diagnostics,[]);
 assert.equal(parseDatabase(result.bytes).records[0].cellIndex,59);
});

test('private firmware database matches researched identity and rebuilds byte-identically', async t => {
  const path=process.env.MIVUE_FIRMWARE_DATABASE;
  if(!path) return t.skip('Set MIVUE_FIRMWARE_DATABASE to a privately extracted database');
  const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');
  const bytes=await readFile(path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'8f6930c3bbf7be5c9d51e8fadad93e300b6eea8b6b9f1c9dff4d046accaa13ca');
  const db=parseDatabase(bytes);
  assert.equal(db.summary.recordCount,51790);assert.equal(db.cells.length,3388);
  assert.equal(db.summary.populatedCellCount,987);
  assert.deepEqual(db.summary.diagnosticCounts,{LINK_TARGET_MISSING:9});
  assert.deepEqual(Buffer.from(reconstructDatabase(db)),bytes);
  assert.deepEqual(Buffer.from((await buildProject(await createProject(bytes))).bytes),bytes);
  await assertBinaryRoundTrips(bytes);
});

test('reconstruction rejects dimensions contradicting the raw header',()=>{
 const db=parseDatabase(makeFixture([{}],22).bytes);
 db.header.cellDimensions.rows=0;
 assert.throws(()=>reconstructDatabase(db),e=>e.code==='INVALID_PARSED_DATA');
});

for (const width of [20,22]) test(`${width}×${width} preserves all byte values, raw types, links and unusual coordinate encodings`,async()=>{
 const types=[0,1,3,5,964,9128,0xffffffff];
 const records=Array.from({length:256},(_,i)=>({
   latitudeRaw:[3700,-3700,0,-0,NaN,Infinity,-Infinity][i%7],
   longitudeRaw:i%2?-700:700,rawBytes16To19:[i,255-i,i^170,i^85],
   typeRaw:types[i%types.length],linkRaw:i%3?0:0xfedcba98,
 }));
 const {bytes,recordOffsets}=makeFixture(records,width);
 // A noncanonical NaN payload must survive the JSON/project path verbatim.
 new DataView(bytes.buffer).setBigUint64(recordOffsets[4],0x7ff8000000000042n,true);
 await assertBinaryRoundTrips(bytes);
});
