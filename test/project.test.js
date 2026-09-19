import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, loadProject, serializeProject, applyEdit } from '../src/project.js';
import { makeFixture } from './helpers/fixture.js';

test('project retains baseline, stable IDs and provenance across save/load', async () => {
  const f = makeFixture([{}]);
  const p = await createProject(f.bytes, { name: 'example.bin' });
  assert.equal(p.records[0].id, `source:${f.recordOffsets[0]}`);
  assert.equal(p.source.bytesHex, Buffer.from(f.bytes).toString('hex'));
  assert.equal(p.source.sha256.length, 64);
  p.records[0].provenance.push({ source: 'user', comment: '<script>example</script>' });
  assert.deepEqual(await loadProject(await serializeProject(p)), p);
});
test('update, clone, delete and restore are immutable and preserve identity', async () => {
  const p = await createProject(makeFixture([{}]).bytes), before = structuredClone(p), id = p.records[0].id;
  const edited = applyEdit(p, { kind: 'update', id, changes: { latitude: 37.1, rawBytes16To19: [70, 0, 0, 1] } });
  assert.equal(edited.records[0].edits.latitude, 37.1); assert.deepEqual(p, before);
  const clone = applyEdit(edited, { kind: 'clone', templateId: id, latitude: 37.2, longitude: -7 });
  assert.equal(clone.records[1].id, 'new:1'); assert.equal(clone.nextId, 2);
  const deleted = applyEdit(clone, { kind: 'delete', id });
  assert.equal(deleted.records[0].deleted, true);
  assert.deepEqual(applyEdit(deleted, { kind: 'restore', id }), clone);
  assert.deepEqual(await loadProject(await serializeProject(deleted)), deleted);
});
const mutations = [
  p => { p.projectVersion = 99; }, p => { p.source.sha256 = '0'.repeat(64); },
  p => { p.source.sha256 = 'x'; }, p => { p.source.bytesHex += 'z'; },
  p => { p.source.bytesHex = 'gg'; }, p => { p.records.pop(); },
  p => { p.records.push(structuredClone(p.records[0])); }, p => { p.records[0].sourceOffset++; },
  p => { p.records[0].edits = { latitude: 91 }; }, p => { p.records[0].edits = { latitude: null }; },
  p => { p.records[0].edits = { rawBytes16To19: [0, 0, 0, 256] }; },
  p => { p.records[0].edits = { typeRaw: 99 }; }, p => { p.nextId = 0; },
  p => { p.records.push({ ...p.records[0], id: 'new:1', sourceOffset: null, templateId: 'missing' }); p.nextId = 2; },
  p => { p.records.push({ ...p.records[0], id: 'new:1', sourceOffset: null, templateId: p.records[0].id }); },
  p => { p.records[0].edits = { linkResolution: { targetId: 'missing', reason: 'test' } }; },
];
test('untrusted project fields cannot override the baseline', async () => {
  const original = await createProject(makeFixture([{}]).bytes);
  for (const mutate of mutations) {
    const p = structuredClone(original); mutate(p);
    await assert.rejects(loadProject(JSON.stringify(p)), undefined, mutate.toString());
  }
  await assert.rejects(loadProject('{'));
});
test('operations reject unknown fields, invalid values and unsupported templates', async () => {
  const p = await createProject(makeFixture([{ typeRaw: 964 }, { typeRaw: 9128 }, {}]).bytes);
  const id = p.records[2].id;
  for (const op of [null, { kind: 'explode' }, { kind: 'delete', id: 'missing' },
    { kind: 'delete', id, extra: true }, { kind: 'update', id, changes: { latitude: Infinity } },
    { kind: 'update', id, changes: { speed: 70 } },
    { kind: 'clone', templateId: p.records[0].id, latitude: 37, longitude: -7 },
    { kind: 'resolve-link', id, targetId: p.records[1].id, reason: 'test' },
    { kind: 'resolve-link', id: p.records[0].id, targetId: id, reason: 'test' },
  ]) assert.throws(() => applyEdit(p, op));
  const resolved = applyEdit(p, { kind: 'resolve-link', id: p.records[0].id, targetId: p.records[1].id, reason: 'known endpoints' });
  assert.equal(resolved.records[0].edits.linkResolution.reason, 'known endpoints');
  const deleted = applyEdit(resolved, { kind: 'delete', id: p.records[1].id });
  assert.deepEqual(await loadProject(await serializeProject(deleted)), deleted);
});
