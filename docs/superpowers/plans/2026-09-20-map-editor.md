# Polish/English Map Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, preserving the user's native/in-session execution choice. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a local-first PL/EN map editor with automatic official-source caching, recoverable autosaved edits, and validated downloads.

**Architecture:** Reuse the existing codec and immutable project model inside a module worker. Separate the official-source cache from the working document in IndexedDB, and fence asynchronous work by session and revision. Serve an allowlisted static bundle with locally packaged Leaflet; no application backend.

**Tech Stack:** JavaScript ES modules, existing Node test runner, IndexedDB, Web Workers, Leaflet 1.9.4, Playwright browser tests. Pin new dependencies and commit the lockfile.

**Spec:** `docs/superpowers/specs/2026-09-20-map-editor-design.md`

## Global Constraints

- Polish and English cover all controls, errors, warnings, and human-readable export reports; developer documentation stays English.
- Machine-readable keys and diagnostic codes remain language-independent.
- Target device remains MiVue 955W; actual device acceptance is untested.
- Everyday editing is the default; binary research details are in advanced mode.
- Never ship the sample in app assets.
- Table and map use the same filtered projection.
- Show the matching count and paginate at 100 records; do not insert all records into the DOM.
- Retain the last 50 states in memory, sharing the unchanged baseline rather than copying it per state.
- Autosave covers applied project operations, not unfinished form input.
- Display filters never restrict exports implicitly.
- Create the app, build/preview scripts, and browser tests. Prepare Pages-compatible output, but do not enable Pages, merge, or publish automatically in this increment.
- No new OPP encoding, 22×22 support, general ingestion, or exact country-boundary filtering in this increment.
- After every task, update `README.md` in that task's commit with delivered functionality, verification, limitations, and the next step; never describe planned behavior as shipped. This also applies to planning/documentation tasks.

## Review Focus

1. An old save/build/source response arrives after document replacement or reset: it must not resurrect old edits or enable a stale binary (Tasks 2–3, 6).
2. HTTP metadata is missing, inaccessible, or inconsistent between HEAD and GET: retain the usable cache and never falsely report freshness (Task 2).
3. Storage opens successfully but its transaction aborts, or a restored project is corrupt: preserve recovery data and never claim a successful save (Tasks 2, 6).
4. Multiple cameras coincide, coordinates are invalid, or filters hide the selection: keep distinct identities and accessible table entries without invented positions (Tasks 1, 4, 6).
5. Untrusted provenance includes HTML, CSV formulas, or quoted/newline text: render text safely and export without spreadsheet execution (Tasks 1, 5–6).

## File and interface map

- `src/project-view.js`: effective record projection and project-view JSON/GeoJSON/CSV; existing CLI exports remain unchanged.
- `src/history.js`: bounded immutable history, baseline reset, monotonically increasing revisions.
- `src/view-filter.js`: pure search/filter/pagination and screen-space aggregation.
- `web/storage.js`: IndexedDB transactions, cache and working-document stores, recoverable raw records.
- `web/source-cache.js`: coalesced source checks/downloads with injected validation and storage.
- `web/autosave.js`: serialized writes and revision/session fencing.
- `web/worker.js`, `web/worker-session.js`: worker entry and independently testable message handling.
- `web/worker-client.js`: request routing, cancellation, stale-response rejection.
- `web/i18n.js`, `web/locales/pl.js`, `web/locales/en.js`: presentation translations and safe fallback diagnostics.
- `web/index.html`, `web/styles.css`, `web/app.js`: accessible shell and orchestration.
- `web/map.js`, `web/record-list.js`, `web/details.js`: map, paginated list, tentative form state.
- `web/downloads.js`, `web/export-dialog.js`: Blob lifecycle and revision-bound report/download flow.
- `scripts/build-web.mjs`, `scripts/preview-web.mjs`: allowlisted output and dist-only HTTP server.
- `playwright.config.js`, `test/browser/*.spec.js`, `test/browser/helpers.js`: real-browser verification with deterministic network fixtures.
- `test/{project-view,history,view-filter,source-cache,autosave,worker-session,web-build,i18n}.test.js`: Node unit/integration coverage.
- Modify `package.json`, `.gitignore`, `README.md`, `docs/roadmap.md`; create `docs/browser-editor.md` and a measured verification record.

