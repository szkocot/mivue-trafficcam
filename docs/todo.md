# Remaining work

Handoff updated **2026-09-29** from the agreed follow-up list. The user authorized implementing points **1–4 and 6**. Points **1 and 2 are completed and deployed**; points **3, 4 and 6 remain open**. Point 5 requires separate user/device testing. Binary research may be needed before some reduced BIN builds can succeed.

Last verified release: **2026-09-21**, source `c8f3f99`, with release documentation committed as `281285b` on `main`. That release passed 237 local Node tests and 62 Chromium tests (one opt-in live-source skip). These are recorded results, not a fresh test or live-service check on the handoff date. The merged country-export branch/worktree was removed; do not recreate its completed implementation.

## Resume here

Suggested order (not a new scope approval):

1. **Point 6 — polish:** actionable PL/EN import errors, persistent Mio cache warnings, then Firefox/WebKit coverage. Track physical mobile testing separately.
2. **Point 3 — sources:** assess permitted CANARD enrichment and OSM/other source access before choosing an adapter to implement.
3. **Point 4 — binary research:** investigate header/link blockers and verify field meanings before enabling more encoding controls.
4. **Country-export minor:** use reviewed ISO codes in data filenames, falling back to stable dataset IDs. Keep the device BIN filename unchanged.
5. **Point 5 — hardware:** only when the user is ready to test the MiVue 955W safely.

Before implementation, inspect `git status`, recent commits and this checklist; check for changes since the recorded release. Agree the next bounded increment, run relevant baseline tests, and preserve unrelated user edits. Update this list and README after each task. Keep merge/push/deployment decisions explicit; this handoff request itself authorizes documentation only.

Copy/paste to resume:

> Continue the MiVue TrafficCam project in /Users/szymonkocot/Projects/mivue-trafficcam. Read docs/todo.md and README.md first, and check the current working tree. CANARD publication and country exports are already completed and deployed. Resume with point 6: actionable Polish/English import errors and persistent Mio cache warnings, followed by browser coverage. Keep points 3 and 4 on the backlog. Preserve full backups and BIN safety checks, add regression tests, and update README/TODO after each task. Do not assume device acceptance or legal permission for new sources.

Useful references: [deployment evidence](deployment.md), [browser verification](browser-verification.md), [CANARD access assessment](source-access.md), [CANARD field inventory](canard-field-inventory.md), [binary research](binary-format.md), [firmware research](firmware-research.md), [country boundaries](country-boundaries.md).

## Completed baseline

The existing baseline includes decoding/rebuilding the researched BIN layout, the PL/EN map editor, CSV/GeoJSON imports, source metadata display, browser location and startup caching. Hosted CANARD implementation and review fixes are merged, pushed and deployed with the reviewed dataset.

## 1. Activate CANARD data — release work

- [x] Obtain explicit approval to publish the reviewed dataset and enable daily updates — user requested implementation of point 1 on 2026-09-20.
- [x] Recheck the release gates and publish the exact approved candidate with attribution; fresh validation reproduced the reviewed digest.
- [x] Enable the repository publication variable only after the review record permits publication.
- [x] Verify the Actions result, deployed source/data commits, manifest hash and counts — run `35529021193`, source `f95ea5f`, data `7bb196e`.
- [x] In a fresh browser on the public site, verify PL/EN, import/edit/save/reopen/export, notices and reload without an unchanged snapshot-body download.
- [x] Confirm sample BIN, firmware and private research files remain absent from the public artifact; record the deployment evidence.

