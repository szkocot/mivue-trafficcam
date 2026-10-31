import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseDatabase } from '../../src/parser.js';
import { serializeJson } from '../../src/export.js';
import { reconstructDatabase, buildProject } from '../../src/encoder.js';
import { createProject, serializeProject, loadProject } from '../../src/project.js';

// Exercise actual persisted representations twice, including reparsing each build.
export async function assertBinaryRoundTrips(source) {
  const expected = Buffer.from(source), hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const expectedHash = hash(expected), baseline = parseDatabase(source);
  let bytes = source;
  for (let cycle = 0; cycle < 2; cycle++) {
    const parsed = parseDatabase(bytes);
    assert.deepEqual(parsed, baseline);
    const reconstructed = reconstructDatabase(JSON.parse(serializeJson(parsed)));
    assert.deepEqual(Buffer.from(reconstructed), expected);
    let project = await createProject(reconstructed);
    for (let save = 0; save < 2; save++) project = await loadProject(await serializeProject(project));
    const result = await buildProject(project);
    assert.equal(result.report.layoutChanged, false);
    assert.deepEqual(Buffer.from(result.bytes), expected);
    assert.equal(hash(result.bytes), expectedHash);
    bytes = result.bytes;
  }
  assert.deepEqual(Buffer.from(source), expected);
}