The tasks are layers of one integrated increment, not separately shipped subsystems. Keep the existing CLI/project schema stable. Official retrieval/check metadata belongs in the cache/working-document envelope, not new unsupported keys in project-v1 JSON.

## Task 1: Effective projection, safe data exports, and bounded history

**Files:** Create `src/project-view.js`, `src/history.js`, `src/view-filter.js` and corresponding Node tests listed above.

**Interfaces:**

- `projectView(project)` → Promise of `{schema:'mivue-project-view', version:1, source, records, diagnostics}`. Include all entries; each projected record has `id`, `originalSourceOffset`, `templateId`, effective `latitude/longitude/rawBytes16To19/typeRaw`, `originalLinkRaw`, resolved `linkTargetId`, `deleted`, `changed`, `provenance`, and record diagnostics. Clones have null original offset. Diagnostics explicitly distinguish baseline findings from current validation/link findings.
- `exportView(view, format)` → string for `json|geojson|csv`, active records only, all filters ignored. JSON retains metadata/diagnostics; GeoJSON carries them at collection/feature level; CSV serializes structured fields into quoted cells. Geometry is null for invalid coordinates.
- `createHistory(project, {limit=50}={})` → object with `current`, `revision`, `canUndo`, `canRedo`, `apply(operation)`, `undo()`, `redo()`, async `reset()`. Successful transitions advance revision; reset recreates the current source baseline and clears history. Failed operations leave state unchanged.
- `filterView(view, filters)` → array; filters `{query, viewport, warningsOnly, changedOnly, showDeleted, typeRaw}`; viewport null disables filtering, otherwise `{south,west,north,east}`. `pageRecords(records,page,pageSize=100)` → `{records,page,pageCount,total}` with clamped page.
- `aggregatePoints(points, cellSize=40)` → groups `{x,y,ids}`; points are valid viewport pixel coordinates `{id,x,y}`. Stable IDs are never deduplicated.

- [ ] Write failing tests with an independently packed fixture. Pin effective values and unchanged source bytes:

```js
const base = await createProject(makeFixture([{}]).bytes);
const h = createHistory(base);
h.apply({kind:'update', id:base.records[0].id, changes:{latitude:37.1}});
assert.equal((await projectView(h.current)).records[0].latitude, 37.1);
assert.strictEqual(h.current.source, base.source);
h.undo();
assert.equal((await projectView(h.current)).records[0].latitude, 37);
h.redo();
assert.equal(h.revision, 3);
```

- [ ] Run `node --test test/project-view.test.js test/history.test.js test/view-filter.test.js`; expect missing-module failures before implementation.
- [ ] Implement projection using `validateProject(project)` and its originals map, never `buildProject`. Spread original values only into explicitly named projection fields; overlay supported edits. Resolve candidate links through original offsets or explicit resolutions, flag deleted/missing targets. Keep immutable history snapshots with shared source and unchanged records:

```js
const before = current;
const after = applyEdit(before, operation); // validate before committing
past.push(before);
if (past.length > limit) past.shift();
current = after;
future.length = 0;
revision += 1;
```

- [ ] Add tests for clones/deletes/restores/links, invalid coordinates, stable IDs, 50-state cap, redo invalidation, failed edits, reset to original baseline, and changed-state comparisons. Test coincident points, viewport edge/wrapped longitude handling, hidden selections, empty results and 101-record pagination. For CSV quote every cell, double quotes, and prefix dangerous textual values (including whitespace/control-prefixed `= + - @`) with an apostrophe; numeric coordinate fields remain numeric. Assert a provenance value `=HYPERLINK("bad")` is neutralized and quoted/newline text survives round-trip CSV parsing.
- [ ] Run the targeted tests and `npm test`; commit this independently tested core deliverable as `feat: add editor projection and bounded history`.

## Task 2: Official-source cache and durable working-document storage

**Files:** Create `web/storage.js`, `web/source-cache.js`, `web/autosave.js`, `test/source-cache.test.js`, `test/autosave.test.js`. Reuse `src/sources.js` URL without changing its existing public loader contract.

**Interfaces:**

