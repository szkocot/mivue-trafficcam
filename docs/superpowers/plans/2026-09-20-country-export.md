# Country Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add non-destructive, reviewed country-limited exports while preserving linked sections, attribution and existing BIN safety checks.

**Architecture:** Load pinned boundaries lazily in the worker, classify current coordinates, then calculate a deterministic export selection with link closure. Export from temporary views/clones only; never commit selection to project history. The PL/EN export dialog owns transient controls and rejects stale previews and downloads.

**Tech Stack:** Existing ES modules, Node test runner, Web Worker, Web Crypto, native fetch, Playwright/Chromium; Natural Earth 5.1.1 boundary data. No new runtime dependency is planned.

**Spec:** [Approved country-export design](../specs/2026-09-20-country-export-design.md). The user approved the written spec on 2026-09-20. Native execution is the preserved method, subject to review of this plan.

## Global Constraints

- Country mode applies to BIN, encoded-record JSON/CSV/GeoJSON and reference GeoJSON.
- The full Project JSON backup always contains the original project, including original European data.
- Label it **Full project backup — not country-filtered** in both languages.
- Do not offer a reduced project format in this increment.
- Cap the decoded artifact at 20 MiB and two million positions; if the chosen conversion exceeds either limit, pause for a revised data representation rather than silently simplify or truncate it.
- The 1 km band is a conservative product review trigger, not a claim that dataset error is bounded by 1 km.
- Never resurrect a record already deleted in the working project.
- No camera coordinates go to a geocoder or boundary API.
- No project schema migration is needed: export settings and the preview are ephemeral.
- Keep heavy geometry work off the UI thread and paginate preview rows at 100, following existing table limits.
- Update README and the checklist after each implementation task.
- No header/link safeguard removal, new camera encoding claims, additional source adapters or hardware acceptance claims. Backlog points 3, 4 and 6 remain separate work.

## Review Focus

1. A retained target must retain its linked source too, including many-to-one components; deleted and wrong-type targets must not be resurrected or treated as understood links (Task 3).
2. A near-border point just outside a polygon bounding box still needs distance review; dateline and polar rings must not classify half the globe by accident (Task 2).
3. Cancel/reopen, language change or a late source import must not make a stale preview or BIN downloadable, even if the country list happens to match again (Tasks 4–5).
4. An interrupted boundary response or failed first load must not poison the session cache or bypass size/hash checks on retry (Tasks 1–2).
5. Source observations bound to excluded/deleted BIN entries must not reappear as independent reference points; full backups and notices must remain complete (Tasks 3–4).

## Files and contracts

New files:

- `scripts/countries/prepare.mjs`: deterministic conversion of the pinned upstream GeoJSON; no network during normal builds.
- `config/countries-review.json`: reviewed release commit/archive/input hashes and source/terms evidence.
- `data/countries/{manifest.json,countries.json,NOTICE.json}`: the three allowlisted, checked-in normalized assets.
- `src/country-data.js`: strict schema/resource/hash validation, shared by build and worker.
- `src/country-classifier.js`: spatial index, polygon membership, ring-distance review and cooperative batches.
- `src/country-selection.js`: pure grouping/selection engine and typed selection errors.
- `src/country-export.js`: scoped serialization and temporary-clone BIN builds.
- `web/country-cache.js`: lazy bounded same-origin fetch and retryable session cache.
- `web/country-export-controls.js`: accessible country selection and paginated review controls.
- Tests: `test/country-data.test.js`, `test/country-classifier.test.js`, `test/country-selection.test.js`, `test/country-export.test.js`, `test/country-worker.test.js`, `test/helpers/country-fixture.js`, `test/browser/country-export.spec.js`.
- Evidence: `docs/country-boundaries.md`, plus existing README, TODO, deployment and browser-verification documents.

Existing integration points: `web/worker-session.js`, `web/export-dialog.js`, `web/app.js`, `web/styles.css`, `web/locales/{en,pl}.js`, `scripts/build-web.mjs`, `test/web-build.test.js`. Do not refactor unrelated ingestion or encoder code.

Shared object contracts (plain structured-cloneable objects; string arrays sorted by stable ID):

