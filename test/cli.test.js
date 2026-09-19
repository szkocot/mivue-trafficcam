import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { makeFixture } from './helpers/fixture.js';

const cli = new URL('../bin/mivue-trafficcam.js', import.meta.url).pathname;
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', maxBuffer: 5_000_000 });
async function fixture(t, records = [{}]) {
  const dir = await mkdtemp(join(tmpdir(), 'mivue-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'camera sample.bin'), { bytes } = makeFixture(records);
  await writeFile(path, bytes);
  return { path, bytes };
}
test('help and invalid syntax have distinct exit codes', () => {
  assert.equal(run('--help').status, 0);
  for (const args of [[], ['other'], ['inspect'], ['inspect', 'x', 'extra'],
    ['export', 'x'], ['export', 'x', '--format', 'csv'], ['export', 'x', '--other', 'json'],
    ['inspect', '--bad'], ['--help', 'extra']]) {
    const r = run(...args); assert.equal(r.status, 2, args.join(' ')); assert.equal(r.stdout, '');
  }
});
test('inspect and exports work without changing the input', async t => {
  const { path, bytes } = await fixture(t);
  const inspect = run('inspect', path);
  assert.equal(inspect.status, 0); assert.match(inspect.stdout, /Records: 1/);
  for (const format of ['json', 'geojson']) {
    const r = run('export', path, '--format', format);
    assert.equal(r.status, 0, r.stderr); assert.equal(r.stderr, '');
    const data = JSON.parse(r.stdout); assert.equal(data.summary.recordCount, 1);
    if (format === 'geojson') assert.deepEqual(data.features[0].geometry.coordinates, [-7, 37]);
  }
  assert.deepEqual(new Uint8Array(await readFile(path)), bytes);
});
test('warnings go to stderr without invalidating the export', async t => {
  const { path } = await fixture(t, [{ typeRaw: 964, linkRaw: 123 }]);
  const r = run('export', path, '--format', 'json');
  assert.equal(r.status, 0); assert.equal(JSON.parse(r.stdout).diagnostics.length, 1);
  assert.match(r.stderr, /LINK_TARGET_MISSING/);
});
test('I/O and malformed input errors exit cleanly', async t => {
  const { path } = await fixture(t);
  assert.equal(run('inspect', path + '.missing').status, 1);
  await writeFile(path, new Uint8Array(4));
  const r = run('inspect', path);
  assert.equal(r.status, 1); assert.equal(r.stdout, ''); assert.match(r.stderr, /TRUNCATED/);
  assert.doesNotMatch(r.stderr, /at .*\.js:/);
});
test('closed output pipe produces a controlled failure', { timeout: 15000 }, async t => {
  const { path } = await fixture(t, Array.from({ length: 5000 }, () => ({})));
  const child = spawn(process.execPath, [cli, 'export', path, '--format', 'json']);
  let errors = ''; child.stderr.setEncoding('utf8'); child.stderr.on('data', s => { errors += s; });
  const closed = once(child, 'close'); child.stdout.destroy();
  const [code] = await closed;
  assert.equal(code, 1); assert.match(errors, /output/i); assert.doesNotMatch(errors, /Unhandled|at .*\.js:/);
});
