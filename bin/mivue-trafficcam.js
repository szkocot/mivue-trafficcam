#!/usr/bin/env node
import { readFile, open, unlink } from 'node:fs/promises';
import { parseDatabase, ParseError } from '../src/parser.js';
import { serializeJson, serializeGeoJson } from '../src/export.js';
import { createProject, loadProject, serializeProject, applyEdit, ProjectError } from '../src/project.js';
import { buildProject, BuildError } from '../src/encoder.js';

const usage = `Usage:
  node bin/mivue-trafficcam.js inspect <file>
  node bin/mivue-trafficcam.js export <file> --format json|geojson
  node bin/mivue-trafficcam.js project <file.bin> --output <new-project.json>
  node bin/mivue-trafficcam.js edit <project.json> --patch <operations.json> --output <new-project.json>
  node bin/mivue-trafficcam.js build <project.json> --output <new-file.bin>
  node bin/mivue-trafficcam.js --help
`;
process.stderr.on('error', () => { process.exitCode = 1; });
process.stdout.on('error', error => {
  process.exitCode = 1;
  process.stderr.write(`Output error: ${error.code ?? error.message}\n`);
});

async function writeNew(path, data) {
  const file = await open(path, 'wx');
  try { await file.writeFile(data); await file.close(); }
  catch (error) {
    await file.close().catch(() => {});
    await unlink(path).catch(() => {});
    throw error;
  }
}

async function projectCommand(args) {
  const [command, path] = args;
  const dest = args.at(-1);
  const validPath = p => typeof p === 'string' && p.length > 0 && !p.startsWith('-');
  const valid = validPath(path) && validPath(dest) && (command === 'edit'
    ? args.length === 6 && args[2] === '--patch' && validPath(args[3]) && args[4] === '--output'
    : args.length === 4 && args[2] === '--output');
  if (!valid) { process.exitCode = 2; process.stderr.write(usage); return; }
  let data, report;
  if (command === 'project') data = await serializeProject(await createProject(await readFile(path), { name: path }));
  else {
    let project = await loadProject(await readFile(path, 'utf8'));
    if (command === 'edit') {
      const operations = JSON.parse(await readFile(args[3], 'utf8'));
      if (!Array.isArray(operations)) throw new ProjectError('Patch must be an array of operations');
      for (const operation of operations) project = applyEdit(project, operation);
      data = await serializeProject(project);
    } else {
      const built = await buildProject(project); data = built.bytes; report = built.report;
    }
  }
  await writeNew(dest, data);
  if (report) for (const warning of report.warnings) process.stderr.write(`${warning.code}: ${warning.recordId} (target ${warning.targetOffset})\n`);
  process.stdout.write(JSON.stringify({ output: dest, ...(report ? { report } : {}) }, null, 2) + '\n');
}

async function main(args) {
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(usage); return; }
  if (['project', 'edit', 'build'].includes(args[0])) return projectCommand(args);
  const [command, path, flag, format] = args;
  if (!path || path.startsWith('-') || !(
    (command === 'inspect' && args.length === 2)
    || (command === 'export' && args.length === 4 && flag === '--format' && ['json', 'geojson'].includes(format))
  )) { process.exitCode = 2; process.stderr.write(usage); return; }
  const database = parseDatabase(await readFile(path));
  for (const warning of database.diagnostics)
    process.stderr.write(`${warning.code} at ${warning.offset}: ${warning.message}`
      + (warning.targetOffset === undefined ? '' : ` (target ${warning.targetOffset})`) + '\n');
  if (command === 'export') {
    process.stdout.write(format === 'json' ? serializeJson(database) : serializeGeoJson(database));
  } else {
    const s = database.summary;
    process.stdout.write(`Bytes: ${s.byteLength}\nRegions: ${s.regionCount}\n`
      + `Cells: ${s.cellCount} (${s.populatedCellCount} populated)\nRecords: ${s.recordCount}\n`
      + `Version candidate: ${JSON.stringify(database.header.versionCandidate)}\n`
      + `Raw types (meanings unverified): ${JSON.stringify(s.typeCounts)}\n`
      + `Warnings: ${database.diagnostics.length}\n`);
  }
}

try { await main(process.argv.slice(2)); }
catch (error) {
  process.exitCode = 1;
  process.stderr.write(error instanceof ParseError
    ? `${error.code} at ${error.offset}: ${error.message}\n`
    : error instanceof BuildError || error instanceof ProjectError
      ? `${error.code}: ${error.message}\n`
      : `Input/output error: ${error.message}\n`);
}
