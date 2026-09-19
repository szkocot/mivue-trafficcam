import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, symlink, link, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { makeFixture } from './helpers/fixture.js';
import { parseDatabase } from '../src/parser.js';

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

test('project, edit and build produce a verified binary without overwriting input', async t => {
  const { path, bytes } = await fixture(t);
  const project = path + '.json', edited = path + '.edited.json', output = path + '.rebuilt.bin', patch = path + '.patch.json';
  assert.equal(run('project', path, '--output', project).status, 0);
  const p = JSON.parse(await readFile(project, 'utf8'));
  await writeFile(patch, JSON.stringify([{ kind: 'update', id: p.records[0].id, changes: { rawBytes16To19: [70, 0, 0, 1] } }]));
  const edit = run('edit', project, '--patch', patch, '--output', edited);
  assert.equal(edit.status, 0, edit.stderr);
  const build = run('build', edited, '--output', output);
  assert.equal(build.status, 0, build.stderr);
  assert.equal(parseDatabase(await readFile(output)).records[0].rawBytes16To19[0], 70);
  assert.deepEqual(new Uint8Array(await readFile(path)), bytes);
  assert.equal(run('build', edited, '--output', output).status, 1);
});
test('new commands reject bad syntax and cannot clobber aliases or existing files', async t => {
  const { path, bytes } = await fixture(t);
  for (const args of [['project', path], ['build', path, '--output'], ['edit', path, '--output', path],
    ['project', path, '--oops', path], ['project', path, '--output', path, 'extra']]) assert.equal(run(...args).status, 2);
  const sym = path + '.symlink', hard = path + '.hardlink';
  await symlink(path, sym); await link(path, hard);
  for (const dest of [path, sym, hard]) assert.equal(run('project', path, '--output', dest).status, 1);
  assert.deepEqual(new Uint8Array(await readFile(path)), bytes);
  assert.equal(run('project', path, '--output', path + '/missing/out.json').status, 1);
});
test('failed edit or build leaves no output file', async t => {
  const { path } = await fixture(t, [{ typeRaw: 964, linkRaw: 123 }, {}]);
  const project = path + '.json', patch = path + '.patch.json', out = path + '.out';
  assert.equal(run('project', path, '--output', project).status, 0);
  await writeFile(patch, '{}');
  assert.equal(run('edit', project, '--patch', patch, '--output', out).status, 1);
  await assert.rejects(access(out));
  const p = JSON.parse(await readFile(project, 'utf8')); p.records[1].edits.latitude = 38;
  await writeFile(project, JSON.stringify(p));
  const result = run('build', project, '--output', out);
  assert.equal(result.status, 1); assert.match(result.stderr, /UNRESOLVED_LINK/); await assert.rejects(access(out));
  await writeFile(project, '{');
  assert.equal(run('build', project, '--output', out).status, 1); await assert.rejects(access(out));
});
