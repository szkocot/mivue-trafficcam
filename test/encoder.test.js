import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDatabase } from '../src/parser.js';
import { createProject, applyEdit } from '../src/project.js';
import { reconstructDatabase, buildProject, BuildError } from '../src/encoder.js';
import { makeFixture } from './helpers/fixture.js';

test('reconstruction uses parsed nodes and preserves raw bytes including NaN', () => {
  for (const records of [[], [{}], [{ latitudeRaw: NaN, typeRaw: 123, rawBytes16To19: [255, 200, 7, 9] }]]) {
    const { bytes } = makeFixture(records), parsed = parseDatabase(bytes);
    bytes.fill(0); // The reconstruction must no longer depend on the original buffer.
    assert.deepEqual(reconstructDatabase(structuredClone(parsed)), makeFixture(records).bytes);
  }
});
test('reconstruction rejects overlapping offsets and contradictory parsed fields', () => {
  const db = parseDatabase(makeFixture([{}]).bytes);
  for (const alter of [p => p.records[0].offset++, p => p.cells[21].count++,
    p => { p.records[0].latitude = 40; }, p => p.regions[0].cellOffsets[0]++,
    p => { p.records[0].rawHex = 'zz'.repeat(28); }, p => p.records.push(p.records[0])]) {
    const edited = structuredClone(db); alter(edited);
    assert.throws(() => reconstructDatabase(edited), BuildError);
  }
});
test('no-op and same-cell edits preserve all unrelated bytes', async () => {
  const { bytes } = makeFixture([{}]); const p = await createProject(bytes), id = p.records[0].id;
  assert.deepEqual((await buildProject(p)).bytes, bytes);
  assert.deepEqual((await buildProject(applyEdit(p, { kind: 'update', id, changes: { latitude: 37, longitude: -7 } }))).bytes, bytes);
  const edited = applyEdit(p, { kind: 'update', id, changes: { latitude: 37.1, rawBytes16To19: [70, 0, 0, 1] } });
  const before = structuredClone(edited), result = await buildProject(edited);
  const record = parseDatabase(result.bytes).records[0];
  assert.ok(Math.abs(record.latitude - 37.1) < 1e-10); assert.equal(record.rawBytes16To19[0], 70);
  assert.equal(result.report.layoutChanged, false); assert.deepEqual(edited, before);
  assert.deepEqual(result.bytes.slice(0, record.offset), bytes.slice(0, record.offset));
});
test('cross-cell edits, cloning and deletion rebuild counts and relocated links', async () => {
  const p = await createProject(makeFixture([{ typeRaw: 964, linkTo: 1 }, { typeRaw: 9128 }, {}]).bytes);
  const [from, to, ordinary] = p.records.map(r => r.id);
  let changed = applyEdit(p, { kind: 'update', id: to, changes: { latitude: 38 } });
  changed = applyEdit(changed, { kind: 'clone', templateId: ordinary, latitude: 37.2, longitude: -7 });
  const result = await buildProject(changed), db = parseDatabase(result.bytes);
  assert.equal(db.records.length, 4); assert.equal(db.regions[0].count, 4);
  assert.equal(db.records.find(r => r.typeRaw === 964).linkRaw, db.records.find(r => r.typeRaw === 9128).offset);
  assert.equal(result.report.layoutChanged, true); assert.deepEqual(db.diagnostics, []);
  await assert.rejects(buildProject(applyEdit(changed, { kind: 'delete', id: to })), e => e.code === 'DANGLING_LINK');
  const deletion = applyEdit(p, { kind: 'delete', id: ordinary });
  assert.equal(parseDatabase((await buildProject(deletion)).bytes).records.length, 2);
  assert.deepEqual((await buildProject(applyEdit(deletion, { kind: 'restore', id: ordinary }))).bytes, makeFixture([{ typeRaw: 964, linkTo: 1 }, { typeRaw: 9128 }, {}]).bytes);
  assert.ok(from.startsWith('source:'));
});
test('unresolved references survive unchanged but block address-space changes until resolved', async () => {
  const { bytes } = makeFixture([{ typeRaw: 964, linkRaw: 123 }, { typeRaw: 9128 }, {}]);
  const p = await createProject(bytes), [from, to, ordinary] = p.records.map(r => r.id);
  assert.deepEqual((await buildProject(p)).bytes, bytes);
  const moved = applyEdit(p, { kind: 'update', id: ordinary, changes: { latitude: 38 } });
  await assert.rejects(buildProject(moved), e => e.code === 'UNRESOLVED_LINK');
  const resolved = applyEdit(moved, { kind: 'resolve-link', id: from, targetId: to, reason: 'explicit test pairing' });
  assert.deepEqual(parseDatabase((await buildProject(resolved)).bytes).diagnostics, []);
  const opaque = await createProject(makeFixture([{ typeRaw: 99, linkRaw: 123 }, {}]).bytes);
  await assert.rejects(buildProject(applyEdit(opaque, { kind: 'update', id: opaque.records[1].id, changes: { latitude: 38 } })), e => e.code === 'UNRESOLVED_LINK');
});
test('first populated region changes and outside-global coordinates are blocked', async () => {
  const p = await createProject(makeFixture([{}]).bytes), id = p.records[0].id;
  await assert.rejects(buildProject(applyEdit(p, { kind: 'update', id, changes: { latitude: 50 } })), e => e.code === 'UNKNOWN_HEADER_DEPENDENCY');
  await assert.rejects(buildProject(applyEdit(p, { kind: 'update', id, changes: { longitude: 100 } })), e => e.code === 'INVALID_COORDINATE');
});
test('coordinate encoding respects negative values, carry and fractional boundaries', async () => {
  const p = await createProject(makeFixture([{}]).bytes), id = p.records[0].id;
  for (const [latitude, longitude, cellIndex] of [[37, -7.5, 20], [42.8, -7, 241], [42.8 - 1e-12, -7, 221], [42.8 + 1e-12, -7, 241], [37.99999999999999, -7, 61]]) {
    const result = await buildProject(applyEdit(p, { kind: 'update', id, changes: { latitude, longitude } }));
    const r = parseDatabase(result.bytes).records[0];
    assert.ok(Math.abs(r.latitude - latitude) <= 1e-10); assert.ok(Math.abs(r.longitude - longitude) <= 1e-10);
    assert.equal(r.cellIndex, cellIndex); assert.deepEqual(parseDatabase(result.bytes).diagnostics, []);
  }
});
test('effective edits determine output independently of edit order', async () => {
  const p = await createProject(makeFixture([{}, {}]).bytes), [a, b] = p.records.map(r => r.id);
  const x = { kind: 'update', id: a, changes: { latitude: 38 } }, y = { kind: 'update', id: b, changes: { longitude: -7.5 } };
  assert.deepEqual((await buildProject(applyEdit(applyEdit(p, x), y))).bytes, (await buildProject(applyEdit(applyEdit(p, y), x))).bytes);
});
test('overflow is rejected before writing truncated regional counts', async () => {
  const p = await createProject(makeFixture([{}]).bytes), templateId = p.records[0].id;
  for (let i = 1; i <= 65535; i++) p.records.push({ id: `new:${i}`, sourceOffset: null, templateId,
    edits: { latitude: 37, longitude: -7 }, deleted: false, provenance: [] });
  p.nextId = 65536;
  await assert.rejects(buildProject(p), e => e.code === 'COUNT_OVERFLOW');
});
