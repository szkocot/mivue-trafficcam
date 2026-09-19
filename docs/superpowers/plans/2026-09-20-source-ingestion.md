# Automatic Source Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import camera/OPP observations automatically, protect manual edits, and display attributed metadata without guessing MiVue encoding.

**Architecture:** Pure adapters normalize external data; a pure reconciler builds one validated project transaction. The existing worker owns commit/history and the browser presents source configuration, reference layers, metadata and results. Browser location has its own companion plan and no ingestion dependency.

**Tech Stack:** Existing JavaScript ES modules, Node test runner, Leaflet canvas rendering, IndexedDB, Playwright; no framework or server dependency.

**Spec:** `docs/superpowers/specs/2026-09-20-source-ingestion-design.md`

## Global Constraints

- Preserve original BIN bytes and SHA; target remains MiVue 955W with unverified physical-device compatibility.
- Manual edits and deletions win; latitude/longitude form one ownership group.
- Proximity alone must not identify two cameras as the same device.
- Bound inputs to 20 MiB and 100,000 features, 1,000 vertices per section, 256 characters per ID/namespace and 64 KiB of metadata per feature.
- Missing imported values do not clear existing values.
- Same-content imports are no-ops: no duplicate records, provenance entries, history steps or autosave writes solely due to a newer retrieval timestamp.
- Speed/heading metadata is not encoded into undocumented bytes. New OPP pairs are unsupported.
- User chooses a supported original template per source/kind before automatic binary additions; only active point observations qualify.
- PL/EN parity, original source attribution, bounded DOM rendering and existing save/recovery safeguards remain mandatory.
- Update README after every task; commit task code, tests and documentation together. No sample or third-party dataset commits.
- No automatic deployment, public proxy, country filtering or background source refresh in this plan.

## Review Focus

- Source IDs such as `__proto__` or IDs containing separators must not corrupt state or collide: pin in Task 1 and Task 2.
- Two nearby new records in a differently ordered batch must produce identical held outcomes: pin in Task 3.
- A manual edit returning a field to its baseline value must still resist import: pin in Task 2 and Task 3.
- An unchanged batch after changing a template policy must be reconsidered rather than incorrectly skipped: pin in Task 3.
- A project switch or draft edit while a source request runs must not receive stale changes: pin in Task 5 and Task 7.

## File responsibilities and shared contracts

Create `src/import-normalize.js` for validation/canonicalization, `src/import-csv.js` and `src/import-geojson.js` for parsing, `src/ingestion-state.js` for v2 state validation, `src/reconcile.js` for matching/transactions, `src/import-view.js` for reference projections/exports, and `src/source-metadata.js` for display values. Create `web/import-dialog.js`, `web/import-sources.js`, `web/import-results.js`, and `web/metadata-options.js` for focused UI responsibilities. Only add `src/import-canard.js` if Task 4 passes its access gate.

Existing `src/project.js`, `src/history.js`, `src/project-view.js`, `web/worker-session.js` and `web/app.js` retain their respective project, history, projection, session and orchestration roles. Extend their interfaces; avoid unrelated rewrites. Add every new browser dependency to `scripts/build-web.mjs`'s explicit allowlist.

Normalized batch:

```js
// Data only; arrays avoid object-key identity collisions.
const batch = {
  source: { namespace:'example', attribution:'Example owner', url:null },
  retrievedAt:'2026-09-20T12:00:00.000Z',
  observations:[{
    sourceId:'a', kind:'camera', status:'active',
    geometry:{type:'Point',coordinates:[19,52]},
    name:null, speedKmh:50, originalSpeed:{value:50,unit:'km/h'},
    direction:null, url:null, originalProperties:{speed:50}
  }]
};
```

Project v2 adds `ingestion:{sources:[],observations:[],bindings:[],ownership:[],policies:[]}`. Sources use namespace as identity. Stored observations add namespace and retrievedAt; bindings are `{namespace,sourceId,recordId}`; ownership entries are `{recordId,coordinates:'manual'|{namespace,sourceId}}`; policies are `{namespace,kind,templateId}`. Record `deleted` is always authoritative for import suppression. Original bytes, record IDs, nextId and existing edits retain their current structure. Compare canonical content, excluding retrievedAt, at observation level; do not use a digest alone to decide whether policies changed.

