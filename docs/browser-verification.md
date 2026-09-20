# Browser editor verification — 2026-09-20

Environment: macOS 27.0 (26A428), arm64; Node 26.8.2; Playwright 1.63.0; Chromium 153.0.8010.12. Preview under `/mivue-trafficcam/`.

## Final results after review fixes

- `npm test`: 83 passed, no skips/failures, including the optional local-sample codec test.
- `npm run build:web`: 33 allowlisted assets; no binaries, projects, firmware, fixtures, repository metadata or proprietary source data in output.
- `npm run test:browser`: 23 passed, one intentional skip (opt-in live-source check). External source/tile traffic is stubbed in deterministic tests.
- `MIVUE_LIVE_SOURCE=1 npm run test:browser -- test/browser/live-source.spec.js`: one passed against the live Mio endpoint. First visit made one GET; reload made one HEAD and no second GET. Browser-visible ETag was null; Last-Modified was `Thu, 16 Jul 2026 07:39:32 GMT`, Content-Length `1521542`, validated SHA-256 `2f01485c4d9910c9b9dce7fdc9355c3f8293e396d687526873c8537a4e0317f0`.
- `git diff --check`: clean.

The local 52,935-record sample produced no per-record DOM markers and at most 100 table rows. The final observed run loaded in 804 ms, applied and autosaved an edit in 871 ms, and rebuilt in 843 ms, with 48 animation frames during loading. Timing varies by machine/run and includes UI/test overhead, not a general performance guarantee. Tests exercise raw editing, undo, downloaded project reopen, narrow viewport, keyboard selection, failed tiles and exact byte equality of unchanged binary downloads. The sample stays ignored and local. Repeated source-race/sample runs also passed. Desktop (1440px) and narrow (390px) synthetic-data screenshots were visually inspected.

## Failure and race cases

Storage denial, quota errors and real IndexedDB transaction aborts leave the working data editable and report save failure. Corrupt working envelopes remain available for recovery instead of being silently overwritten. Source checks cover unchanged downloads, unavailable/nonexposed metadata, malformed updates, offline reuse, cancellation and protection of an edited document from newer source data. Discard restores the project's original baseline even when the cache is newer.

A regression test exposed a startup priority bug: a manually selected file was ignored while the startup worker was busy. The file now cancels a not-yet-active startup decode and advances document intent; stale startup replies cannot replace it. Unit tests additionally defer save completion across document replacement/reset and reject stale worker responses.

## Limits

Only Chromium has been exercised; Firefox/WebKit and physical mobile browsers are not verified. Device acceptance on MiVue 955W remains untested. The live metadata check is opt-in to keep normal tests deterministic. Application assets require the static host/local preview; caching data does not make this an offline-installable application. No Pages deployment was enabled and no source binaries were published.

## Independent review and fix evidence

A fresh read-only reviewer inspected `757db80..93cc9e2`. Four Critical/Important findings were reproduced with failing tests and fixed in one pass:

1. A failed working-project read could trigger an official-baseline autosave over unread edits. Startup now blocks automatic activation on read failure and requires retry or explicit replacement.
2. Delayed storage initialization replaced the active autosave session. One serialized autosave instance now waits for storage readiness and retains its document session.
3. Coordinate/raw and link-resolution drafts could discard each other's fields. The form commits a validated atomic operation array as one undo state, or retains the entire draft on failure.
4. Build errors carried record IDs in `issues[]`, while the dialog only looked at top-level IDs. The dialog now renders deduplicated issue links that select the affected record.

Additional UI coverage verifies aggregate-click zoom, single-point/table selection, and Polish map zoom labels. The labels were corrected after a failing localization test. All final suites are green; the author verified the fixes without a second reviewer dispatch.

Deferred minor: a cache persistence error is followed immediately by a source-ready/unchanged message. The data remains usable in memory, but the cache-specific storage warning should remain visible independently in a follow-up. Working-project save failures remain visible.

Execution decisions: used the existing in-place feature-branch workflow (no separate directory isolation); left physical device acceptance unverified (compatibility risk), browser verification Chromium-only (other-browser risk), and Pages/offline installation outside scope (host/local preview still required). Added atomic form-operation arrays to history (larger edit surface, covered by rollback/undo regressions). These decisions do not authorize publication or binary-format expansion.
# Browser-location increment — 2026-09-20

Independent read-only review of `e3d7a6d..acf3c60` found no Critical/Important issues and judged the location increment ready to merge; all 20 controller tests were independently rerun successfully. Its one minor finding, contradictory README implementation-status wording, was corrected during integration into `main`. The reviewer declined no additional behavior judgments.

On `feat/browser-location`, all 103 Node tests pass (20 new controller cases) and all 33 deterministic browser tests pass (10 new location cases); the opt-in live-source test is skipped. The allowlisted web build contains 34 assets. The first controller run failed the missing-interface assertions; the first browser run failed on absent location controls before implementation.

