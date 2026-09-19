# Editable Projects and Binary Encoder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save/reopen editable projects and reconstruct or rebuild supported MiVue databases, preserving raw data and surfacing unresolved references.

**Architecture:** A browser-compatible project module retains a binary baseline and stable record identities. A separate encoder reconstructs bytes from parsed nodes and applies validated edits with deterministic layout and link handling. The existing Node CLI exposes project creation, editing, and binary output; the future Polish-language UI will consume the same functions.

**Tech Stack:** Existing JavaScript ES modules, DataView, Web Crypto SHA-256, Node built-in tests; no third-party dependencies.

**Spec:** [Approved roadmap](../../roadmap.md), particularly “Shared project model”, “Binary builds and unresolved references”, and increment 1. Format evidence is in [binary-format.md](../../binary-format.md).

## Global Constraints

- Use stable record IDs independent of file offsets.
- Separate editable fields from the original raw bytes so unknown bits survive edits.
- Binary offsets are assigned only during encoding.
- Require exact byte equality on the untouched sample, including its 13 anomalous candidate links.
- Do not silently delete, repair, or reinterpret records.
- Keep codec/model modules browser-compatible.
- Binary structural validity does not prove that the 955W accepts the file or interprets it correctly.
- Map UI, source connectors, and deployment follow in later roadmap increments; preserve the existing CLI commands and 40-test baseline.

## Review Focus

1. JSON tampering and inconsistent duplicated fields: validate against the embedded baseline instead of trusting caller-provided offsets (Task 1).
2. Unchanged floating-point values and unknown bits: rebuild from raw bytes, not from formatted decimal coordinates (Task 2).
3. Deletes, clones, and relocations: stable link targets must survive offset changes; dangling or unresolved links must never be silently repaired (Task 2).
4. Count overflow, coordinate boundaries, and metadata with unknown semantics: validate before allocating or emitting bytes (Task 2).
5. Existing output files, aliases of the input, and partial output: CLI must not truncate existing files, including symlinks and hard links (Task 3).

## Files and interfaces

- Create `src/project.js`: project creation/load/save/validation and immutable edit operations.
- Create `src/encoder.js`: raw reconstruction, layout planning, diagnostics, build verification.
- Create `src/spatial.js`: shared coordinate encoding/decoding and cell membership; extract existing parser boundary logic without changing behavior.
- Modify `src/parser.js` only to consume shared spatial helpers.
- Modify `bin/mivue-trafficcam.js` to add commands; keep existing inspect/export behavior.
- Create `test/project.test.js`, `test/encoder.test.js`; extend `test/cli.test.js` and `test/sample.test.js`.
- Update README, binary research notes, and ignore `/projects/` for local project files.

Project JSON schema:

```js
{
  projectVersion: 1,
  targetDevice: 'MiVue 955W',
  source: { name: 'Speedcam_Data_FEU.bin', sha256: '...', bytesHex: '...' },
  records: [
    { id: 'source:2032', sourceOffset: 2032, templateId: null,
      edits: {}, deleted: false, provenance: [] }
  ],
  nextId: 1
}
```

Original nodes, record bytes, and unresolved references are recoverable by parsing the immutable embedded baseline. Do not duplicate them as independently editable truth. Original IDs are `source:<offset>`; new IDs are monotonic `new:<n>`. Clones reference an original template ID; sourceOffset is null. Provenance is JSON metadata, excluded from the binary. Persist it without interpreting strings as HTML or code.

Public functions:

```js
// src/project.js — crypto uses globalThis.crypto.subtle, never Node imports.
async function createProject(bytes, { name = '' } = {}) {}
async function loadProject(jsonText) {} // hash, schema, baseline, references checked
async function serializeProject(project) {} // validate, then JSON + newline
function applyEdit(project, operation) {} // returns new project; input unchanged
// operations: update, delete, restore, clone, resolve-link
// update: { kind:'update', id, changes:{ latitude, longitude, rawBytes16To19 } }
// clone: { kind:'clone', templateId, latitude, longitude }
// resolve-link: { kind:'resolve-link', id, targetId, reason }
// delete/restore: { kind, id }

// src/encoder.js
function reconstructDatabase(parsed) {} // Uint8Array; exact parsed layout
async function buildProject(project) {} // { bytes, report }, or BuildError
// BuildError: code, message, issues:[{ code, recordId?, message }]
```

Expose raw byte edits as raw research values, not confirmed speed/heading units. Clone only a non-link original record (raw type 1, 3, or 5 with linkRaw 0), preserving its unknown bytes as a documented template; do not claim new device profiles. New OPP creation is outside this increment. Resolve-link accepts only source type 964 and target type 9128; retain the explicit reason in edits. A deleted target remains an error until restored or explicitly redirected.