```js
// Dataset: {schemaVersion:1, countries:[{id,iso2:null|string,
//   names:{en,pl}, geometry:{type:'Polygon'|'MultiPolygon',coordinates}}]}
// Manifest: {schemaVersion:1,release:'5.1.1',path:'data/countries/countries.json',
//   sha256,byteLength,featureCount,positionCount,sourceUrl,sourceCommit,
//   sourceArchiveSha256,sourceGeoJsonSha256,noticePath:'data/countries/NOTICE.json',noticeSha256}
// Classification: {status:'assigned'|'border'|'unassigned'|'invalid',countryIds:string[]}
// Options: {countryIds:string[], decisions:{[itemId]:'keep'|'exclude'},
//   componentDecisions:{[componentId]:'keep'|'exclude'},acknowledgeExtras:boolean}
// Preview: {boundary:{release,sha256},options,records:Partition,references:Partition,
//   components:[{id,recordIds}],linkedExtras:[{id,triggerIds,reason}],
//   reviewItems:[{id,kind,classification,componentId:null|string}],
//   diagnostics:[{code,recordId?}],ready:boolean}
// Partition: {keptIds:string[],excludedIds:string[],unresolvedIds:string[]}
```

`CountryError` carries `code`, `message` and optional `issues`. Defined codes: `COUNTRY_DATA_INVALID`, `COUNTRY_DATA_LIMIT`, `COUNTRY_DATA_HASH`, `COUNTRY_DATA_UNAVAILABLE`, `COUNTRY_SELECTION_EMPTY`, `COUNTRY_ID_UNKNOWN`, `COUNTRY_DECISION_INVALID`, `COUNTRY_REVIEW_REQUIRED`, `COUNTRY_EXTRAS_ACK_REQUIRED`, `COUNTRY_EMPTY_BIN`, `COUNTRY_PREVIEW_STALE`, `COUNTRY_CANCELLED`. Existing encoder errors propagate unchanged.

### Task 1: Pinned boundary artifacts and build validation

**Files:** Create converter, review record, data assets, `src/country-data.js`, `test/country-data.test.js`, `test/helpers/country-fixture.js`, `docs/country-boundaries.md`; modify build allowlist and `test/web-build.test.js`, README/TODO.

**Interfaces:** `normalizeCountries(geojson,review)` returns Dataset. `validateCountryData(bytes,manifest,noticeBytes)` asynchronously returns validated `{dataset,manifest,notice}`. Export the `CountryError` class here. Reject unexpected fields/paths, invalid coordinates/rings, empty geometries, duplicate IDs, excessive depth/count/bytes, mismatched hashes/notices and sentinel ISO mappings. Manifest JSON is capped at 64 KiB, notices at 64 KiB, country feature count at 1,000; fixed paths only.

- [ ] Add independent synthetic fixtures; the helper exports `boxCountry(id,w,s,e,n)` and `packCountryData(countries)` (async, calculates real Web Crypto hashes for compact newline-terminated JSON and a synthetic notice). Use uppercase two-letter IDs only as synthetic ISO codes; real IDs come from reviewed source IDs.

```js
export const boxCountry=(id,w,s,e,n)=>({id,iso2:id,names:{en:id,pl:id},
 geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}});
// In test/country-data.test.js (Node test/assert imports):
test('rejects corruption and duplicate identities',async()=>{
 const entry=await packCountryData([boxCountry('AA',0,0,1,1)]);
 const bad=entry.bytes.slice();bad[0]^=1;
 await assert.rejects(validateCountryData(bad,entry.manifest,entry.noticeBytes),{code:'COUNTRY_DATA_HASH'});
 const duplicates=await packCountryData([boxCountry('AA',0,0,1,1),boxCountry('AA',2,0,3,1)]);
 await assert.rejects(validateCountryData(duplicates.bytes,duplicates.manifest,duplicates.noticeBytes),{code:'COUNTRY_DATA_INVALID'});
});
```

