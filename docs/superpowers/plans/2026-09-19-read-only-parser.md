# Read-only MiVue Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inspect and export the documented MiVue database layout without changing source bytes, preserving unknown fields and reporting research warnings.

**Architecture:** A browser-compatible parser consumes a Uint8Array and produces plain data. Separate serializers generate JSON/GeoJSON; a Node CLI handles files and streams. All components use JavaScript ES modules without third-party dependencies.

**Tech Stack:** JavaScript, DataView, Node's built-in test runner. Local verification environment: Node v26.8.2; no install or build step is required.

**Spec:** [Approved design](../specs/2026-09-19-read-only-parser-design.md). Format evidence: [binary research](../../binary-format.md).

## Global Constraints

- The core accepts a Uint8Array and uses DataView, without Node-specific APIs, network calls, or filesystem access.
- Support the documented layout with a 36-byte header, 3×3 regions, 20×20 cells per populated region, 10-byte node headers, and 28-byte records.
- Unknown fields must never be normalized or repaired.
- JSON output has a `schemaVersion: 1`, complete parsed metadata, records, diagnostics, and summary.
- CLI exit codes: 0 for successfully parsed data, including research warnings; 1 for malformed/unsupported input or I/O failure; 2 for invalid command-line usage.
- The normal test suite must pass without the sample.
- Exports derived from the sample remain local and must not be committed or published automatically.
- No device compatibility or re-encoding claim is part of this work.

## Review Focus

1. Node Buffers and sliced typed arrays: honor byteOffset and byteLength; never parse surrounding memory (Task 1).
2. Hostile pointer/count values: reject out-of-range spans before reading or allocating, including pointers into tables (Task 1).
3. Negative and boundary coordinates: use truncation toward zero; exact upper global bounds belong to the final cell (Task 1).
4. NaN/Infinity and unknown metadata: preserve original hex while emitting valid JSON and null invalid geometry (Tasks 1–2).
5. CLI misuse and failed output streams: keep exports uncontaminated, return documented exit codes, and do not print unhandled exceptions (Task 3).

## File map and shared data contract

Create `package.json`, `src/parser.js`, `src/export.js`, `bin/mivue-trafficcam.js`, `test/helpers/fixture.js`, `test/parser.test.js`, `test/export.test.js`, `test/cli.test.js`, and `test/sample.test.js`. Modify README and .gitignore as part of CLI delivery. Keep reusable fixture construction outside test discovery by using an explicit `test/*.test.js` script.

`parseDatabase(bytes)` returns:

```js
{
  schemaVersion: 1,
  header: { rawHex, bounds, cellDimensions, regionDimensions,
    unknown16Hex, unknown20, versionCandidate },
  regions: [{ index, offset, count, storedBounds, rawHex, cellOffsets }],
  cells: [{ regionIndex, index, offset, count, storedBounds, rawHex }],
  records: [{ offset, regionIndex, cellIndex, rawHex,
    latitudeRaw, longitudeRaw, latitude, longitude,
    rawBytes16To19, typeRaw, linkRaw }],
  diagnostics: [{ code, offset, message, targetOffset }],
  summary: { byteLength, regionCount, cellCount, populatedCellCount,
    recordCount, typeCounts, diagnosticCounts }
}
```

Here `bounds` uses `{ longitudeMin, latitudeMin, longitudeMax, latitudeMax }`, and `storedBounds` uses `{ latitudeMin, longitudeMin, latitudeMax, longitudeMax }`. Dimensions use `{ rows, columns }`; unknown header bytes remain opaque. Diagnostic `targetOffset` is omitted when irrelevant. Invalid decoded coordinate pairs have both latitude and longitude set to null. Nonfinite raw doubles are represented by strings `NaN`, `Infinity`, or `-Infinity`; `rawHex` retains their exact bit patterns. Valid raw doubles remain numbers. Hex strings are lowercase, contiguous, and fixed to their original byte lengths.

`ParseError extends Error` exposes `code`, `offset`, and `message`. Error codes: `INVALID_INPUT`, `TRUNCATED`, `UNSUPPORTED_GRID`, `INVALID_BOUNDS`, `INVALID_OFFSET`, `SPAN_MISMATCH`, and `COUNT_MISMATCH`. Warning codes: `INVALID_COORDINATE`, `CELL_MISMATCH`, `LINK_TARGET_MISSING`, and `LINK_TARGET_TYPE`. Unknown type values remain valid data.

---

