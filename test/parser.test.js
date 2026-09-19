import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDatabase, ParseError } from '../src/parser.js';
import { makeFixture } from './helpers/fixture.js';

test('empty database accounts for all regions', () => {
  const db = parseDatabase(makeFixture().bytes);
  assert.equal(db.regions.length, 9); assert.equal(db.cells.length, 0);
  assert.equal(db.summary.recordCount, 0); assert.equal(db.summary.byteLength, 162);
});
test('slice offsets, raw fields and input immutability', () => {
  const { bytes } = makeFixture([{ rawBytes16To19: [32, 179, 42, 7], typeRaw: 123456 }]);
  bytes[16] = 255;
  const padded = new Uint8Array(bytes.length + 17).fill(255); padded.set(bytes, 7);
  const before = padded.slice(), db = parseDatabase(padded.subarray(7, 7 + bytes.length));
  const r = db.records[0];
  assert.equal(r.latitude, 37); assert.equal(r.longitude, -7);
  assert.equal(r.rawHex.length, 56); assert.equal(r.typeRaw, 123456);
  assert.deepEqual(r.rawBytes16To19, [32, 179, 42, 7]);
  assert.equal(db.header.unknown16Hex, 'ff202020');
  assert.equal(db.header.rawHex.length, 72); assert.equal(db.cells[21].rawHex.length, 20);
  assert.equal(db.diagnostics.length, 0); assert.deepEqual(padded, before);
  padded.fill(0); assert.equal(r.rawBytes16To19[0], 32);
});
for (const [name, record, lat, lon] of [
  ['negative minutes', { longitudeRaw: -730, cellIndex: 20 }, 37, -7.5],
  ['global upper edge', { latitudeRaw: 7000, longitudeRaw: 3100, regionIndex: 8, cellIndex: 399 }, 70, 31],
  ['interior region edge', { longitudeRaw: 500, regionIndex: 1, cellIndex: 20 }, 37, 5],
]) test(name, () => {
  const db = parseDatabase(makeFixture([record]).bytes);
  assert.equal(db.records[0].latitude, lat); assert.equal(db.records[0].longitude, lon);
  assert.deepEqual(db.diagnostics, []);
});
for (const value of [3760, NaN, Infinity, -Infinity, 9100]) test(`invalid coordinate ${value}`, () => {
  const db = parseDatabase(makeFixture([{ latitudeRaw: value }]).bytes);
  assert.equal(db.records[0].latitude, null); assert.equal(db.records[0].longitude, null);
  assert.equal(db.diagnostics[0].code, 'INVALID_COORDINATE');
});
test('misplaced valid coordinate is preserved and warned', () => {
  const db = parseDatabase(makeFixture([{ cellIndex: 22 }]).bytes);
  assert.equal(db.records[0].latitude, 37); assert.equal(db.diagnostics[0].code, 'CELL_MISMATCH');
});
for (const [name, records, code] of [
  ['valid link', [{ typeRaw: 964, linkTo: 1 }, { typeRaw: 9128 }], null],
  ['missing target', [{ typeRaw: 964, linkRaw: 123 }], 'LINK_TARGET_MISSING'],
  ['unexpected target', [{ typeRaw: 964, linkTo: 1 }, {}], 'LINK_TARGET_TYPE'],
  ['self target', [{ typeRaw: 964, linkTo: 0 }], 'LINK_TARGET_TYPE'],
]) test(name, () => {
  const db = parseDatabase(makeFixture(records).bytes);
  assert.equal(db.records.length, records.length);
  assert.deepEqual(db.diagnostics.map(d => d.code), code ? [code] : []);
});
const invalidCases = [
  ['regional table pointer', (v) => v.setUint32(36, 40, true), 'INVALID_OFFSET'],
  ['duplicate region', (v, f) => v.setUint32(40, f.regionOffsets[0], true), 'INVALID_OFFSET'],
  ['decreasing region', (v, f) => v.setUint32(44, f.regionOffsets[0], true), 'INVALID_OFFSET'],
  ['out of range region', v => v.setUint32(40, 0xffffffff, true), 'INVALID_OFFSET'],
  ['cell table pointer', (v, f) => v.setUint32(f.regionOffsets[0] + 10, 100, true), 'INVALID_OFFSET'],
  ['duplicate cell', (v, f) => v.setUint32(f.regionOffsets[0] + 14, f.cellOffsets[0][0], true), 'INVALID_OFFSET'],
  ['out of range cell', (v, f) => v.setUint32(f.regionOffsets[0] + 14, 0xffffffff, true), 'INVALID_OFFSET'],
  ['impossible cell count', (v, f) => v.setUint16(f.cellOffsets[0][21], 65535, true), 'SPAN_MISMATCH'],
  ['regional count mismatch', (v, f) => v.setUint16(f.regionOffsets[0], 2, true), 'COUNT_MISMATCH'],
  ['zero dimensions', v => v.setUint16(8, 0, true), 'UNSUPPORTED_GRID'],
  ['huge dimensions', v => v.setUint16(12, 65535, true), 'UNSUPPORTED_GRID'],
  ['reversed bounds', v => v.setInt16(6, 35, true), 'INVALID_BOUNDS'],
  ['impossible bounds', v => v.setInt16(6, 91, true), 'INVALID_BOUNDS'],
];
for (const [name, mutate, code] of invalidCases) test(`rejects ${name}`, () => {
  const f = makeFixture([{}]); mutate(new DataView(f.bytes.buffer), f);
  assert.throws(() => parseDatabase(f.bytes), e => e instanceof ParseError && e.code === code && Number.isInteger(e.offset));
});
test('rejects truncated input and extra bytes', () => {
  const { bytes } = makeFixture([{ regionIndex: 8, cellIndex: 399 }]);
  for (const length of [0, 35, 71, bytes.length - 1])
    assert.throws(() => parseDatabase(bytes.subarray(0, length)), ParseError);
  const extra = new Uint8Array(bytes.length + 1); extra.set(bytes);
  assert.throws(() => parseDatabase(extra), e => e.code === 'SPAN_MISMATCH');
});
test('rejects non-byte input', () => {
  for (const input of [null, [], new ArrayBuffer(100)])
    assert.throws(() => parseDatabase(input), e => e.code === 'INVALID_INPUT');
});
