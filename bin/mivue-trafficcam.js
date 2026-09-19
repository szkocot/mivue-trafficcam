#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseDatabase, ParseError } from '../src/parser.js';
import { serializeJson, serializeGeoJson } from '../src/export.js';

const usage = `Usage:
  node bin/mivue-trafficcam.js inspect <file>
  node bin/mivue-trafficcam.js export <file> --format json|geojson
  node bin/mivue-trafficcam.js --help
`;
process.stderr.on('error', () => { process.exitCode = 1; });
process.stdout.on('error', error => {
  process.exitCode = 1;
  process.stderr.write(`Output error: ${error.code ?? error.message}\n`);
});

async function main(args) {
  if (args.length === 1 && args[0] === '--help') { process.stdout.write(usage); return; }
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
    : `Input/output error: ${error.message}\n`);
}
