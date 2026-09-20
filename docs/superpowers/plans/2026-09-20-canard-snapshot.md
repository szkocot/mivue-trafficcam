# Hosted CANARD Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver legally gated, attributed CANARD map snapshots through GitHub Pages, downloaded only when changed and safely synchronized into opted-in projects.

**Architecture:** A bounded Node fetcher and pure adapter produce validated, deterministic snapshots on a generated-data branch. The existing Pages deployment publishes them with the application. A separate browser cache feeds the existing revision-safe worker import engine; source notices and synchronization preferences survive project persistence.

**Tech Stack:** Existing Node 26 ES modules, node:test, vanilla browser JavaScript, IndexedDB, Leaflet, Playwright and GitHub Actions. A pinned LZString decoder is the only new product dependency permitted by this plan; verify its licence and exact version before installation.

**Spec:** [Approved design](../specs/2026-09-20-canard-snapshot-design.md). Read it together with [source-access research](../../source-access.md) before execution.

## Global Constraints

- “Bulk object-detail requests are disabled in this increment.”
- “Newly encountered fields or changed schema/terms stop publication for review rather than being copied blindly.”
- “Use a 30-second request timeout, at most two retries for transient transport/5xx failures, and backoff.”
- “The browser warns when that time is more than 48 hours old, independently of whether a failed upstream run could deploy its status.”
- “Source omissions do not delete user records.”
- “Missing speed, direction and status remain unknown.”
- “Existing Mio loading remains separate and unchanged.”
- “Update README and relevant source/deployment/browser documentation after each implementation task.”
- Enforce existing 20 MiB import, 100,000 observation, 1,000 section-vertex and 64 KiB per-observation metadata limits. No live network in ordinary tests.
- No automatic publication until the initial legal/schema/identity review passes. A schema anomaly override must identify the reviewed candidate digest, never a persistent skip-validation flag.
- Keep all UI text Polish/English. Never imply device acceptance, road-route accuracy, official endorsement or complete detail enrichment.

## Review Focus

1. CDN deployment skew: a manifest can reference a snapshot not yet reachable; retain validated cached data, never import half a release (Task 5).
2. A restored project has an old CANARD update while a new source fetch completes: wait for recovery and preserve unsaved forms/session identity (Tasks 6–7).
3. IDs churn while counts stay stable: require overlap validation, not just count checks (Task 3).
4. A proxy/login page returns HTTP 200 or a compressed payload expands dramatically: bounded decoding and schema rejection, not an empty replacement (Tasks 1–2).
5. A rights withdrawal arrives while a snapshot fetch is pending: cancel/invalidate pending results and prevent fallback to the revoked shared cache (Tasks 5–6).

## Execution and file map

This is one pipeline, executed in dependency order. Before implementation, use the worktree skill to establish an isolated checkout and preserve unrelated changes. Do not create the generated-data branch or enable scheduled publishing during planning.

| Unit | Files | Responsibility |
| --- | --- | --- |
| Upstream contract | `config/canard-review.json`, `docs/canard-field-inventory.md`, `scripts/canard/access.js` | Reviewed schema/terms, identity evidence, bounded public-page retrieval |
| Adapter | `src/canard-adapter.js`, `test/helpers/canard-fixture.js` | Decode recognized literal arrays; normalize reviewed fields without executing code |
| Snapshot | `src/canard-snapshot.js`, `scripts/canard/prepare.js` | Canonical bytes, manifest, notices, comparison gates |
| Project provenance | `src/source-notices.js`, existing project/ingestion/reconciliation/view/worker modules | Project v3 migration, source notices, sync setting, attributed exports |
| Browser cache | `web/canard-cache.js`, `web/storage.js` | Manifest check, verified cache replacement, withdrawal |
| Synchronization | `web/canard-sync.js`, source picker, app, locales, export dialog | Project opt-in, guarded atomic imports, status and notices |
| Publishing | `scripts/canard/publish.js`, `.github/workflows/pages.yml`, `scripts/build-web.mjs` | Data-only branch, serialized update/build/deploy, artifact allowlist |

The exact field inventory is deliberately an evidence gate in Task 1: existing research establishes client references, not a complete verified schema. Do not invent mappings to finish a task. If evidence cannot establish a required mapping or identity, report that blocker and keep publication disabled; synthetic test work may continue.