## Task 1: Versioned editable project model

- [x] Write tests in `test/project.test.js` using `makeFixture`. The tests import the proposed module and cover stable IDs, save/load, hash mismatch, invalid JSON/version/hex, missing or duplicate original records, duplicate/new IDs, invalid counters, invalid templates, invalid edits, missing source/target references, and input immutability. Include clone/delete/restore and persisted provenance. Representative acceptance assertions:

```js
const bytes = makeFixture([{}]).bytes;
const project = await createProject(bytes, { name: 'example.bin' });
assert.deepEqual(await loadProject(await serializeProject(project)), project);
const before = structuredClone(project);
const edited = applyEdit(project, {
  kind: 'update', id: project.records[0].id, changes: { latitude: 37.1 }
});
assert.equal(edited.records[0].edits.latitude, 37.1);
assert.deepEqual(project, before);
await assert.rejects(loadProject(JSON.stringify({ ...project, projectVersion: 99 })));
```

- [x] Run `node --test test/project.test.js`; observe failure for missing project module.
- [x] Implement schema validation before allocations and iteration. Require an even-length lowercase/uppercase hex string with only hexadecimal digits, 64 hexadecimal SHA characters, integer counters, finite edit coordinates in geographic limits, exactly four integer bytes in 0–255, and the documented operation fields. Reject unknown operation/change keys. Every original baseline record must have exactly one matching source ID/offset; deleted entries stay present. Clones must name a valid original template and have a unique new ID below nextId. Validate links against active records at build time so deletion can remain an editable draft. Verify source fingerprint with `crypto.subtle.digest('SHA-256', bytes)` and parse the baseline. Do not use saved offsets to index unvalidated byte arrays.
- [x] Implement immutable edits by copying affected objects/arrays; source baseline cannot be edited through operations. On load, validate structural invariants against a freshly parsed baseline. Keep schema validation separate from build eligibility, so unresolved drafts can save/reopen.
- [x] Run `node --test test/project.test.js` and `npm test`, then `git diff --check`. Commit project module and tests after passing.

## Task 2: Reconstruction, edits, layout and link verification

- [x] Write `test/encoder.test.js`. First require exact equality for empty and populated synthetic databases, including nonfinite raw coordinates and nondefault raw metadata. Extend the optional sample test to reconstruct from `parseDatabase(bytes)` and compare every byte, not only record counts. Reconstruction must not have access to the original whole-file buffer:

```js
const parsed = parseDatabase(makeFixture([{}]).bytes);
const rebuilt = reconstructDatabase(structuredClone(parsed));
assert.deepEqual(rebuilt, makeFixture([{}]).bytes);
const project = await createProject(makeFixture([{}]).bytes);
const result = await buildProject(applyEdit(project, {
  kind: 'update', id: project.records[0].id,
  changes: { rawBytes16To19: [70, 0, 0, 1] }
}));
assert.equal(parseDatabase(result.bytes).records[0].rawBytes16To19[0], 70);
```

Add explicit cases for same-cell coordinate edit, crossing cells, negative coordinates, exact boundaries and neighboring values, clone/delete/restore, target relocation, deleted targets, explicit redirection, unknown link words, unresolved references under unchanged and changed layout, count overflow, and unknown header/layout dependency. Preserve source bytes and project objects. A no-op edit must not re-encode unchanged double values. Ensure different edit history yielding the same active records yields deterministic bytes.

- [x] Run `node --test test/encoder.test.js`; observe missing-module failure.
- [x] Implement `reconstructDatabase`: allocate the length derived from nodes/records, write header rawHex, region table, node rawHex, cell tables, and record rawHex into validated non-overlapping spans. Require complete coverage and reparse output. Validate contradictory parsed raw/count/offset data rather than letting last-write-win hide overlap. The baseline is reconstructed by this function; returning embedded bytes is not the round-trip implementation.
- [x] Extract shared spatial functions and test both parser and encoder. Coordinate encoding is `trunc(decimal) * 100 + (decimal - trunc(decimal)) * 60`; handle minute carry caused by binary64 arithmetic, and verify decoded result within 1e-10 degrees of requested input. Compute cell membership from the encoded-and-decoded coordinate, with direct fractional boundary comparisons. Preserve unchanged raw coordinate bytes exactly.
- [x] Build active records from templates, applying only explicit changed fields. Group by region/cell, retaining baseline order and then new-ID order inside each cell. Compute node/table spans and count sums before allocation. Reject cell/region counts above 65535, offsets/file lengths beyond uint32, invalid or outside-global-bound edits, and unusable coordinates when regrouping. Preserve existing stored bounds for unchanged nodes; derive truncated bounds for newly populated nodes. Recompute every understood index and count.
- [x] Resolve understood links using original type 964→9128 relationships and stable IDs, then write each new target offset. Treat all other nonzero link words as opaque. If any address space changes, require explicit resolution for every opaque/unresolved reference; no force flag or guessed target. Unchanged layout can preserve unresolved bytes, but cannot delete or alter the raw type of a referenced record. A build report includes unresolved warnings, changed record IDs, and whether layout changed.
- [x] Preserve unknown header bytes. Investigate header offset 20 before enabling a layout change that would move the first populated region. Until additional evidence establishes its semantics, reject such builds with `UNKNOWN_HEADER_DEPENDENCY`; never guess that 82 is a pointer. Permit other layout changes only under the documented experimental layout model; the report explicitly states that device acceptance is untested. Byte-preserving rebuilds remain supported regardless of this header value.
- [x] Reparse every build and check intended counts, coordinates, raw fields and relocated targets. Permit only pre-existing warnings whose associated bytes/addresses remain unchanged; reject newly introduced structural or coordinate problems. Store no generated data in source control. Run `npm test`, exact sample byte comparison, and `git diff --check`, then commit.

