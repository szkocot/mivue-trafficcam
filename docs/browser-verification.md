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