## Shared interfaces

Use namespace `pl.gitd.canard.public-map`. Source IDs are `JSON.stringify([category,String(upstreamId)])`, where category is `PP`, `OPP`, `RL` or `PK`.

```js
// NoticeBundle: plain JSON, safe strings/URLs, no HTML.
// { attribution, sourceUrl, termsUrl, licenceLabel, licenceUrl,
//   disclaimerPl, disclaimerEn, transformation, transformationVersion,
//   reviewedTermsSha256 }
// Snapshot: {schemaVersion:1, batch:{source,retrievedAt,observations}, notices}
// Active manifest: {schemaVersion:1, state:'active', sha256, byteLength,
//   path:`data/canard/snapshot-${sha256}.json`, counts:{PP,OPP,RL,PK},
//   total, retrievedAt, checkedAt, noticePath:'data/canard/NOTICE.json'}
// Disabled manifest: {schemaVersion:1, state:'disabled', checkedAt,
//   reasonCode:'RIGHTS_REVIEW', messagePl, messageEn}
// CacheEntry: {manifest, bytes:Uint8Array}; snapshot always validated from bytes.
// Prepared: {manifest,bytes:Uint8Array,noticeBytes:Uint8Array,changed:boolean}
```

`config/canard-review.json` has `version:1`, `publicationApproved:false` initially, `termsSha256`, `robotsSha256`, `fieldsByCategory`, `identityEvidence`, `notices` and `reviewedCandidateSha256`. Field descriptors specify original name, type, requiredness and permitted normalized meaning. Hash normalized visible reuse text, not a whole page containing timestamps. A reviewed candidate digest authorizes only that candidate; normal ongoing checks still apply.

Keep private raw responses and HTTP validators in Actions cache, not in the public data branch. A missing/evicted private cache causes an unconditional GET, not reliance on an unavailable 304 body. Public data contains only approved observations and notices.

### Task 1: Establish a reviewed upstream access contract

**Files:** Create `config/canard-review.json`, `docs/canard-field-inventory.md`, `scripts/canard/access.js`, `test/canard-access.test.js`; modify `docs/source-access.md`, `README.md`.

**Interfaces:** `fetchCanardPage({fetchImpl,signal,previous,sleep,now})` returns `{html,termsText,robotsText,validators,checkedAt}`. `previous` is private `{html,validators}` or null; `sleep(ms,signal)` and `now()` are injected for tests. It performs public map/robots retrieval only, never object-detail POSTs.

