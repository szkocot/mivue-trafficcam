import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseDatabase } from '../src/parser.js';
import { serializeJson, serializeGeoJson } from '../src/export.js';
import { reconstructDatabase, buildProject } from '../src/encoder.js';
import { createProject } from '../src/project.js';

test('local research sample matches documented counts and anomalies', async t => {
  const path = new URL('../Speedcam_Data_FEU.bin', import.meta.url);
  let bytes;
  try { bytes = await readFile(path); }
  catch (e) { if (e.code === 'ENOENT') return t.skip('Local sample not present'); throw e; }
  const hash = b => createHash('sha256').update(b).digest('hex');
  const before = hash(bytes);
  assert.equal(before, '2f01485c4d9910c9b9dce7fdc9355c3f8293e396d687526873c8537a4e0317f0', 'Sample differs from researched file');
  const db = parseDatabase(bytes);
  assert.equal(db.summary.recordCount, 52935); assert.equal(db.regions.length, 9);
  assert.equal(db.cells.length, 2800); assert.equal(db.summary.populatedCellCount, 898);
  assert.deepEqual(db.summary.diagnosticCounts, { LINK_TARGET_MISSING: 11, LINK_TARGET_TYPE: 2 });
  assert.deepEqual(db.diagnostics.map(d => [d.offset, d.targetOffset]), [
    [909920, 809938], [910032, 809574], [988856, 810470], [1023776, 988922],
    [1062504, 1023898], [1205780, 1235846], [1227652, 1299774], [1227960, 1299578],
    [1228492, 1273570], [1267224, 1285670], [1278484, 1282426], [1312772, 1157548], [1422122, 1466214],
  ]);
  assert.equal(JSON.parse(serializeJson(db)).records.length, 52935);
  assert.equal(JSON.parse(serializeGeoJson(db)).features.length, 52935);
  assert.deepEqual(Buffer.from(reconstructDatabase(structuredClone(db))), bytes);
  const rebuilt = await buildProject(await createProject(bytes));
  assert.deepEqual(Buffer.from(rebuilt.bytes), bytes);
  assert.equal(rebuilt.report.layoutChanged, false);
  assert.equal(rebuilt.report.warnings.length, 13);
  assert.equal(hash(bytes), before); assert.equal(hash(await readFile(path)), before);
});
