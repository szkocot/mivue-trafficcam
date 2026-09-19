# Browser editor verification — 2026-09-20

Environment: macOS 27.0 (26A428), arm64; Node 26.8.2; Playwright 1.63.0; Chromium 153.0.8010.12. Preview under `/mivue-trafficcam/`.

## Results before final independent review

- `npm test`: 82 passed, no skips/failures, including the optional local-sample codec test.
- `npm run build:web`: 33 allowlisted assets; no binaries, projects, firmware, fixtures, repository metadata or proprietary source data in output.
- `npm run test:browser`: 18 passed, one intentional skip (opt-in live-source check). External source/tile traffic is stubbed in deterministic tests.
- `MIVUE_LIVE_SOURCE=1 npm run test:browser -- test/browser/live-source.spec.js`: one passed against the live Mio endpoint. First visit made one GET; reload made one HEAD and no second GET. Browser-visible ETag was null; Last-Modified was `Thu, 16 Jul 2026 07:39:32 GMT`, Content-Length `1521542`, validated SHA-256 `2f01485c4d9910c9b9dce7fdc9355c3f8293e396d687526873c8537a4e0317f0`.
- `git diff --check`: clean.

The local 52,935-record sample produced no per-record DOM markers and at most 100 table rows. One observed run loaded in 802 ms and rebuilt in 844 ms, with 48 animation frames during loading. Timing varies by machine/run and includes UI/test overhead, not a general performance guarantee. Tests exercise raw editing, undo, downloaded project reopen, narrow viewport, keyboard selection, failed tiles and exact byte equality of unchanged binary downloads. The sample stays ignored and local.

## Failure and race cases

Storage denial, quota errors and real IndexedDB transaction aborts leave the working data editable and report save failure. Corrupt working envelopes remain available for recovery instead of being silently overwritten. Source checks cover unchanged downloads, unavailable/nonexposed metadata, malformed updates, offline reuse, cancellation and protection of an edited document from newer source data. Discard restores the project's original baseline even when the cache is newer.

A regression test exposed a startup priority bug: a manually selected file was ignored while the startup worker was busy. The file now cancels a not-yet-active startup decode and advances document intent; stale startup replies cannot replace it. Unit tests additionally defer save completion across document replacement/reset and reject stale worker responses.

## Limits

Only Chromium has been exercised; Firefox/WebKit and physical mobile browsers are not verified. Device acceptance on MiVue 955W remains untested. The live metadata check is opt-in to keep normal tests deterministic. Application assets require the static host/local preview; caching data does not make this an offline-installable application. No Pages deployment was enabled and no source binaries were published.