- [ ] Run `node --test test/country-data.test.js`; observe missing implementation/behavior failure. Add table-driven malformed-ring, NaN, invalid nesting, unsafe path, notice mismatch, sentinel ISO and resource-limit cases. Limit tests must prove rejection before traversal of oversized geometry.
- [ ] Inspect upstream tag `v5.1.1` in `nvkelso/natural-earth-vector`, resolve it to a commit, retrieve its archive into an ignored temporary directory, and hash it. Extract only `geojson/ne_10m_admin_0_countries.geojson` and relevant licence/readme files after listing paths; never execute archive contents. The repository's tagged GeoJSON directory was verified during planning. Record archive and GeoJSON hashes, not invented constants, in `config/countries-review.json`. Recheck Natural Earth's source and terms links from the spec. If the tagged file/licence does not match the approved dataset, stop at the evidence gate.
- [ ] Implement deterministic conversion: preserve all geometry positions and ring order, drop unrelated properties, use unique reviewed `NE_ID` values prefixed `ne:`, and copy source EN/PL names with EN fallback. Review all ISO field exceptions; assign null rather than guess sentinel/duplicate mappings. Emit sorted countries, fixed manifest paths and attributed notices; validate the result before writing fresh output files. `node scripts/countries/prepare.mjs INPUT OUTPUT` consumes local input only and checks its digest against the review record. Write no downloaded upstream JS into production.

```js
// Converter's identity boundary; review is the checked-in record, not user input.
if(sha256(inputBytes)!==review.sourceGeoJsonSha256)throw new CountryError('COUNTRY_DATA_HASH');
const dataset=normalizeCountries(JSON.parse(new TextDecoder().decode(inputBytes)),review);
const bytes=new TextEncoder().encode(JSON.stringify(dataset)+'\n');
// sha256 is the converter-local createHash('sha256').update(bytes).digest('hex').
```

- [ ] Add the three exact assets and new modules to the build allowlist. Validate assets before modifying build output; refuse symlinked asset inputs. Extend artifact tests to reject altered bytes and retain private-file exclusions. No data refresh during `npm run build:web`.
- [ ] Run `node --test test/country-data.test.js test/web-build.test.js`, `npm run build:web`, and `git diff --check`. Record source/output hashes, actual sizes/counts and rights/precision limitations in `docs/country-boundaries.md`; update README/TODO without claiming country UI exists. Commit: `feat: bundle validated versioned country boundaries`.

### Task 2: Local classifier and bounded lazy loader

**Files:** Create `src/country-classifier.js`, `web/country-cache.js`, `test/country-classifier.test.js`; extend `test/country-data.test.js`, synthetic fixtures, build allowlist, README/TODO.

**Interfaces:** `createCountryClassifier(validated)` returns `{countries,boundary,classify({latitude,longitude}),classifyMany(items,{signal,yieldControl})}`. Items are `{id,latitude,longitude}`; classifyMany resolves `Map<id,Classification>`. `createCountryCache({fetchImpl=fetch,baseUrl})` returns `{load({signal}),clearFailure()}`; load returns validated data, never a partial cache entry. Explicitly pass the site root URL from the worker, rather than resolving assets relative to `web/`.

- [ ] Write classifier behavior tests, including holes, disconnected islands, feature reordering, overlap and latitude bounds. This example pins the review band on both sides of a bounding box:

```js
test('border review extends outside the polygon bounding box',async()=>{
 const e=await packCountryData([boxCountry('AA',0,0,2,2)]);
 const c=createCountryClassifier(await validateCountryData(e.bytes,e.manifest,e.noticeBytes));
 assert.equal(c.classify({latitude:1,longitude:1}).status,'assigned');
 assert.equal(c.classify({latitude:1,longitude:2.005}).status,'border');
 assert.equal(c.classify({latitude:1,longitude:3}).status,'unassigned');
 assert.equal(c.classify({latitude:NaN,longitude:1}).status,'invalid');
});
```

- [ ] Run `node --test test/country-classifier.test.js`; confirm RED. Add synthetic dateline rectangle 179° to −179° (180° inside, 0° outside), polar rings, hole borders and exact vertices. Test the 1,000 m threshold with explicit spherical distance fixtures and numeric tolerance, not only coarse degree examples.
- [ ] Implement ring-aware membership with longitude unwrapping, explicit boundary detection and holes. Build per-polygon and per-segment spatial indexes with expanded 1 km candidate envelopes; never discard near-border candidates at an unexpanded bounding-box check. Compute shortest spherical point-to-segment distance in metres using Earth radius 6,371,008.8 m, clamped dot products and endpoint fallbacks; document planar membership versus spherical review distance. Handle dateline split envelopes and polar/full-longitude envelopes explicitly.
- [ ] Implement cooperative batches of at most 256 points. Check `signal.aborted` before/after each yield and throw `COUNTRY_CANCELLED`; do not publish partial results. Each yield is `await new Promise(resolve=>setTimeout(resolve,0))` in the worker, injectable for tests. Cache classifications only for exact session/revision/boundary identity later in Task 4.
- [ ] Add loader tests with controlled streaming Response objects: HTTP errors, overlimit declared size, overlimit streamed bytes, truncated JSON, hash mismatch, midstream abort and successful retry after each failure. Assert one data body request on repeated successful loads; assert no automatic startup load and no camera-coordinate network payload.