- `openStorage({indexedDB=globalThis.indexedDB}={})` → Promise store with `getCache()`, `putCache(entry)`, `getWorking()`, `putWorking(entry)`, `close()`. Database `mivue-trafficcam`, version 1, separate `source` and `working` object stores. Writes resolve on transaction completion, not request success. Working store keeps original invalid data until explicit user replacement and offers its raw JSON for recovery.
- Cache entry `{version:1, bytes, source:{url,retrievedAt,checkedAt,lastModified,contentLength,etag,sha256}}`. Working envelope `{version:1,sessionId,revision,projectJson,sourceInfo,savedAt}`. Source info is nullable and independent of project-v1 schema.
- `createSourceCache({store,fetchImpl,validateBytes,now,onStatus})` → `{loadCached(),check(),cancel()}`. `validateBytes(bytes)` runs codec validation in worker and returns SHA-256; cache loads also validate untrusted stored bytes. Concurrent checks share one promise.
- `createAutosave({store,onStatus})` → `{begin(sessionId),save({sessionId,revision,projectJson,sourceInfo}),flush()}`. `save` takes already validated serialized worker output; serial queue skips obsolete sessions/revisions before writing and suppresses obsolete completions. New document saves always follow in-flight old writes, so old data cannot overwrite them. `flush` reports failure, never swallows it into success.

- [ ] Write failing stubbed transport/storage tests:

```js
let gets = 0;
const fetchImpl = async (_url, options) => {
  if (options.method === 'HEAD') return new Response(null, {headers:{
    'Last-Modified':'Thu, 16 Jul 2026 07:39:32 GMT', 'Content-Length':'123'
  }});
  gets++;
  throw new Error('unchanged metadata must not download');
};
// Seed a validated cache with the identical Last-Modified and length.
const cache = createSourceCache({store,fetchImpl,validateBytes,now,onStatus});
await cache.loadCached();
await cache.check();
assert.equal(gets, 0);
```

- [ ] Run `node --test test/source-cache.test.js test/autosave.test.js`; confirm red before adding modules.
- [ ] Implement first-visit GET with `mode:'cors', credentials:'omit'`; validate fully before committing. With cache, HEAD using `cache:'no-cache'` checks usable metadata: prefer readable ETag, otherwise valid Last-Modified plus Content-Length. No explicit non-safelisted conditional headers/preflight dependency. Equal usable validators mean unchanged; changed validators trigger GET. Absent validators/failed HEAD mean `check-unavailable`, retaining cache and offering explicit retry/download. Derive replacement validators from GET, never the preceding HEAD. If GET validators are absent, retain bytes but do not claim future freshness. Abort checks before parse and cache commit. Use a shared in-flight promise:

```js
function check() {
  if (pending) return pending;
  pending = runCheck().finally(() => { pending = null; });
  return pending;
}
```

- [ ] Implement IndexedDB wrappers with abort/error rejection and a serial autosave queue. Storage failure returns actionable status with memory retained, not a failed document open. Fence every completion by current session/revision. Add tests for first download, simultaneous checks, missing/nonexposed ETag, changed HEAD/GET validators, offline, cancellation, malformed update, quota failure, corrupt cache, deferred old save across reset/replacement, and transaction rejection. Pin commit semantics with a fake transaction whose request succeeds before transaction aborts; real IndexedDB coverage is Task 6.
- [ ] Run targeted tests and `npm test`; commit as `feat: cache official data and autosave working projects`.

## Task 3: Worker-owned editing and revision-safe client

**Files:** Create `web/worker.js`, `web/worker-session.js`, `web/worker-client.js`, `test/worker-session.test.js`.

**Interfaces:**

- Wire request `{sessionId,requestId,kind,payload}`; response `{sessionId,requestId,ok,result}` or `{sessionId,requestId,ok:false,error:{code,message,recordId,issues}}`. Plain structured-clone data only.
- `createWorkerSession()` → `{handle(request)}` async. Serialize mutating requests. Kinds: `open-bin` (`bytes,name`), `open-project` (`text`), `apply` (`operation`), `undo`, `redo`, `reset`, `snapshot`, `export` (`format`), `build`, `validate-source` (`bytes`). Source validation is stateless and cannot replace active history.
- Editing replies return `{revision,view,canUndo,canRedo,modified,projectJson}`; serialize validated project only once per committed revision for autosave. `export` returns `{revision,text,mime,filename}`; `build` returns `{revision,bytes,report}`. Project export uses authoritative `serializeProject`.
- `createWorkerClient({workerFactory})` → `{open(kind,payload),request(kind,payload),validateSource(bytes),cancel(),close()}`. Open starts a new unique session and worker; validation uses an independent worker so cancelling source startup cannot cancel editing. Request IDs monotonically increase. Cancellation terminates relevant worker, rejects pending promises, preserves last accepted project snapshot for recovery/restart.