Summary contract: `{added,updated,unchanged,protected,referenceOnly,ambiguous,items}` with numeric counters and `items:[{namespace,sourceId,recordId:null|string,codes:string[]}]`. Updated/protected counters may overlap and UI must say so. `ImportError` exposes `code` and `issues:[{index,field,code}]`; diagnostics are translated by code.

## Task 1: Strict local adapters

**Files:** Create `src/import-normalize.js`, `src/import-csv.js`, `src/import-geojson.js`, `test/import-adapters.test.js`, `test/helpers/import-fixture.js`; update README.

**Interfaces:** `parseCsv(text,source,retrievedAt)` and `parseGeoJson(text,source,retrievedAt)` synchronously return a normalized batch or throw ImportError. `normalizeBatch(batch)` returns canonical validated data. `makeImportBatch(overrides={})` in the test helper returns the example above with structured-cloned overrides.

- [ ] Write adapter tests, including the following anchor, plus quoted multiline CSV, escaped quotes, BOM/CRLF, duplicate/missing headers and IDs, nulls, invalid coordinates, mph, missing speed units, nonfinite/negative speeds, unknown enum values, invalid geometry, limits and malicious object keys. Normalize IDs to nonempty strings without silently trimming identity; reject conflicting GeoJSON Feature.id/properties.id. Permit extra CSV columns as original metadata.

```js
const source={namespace:'example',attribution:'Example owner',url:null};
const parsed=parseCsv('id,latitude,longitude,kind,status,speed,speed_unit\na,52,19,camera,active,50,km/h',source,'2026-09-20T12:00:00.000Z');
assert.equal(parsed.observations[0].speedKmh,50);
assert.deepEqual(parsed.observations[0].geometry.coordinates,[19,52]);
assert.throws(()=>parseCsv('id,latitude,longitude,kind\na,52,19,camera\na,53,20,camera',source,'2026-09-20T12:00:00.000Z'));
```

- [ ] Run `node --test test/import-adapters.test.js`; confirm failures concern missing/new behavior.
- [ ] Implement CSV parsing as a quoted/unquoted state machine, not split(','); GeoJSON parsing via JSON.parse plus strict feature validation. Validate byte size before parsing and counts/vertices/metadata before retention. Permit only finite speed >=0, explicit km/h or mph; conversion is `mph * 1.609344`. Reject conflicting IDs, malformed quoting, and the entire invalid batch; never partially import.

```js
const identity = (namespace,sourceId) => JSON.stringify([namespace,sourceId]);
const byteLength = value => new TextEncoder().encode(value).byteLength;
// Use Map keyed by identity for uniqueness; never concatenate with a delimiter.
```

- [ ] Run the adapter file and `npm test`; update README with the exact supported local schema and limitations; commit `feat: normalize local camera imports`.

## Task 2: Versioned project state and atomic history

**Files:** Create `src/ingestion-state.js`, `test/ingestion-state.test.js`; modify `src/project.js`, `src/history.js`, `src/encoder.js`, `src/project-view.js`, existing project/history/encoder/CLI tests, README.

**Interfaces:** Export `upgradeProject(project)` (pure v1->v2), `validateIngestionState(project)` (structural validation), and `isProjectModified(project)` from ingestion-state. `loadProject` accepts v1 and returns v2; `createProject` creates v2. Keep `validateProject` accepting valid v1 input for programmatic backward compatibility. Add `history.commit(nextProject)` for a structurally validated v2 candidate, sharing immutable source data and making one revision; it must skip identity no-ops. Existing apply/undo/redo/reset remain available.

- [ ] Write migration/validation and ownership tests using independent existing fixtures. Test unsupported versions, duplicate identities, bad bindings/policies, forged ownership, v1 deleted/edited records, unchanged BIN builds, metadata-only dirty state and clone deletion/reopen.

```js
const p=await createProject(makeFixture([{}]).bytes);
const edited=applyEdit(p,{kind:'update',id:p.records[0].id,changes:{latitude:37,longitude:-7}});
assert.equal(edited.ingestion.ownership.find(o=>o.recordId===p.records[0].id).coordinates,'manual');
const reopened=await loadProject(await serializeProject(edited));
assert.deepEqual(reopened.ingestion,edited.ingestion);
const h=createHistory(p);h.commit(edited);h.undo();assert.deepEqual(h.current,p);
```