```js
test('a failed first boundary fetch can retry',async()=>{
 let calls=0;
 const cache=createCountryCache({baseUrl:new URL('https://example.test/app/'),
  fetchImpl:async()=>{calls++;throw new Error('offline');}});
 await assert.rejects(cache.load({}),{code:'COUNTRY_DATA_UNAVAILABLE'});
 await assert.rejects(cache.load({}),{code:'COUNTRY_DATA_UNAVAILABLE'});
 assert.equal(calls,2); // rejected in-flight promise was evicted
});
```

- [ ] Run classifier/data tests and full `npm test`. Update README/TODO with classifier/cache evidence and explicit lack of UI. Commit: `feat: classify countries locally with border review`.

### Task 3: Deterministic selection with undirected link closure

**Files:** Create `src/country-selection.js`, `test/country-selection.test.js`; extend fixtures and build allowlist, README/TODO.

**Interfaces:** `selectCountries({view,references,classifications,boundary,options,countryIds}) -> Preview`. `countryIds` is the validated dataset ID allowlist. Classification Map keys use record IDs, point-reference IDs and section endpoint keys `${id}:start`/`${id}:end`. Component ID is its lexically smallest record ID. Derive only understood edges from current view plus original validated link type; explicit validated resolutions win. Do not trust every `projectView.linkTargetId` as verified: its raw-pointer fallback can name a wrong-type record.

- [ ] Add a helper `selectionFixture()` returning three plain project-view records `a` (964 → b), `b` (9128), `c` (1), with complete fields required by selection, no references, boundary identity, country allowlist AA/BB, and classification Map a=AA, b=BB, c=AA. Write:

```js
test('selecting a target country retains the source and excludes unrelated rows',()=>{
 const f=selectionFixture();
 const p=selectCountries({...f,options:{countryIds:['BB'],decisions:{},componentDecisions:{},acknowledgeExtras:false}});
 assert.deepEqual(p.records.keptIds,['a','b']);
 assert.deepEqual(p.records.excludedIds,['c']);
 assert.equal(p.linkedExtras[0].id,'a');assert.equal(p.ready,false);
});
```

- [ ] Run `node --test test/country-selection.test.js`; confirm RED. Add cases for reversed view order, many-to-one links, unknown selected IDs, unknown decision IDs, duplicate countries, empty selection, malformed option types, deleted target, missing target and wrong-type target. Invalid inputs throw exact defined codes; no loose truthiness/coercion.
- [ ] Implement deterministic union-find over active verified links, then component selection. Any selected-country member or explicit keep seeds inclusion. An explicit component decision applies to all members. Conflicting individual decisions yield review items rather than silently cutting a component. An exclude decision on an assigned point is valid only as an explicit whole-component override; no arbitrary exclusion of unrelated known points through forged payloads. Expand inclusion transitively, accumulate sorted triggering IDs, and require acknowledgement for linked extras/uncertain retained companions.
- [ ] Add synthetic references: Point, three-vertex LineString, an entirely outside LineString passing through a selected country, a bound excluded record and a deleted binding. Select by endpoints only, retain whole selected geometry, inherit bound-record scope, and never reinterpret deleted bindings as free references. Partition counts must cover exactly the eligible records and observations with no duplicates. Explicitly identify deleted-bound observations as excluded in reference preview.

```js
test('selection never mutates its inputs',()=>{
 const f=selectionFixture(),before=structuredClone(f);
 selectCountries({...f,options:{countryIds:['AA'],decisions:{},componentDecisions:{},acknowledgeExtras:true}});
 assert.deepEqual(f,before);
});
```

- [ ] Run selection/classifier tests and full `npm test`. Update README/TODO with uncertainty/component policy and tests. Commit: `feat: preserve linked sections in country export selections`.