### Task 1: Validated parser and synthetic fixtures

**Files:** Create package.json, src/parser.js, test/helpers/fixture.js, test/parser.test.js.

**Interfaces:** Produce `parseDatabase(Uint8Array)` and `ParseError`. The test helper exports `makeFixture(records = [])`, returning `{ bytes, recordOffsets, cellOffsets, regionOffsets }`. Input fixture records specify `regionIndex`, `cellIndex`, `latitudeRaw`, `longitudeRaw`, `rawBytes16To19`, `typeRaw`, and optional `linkTo` (input record index) or `linkRaw` (absolute raw word). Default coordinates are `3700, -700`, region 0, cell 21; default raw bytes are `[50, 0, 0, 1]`, type 1, link 0.

- [x] **Write fixture builder and parser tests.** Independently pack headers/tables/records with DataView setters, not production parser helpers. Use global bounds -8,36,31,70. Group records by region/cell, compute every span, assign record offsets, then resolve fixture `linkTo` values. Preserve input order for `recordOffsets`. Empty regions occupy 10 bytes; populated regions have 400 cells. Derive stored integer bounds by truncating fractional boundaries. Tests include:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDatabase, ParseError } from '../src/parser.js';
import { makeFixture } from './helpers/fixture.js';

test('empty database has nine regions and no cells', () => {
  const db = parseDatabase(makeFixture().bytes);
  assert.equal(db.summary.recordCount, 0);
  assert.equal(db.regions.length, 9);
  assert.equal(db.cells.length, 0);
});
test('honors a typed-array slice and never mutates it', () => {
  const { bytes } = makeFixture([{}]);
  const padded = new Uint8Array(bytes.length + 17).fill(255);
  padded.set(bytes, 7);
  const before = padded.slice();
  const db = parseDatabase(padded.subarray(7, 7 + bytes.length));
  assert.equal(db.records[0].latitude, 37);
  assert.equal(db.records[0].longitude, -7);
  assert.equal(db.records[0].rawHex.length, 56);
  assert.deepEqual(padded, before);
});
test('rejects pointer into regional table', () => {
  const { bytes } = makeFixture([{}]);
  new DataView(bytes.buffer).setUint32(36, 40, true);
  assert.throws(() => parseDatabase(bytes), e =>
    e instanceof ParseError && e.code === 'INVALID_OFFSET');
});
test('reports inferred link target type without dropping records', () => {
  const { bytes } = makeFixture([{ typeRaw: 964, linkTo: 1 }, {}]);
  const db = parseDatabase(bytes);
  assert.equal(db.records.length, 2);
  assert.equal(db.diagnostics[0].code, 'LINK_TARGET_TYPE');
});
```

Add cases for header and final-record truncation; duplicate/decreasing offsets; pointers into cell tables and beyond EOF; count 65535 against a short span; regional count disagreement; extra trailing byte; grid dimensions 0 and 65535; non-increasing or impossible geographic bounds; negative fractional longitude `-730` decoding to `-7.5`; exact global maximum `7000,3100` in region 8/cell 399; an interior longitude boundary `500` in region 1/cell 20 at latitude 37; invalid minute value `3760`; NaN and Infinity; misplaced but valid coordinates; nondefault bytes 16–19 and unknown type/header values; valid, missing, unexpected-type, and self-target candidate links. Missing links must warn without dereferencing. Assert error class/code rather than engine-specific messages.

- [x] **Run tests and confirm failure before implementation.** Command: `node --test test/parser.test.js`. Expect module-not-found for src/parser.js.

- [x] **Implement the parser and package metadata.** Package uses `"private": true`, `"type": "module"`, no dependencies, and `"scripts": { "test": "node --test test/*.test.js" }`. Provide JSDoc for public interfaces. Construct the view using the supplied slice:

```js
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
function requireSpan(offset, length) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length)
      || offset < 0 || length < 0 || offset > bytes.length - length) {
    throw new ParseError('TRUNCATED', offset, 'Read exceeds input bounds');
  }
}
function decodeCoordinate(value) {
  const degrees = Math.trunc(value / 100);
  return degrees + (value - degrees * 100) / 60;
}
```

Read/check the 36-byte header and 36-byte region table before traversing. Require first region offset 72; subsequent region offsets define exact spans, with EOF ending the final span. For empty regions require span 10. For populated regions require 1610 bytes before reading 400 cell offsets; first cell begins immediately after that table. Each next cell offset (or region end) defines the cell span, which must equal `10 + 28 * count`. Reject offsets before the preceding table/end before reading them. Sum cell counts and compare to the regional count. Retain all headers and index offsets in output.

Validate coordinate values before conversion; absolute remainder modulo 100 must be below 60. Check geographic range and global bounds before assigning expected region/cell. Calculate each axis' global cell index from `(coordinate - minimum) / (maximum - minimum) * 60`, with an explicit maximum-edge case returning 59. Region index is `floor(latIndex / 20) * 3 + floor(lonIndex / 20)`; cell index is `(latIndex % 20) * 20 + lonIndex % 20`. Emit a warning if it differs from the stored location. Do not round coordinates to hide disagreements.

Build `Map(record.offset -> record)` once. For each nonzero raw link on type 964, look up the target and emit the missing/type warning when applicable. Do not recursively traverse. Populate counts from parsed arrays and diagnostics. Return plain objects and arrays; retain no mutable input views.

- [x] **Run parser tests, resolve failures, and commit this deliverable.** Use `node --test test/parser.test.js` and `git diff --check`; stage only Task 1 files. Commit message: `feat: parse and validate MiVue speedcam databases`.

### Task 2: Loss-aware JSON and GeoJSON serializers

**Files:** Create src/export.js and test/export.test.js.

**Interfaces:** Consume the Task 1 result. Export `serializeJson(database): string`, `toGeoJson(database): object`, and `serializeGeoJson(database): string`.

- [x] **Write serializer tests.** Use synthetic parser results, including a fixture with NaN and unknown bytes. Verify:

```js
const db = parseDatabase(makeFixture([{}]).bytes);
assert.deepEqual(JSON.parse(serializeJson(db)), db);
const geo = JSON.parse(serializeGeoJson(db));
assert.equal(geo.type, 'FeatureCollection');
assert.deepEqual(geo.features[0].geometry.coordinates, [-7, 37]);
assert.equal(geo.features[0].properties.rawHex, db.records[0].rawHex);
assert.equal(geo.schemaVersion, 1);
const invalid = parseDatabase(makeFixture([{ latitudeRaw: NaN }]).bytes);
assert.equal(toGeoJson(invalid).features[0].geometry, null);
assert.equal(JSON.parse(serializeJson(invalid)).records[0].latitudeRaw, 'NaN');
```

Import helpers and functions explicitly in test/export.test.js. Also verify empty exports, intact diagnostics, preserved source offsets/link words, absent line geometries, and unchanged input objects after serializing. Use `structuredClone(db)` for the before/after assertion.

- [x] **Run the new test and confirm module-not-found.** Command: `node --test test/export.test.js`.

- [x] **Implement serializers.** JSON uses `JSON.stringify(database, null, 2)` plus a newline. GeoJSON maps each record to a Feature with `id: record.offset`, properties copied from the full record, and a Point only when both decoded coordinates are finite. Carry header, summary, diagnostics, and schemaVersion as collection members. Do not infer lines or official type labels.

```js
const geometry = Number.isFinite(record.latitude)
  && Number.isFinite(record.longitude)
  ? { type: 'Point', coordinates: [record.longitude, record.latitude] }
  : null;