Published coverage: 499 point-speed, 138 OPP and 169 red-light observations. Control-point data is unavailable, not a verified zero. Daily gated checks are enabled; the first observed scheduled run, [35581370719](https://github.com/szkocot/mivue-trafficcam/actions/runs/35581370719), successfully prepared, published, built and deployed on 2026-09-21. See [release evidence](deployment.md), [access assessment](source-access.md) and [field inventory](canard-field-inventory.md). Reuse safeguards are not legal certification.

## 2. Country selection — implementation

Released and public-browser verified on 2026-09-21: [deployment 35622164123](https://github.com/szkocot/mivue-trafficcam/actions/runs/35622164123), source `c8f3f99`, accepted data `3597190`. The [six-task country-export plan](superpowers/plans/2026-09-20-country-export.md) is complete, including review fixes, integration and public verification. Its internal task numbers are separate from this backlog's numbered points.

Decision-only cancellation preserves completed classifications; review rows disclose coordinates, candidate countries, names and linked IDs. Full backups remain unfiltered. Unknown headers/links can still block reduced BINs; there is no force-build bypass or guarantee that a Poland-only BIN will work on the 955W.

- [x] Let users select one or more countries for a reduced export, separately from map display filters.
- [x] Use a versioned boundary dataset with verified reuse terms and attribution — pinned Natural Earth 5.1.1; see [evidence](country-boundaries.md).
- [x] Define handling for border points, unknown/invalid coordinates and cross-border OPP before implementation.
- [x] Preview kept, excluded and unresolved records; preserve linked OPP endpoints and the original project for recovery.
- [x] Build and reparse the reduced BIN, or explain why unresolved links/header semantics prevent a safe build. Do not bypass existing encoder safeguards.
- [x] Integrate and deploy the country-export branch; verify the public artifact and fresh-browser workflows.

See [country-selection requirements](roadmap.md#shared-project-model).

- [ ] Deferred minor: use reviewed ISO codes in scoped data filenames where available, with stable dataset-ID fallback. Retain `Speedcam_Data_FEU.bin` for device output and stable IDs in reports.

## 3. Additional sources and richer metadata — research and implementation

- [ ] Add OSM and other website adapters only after checking access, reuse terms, attribution and stable identity.
- [ ] Investigate permitted CANARD detail enrichment for speed limits, direction, status and place information; public map arrays do not supply these fields.
- [ ] Obtain usable control-point evidence before implementing that category; do not invent coordinates or treat the placeholder as an empty authoritative dataset.
- [ ] Preserve source IDs, original metadata, units and retrieval times; protect manual edits/deletions and avoid automatic proximity-only merges.
- [ ] Test repeated imports, conflicts, malformed input and notice retention. Keep absent values unknown and source-reported values distinct from BIN-encoded fields.

Traffic-camera coverage here means enforcement locations. No live-video feeds or permission for bulk detail scraping are assumed.

## 4. Complete binary-field research — research and implementation

- [ ] Verify speed-limit, direction and record-type/flag meanings using documented evidence rather than guesses.
- [ ] Investigate remaining header/layout dependencies and anomalous references that block structural edits.
- [ ] Complete directional OPP/endpoints and supported encoding mappings; endpoint connectors must not be presented as verified road routes.
- [ ] Use the supplied firmware as supporting research where useful, without redistributing proprietary files or treating firmware inspection as device validation.
- [ ] Add fixtures and regression tests for each verified mapping, retaining unknown raw bytes and byte-identical unchanged reconstruction.

See [binary-format notes](binary-format.md).

## 5. MiVue 955W validation — user/device testing

- [ ] Prepare a documented test procedure with original-file backups and a recovery path.
- [ ] Record the device model, firmware version and generated dataset used for each test.
- [ ] Confirm the device accepts the generated file and verify point-camera and OPP alert behavior, including any newly verified speed/direction encoding.
- [ ] Document observed results and limitations separately from parser/encoder test success. Test safely; do not encourage speeding or driver interaction with the app.

Device acceptance remains unverified. All generated files remain experimental and use-at-own-risk.

## 6. PL/EN polish and browser coverage — implementation and testing

- [ ] Translate technical import codes such as `DUPLICATE_ID` and `CSV_QUOTE` into actionable PL/EN messages.
- [ ] Keep Mio cache persistence warnings visible instead of immediately replacing them with a ready/unchanged message. This is the older Mio-cache issue, not the corrected CANARD warning behavior.
- [ ] Exercise Firefox, Safari/WebKit and physical mobile browsers: file handling, storage/recovery, map/editor, downloads and browser GPS permissions.
- [ ] Record supported/tested environments and remaining limitations; do not infer physical-device behavior from Chromium tests.

## Completion rules

Mark an item complete only with recorded evidence. Update this checklist and README after each task, preserve the own-risk warning, and distinguish implementation, source publication, website deployment and physical-device validation. See the [roadmap](roadmap.md) for the broader scope and [verification record](browser-verification.md) for results already obtained.