### Task 4: Scoped exports and revision-fenced worker requests

**Files:** Create `src/country-export.js`, `test/country-export.test.js`, `test/country-worker.test.js`; modify `web/worker-session.js`, `web/worker.js`, build allowlist, README/TODO.

**Interfaces:** `exportCountrySelection({project,preview,format})` accepts `bin|json|geojson|csv|references`, verifies preview readiness, returns existing download shape plus `selectionReport`, `notices`, and for BIN `bytes,report`. Production callers construct preview in the worker, never accept it from UI. Create `CountryExportController` in `src/country-export.js` via `createCountryExportController({loadData})`, exposing async `preview({project,sessionId,revision,generation,options,signal})`, async `export({project,sessionId,revision,generation,token,format,signal})` and `invalidate()`. Controller stores one current preview/token and a classification cache keyed by session/revision/digest; request validation compares every identity field.

- [ ] Write scoped BIN tests from real `createProject(makeFixture(...).bytes)` and real classifier/selection results, not a forged ready preview. Keep two ordinary same-cell records with different coordinates so one may be removed without changing first populated region. Compare serialized project before/after; parse output; compare retained raw bytes and coordinates. Add linked synthetic fixture with an excluded earlier record to verify relocated offsets.

```js
// Core assertions inside the real-fixture test:
const before=await serializeProject(project);
const result=await exportCountrySelection({project,preview,format:'bin'});
assert.equal(parseDatabase(result.bytes).records.length,preview.records.keptIds.length);
assert.equal(await serializeProject(project),before);
assert.equal(result.report.deviceAcceptance,'untested');
```

- [ ] Run `node --test test/country-export.test.js`; confirm RED. Add invalid-coordinate, unresolved-link, deleted target and first-region-change fixtures that retain the existing encoder error codes. Test zero selected BIN records (`COUNTRY_EMPTY_BIN`) versus valid empty GeoJSON.
- [ ] Implement build clone and filtered serializers. Clone project, mark excluded active entries deleted, call `buildProject`; never clear links or change header bytes. Use existing `projectView`/`exportView` for record formats and existing reference feature shape for source GeoJSON. Filter diagnostics to relevant rows while retaining boundary/source reports. Embed `exportSelection` and notices in JSON/GeoJSON; return a companion report for CSV/BIN. Keep CSV formula escaping and sanitized names. Expose retained stable IDs in selectionReport rather than promising a nonexistent encoder offset map.
- [ ] Add the controller and worker protocol: `country-list`, `country-preview`, `country-export`, `country-cancel`. List payload is `{generation}` and returns `{generation,countries,boundary,notice}` from the lazy loader. Preview payload is `{expectedRevision,generation,options}`; response is `{revision,generation,token,preview}`. Export carries `{expectedRevision,generation,token,format}` and returns the scoped download shape plus revision/generation/token. Full `export {format:'project'}` remains unchanged and independent. `createWorkerSession({loadCountryData}={})` permits synthetic loader injection; production lazy loader uses `new URL('../',import.meta.url)` as the site root and appends the fixed `data/countries/` paths once.
- [ ] Handle cancellation out of the normal request queue: session `cancelCountry({sessionId,generation})` only aborts a matching active country operation and invalidates its token, never project state. `web/worker.js` dispatches country-cancel to that method immediately and posts a normal `{sessionId,requestId,ok:true,result:{cancelled}}` acknowledgement so the client promise settles; serialized normal requests keep their existing order. Record cancelled generations so queued-but-not-started requests cannot revive them. Tag delayed tasks with generation and compare before cache/preview publication. Invalidate controller on every successful open or history revision change, including source imports. UI cancellation does not terminate the document worker or discard its history.

```js
test('stale country request leaves project and history unchanged',async()=>{
 const worker=createWorkerSession({loadCountryData:async()=>validatedFixture});
 let n=0;const req=(kind,payload={})=>worker.handle({kind,payload,sessionId:'country',requestId:++n});
 const opened=(await req('open-bin',{bytes:makeFixture([{}]).bytes})).result;
 const bad=await req('country-preview',{expectedRevision:9,generation:1,options:{countryIds:['AA'],decisions:{},componentDecisions:{},acknowledgeExtras:false}});
 assert.equal(bad.error.code,'COUNTRY_PREVIEW_STALE');
 assert.deepEqual((await req('snapshot')).result,opened);
});
// validatedFixture is built with packCountryData + validateCountryData in test setup.
```