- [ ] Run `node --test test/ingestion-state.test.js test/project.test.js test/history.test.js`; record RED.
- [ ] Implement strict v2 state/reference validation. Upgrade v1 edits to manual ownership, even edits equal to baseline. Public coordinate edits mark the coordinate group manual; internal import transactions set source ownership explicitly. Validate eligible original templates via parsed originals. Make commit validate once structurally and require unchanged embedded source; keep asynchronous hash validation on load/serialization. Reset creates a fresh v2 baseline with empty ingestion state. Extend encoder validation without altering record-byte semantics.

```js
// Preserve source object sharing; never mutate project.ingestion arrays in place.
const emptyIngestion = () => ({sources:[],observations:[],bindings:[],ownership:[],policies:[]});
// Dirty includes ingestion state and manual ownership, not only changed bytes.
```

- [ ] Run focused tests and `npm test`; update schema documentation in `docs/browser-editor.md` and README; commit `feat: persist import identity and manual ownership`.

## Task 3: Deterministic reconciliation and safe binary additions

**Files:** Create `src/reconcile.js`, `test/reconcile.test.js`; modify `src/project.js` to expose a validated batch transaction `applyImportTransaction(project,transaction)`, tests and README.

**Interfaces:** `reconcile(project,batch)` asynchronously returns `{project,summary}`. `setImportPolicy(project,{namespace,kind,templateId})` returns a validated immutable project. `resolveImport(project,{namespace,sourceId,action,recordId})` supports `bind`, `reference`, `add-distinct`; add-distinct uses the configured template, recordId is required only for bind. Transaction internals are not accepted as unvalidated JSON operations from the UI.

- [ ] Write tests for the full spec merge matrix. Use active points far from the fixture for additions; same IDs moved for updates; nearby new points reversed in input order; protected/deleted records; source omission; planned/unknown status; coordinate pair protection; policy changes followed by identical content; held observations reconsidered after template setup; explicit bind/reference/distinct actions; no-op retrieval time; conflicting sources; sections never encoded.

```js
let p=await createProject(makeFixture([{}]).bytes);
p=setImportPolicy(p,{namespace:'example',kind:'camera',templateId:p.records[0].id});
const a=await reconcile(p,makeImportBatch());
assert.equal(a.summary.added,1);
const b=await reconcile(a.project,makeImportBatch({retrievedAt:'2026-09-20T13:00:00.000Z'}));
assert.strictEqual(b.project,a.project);
assert.equal(b.summary.added,0);
```

- [ ] Run `node --test test/reconcile.test.js`; verify RED before implementing reconciliation.
- [ ] Index identity by JSON tuple and positions in geographic spatial bins; use great-circle distance for the exact <=100m candidate test, including longitude wrap and polar bins. Compare each new point against baseline, held observations and other batch identities without treating its own identity as a duplicate. Sort stable identities before assigning new IDs. Retain reference-only reason codes and explicit reference decisions in observation state (add strict `disposition:'auto'|'reference'` and `codes:string[]` fields). Add eligible clones in one transaction rather than calling full-project applyEdit per row.

```js
// Coordinate source updates are permitted only for the owning source.
const sameIdentity=(a,b)=>a.namespace===b.namespace&&a.sourceId===b.sourceId;
// A manual owner or a deleted record prevents import coordinate writes.
// Candidate source data still updates in ingestion.observations.
```

- [ ] Verify template raw bytes/type are copied unchanged, source metadata cannot write bytes, build blockers still apply and successful synthetic clones reparse at the intended coordinates. Run `node --test test/reconcile.test.js test/encoder.test.js` and `npm test`; README update; commit `feat: merge source observations without overwriting manual edits`.

## Task 4: CANARD feasibility gate and source registry

**Files:** Create `docs/source-access.md`, `web/import-sources.js`, `test/import-sources.test.js`; conditionally create `src/import-canard.js`, `test/import-canard.test.js`; update README and roadmap.

**Interfaces:** `listImportSources()` returns `{id,labelKey,available,reasonCode,attribution,url}[]`. `fetchImportSource(id,{signal})` returns a normalized batch for supported enabled sources; unavailable entries reject with `SOURCE_UNAVAILABLE`. No credentials or arbitrary proxy URL configuration.

