import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseDatabase } from '../src/parser.js';
import { serializeJson, serializeGeoJson } from '../src/export.js';
import { reconstructDatabase, buildProject } from '../src/encoder.js';
import { createProject } from '../src/project.js';
import { sampleExpectations } from './helpers/local-sample.js';

test('local research sample matches documented counts and anomalies', async t => {
  const path = new URL('../Speedcam_Data_FEU.bin', import.meta.url);
  let bytes;
  try { bytes = await readFile(path); }
  catch (e) { if (e.code === 'ENOENT') return t.skip('Local sample not present'); throw e; }
  const hash = b => createHash('sha256').update(b).digest('hex');
  const before = hash(bytes);
  const expected=sampleExpectations(bytes);
  const db = parseDatabase(bytes);
  assert.equal(db.summary.recordCount, expected.records); assert.equal(db.regions.length, 9);
  assert.equal(db.cells.length, 2800); assert.equal(db.summary.populatedCellCount, expected.populated);
  assert.deepEqual(db.summary.diagnosticCounts, { LINK_TARGET_MISSING: 11, LINK_TARGET_TYPE: 2 });
  assert.deepEqual(db.diagnostics.map(d => [d.offset, d.targetOffset]), expected.links);
  assert.equal(JSON.parse(serializeJson(db)).records.length, expected.records);
  assert.equal(JSON.parse(serializeGeoJson(db)).features.length, expected.records);
  assert.deepEqual(Buffer.from(reconstructDatabase(structuredClone(db))), bytes);
  const rebuilt = await buildProject(await createProject(bytes));
  assert.deepEqual(Buffer.from(rebuilt.bytes), bytes);
  assert.equal(rebuilt.report.layoutChanged, false);
  assert.equal(rebuilt.report.warnings.length, 13);
  assert.equal(hash(bytes), before); assert.equal(hash(await readFile(path)), before);
});