- [ ] Test cancel during cooperative batch, late loader completion, session replacement, revision changes, wrong token/generation, retry, full backup after boundary failure and no undo/autosave changes. Validate optional payloads strictly. Full export requests with unexpected country arguments must fail, not silently produce unrestricted data.
- [ ] Run `node --test test/country-export.test.js test/country-worker.test.js test/worker-session.test.js test/encoder.test.js`, then full `npm test`. Update README/TODO, retaining the sample BIN limitation. Commit: `feat: build scoped exports without changing the working project`.

### Task 5: PL/EN export controls and browser regression coverage

**Files:** Create `web/country-export-controls.js`, `test/browser/country-export.spec.js`; modify export dialog, app integration, styles, locales and build allowlist; update README/TODO.

**Interfaces:** `createCountryExportControls(element,{client,getIdentity,t,onInvalidate,onPreview})` returns `{getPreparedScope(),cancel(),destroy()}`. Controls own monotonic generation and active token. `getPreparedScope()` returns null for full scope, otherwise `{generation,token,revision}` only after ready preview; unresolved scope throws `COUNTRY_REVIEW_REQUIRED`. Dialog owns prepared BIN bytes tagged by session/revision/generation/token. `onInvalidate` clears all scoped/prepared downloads immediately; `onPreview` publishes only a currently matching worker result.

- [ ] Write Playwright tests using existing `stubNetwork` and `openFixture`, route all three boundary files to a real hashed synthetic bundle from `packCountryData`, and initially assert no country-body request until country mode opens. Fixtures must go through the real worker and classification code.

```js
test('country export leaves the full project backup unchanged',async({page})=>{
 await stubNetwork(page);
 const e=await packCountryData([boxCountry('AA',-8,36,-6,38)]);
 await page.route('**/data/countries/manifest.json',r=>r.fulfill({json:e.manifest}));
 await page.route('**/data/countries/countries.json',r=>r.fulfill({contentType:'application/json',body:Buffer.from(e.bytes)}));
 await page.route('**/data/countries/NOTICE.json',r=>r.fulfill({contentType:'application/json',body:Buffer.from(e.noticeBytes)}));
 await page.goto('/mivue-trafficcam/');await openFixture(page);
 await page.getByRole('button',{name:'Export',exact:true}).click();
 await page.getByLabel('Export scope',{exact:true}).selectOption('countries');
 await page.getByLabel('Countries',{exact:true}).selectOption(['AA']);
 await page.getByRole('button',{name:'Preview selection',exact:true}).click();
 await expect(page.getByTestId('country-preview')).toContainText('Included');
 await expect(page.getByRole('button',{name:'Full project backup — not country-filtered',exact:true})).toBeEnabled();
});
```

- [ ] Run `npm run test:browser -- test/browser/country-export.spec.js`; confirm RED. Complete the example by downloading backup before/after selection and comparing JSON, downloading the scoped output and checking IDs/counts. Add a border fixture that blocks until explicit review, linked-extra acknowledgement and a deliberately blocked BIN that still permits scoped GeoJSON/full backup.
- [ ] Implement a labelled native scope select and searchable multiple select; show dataset labels/ISO codes and warning that scope follows dataset boundaries. Paginate classified/review lists at 100; use textContent for source-controlled labels. Bulk decisions name the category and affected count. Component actions clearly say keep/exclude entire linked section. Show separate BIN/reference totals, boundary version, uncertainty caveat and linked extras. No per-record map marker creation.
- [ ] Wire dialog buttons to scoped worker requests when selected, keeping full backup outside scope. Add companion report download for scoped CSV/BIN, active countries beside `Speedcam_Data_FEU.bin`, localized readable messages for every CountryError and preserved existing build errors. PL/EN technical details stay expandable. Failure never silently switches to full export. Scope/decision changes synchronously clear prepared bytes, increment generation and cancel older work before starting another request.

```js
// Apply the same identity check to every async preview/export response.
const requestIdentity={...getIdentity(),generation};
const result=await client.request('country-preview',payload);
if(requestIdentity.sessionId!==getIdentity().sessionId ||
 requestIdentity.revision!==getIdentity().revision ||
 requestIdentity.generation!==generation)return;
```