- [ ] Write failing tests using real core modules and deferred fake worker replies:

```js
const session = createWorkerSession();
const first = await session.handle({sessionId:'a',requestId:1,kind:'open-bin',
  payload:{bytes:makeFixture([{}]).bytes,name:'fixture.bin'}});
assert.equal(first.result.revision, 0);
const saved = await session.handle({sessionId:'a',requestId:2,kind:'snapshot',payload:{}});
assert.equal(JSON.parse(saved.result.projectJson).records.length, 1);
```

- [ ] Run `node --test test/worker-session.test.js` and observe missing-module failures.
- [ ] Implement worker operations through Task 1/core APIs, preserving machine error codes. Never transfer buffers still used as baseline/cache; transfer copies for downloads if needed. Client acceptance requires matching session and pending request, with latest view revision monotonic:

```js
if (message.sessionId !== activeSession) return;
const pending = requests.get(message.requestId);
if (!pending) return;
requests.delete(message.requestId);
message.ok ? pending.resolve(message.result) : pending.reject(message.error);
```

- [ ] Add tests for malformed projects, blocked build remaining editable, concurrent edits ordered, old open/build/export reply after a new session, cancel/restart from accepted snapshot, reset revision fencing, independent source validation, and project JSON with no Node globals. Prepared build is invalidated whenever session or revision changes, even undo returning to identical data.
- [ ] Run targeted tests and `npm test`; commit as `feat: run editing and validation in session-safe workers`.

## Task 4: Bilingual static workspace with linked map and table

**Files:** Create `web/index.html`, `web/styles.css`, `web/app.js`, `web/map.js`, `web/record-list.js`, `web/i18n.js`, both locale files, build/preview scripts, `test/web-build.test.js`, `test/i18n.test.js`, `playwright.config.js`, `test/browser/helpers.js`, `test/browser/workspace.spec.js`. Modify package scripts, `.gitignore`; install exact Leaflet 1.9.4 and an exact Playwright version verified against official documentation at execution time, committing `package-lock.json`.

**Interfaces:**

- `createMap(element,{onSelect,onPick,onViewport,onTileError})` → `{render(records,selectedId),fit(records),center(record),setPickMode(enabled),destroy()}`. Leaflet canvas overlay owns projected viewport points/aggregates; no per-record DOM marker. Dashed candidate links have an inferred-only legend.
- `renderRecordList(element,{records,page,selectedId,onSelect,onPage,t})` uses `pageRecords`, text nodes and accessible buttons/table. Hidden selection gets an explicit notice outside filtered rows.
- `createI18n({languages,storage})` → `{language,setLanguage,t}`. Exact same keys in PL/EN; `t(key,params={})` uses named interpolation, never HTML insertion. Preference storage errors fall back to browser language. Diagnostics map known codes and provide localized generic text plus machine code/technical detail for unknown codes.
- Scripts: `npm run build:web`, `npm run preview:web -- --port 4173 --base /mivue-trafficcam/`, `npm run test:browser`. Playwright starts dist-only preview, deterministic HTTP stubs, fresh storage per test. Its fixture bytes come from `makeFixture`, not the proprietary sample.

- [ ] Write build/i18n and browser smoke tests before shell implementation. Browser test outline:

```js
await page.goto('/mivue-trafficcam/');
await page.getByRole('button', {name:'EN',exact:true}).click();
await page.getByLabel('Open file', {exact:true}).setInputFiles({
  name:'fixture.bin',mimeType:'application/octet-stream',buffer:Buffer.from(makeFixture([{}]).bytes)
});
await expect(page.getByTestId('record-count')).toHaveText('1');
await page.getByTestId('record-row').first().click();
await expect(page.getByTestId('selected-id')).toContainText('source:');
```

