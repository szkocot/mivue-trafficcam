# Cross-browser verification — 2026-10-31

## Environment and reproducible commands

Local macOS 27.2 (26B123), arm64, Node 26.13.0 and pinned Playwright 1.63.0. Headless engines: Chromium 153.0.8010.12 (build 1243), Firefox 155.0 (build 1543), WebKit 26.6 (build 2359). These versions identify the tested engines, not a promise about every installed browser version.

```sh
npm ci
npx playwright install chromium firefox webkit
npm run test:browser
MIVUE_LIVE_SOURCE=1 npm run test:browser -- test/browser/live-source.spec.js
```

All three projects run by default. To select one, append `-- --project=firefox` (or `chromium` / `webkit`) to `npm run test:browser`. `MIVUE_BROWSER_PORT=4175` selects an alternate preview port; default is 4173. The suite builds and serves the allowlisted static output under `/mivue-trafficcam/`. CI installs all three pinned engines with their Linux dependencies and runs the same deterministic projects before producing the Pages artifact. Linux CI execution remains separate evidence from this local macOS run.

## Results

`MIVUE_BROWSER_PORT=4175 npm run test:browser` passed **201 tests with 3 intentional opt-in live-source skips** in 1.3 minutes: 67 passed and one skipped in each engine. No retries, forced clicks or timeout increases were needed. The private sample was present, so all six private-sample cases ran.

| Engine | Deterministic | Opt-in live Mio | Unchanged full BIN | Country preview rows |
| --- | --- | --- | --- | --- |
| Chromium | 67 pass, 1 skip | pass | byte-identical | 100 |
| Firefox | 67 pass, 1 skip | pass | byte-identical | 100 |
| WebKit | 67 pass, 1 skip | pass | byte-identical | 100 |

`MIVUE_BROWSER_PORT=4175 MIVUE_LIVE_SOURCE=1 npm run test:browser -- test/browser/live-source.spec.js` passed **3 tests** in 6.6 seconds. Each engine made one GET on startup and one HEAD after reload, with no repeat body GET. Browser CORS, IndexedDB persistence and unchanged detection worked against the official Mio endpoint at approximately 21:55 UTC. All exposed the same SHA-256 `69759a67d9442bfa1a636c38ccbc16623a2208ef34564e11f68ad0d696becdb1`, Last-Modified `Mon, 21 Sep 2026 03:00:53 GMT`, Content-Length `1532826`, and no exposed ETag. This is a point-in-time external-service check, not a long-term availability guarantee.

The builds performed by both commands passed. `git diff --check` passed. Node and broader integrated verification are recorded separately by the parent task; this record does not substitute browser tests for codec/source unit tests.

## Coverage and corrections

The deterministic suite blocks external tiles and stubs external sources. It covers local BIN/project file input; real file-chooser activation through the visible label; PL/EN imports and actionable errors; IndexedDB persistence, quota denial, transaction aborts and recovery; map/table editing and keyboard selection; full and reduced downloads with reparsing; country preview cancellation; CANARD caching/withdrawal; and emulated browser location, denied permissions and stale callbacks. Narrow 390 px layouts are exercised without claiming physical-mobile behavior.

The private 53,338-record Mio sample is available only locally. Each engine exercises its byte-identical unchanged BIN download, bounded DOM, worker responsiveness and real country-boundary preview. It is neither committed nor published; CI skips the two private-sample cases per engine when the file is absent. The separate live-source test is intentionally skipped in normal deterministic runs.

The initial WebKit run reproduced a real UI defect: the transparent file input intercepted clicks on the adjacent Import button. Clipping the visually hidden input prevents it from receiving pointer hits outside its intended control while preserving its accessible label and focus behavior. Existing CANARD/import tests failed before the CSS correction and passed afterward; the workspace test also opens the real file chooser through the label. No forced clicks or timeout increases were used.

The integration run also caught a format-selection regression: switching from CSV to GeoJSON cleared manually entered source fields. The shared import dialog now preserves local source fields and restores them after leaving OSM. Existing GeoJSON/error tests verify this. New PL/EN OSM cases reject unsupported relations, retry with a supported camera node, disclose OpenStreetMap/ODbL attribution and restore the reference after reload without changing the BIN record count.

## Limits and manual follow-up

Playwright WebKit is an automated WebKit build, not the installed Safari application. No physical iPhone/iPad/Android browser, native download/share destination, real GPS provider, operating-system permission prompt or MiVue 955W was tested. Browser emulation verifies application behavior; it does not verify physical positioning accuracy or device acceptance. Generated BINs remain experimental and use-at-own-risk.

For later manual testing, record browser/OS/device versions; open a backed-up local BIN; edit/save/reopen a project; download and reopen a full backup; retry after denying storage; check map/table use and imports in PL/EN; request and deny location while stationary; and inspect mobile download/share behavior. Keep physical MiVue acceptance in the separate hardware procedure. This record does not claim a new deployment or a fresh public-site release.


## 2026-11-01 follow-up

The subsequent Linux CI failure was a real loading/click race: worker completion removed the Working/Cancel control between mouse down/up and shifted the List tab away. The tabs now remain disabled during file loading. A paused-worker regression reproduces the boundary deterministically; 30 repeated Linux Firefox loading/mobile checks passed after the correction. [Deployment 41267095267](https://github.com/szkocot/mivue-trafficcam/actions/runs/41267095267) passed for `fb378cc`; fresh public Chromium confirmed PL/EN BIN field display, zero edits and no page errors. CI now retains failure traces for diagnosis.

The final local follow-up includes explicit OSM average-speed endpoint relations, offline audit-report safety/navigation, and firmware-scoped read-only BIN interpretation with unknown raw values retained. Node verification passed 284 tests with zero skips, including both private binaries. The final full browser suite passed 216 tests (72 per engine), with three intentional opt-in live skips, in 2.7 minutes. The physical-browser/device limits above still apply.

The separate opt-in live Mio check passed all three engines in 12.0 seconds on 2026-11-01. Each made one GET and one HEAD; all observed the unchanged official SHA-256 `69759a67d9442bfa1a636c38ccbc16623a2208ef34564e11f68ad0d696becdb1`, 1,532,826 bytes and Last-Modified 2026-09-21. No second body download was required.