- [ ] Inspect only public CANARD map scripts/endpoints and published reuse information. Record exact endpoint/schema/IDs, conditions and CORS evidence, date, and whether source status/speed are actually supplied. Do not assume a successful curl proves browser access. If evidence is insufficient, document a disabled CANARD entry and continue the local-import deliverable.
- [ ] Write registry tests asserting local formats remain usable with CANARD unavailable and abort/fetch failures never yield a partial batch. If enabled, add a tiny synthetic response fixture and parsing test using observed field names; do not invent an API contract before inspection.

```js
const source=listImportSources().find(s=>s.id==='canard');
assert.equal(typeof source.available,'boolean');
if(!source.available) {
  assert.ok(source.reasonCode);
  await assert.rejects(fetchImportSource('canard',{signal:new AbortController().signal}),{code:'SOURCE_UNAVAILABLE'});
}
```

- [ ] Run `node --test test/import-sources.test.js`; confirm RED for the registry interface. Implement the registry and only the evidenced connector. A disabled connector is a reported partial scope outcome, never described as completed CANARD ingestion.
- [ ] Run registry tests and `npm test`; document evidence and exact unavailable reason in README/roadmap; commit `feat: expose verified import source availability`.

## Task 5: Worker imports, persistence and reference projections

**Files:** Create `src/import-view.js`, `test/import-view.test.js`; modify `web/worker-session.js`, `web/worker-client.js`, `src/project-view.js`, `src/history.js`, `test/worker-session.test.js`, build allowlist and README.

**Interfaces:** `referenceView(project)` returns observation views with collision-free `id:'import:'+JSON.stringify([namespace,sourceId])`, binding/encoding status, geometry and metadata; `exportReferences(project)` returns attributed GeoJSON text including encoded:false for unbound observations. Worker adds `import`, `import-policy`, `import-resolve`, `export-references`. Import payload contains normalized batch and `expectedRevision`; return `{snapshot,summary}`. Policy and resolution payloads contain the operations from Task 3 and expectedRevision. Snapshot adds `references` and uses isProjectModified.

- [ ] Extend worker tests for import one-revision commit, no-op no revision, undo/redo all state, stale revision/session rejection, metadata-only snapshots, failed transaction rollback, project reopen and reference export without position leakage from unrelated UI state.

```js
const opened=await session.handle({kind:'open-bin',sessionId:'a',requestId:1,payload:{bytes:makeFixture([{}]).bytes}});
const imported=await session.handle({kind:'import',sessionId:'a',requestId:2,payload:{batch:makeImportBatch(),expectedRevision:opened.result.revision}});
assert.equal(imported.ok,true);
assert.equal(imported.result.snapshot.references.length,1);
assert.equal(imported.result.snapshot.modified,true);
```

- [ ] Run `node --test test/worker-session.test.js test/import-view.test.js`; confirm RED.
- [ ] Validate incoming batch again inside worker, compare revision before reconcile/commit, commit once and invalidate cached snapshot/build. Stale requests return `STALE_IMPORT` without changes. UI fetch cancellation does not mutate history. Preserve existing queue and session guarantees. Include bound source metadata in encoded-record projection without duplicate markers; reference export is a separate action, not a changed meaning for existing exports.

```js
if(payload.expectedRevision!==history.revision)
  throw Object.assign(new Error('Import revision changed'),{code:'STALE_IMPORT'});
const result=await reconcile(history.current,normalizeBatch(payload.batch));
history.commit(result.project);
```

- [ ] Run focused tests, `npm test` and `npm run build:web`; update README; commit `feat: apply imports through revision-safe worker history`.

## Task 6: Bilingual import UI and metadata options

**Files:** Create `web/import-dialog.js`, `web/import-results.js`, `web/metadata-options.js`, `src/source-metadata.js`, `test/source-metadata.test.js`, `test/browser/imports.spec.js`; modify app/map/details/record-list/index/styles/locales/export-dialog, build allowlist, README and `docs/browser-editor.md`.

**Interfaces:** `createImportDialog({onImport,onPolicy,onCancel,t})` returns `{open,sync,destroy}`; onImport receives batch, onPolicy receives Task 3 policy. `renderImportResults(element,summary,{t,onResolve})` shows translated reasons. `metadataRows(reference,t)` returns safe label/value text pairs; `speedLabel(references,t)` returns a single attributed limit or translated unknown/conflict. `createMetadataOptions({storage,onChange,t})` returns `{values,setLanguage,destroy}` with values `{showSpeedLimits:false,showMetadata:false}`; storage denial falls back to memory. Extend map with `setReferenceLayers(references)`, `setDisplayOptions(values)`; keep existing render/fit/selection APIs.