Coverage includes no startup request, one-shot browser location, accuracy/fix-time display, PL/EN, pending cancellation, stale/duplicate callbacks, explicit retry, denied/unavailable/timeout/unsupported/insecure states, invalid coordinates/timestamps, document replacement, no project/storage/export changes, no extra application requests, narrow-screen drafts and persisted pagehide recovery. Location uses a dedicated noninteractive map layer, not camera records. Browser tests use injected or Chromium-emulated positions, not physical GPS.

The existing 52,935-record sample still passes byte-identical build and worker responsiveness tests (observed load 804 ms, edit 903 ms, build 851 ms, 47 animation frames during load). Synthetic desktop 1440px and Polish mobile 390px screenshots were inspected; controls wrap without horizontal overflow. Background tile availability is not required for location or editing.

Execution decisions: retained the existing feature-branch checkout (no directory isolation); reject out-of-Date-range timestamps so rendering cannot throw (malformed-provider inputs excluded); persisted pagehide clears location but retains a usable controller for browser back/forward cache recovery (tested). GitHub Pages deployment is authorized only after the remaining work is complete and verified; this increment is not deployed.

## Source-ingestion increment — 2026-09-20

Pre-review gates on `feat/source-ingestion`: 133 Node tests pass; 40 Chromium browser tests pass, one opt-in live-source check skipped; 46 allowlisted build assets; clean `git diff --check`. This does not claim live CANARD ingestion, physical-device acceptance, cross-browser coverage or Pages deployment.

Coverage includes strict CSV/GeoJSON normalization, stable identities and hostile keys, migration, atomic undo/redo, source conflicts, manual coordinates/deletions, repeat-import/no-autosave behavior, source category transitions, explicit template raw-byte preservation, reference exports, cancelled file read followed by document replacement, draft guards, denied storage recovery, PL/EN and presentation preference persistence. Unit tests accept exactly 100,000 synthetic observations and reject 100,001. Browser imports 100,000 observations with 100 reference table rows, <=200 labels and no per-point DOM markers. The latest observed import was 5423 ms; this is a measurement, not a promised time limit.

The 52,935-record local sample loads and rebuilds byte-identically with both label toggles enabled. Observed load 804 ms, edit 883 ms, build 849 ms, 53 animation frames during load. Desktop and 390px mobile synthetic screenshots were inspected; mobile has no horizontal document overflow. Reference metadata stays read-only and source strings are text. Tests found and corrected lingering busy/hidden-selection notices and duplicate pagination names.

Initial regression runs reproduced unnecessary history on repeated template setup, missing inactive-source flags, rejection on a point-to-section transition and loss of explicit manual ownership when a coordinate was edited back to its prior value. Each was corrected and rerun; final suites above are green. A point-to-unsupported transition retains the BIN record, detaches the source binding and protects its coordinates as manual, leaving the new geometry visible as a reference. Cancel is available during file reading/parsing, but not after atomic commit dispatch. Final independent whole-branch review is pending.

### Independent review and final gate

A fresh read-only reviewer inspected `f9850ce..ad554da` and independently passed 30 focused Node tests. No Critical findings; two Important findings were reproduced with failing tests and fixed in one pass:

- Detaching an unsupported source identity now persists explicit reference-only disposition. Reopening and later importing a moved active camera cannot create another record or bypass an earlier manual deletion. Tested both retained and deleted originals.
- Import setup displays the saved policies for its namespace and explains in PL/EN that blank template input retains them. Switching namespaces updates the disclosure before file selection. New policy configuration still requires acknowledgement.

The author reran the entire suite after fixes: **134 Node tests, 41 browser tests pass**, one opt-in live-source check skipped, 46 allowlisted assets, clean diff check. No second reviewer was dispatched. Deferred Minor: internal parser issue codes such as `DUPLICATE_ID` and `CSV_QUOTE` need localized actionable descriptions; the surrounding messages are translated. The earlier cache-status minor remains a separate tracked item.

Review boundaries remain explicit: live CANARD schemas/parsing are deferred after the CORS gate; country filtering and Pages are separate increments; physical-device acceptance is unverified; location internals belong to the reviewed companion increment, with its regression suite retained here.

### Local integration — 2026-09-20

By user choice, `feat/source-ingestion` was fast-forward merged into local `main` at `dcf3f49` after confirming the remote base was current. Verification on the merged tree passed all 134 Node tests, 41 browser tests (one opt-in live-source check skipped), the 46-asset web build and diff checks. README/roadmap now reflect local integration. Nothing was pushed or deployed; the merged feature-branch name can be removed without losing its commits.

### Pages publication — 2026-09-20

The subsequent explicit “push and deploy” request authorized releasing the current experimental version before live CANARD/country filtering completion. `main` was pushed and [Pages deployment 35503630138](https://github.com/szkocot/mivue-trafficcam/actions/runs/35503630138) succeeded for `459e92c`. CI passed 133 Node tests plus 40 browser tests; absent private-sample checks and the optional live-source browser test were skipped. Only 46 allowlisted static assets were published.

Fresh-browser public-site verification passed: HTTPS, PL/EN, official Mio startup load (52,935 records), synthetic BIN open/edit/validated export and reparse (latitude 37.1), CSV reference import with displayed speed, worker/core asset 200 responses, private sample URL 404, zero page errors. See [deployment record](deployment.md). No physical GPS or device acceptance was tested.