```

- [x] **Run both test files and commit.** Command: `node --test test/parser.test.js test/export.test.js`; commit message: `feat: export parsed records as JSON and GeoJSON`.

### Task 3: CLI, local-sample verification, and usage documentation

**Files:** Create bin/mivue-trafficcam.js, test/cli.test.js, test/sample.test.js. Modify README.md and .gitignore.

**Interfaces:** CLI forms are `node bin/mivue-trafficcam.js inspect <file>` and `node bin/mivue-trafficcam.js export <file> --format json|geojson`. Accept `--help` alone with exit 0; reject unknown commands/options, extra arguments, missing path/format, and unsupported formats with exit 2 before reading input.

- [x] **Write CLI tests.** Use `mkdtemp` under the OS temp directory and synthetic fixtures, with cleanup registered through the test context. Invoke the CLI through `spawnSync(process.execPath, args, { encoding: 'utf8' })`:

```js
const run = (...args) => spawnSync(process.execPath,
  ['bin/mivue-trafficcam.js', ...args], { encoding: 'utf8' });
assert.equal(run('--help').status, 0);
assert.equal(run('export', fixturePath, '--format', 'csv').status, 2);
const result = run('export', fixturePath, '--format', 'json');
assert.equal(result.status, 0);
assert.equal(JSON.parse(result.stdout).summary.recordCount, 1);
assert.equal(result.stderr, '');
```

Cover inspect summary, GeoJSON export, warning-bearing success with parseable stdout and warnings on stderr, nonexistent path, malformed file, filename containing spaces, and preservation of fixture bytes. For output-error behavior, start export with stdout piped, destroy the parent's reading end, and assert a controlled nonzero exit without an unhandled-error stack; use a sufficiently large synthetic fixture to force more than one pipe buffer of output.

- [x] **Run CLI tests to demonstrate failure.** Command: `node --test test/cli.test.js`.

- [x] **Implement CLI argument handling and stream behavior.** Read the input only after syntax validation, call parseDatabase once, print diagnostics to stderr, and emit the requested summary/export to stdout. Summary names type/link meanings as tentative. Use `process.exitCode` to avoid truncating buffered output. Handle stdout errors, including EPIPE, with exit 1 and a concise stderr message. Catch ParseError and filesystem errors without a stack trace. No writes to the input, no network operations, no implicit output files.

- [x] **Add optional sample integration checks.** Skip explicitly if the sample is absent. When present, require its documented SHA-256 so a replacement sample produces a clear mismatch rather than misleading counts. Hash the file again after parsing and exports. Assert nine regions, 2,800 cells, 898 populated cells, 52,935 records, zero coordinate warnings, 11 missing-link warnings, and two unexpected-type warnings. Assert the exact 13 source/target pairs from docs/binary-format.md. Verify JSON/GeoJSON contain 52,935 records/features. Keep the sample and derived exports out of version control.

```js
assert.equal(db.summary.recordCount, 52935);
assert.equal(db.summary.populatedCellCount, 898);
assert.equal(db.diagnostics.filter(d => d.code === 'LINK_TARGET_MISSING').length, 11);
assert.equal(db.diagnostics.filter(d => d.code === 'LINK_TARGET_TYPE').length, 2);
assert.equal(hashAfter, hashBefore);
```

- [x] **Update README and ignores.** Explain that only the observed format is supported; warn that guessed type/speed/direction meanings are not confirmed. Document Node execution, the three commands below, warnings versus structural errors, tests without the sample, and the local-only export convention. Ignore `/exports/`, `node_modules/`, and logs. Preserve the existing sample ignore and own-risk warning.

```sh
node bin/mivue-trafficcam.js inspect Speedcam_Data_FEU.bin
node bin/mivue-trafficcam.js export Speedcam_Data_FEU.bin --format json
node bin/mivue-trafficcam.js export Speedcam_Data_FEU.bin --format geojson
```

- [x] **Verify and review the delivered component.** Run `npm test`, then run the synthetic suite explicitly with `node --test test/parser.test.js test/export.test.js test/cli.test.js`. Run the inspect command against the sample; compare the hash before/after. Inspect parser/export imports for Node APIs and review all five Review Focus cases. Run `git diff --check` and ensure no binary or derived export is staged. Commit message: `feat: add read-only CLI and sample verification`. Do not push or publish automatically as part of this increment.

## Plan self-review

The three tasks cover the approved spec's parser, raw preservation, structural checks, coordinate warnings, candidate links, exports, CLI behavior, synthetic tests, optional sample checks, and README changes. Data property names and interfaces are shared above and used consistently. The five additional review concerns have explicit checks in their owning tasks.

Recommended execution: native, in this session, because these three tasks depend on one shared parsed-data contract. Follow the executing-plans skill after the user reviews this plan and chooses the execution method.

## Execution record — 2026-09-20

All three tasks were implemented in-session on `feat/read-only-parser`. Parser, export, and CLI tests were each observed failing before implementation. The final suite passes 40 tests, including the full sample and its 13 expected link warnings. A separate sample-free checkout passed its synthetic tests and explicitly skipped the optional sample test. Core modules also ran in an isolated JavaScript VM without Node globals or imports.

Independent review found one boundary-classification defect: normalized floating-point arithmetic could floor an exact boundary into the preceding cell. A failing regression test reproduced it; direct boundary comparisons fixed it, preserving nearby coordinates without rounding. The full suite passed after the fix. No other substantive findings or deferred minors were reported.

Execution decisions: use a feature branch in the existing checkout, preserving the in-session research (no worktree isolation from simultaneous edits); use binary-search boundary comparisons instead of the planned normalization formula, which could generate false cell warnings. Source sample and derived exports were not committed. No push or merge was performed.