- [ ] Run Node tests red, then browser tests red after installing the test runner/browser. Dependency installation requiring network follows normal permission approval. Keep Node glob unchanged so browser specs are not run by `node --test`.
- [ ] Implement dist copier using explicit core/web file allowlists and Leaflet distribution assets including image paths and license. No recursive repository copy. Preview accepts GET/HEAD, validates decoded path remains under dist, rejects traversal/symlinks outside root, supports configured base, and never serves repository fallback. Test source binary, `.git`, encoded traversal, and non-allowlisted paths return 404.
- [ ] Build accessible shell with dark navy header/teal actions/amber warnings, responsive map/list tabs, collapsible list, persistent own-risk/local-processing notice, visible attribution and PL/EN switch. Bind startup in this order: read and validate saved working document, restore it if valid; otherwise show recoverable corrupt-data state or cached source; initiate background source check independently. A user file selection advances document intent immediately, before FileReader/worker completion, blocking late startup replacement. First download may activate only when no working document/manual intent exists. Newer source offers explicit replacement, never rebase.
- [ ] Render shared filters, stable selection, search, counts and 100-row pages. Use text-only DOM writes:

```js
const cell = document.createElement('td');
cell.textContent = record.id;
row.append(cell);
```

Use screen-space groups for low zoom and viewport canvas for high zoom. Group click zooms; coincident IDs remain separately selectable through table. Tile failure leaves point layer/list operational. Poland initial view is navigation only; fit-all includes all valid records.
- [ ] Add tests for PL/EN key parity/persistence, 101-record pagination, safe HTML provenance rendering, filter/map identity agreement, invalid coordinates, group zoom, keyboard selection, narrow layout, tile error and `/mivue-trafficcam/` worker paths. Run `npm test`, `npm run build:web`, `npm run test:browser`; commit as `feat: add bilingual map workspace and static tooling`.

## Task 5: Applied edits, recovery, and validated downloads

**Files:** Create `web/details.js`, `web/downloads.js`, `web/export-dialog.js`, `test/browser/editing.spec.js`; extend `web/app.js`, locale files, and `web/styles.css`. Create `docs/browser-editor.md`; update `README.md` and `docs/roadmap.md` to distinguish implemented versus deferred functionality.

**Interfaces:**

- `parseCoordinate(text,limit)` → finite number; strict optional sign, digits, optional decimal point OR comma, no grouping/junk/exponents/blank input. Latitude limit90, longitude180.
- `createDetails(element,{onApply,onOperation,onPick,t})` → `{select(record),hasDraft(),discardDraft(),setPickedLocation(latitude,longitude),setLanguage()}`. Drafts never invoke worker/autosave until Apply. Guard selection/replacement with Apply/Discard/Cancel.
- `downloadBlob({bytes,mime,filename})` creates an object URL, clicks a download anchor, revokes after the browser has consumed it; clean up on replacement/unmount.
- `createExportDialog(element,{client,getIdentity,t})`, `getIdentity()` → `{sessionId,revision}`. Build report gates binary download against exact identity; failed builds show actionable record/issue links.

- [ ] Write failing browser tests for decimal comma, Apply/Cancel, map picking, raw-byte validation, delete/restore/clone, undo/redo and safe binary reports:

```js
await page.getByLabel('Latitude', {exact:true}).fill('37,1');
await page.getByRole('button', {name:'Apply',exact:true}).click();
await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
await page.reload();
await page.getByTestId('record-row').first().click();
await expect(page.getByLabel('Latitude', {exact:true})).toHaveValue('37.1');
```

- [ ] Run `npm run test:browser -- test/browser/editing.spec.js`; confirm failures correspond to absent editing behavior.
- [ ] Implement forms/advanced inspector using existing operations only. Unknown bytes/types stay explicitly unknown, no invented speed/heading units. Clone enabled only for supported original templates. Link resolution requires original964 source, original9128 target and nonempty reason; dashed geometry remains inferred. Translate limitations at disabled controls. Use strict parsing:

```js
const normalized = text.trim();
if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(normalized)) throw new Error('INVALID_COORDINATE');
const value = Number(normalized.replace(',', '.'));
if (!Number.isFinite(value) || Math.abs(value) > limit) throw new Error('INVALID_COORDINATE');
return value;
```

- [ ] Wire each accepted revision to autosave, show saving/committed/failed states, warn on departure with drafts or pending/failed save. Prompt before replacing modified work, offer project backup, allow cancellation. Discard asks confirmation, calls worker reset against embedded baseline, clears drafts/history, invalidates prepared binary and autosaves reset. Preserve corrupt working envelope until explicit recovery download/replacement choice; never silently clear it on source success.
- [ ] Add project/data/GeoJSON/CSV downloads and report-before-binary workflow. Project save remains available with unresolved/blocked builds. Record links on build errors select the relevant ID. Filters do not constrain exports. Check identity again inside download click handler:

```js
const current = getIdentity();
if (prepared.sessionId !== current.sessionId || prepared.revision !== current.revision) {
  prepared = null;
  return;
}
downloadBlob({bytes:prepared.bytes,mime:'application/octet-stream',filename:'Speedcam_Data_FEU.bin'});
```

- [ ] Test project download/reopen, all export formats, CSV formula protection, unchanged binary byte equality, build refusal (deleted linked target/unsupported layout), stale report invalidation, draft selection guard, independent source update, discard against original baseline, both languages including failures/reports, and Blob URL cleanup. Run all Node/browser tests; document own-risk warning, cache versus working data, offline tile limitations, local storage eviction and backup guidance. Commit as `feat: add safe editing recovery and export flows`.

## Task 6: Browser race/failure coverage and real-size verification

**Files:** Create `test/browser/persistence.spec.js`, `test/browser/source-cache.spec.js`, `test/browser/sample.spec.js`, `docs/browser-verification.md`; extend browser helpers as needed. Sample spec skips explicitly when the ignored local sample is absent.

**Interfaces:** Browser helpers provide deterministic route fixtures for HEAD/GET/tile traffic, counters and deferred replies. Persistence tests use actual IndexedDB and injected failure hooks confined to tests, not a production debug endpoint. `sample.spec.js` uses only local file upload and blocks external database requests.

- [ ] Add failing adversarial tests before fixing any findings. Pin unchanged startup traffic:

```js
await page.goto('/mivue-trafficcam/');
await expect(page.getByTestId('source-status')).toHaveAttribute('data-state','ready');
expect(downloads).toBe(1);
await page.reload();
await expect(page.getByTestId('source-status')).toHaveAttribute('data-state','unchanged');
expect(downloads).toBe(1);
```

- [ ] Cover changed metadata/new bytes, missing validators, offline cached startup, failed/cancelled update preserving cache, storage denied/quota/transaction abort, corrupt/incompatible working project recovery, undo/redo persisted but history reset on reload, delayed old save after reset/replacement, file selection during startup, and newer cache never replacing edited work. Verify external requests contain no uploaded file/project content. Use deferred events rather than arbitrary sleep timings.
- [ ] Run `npm run test:browser`; investigate failures with systematic-debugging and add focused regressions before minimal fixes. Repeat race tests to expose scheduling dependence.
- [ ] Independently inspect official endpoint from a real browser: record CORS-visible validators, first GET, subsequent no-body unchanged check and cancellation behavior. If network/live headers prevent verification, document that limitation and retain conservative `check-unavailable` behavior; do not weaken tests or claim a successful live check.
- [ ] Upload local 52,935-record sample, measure load/edit/build durations and a main-thread animation heartbeat during worker work. Assert no more than 100 record rows and no per-camera DOM markers. Exercise keyboard, mobile viewport, all-record fit, map background failure, project save/reopen, and byte-identical untouched build. Record machine/browser/date and observed timings without universal performance promises.
- [ ] Run `npm test`, `npm run build:web`, `npm run test:browser`, `git diff --check`. Inspect dist allowlist and verify no `.bin`, saved project, firmware, sample, test fixtures, or private repository files are published. Document exact results/skips in `docs/browser-verification.md`; commit as `test: verify editor persistence and full-size browser workflows`.
- [ ] Obtain the final independent review required by executing-plans, address substantive findings with regression tests, rerun verification, and hand off for the user's integration choice. Do not merge/push/enable Pages automatically.

## Plan self-review

- Spec coverage: projection/exports/history/filters → Task 1; cache/autosave → Task 2; worker ordering/cancellation → Task 3; bilingual layout/map/table/static security → Task 4; drafts/edit operations/recovery/downloads → Task 5; real browser failures/races/live metadata/full sample → Task 6.
- All five review-focus conditions have explicit test ownership above.
- Project-v1 source schema stays unchanged; cache provenance uses an external storage envelope. Worker names, revision identity, shared filtering and export scope are consistent across tasks.
- No deployment or binary-format scope expansion. Execution remains native/in-session after plan review.
- User-requested follow-up: CANARD and other website imports plus explicit country-limited datasets/builds. See the roadmap; the map itself is delivered by this plan. Each task includes a README update under Global Constraints.