- [ ] Write metadata unit tests and browser tests that import a file, select its unencoded point, see attributed speed/name/status, enable independent toggles, and switch PL/EN. Include hostile labels, unknown BIN speed, mph original-unit details, conflicting limits, source links restricted to http(s), reference-only section display, and reload of display preferences.

```js
await page.getByRole('button',{name:'Import',exact:true}).click();
await page.getByLabel('Source namespace',{exact:true}).fill('example');
await page.getByLabel('Attribution',{exact:true}).fill('Example owner');
await page.getByLabel('Import file',{exact:true}).setInputFiles({name:'cameras.csv',mimeType:'text/csv',buffer:Buffer.from('id,latitude,longitude,kind,status,speed,speed_unit\na,52,19,camera,active,50,km/h')});
await expect(page.getByTestId('import-summary')).toContainText('reference');
await page.getByLabel('Show speed limits',{exact:true}).check();
```

- [ ] Run `node --test test/source-metadata.test.js` and `npm run test:browser -- test/browser/imports.spec.js`; verify RED.
- [ ] Implement setup and automatic commit after valid file selection, respecting unfinished-form guards and captured document/revision intent. Template selection requires explicit acknowledgement of copied unverified fields. Pending cancel invalidates fetch/parse results. Render text via textContent; handle storage/fetch errors without discarding state. Reference-only details disable binary edits. Use canvas source geometry and label collision boxes; draw <=200 single-point labels, never aggregate limits. Bound references do not duplicate their binary marker. Keep encoded and reference tables distinctly labelled, paginated, keyboard-accessible and usable on narrow screens.

```js
// Label option changes affect presentation only, never history or source bytes.
const metadataOptions=createMetadataOptions({storage:localStorage,t,
  onChange:values=>map.setDisplayOptions(values)});
// When rendering external strings use textContent, not innerHTML.
```

- [ ] Run focused tests, `npm test`, `npm run build:web`, deterministic browser suite; document schema/example and reference-vs-encoded distinction; commit `feat: show imported cameras and attributed metadata`.

## Task 7: End-to-end regression and handoff

**Files:** Extend `test/browser/imports.spec.js`, `test/browser/persistence.spec.js`, `test/browser/sample.spec.js`, `test/web-build.test.js`; update README, `docs/browser-verification.md`, `docs/roadmap.md`.

- [ ] Add regression tests for one-step undo/redo, reimport after save/reload, protected manual move and deletion, held duplicate resolution, raw template bytes, stale fetch after file replacement, pending form guard, storage quota recovery and separate reference GeoJSON export. Assert no-op import preserves revision and does not save again. Add synthetic 100,000-observation limit test without an external dataset; reject one extra record.

```js
// After importing a valid fixture through the Task 6 controls:
await page.getByRole('button',{name:'Undo',exact:true}).click();
await expect(page.getByTestId('reference-row')).toHaveCount(0);
await page.getByRole('button',{name:'Redo',exact:true}).click();
await expect(page.getByTestId('reference-row')).toHaveCount(1);
await page.reload();
await expect(page.getByTestId('reference-row')).toHaveCount(1);
```

- [ ] Run each regression test before fixes; diagnose real failures and make minimal scoped fixes. Run `npm test`, `npm run build:web`, `npm run test:browser`, and `git diff --check`. Keep live-source checks opt-in; do not imply they passed unless run.
- [ ] Inspect desktop/mobile synthetic UI and full local sample rendering; verify <=100 visible table rows, <=200 optional labels and no per-camera DOM markers. Record actual measurements, test counts and limitations, not invented thresholds or device acceptance.
- [ ] Update README and roadmap with completed/blocked work, retain country filtering and Pages as next increments, and link the companion location plan. Commit `test: verify automatic ingestion and metadata workflows`.
- [ ] Follow executing-plans' final independent review gate, fix reproduced findings with tests, then request integration/push direction; do not publish Pages implicitly.

## Execution handoff

Plan awaits user review. Preserve the established native in-session execution method and feature-branch workflow; use isolation instructions at execution time. No new dependencies or live adapter assumptions are pre-approved by this plan. Browser location is tracked in `2026-09-20-browser-location.md` and may be delivered first because it does not depend on the project-v2 migration.