## Task 3: CLI editing/build workflow and documentation

- [x] Extend CLI tests for these command forms:

```sh
node bin/mivue-trafficcam.js project input.bin --output projects/example.json
node bin/mivue-trafficcam.js edit projects/example.json --patch changes.json --output projects/edited.json
node bin/mivue-trafficcam.js build projects/edited.json --output exports/Speedcam_Data_FEU.bin
```

The patch file is a JSON array of the operations defined above, applied in order. Parent output directories must exist. Test project→patch→build with synthetic fixtures and verify input preservation; invalid command arguments; malformed project/patch; unresolved-link build failure; output path collisions, same path, symlink, hard link, and missing parent. Failures must not create a successful-looking output file.
- [x] Run `node --test test/cli.test.js` and observe the new command assertions fail before implementation.
- [x] Implement argument parsing using the existing strict CLI style. Validate and compute the full result before opening output. Create output with exclusive `wx` semantics; refuse to overwrite any existing file (including input aliases). On a write failure, close and remove only the new output created by that command. Print paths and build reports to stdout, warnings/errors to stderr. Keep exit 0/1/2 conventions. Add no shell execution, implicit network access, or source mutations.
- [x] Update README with a complete example patch, project directories, build limitations, and the difference between unchanged round-trip and edited experimental output. Keep Polish UI as the approved next-stage direction. Update research notes with evidence from encoder tests without claiming device success. Ignore `/projects/` as well as existing `/exports/`.
- [x] Run `npm test`, run the synthetic suite without the local sample, and test core modules in a browser-like environment without Node imports. Hash the sample before/after. Review staged files to exclude input/project/export data. Commit when tests pass; do not merge, push, or deploy as part of implementation.

## Self-review and execution

Each approved increment-1 requirement maps to project validation (Task 1), reconstruction/editing/link handling (Task 2), or the CLI workflow (Task 3). UI, general source ingestion, and new OPP profile mapping remain later roadmap work, not missing parts of this codec increment. Public names are shared across tasks. All five Review Focus cases have explicit tests above.

The user approved this plan and native/in-session execution. All three tasks are implemented on `feat/project-encoder`.

## Execution record — 2026-09-20

Project validation, encoder reconstruction/builds, and new CLI command tests were each observed failing before implementation and passing afterward. The full suite passes 59 tests, including exact reconstruction and unchanged project build of the local 52,935-record sample. A separate checkout without the sample passes 58 tests and explicitly skips the optional sample check. Project create/edit/save/load/build also runs with Node's `process` and `Buffer` globals unavailable. The source file SHA-256 remains unchanged.

The user additionally supplied a firmware/guide URL and an official speed-camera database URL. The links are retained in `src/sources.js` and the official database has a validated browser-compatible fetch function. Download metadata currently permits cross-origin requests; downloaded bytes match the original sample. Static firmware inspection found a bundled 22×22 variant and disproved the first-populated-region interpretation of header offset 20; details and hashes are in `docs/firmware-research.md`. Production format scope remains the approved 20×20, with unverified header dependencies conservatively blocked.

Independent review found no actionable defects. A follow-up fault-injection test performs a real partial output write and then raises EIO; it verifies cleanup and unchanged source bytes, bringing the suite to 60 tests. This covers handled I/O failures, not uncatchable process termination. Device acceptance, unknown format semantics, and real-browser CORS remain distinct validation steps; response headers and a Node-free-global smoke test are the evidence collected here, not a claim of browser/device certification.

No production data or firmware is committed; no merge, push, or deployment was performed. The map/editor UI and later roadmap stages remain outstanding.