- [ ] Inspect published terms and public arrays read-only; record URLs, dates, category counts, field types, representative geometry and whether identifiers survive two distinct checks. Save raw material only in an ignored temporary directory. Record lack of evidence honestly; identical closely spaced fetches alone do not prove long-term stability.
- [ ] Inspect the decoder's primary package metadata/licence, pin an exact compatible version and record its attribution. Do not install unrelated tooling. Verify a reviewed decoder supports an output-size bound or implement a bounded decoding wrapper in Task 2; a size check after unbounded decompression is insufficient.
- [ ] Write failing access tests with fake responses, fake time and no live requests:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchCanardPage} from '../scripts/canard/access.js';
test('access denial does not retry', async () => {
  let calls=0;
  await assert.rejects(fetchCanardPage({
    fetchImpl:async()=>{calls++;return new Response('',{status:403});},
    previous:null, sleep:async()=>{}, now:()=>new Date('2026-09-20T00:00:00Z')
  }), {code:'CANARD_ACCESS_DENIED'});
  assert.equal(calls,1);
});
```

- [ ] Run `node --test test/canard-access.test.js`; confirm failure before implementation.
- [ ] Implement manual redirect checking against the exact CANARD HTTPS host and map/robots paths; omit credentials, identify the project, cap each body at 20 MiB, and abort each request after 30 seconds. Retry transient network/5xx failures at most twice with 1s/2s backoff. For 429 or Retry-After, defer when the delay exceeds the remaining 120-second total fetch budget. Never retry 401/403, unsafe redirects, terms/schema errors or cancellation. Use cached bodies only for valid conditional 304 responses; otherwise retry once unconditionally within the same budget.
- [ ] Add tests for redirect to another host, 200 login HTML, missing 304 body, timeout, 429/date Retry-After, cancellation during backoff and streamed oversized body. Assert total calls/time bounds, not just error messages.
- [ ] Record complete reviewed field descriptors and expected notice hashes. Leave `publicationApproved:false` until actual schema/identity/legal evidence is sufficient; no empty permission hashes or invented fields. If unresolved, document precisely what prevents enabling publication.
- [ ] Run access tests and `git diff --check`; update README/source research and commit as `feat: establish bounded CANARD source access`.

### Task 2: Decode public map arrays into canonical observations

**Files:** Create `src/canard-adapter.js`, `test/helpers/canard-fixture.js`, `test/canard-adapter.test.js`; modify `package.json`, `package-lock.json`, `docs/canard-field-inventory.md`, `README.md`.

**Interfaces:** `decodeCanardPage(html,{review,decode})` returns `{PP,OPP,RL,PK}` arrays. `normalizeCanardLayers(layers,{review,retrievedAt})` returns an existing `normalizeBatch`-compatible batch. `decode` accepts `(compressed,maxOutputBytes)` and throws on overflow. `makeCanardLayers()` creates synthetic reviewed-shape observations, one per category, with upstream ID 1 and valid Polish coordinates; `makeCanardHtml(layers)` encodes those arrays with the pinned decoder's compressor for tests.

- [ ] Write failing tests for four categories and category-qualified identities:

```js
test('same numeric ID in four layers stays distinct', () => {
  const batch=normalizeCanardLayers(makeCanardLayers(),{
    review, retrievedAt:'2026-09-20T00:00:00.000Z'
  });
  assert.equal(new Set(batch.observations.map(o=>o.sourceId)).size,4);
  assert.deepEqual(batch.observations.map(o=>o.status),Array(4).fill('unknown'));
  assert.ok(batch.observations.every(o=>o.speedKmh===null));
});
```

- [ ] Run `node --test test/canard-adapter.test.js`; confirm failure.
- [ ] Implement literal extraction for the four recognized assignment names from source research. Accept only the reviewed string-literal/empty-array representation, reject duplicate assignments, malformed compression and non-array JSON. Never use eval, Function, vm, DOM script execution or downloaded client code. Apply compressed input and incremental decoded output budgets before JSON parsing.
- [ ] Map only reviewed field descriptors. Build point coordinates as `[longitude,latitude]`, OPP geometry from both verified endpoints and original metadata identifying endpoint-only geometry. Missing a required endpoint rejects the snapshot. Retain reviewed original field values. Call `normalizeBatch` for existing strict limits; use safe object construction for arbitrary keys.
- [ ] Add test cases for unknown nested fields, HTML-looking metadata safely retained as text, absent/empty layers, numeric/string IDs, duplicate IDs, out-of-range coordinates, two identical OPP endpoints, malformed UTF data and decompression bombs. Identical endpoints must be flagged/rejected as invalid section geometry rather than described as a road route.
- [ ] Verify `node --test test/canard-adapter.test.js test/import-adapters.test.js test/import-limits.test.js`; update field inventory/README and commit as `feat: normalize reviewed CANARD map layers`.

### Task 3: Build deterministic snapshots and publication gates

**Files:** Create `src/canard-snapshot.js`, `scripts/canard/prepare.js`, `test/canard-snapshot.test.js`; modify `README.md`.

**Interfaces:** `prepareSnapshot({batch,notices,previous,checkedAt,review})` returns `Promise<Prepared>`, with `previous:CacheEntry|null`. `validateSnapshot(bytes,manifest)` returns `Promise<Snapshot>`; `validateManifest(value)` returns a validated active/disabled manifest. `prepareCanard({access,review,previous})` coordinates Tasks 1–3 without writing to GitHub. Use `crypto.subtle` SHA-256 in shared code.

- [ ] Write failing deterministic/reuse tests using the Task 2 synthetic fixture:

```js
test('successful unchanged check reuses bytes and retrieval date', async () => {
  const first=await prepareSnapshot({batch,notices,previous:null,checkedAt:t1,review});
  const next=await prepareSnapshot({batch:{...batch,retrievedAt:t2},notices,
    previous:first,checkedAt:t2,review});
  assert.deepEqual(next.bytes,first.bytes);
  assert.equal(next.manifest.retrievedAt,t1);
  assert.equal(next.manifest.checkedAt,t2);
  assert.equal(next.changed,false);
});
```

- [ ] Run `node --test test/canard-snapshot.test.js`; confirm failure.
- [ ] Canonicalize source/notices/observations with recursively sorted object keys and observations sorted by sourceId using code-point ordering. Compare semantic content excluding retrieval/check timestamps. On unchanged content return prior bytes; otherwise serialize `{schemaVersion:1,batch,notices}` once as UTF-8 with a trailing newline, hash those exact bytes and generate the manifest/counts/notice bytes.
- [ ] Reject missing notices, invalid hashes/timestamps/counts, future check times more than five minutes ahead, unsupported schemas and any path other than `data/canard/snapshot-<64 lowercase hex>.json`. For each previous category require at least 80% count and identity overlap and no nonempty-to-empty transition. Test 20% versus greater-than-20% boundaries and full ID churn at unchanged count. A reviewed digest exemption applies only to anomaly comparisons, never schema/rights validation.
- [ ] In `prepareCanard`, check current normalized terms/robots against the review record, require publication approval and sufficient identity evidence for public output, then run whole-candidate validation. Synthetic tests use an explicitly synthetic approved review fixture; never change production approval for a test.
- [ ] Add tests that terms/provenance changes produce a different hash, ordering changes do not, bytes/hash/length/count disagreement rejects, one invalid record rejects everything, and private fetched HTML/validators are absent from all output bytes.
- [ ] Run snapshot/adapter tests and `git diff --check`; update README and commit as `feat: validate content-addressed CANARD snapshots`.

### Task 4: Persist synchronization settings and source notices safely

**Files:** Create `src/source-notices.js`, `test/source-notices.test.js`; modify `src/project.js`, `src/ingestion-state.js`, `src/reconcile.js`, `src/import-view.js`, `web/worker-session.js`, `web/worker-client.js`, `test/project.test.js`, `test/ingestion-state.test.js`, `test/worker-session.test.js`, `test/import-view.test.js`, `README.md`.

**Interfaces:** Project v3 adds optional `notices:NoticeBundle` and `syncEnabled:boolean` to ingestion source entries. v1/v2 migrate to v3 with existing content intact and `syncEnabled:false`; absent notices remain absent for older/local imports. `validateNotices(value)` returns a safe NoticeBundle. `projectNotices(project,{encodedOnly=false})` returns notice bundles for contributing sources. New worker requests: `import-canard` payload `{bytes,manifest,enableSync,expectedRevision}` and `source-sync` payload `{namespace,enabled,expectedRevision}`. Snapshots expose `sourceSync:[{namespace,enabled}]`. `import-canard` returns `{snapshot,summary}`.

- [ ] Write migration and strict-state tests before changing schemas:

```js
test('v2 never silently opts into synchronization', async () => {
  const loaded=await loadProject(JSON.stringify(v2Fixture));
  assert.equal(loaded.projectVersion,3);
  assert.ok(loaded.ingestion.sources.every(s=>s.syncEnabled===false));
  assert.deepEqual(loaded.records,v2Fixture.records);
});
```

- [ ] Run project/state tests to observe failure. Implement explicit v1→v2→v3 migration and update all version-specific key checks, constructors and serialization. Search with `rg -n 'projectVersion|version.*2' src web test` and review every match; do not mechanically relax unknown-field rejection.
- [ ] Validate notice lengths, known fields and HTTP(S) URLs; reject unsafe schemes and non-JSON values. Keep full notices on source entries, not duplicated inside every observation. Reconciliation must retain source extensions when replacing attribution/content digest; generic local imports cannot enable the reserved CANARD namespace's synchronization or impersonate a verified hosted import.
- [ ] Implement `import-canard` by validating the bytes/manifest inside the worker, reconciling into a candidate project, attaching notices/sync preference, validating the complete candidate and committing once. Check session and expected revision before mutation. A failure after reconciliation still leaves history untouched. Add `source-sync` as an undoable validated transaction. Update worker-client snapshot acceptance for new result shapes.
- [ ] Add worker tests for atomic first opt-in, repeat no-op, stale revision, corrupt bytes, disabling sync, notice-only change, local reserved-namespace rejection, manual edit/deletion preservation and unsupported status/type remaining reference-only. Keep existing local namespaces usable, including previously saved projects.
- [ ] Extend reference GeoJSON with a top-level source-notices collection; project export retains notices. `projectNotices(...,{encodedOnly:true})` includes only sources contributing to active encoded records through bindings/provenance, not merely unbound map references. Test mixed and deleted records.
- [ ] Run `npm test`; update README with v3 compatibility (older releases cannot reopen v3), update project/import documentation and commit as `feat: persist CANARD sync and attribution in projects`.

### Task 5: Add a separate verified browser snapshot cache

**Files:** Create `web/canard-cache.js`, `test/canard-cache.test.js`; modify `web/storage.js`, `test/browser/persistence.spec.js`, `README.md`.

**Interfaces:** Storage adds `getCanardCache()`, `putCanardCache(entry)`, `clearCanardCache()` using a separate `canard` object store. `createCanardCache({store,fetchImpl,baseUrl,now,onStatus})` returns `{loadCached,check,cancel}`. `check()` is once-per-instance/startup, deduplicated; returns validated `{manifest,snapshot,bytes}` or null. `loadCached()` validates independently. Disabled manifests return null and emit `disabled`; failures emit status without erasing a valid cache.

- [ ] Write failing call-count and atomic-replacement tests:

```js
test('concurrent startup checks fetch one manifest and no unchanged body', async () => {
  const calls=[];
  const cache=createCanardCache({store:storedValidEntry,
    baseUrl:'https://example.test/mivue-trafficcam/',now:()=>t2,
    fetchImpl:async url=>{calls.push(String(url));return Response.json(manifest);}
  });
  await cache.loadCached();
  await Promise.all([cache.check(),cache.check()]);
  assert.deepEqual(calls,['https://example.test/mivue-trafficcam/data/canard/manifest.json']);
});
```

- [ ] Run `node --test test/canard-cache.test.js`; confirm failure.
- [ ] Upgrade IndexedDB to version 2, creating `canard` without touching `source` or `working`. Implement delete transactions and keep completion as the durability boundary. Handle blocked upgrade with visible persistence failure and in-memory operation, not database deletion.
- [ ] Fetch manifest with `cache:'no-cache'`, credentials omitted and redirect rejection. Resolve reviewed manifest paths against the app base path, verify origin and exact path grammar, bound response sizes, then validate body/hash/notice content. Persist only the fully validated replacement. Do not fall back from a failed new body to unchecked bytes.
- [ ] Keep operation-generation tokens so cancellation/disable invalidates a pending download even if a mock/network ignores AbortSignal. On disabled manifest clear in-memory data before awaiting persistent deletion; block cached fallback even if deletion fails. Record/report the persistence error without losing disabled status.
- [ ] Test CDN skew (new manifest, body 404), corrupt cached bytes, wrong hash/size/path, network failure, >48h stale timestamp, quota errors, unchanged manifest updating freshness only, cancellation, disabled-manifest race and IndexedDB upgrade retaining Mio/autosave data. A subsequent fresh browser with persistent storage unavailable may redownload; UI must not promise durable caching in that case.
- [ ] Run cache tests and targeted persistence browser tests; update README and commit as `feat: cache verified CANARD snapshots separately`.

### Task 6: Integrate guarded synchronization and bilingual UI

**Files:** Create `web/canard-sync.js`, `test/canard-sync.test.js`, `test/browser/canard.spec.js`; modify `web/app.js`, `web/import-dialog.js`, `web/import-sources.js`, `web/export-dialog.js`, `web/locales/en.js`, `web/locales/pl.js`, `web/index.html`, `web/styles.css`, `scripts/build-web.mjs`, `test/import-sources.test.js`, `test/web-build.test.js`, `README.md`, `docs/browser-editor.md`.

**Interfaces:** `createCanardSync({getContext,importSnapshot,onStatus})` returns `{offer,flush,setEnabled,markHandled,dispose}`. `getContext()` returns `{sessionId,revision,ready,dirty,busy,enabled}`. `offer(entry)` queues the latest validated cache result; `flush()` invokes `importSnapshot(entry,{sessionId,expectedRevision})` only when ready/enabled/not dirty/not busy and not handled in that session. `markHandled(sha256)` prevents immediate reapplication after undo; explicit reapply clears that hash via `offer(entry,{reapply:true})`. A session change discards in-flight results; failed imports do not mark hashes handled.

- [ ] Write failing orchestration tests with controllable context and deferred import promises:

```js
test('unfinished form delays rather than discards update', async () => {
  let context={sessionId:1,revision:3,ready:true,dirty:true,busy:false,enabled:true};
  let imports=0;
  const sync=createCanardSync({getContext:()=>context,
    importSnapshot:async()=>{imports++;},onStatus:()=>{}});
  sync.offer(entry); await sync.flush(); assert.equal(imports,0);
  context={...context,dirty:false};
  await sync.flush(); assert.equal(imports,1);
});
```

- [ ] Run `node --test test/canard-sync.test.js`; confirm failure. Implement a single queued candidate, session fence and per-session handled-hash set. Re-read context immediately before worker request and reject changed revisions; retry stale work only after acquiring fresh context, never in a tight loop. Disabled source cancels the queue and prohibits applying already cached offers.
- [ ] Wire one startup cache check after storage initialization, independent of project opt-in. Reuse `accept()`/autosave after successful worker import, without bypassing recovery prompts. Add a CANARD choice in the import dialog, explicit first-import disclosure, per-project sync toggle and explicit reapply action. Preserve local file imports and existing template disclosures. Source available means a valid hosted snapshot exists, not merely that a registry item has been enabled.
- [ ] Add translated source status with separate retrieval/check times, cached/stale/failed states, persistence warning, public-map-only coverage and endpoint-not-route explanation. Never overwrite a persistence warning with a generic ready message. Use textContent for metadata/notices and safe links. Add all new browser/shared modules to the build allowlist; include the decoder licence only if decoder code is shipped to the browser (it should remain Node-only).
- [ ] Expose a source-notice download alongside BIN/CSV/record-only exports when CANARD contributions are present; include notices directly in JSON/GeoJSON where supported. Bind prepared BIN and notice to the same session/revision. Keep an explicit notice button because browsers may block multiple automatic downloads. Show a reminder to retain the companion notice when distributing the BIN. Existing project/reference exports contain notices without a separate action.
- [ ] Add deterministic Playwright routes for hosted manifest/body and test first import, opt-in persistence, reload without snapshot redownload, changed snapshot automatic merge, edit protection, undo suppression/reapply, project switch mid-download, pending recovery, stale warning, disabled-source behavior and both languages. Verify synthetic source speed is displayed but raw BIN speed bytes are untouched.
- [ ] Run `node --test test/canard-sync.test.js test/import-sources.test.js test/i18n.test.js`, `npm run build:web`, and `npm run test:browser -- test/browser/canard.spec.js test/browser/imports.spec.js`; update README/browser guide and commit as `feat: synchronize CANARD snapshots with protected edits`.

### Task 7: Publish data-only snapshots through serialized Pages deployment

**Files:** Create `scripts/canard/publish.js`, `test/canard-publish.test.js`; modify `.github/workflows/pages.yml`, `scripts/build-web.mjs`, `test/web-build.test.js`, `docs/deployment.md`, `docs/source-access.md`, `README.md`.

**Interfaces:** `publishPrepared({prepared,expectedParent,git,review})` writes exactly manifest, current snapshot and NOTICE to branch `canard-data`, returning its commit SHA. `git` is an injected command adapter for deterministic tests, never shell-interpolated upstream values. A build input `--canard-dir <validated-checkout>` supplies data to `build-web.mjs`; no input builds a usable app with CANARD unavailable. Publication requires repository variable `CANARD_PUBLICATION_ENABLED=true` AND the approved review record.

- [ ] Write failing publisher tests for expected-parent mismatch and non-data output rejection:

```js
test('concurrent publisher cannot overwrite a newer data commit', async () => {
  await assert.rejects(publishPrepared({prepared,expectedParent:'a'.repeat(40),
    review,git:fakeGit({remoteHead:'b'.repeat(40)})}),{code:'CANARD_PUBLISH_CONFLICT'});
});
```

- [ ] Run `node --test test/canard-publish.test.js`; confirm failure. Implement an isolated temporary index/worktree or Git plumbing that creates data-only commits without checking generated files into the source workspace. Create the initial branch only if absent; later pushes must be normal fast-forwards against the exact expected parent. Reject symlinks and unknown filenames. Do not force-push or delete unrelated refs/files.
- [ ] Extend the existing Pages workflow, retaining its single workflow-level `github-pages` concurrency group. Add one daily off-minute UTC schedule and manual inputs for update/withdrawal. Schedule is inert unless the publication variable is enabled. Resolve current main and data heads after acquiring serialization; all build steps use those pinned SHAs. Do not nest another same-group workflow and deadlock. Use a conditional fetch/prepare/publish job, then existing verified build/deploy jobs directly in that run, not bot-push triggers.
- [ ] Pin any new actions to reviewed full SHAs. Keep preparation read-only and publication contents-write scoped to its job; deployment retains pages/id-token permissions only. No secrets in pull-request jobs, no generated branch workflow execution, no use of upstream strings in shell source. Failed update does not publish a new checkedAt or replace the active deployment; ordinary code deployments use last accepted data.
- [ ] Add build validation for exact snapshot hash/counts/notices and deterministic allowlisted copying. A disabled manifest publishes no snapshot, removes it from the new Pages artifact and cannot accidentally resurrect older data on a later code deployment. Previous data-branch history remains recoverable; withdrawal docs distinguish removing hosted files from purging public Git history.
- [ ] Test build with no dataset, valid dataset, malicious file/symlink, mismatched hash, disabled source, arbitrary old files in dist and data read at a pinned commit. Test publisher no-op, heartbeat-only manifest update, compare-and-swap conflict and source-fetch failure retaining previous bytes/check time. Document how to disable scheduling and publish withdrawal without accessing CANARD.
- [ ] Run publisher/build tests, `npm test`, `npm run build:web`, and `git diff --check`; update README/deployment/source-access docs and commit as `ci: publish validated CANARD snapshots with Pages`.

### Task 8: Complete release gates and live verification

**Files:** Modify `docs/browser-verification.md`, `docs/deployment.md`, `docs/roadmap.md`, `docs/source-access.md`, `config/canard-review.json`, `README.md`; create `scripts/canard/verify-live.mjs` only if a reusable read-only smoke check is needed.

**Interfaces:** No new application interface. Release consumes the exact reviewed source/data commit SHAs and a written initial-publication decision. Do not mark detail enrichment or country filtering complete.

- [ ] Run the complete deterministic regression suite in the isolated checkout:

```sh
npm test
npm run build:web
npm run test:browser
git diff --check
```

- [ ] Inspect actual reviewed field inventory, category counts, notices and cross-check identity evidence. Run a bounded live prepare check with publication disabled and compare its digest to the reviewed candidate. If any gate is unresolved, leave publishing off and report the specific missing evidence; do not request a blanket waiver of lawful reuse.
- [ ] Complete the selected execution method's whole-branch review and resolve important findings with failing-then-passing regression tests. Record real test counts and remaining limitations, never copy old counts from README.
- [ ] With release authority and all gates satisfied, integrate/push tested changes, enable the repository publication variable and trigger the workflow. Verify the Actions result and exact deployed commits; a push alone is not successful deployment. If new authority is needed for a permission request or destructive history purge, stop and ask.
- [ ] In fresh Chromium at the public Pages URL, verify manifest/body status, matching hash/counts, attribution and PL/EN. Import CANARD into a synthetic project, edit/save/reopen/export, and confirm no hardware-compatibility claim. Reload with storage retained and assert zero full snapshot body requests when the hash is unchanged. Confirm local sample BIN/firmware paths are absent from the deployment.
- [ ] Record results and update README/roadmap/deployment notes, commit as `docs: record verified CANARD snapshot release`, and report the live URL with any remaining limitations. Do not enable live bulk detail access as part of this task.

## Plan self-review and handoff

Coverage: access/legal boundaries → Tasks 1, 3, 7–8; all-layer normalized metadata → Task 2; deterministic validated publication → Tasks 3, 7; project persistence/notices/export → Tasks 4, 6; startup caching/withdrawal → Task 5; guarded merge/undo/PL–EN → Task 6; complete release checks → Task 8. All five Review Focus conditions have explicit test assignments.

The user approved this plan and selected native execution on 2026-09-20. Task 1's access implementation and field inventory are verified; production publication remains disabled because the observed PK placeholder cannot meet the approved usable-four-category requirement. Obtain coverage direction before continuing through that gate. Tasks 2–8 and the independent whole-branch review remain outstanding.