- [ ] Add browser tests for PL/EN, keyboard-only selection, narrow 390 px viewport, boundary corruption/retry, both direction link retention, cancelled slow classification and A→B→A selection races. Switch language/close/reopen during a pending build and assert no stale download button. Change project by edit, undo or import while preview exists and assert invalidation. Assert all-scope legacy exports and existing CANARD import behavior remain unchanged.
- [ ] Run focused tests, `npm test`, `npm run build:web`, full `npm run test:browser`, and `git diff --check`. Update README/TODO with actual counts and remaining limitations. Commit: `feat: add bilingual country export preview and review controls`.

### Task 6: Real-data performance, independent review and release evidence

**Files:** Add `scripts/countries/benchmark.mjs`; modify `docs/country-boundaries.md`, `docs/browser-verification.md`, `docs/deployment.md`, README/TODO. Change production code only to resolve demonstrated review/test failures with RED→GREEN evidence.

**Interfaces:** Benchmark consumes a local BIN path or `--synthetic 100000` and the checked-in validated boundaries; outputs only elapsed times, counts and asset sizes, never proprietary camera coordinates or bytes. Native execution concludes with one fresh whole-branch reviewer under executing-plans, followed by one fix pass as that skill prescribes.

- [ ] Implement the read-only benchmark around real classifier calls; use a deterministic lattice for synthetic global points. Do not include CLI inputs in build assets. Verify stable aggregate results on two runs and early abort on an already-aborted signal.

```js
const start=performance.now();
const result=await classifier.classifyMany(items,{signal:controller.signal,
 yieldControl:()=>new Promise(resolve=>setTimeout(resolve,0))});
console.log(JSON.stringify({points:result.size,elapsedMs:performance.now()-start,
 boundarySha256:classifier.boundary.sha256}));
// items comes from local parseDatabase records or the deterministic lattice;
// controller is a new AbortController; no project edits or network writes occur.
```

- [ ] Run `node scripts/countries/benchmark.mjs --synthetic 100000` and, if available, `node scripts/countries/benchmark.mjs /Users/szymonkocot/Projects/mivue-trafficcam/Speedcam_Data_FEU.bin`. Record actual duration and peak observed DOM rows from a browser preview. Exercise real-data cancellation and full sample byte-identical reconstruction. If the baseline is unavailable, record the skip; never report it as tested.
- [ ] Run all Node/browser tests, build with and without the accepted CANARD checkout, and `git diff --check`. Verify boundary hashes and attribution from the built artifact and assert private sample/firmware/research URLs remain unavailable. Record actual counts rather than copy previous totals.
- [ ] Perform the selected execution method's whole-branch review. Address important findings with failing tests and fixes, then rerun affected/full suites. Update README/TODO after the task; mark only evidenced items complete.
- [ ] With release authority still valid, integrate/push through the existing Pages workflow and verify the deploy job, pinned source/data SHAs and public artifact. If new authority is required, stop at that exact boundary. In fresh public Chromium use synthetic local records, select countries, review uncertainty/extras, download/reparse supported reduced BIN, verify a blocked case, notices/full backup and cache reuse. No test changes to hosted source data are needed.
- [ ] Record the released URL, source/data/boundary hashes, supported cases and outstanding binary/device/browser limitations. Commit `docs: record verified country export release`; leave points 3, 4 and 6 visible as remaining work.

## Plan self-review and handoff

Coverage: source/reuse and resource limits → Task 1; local geometry/uncertainty/caching → Task 2; links/sections/review decisions → Task 3; immutable exports/notices/BIN safeguards → Task 4; PL/EN/accessibility/races → Task 5; performance/review/deployment → Task 6. Review Focus conditions are assigned above. No new project schema, remote geocoder, guessed binary mapping or reduced backup format is introduced.

All test snippets are starting executable cases, with helper contracts/setup specified in their owning tasks; listed matrices expand those cases rather than substitute prose for the initial RED tests. The actual downloaded release hashes must be measured during Task 1. If the approved boundary size limits cannot be met without geometry changes, return to the spec instead of bypassing the limit.

Await user review of this plan before execution. Preserve native execution unless the user changes it.
