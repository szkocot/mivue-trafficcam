# Remaining work

Recorded 2026-09-20 from the agreed follow-up list. The subsequent user request authorized implementing points 1–4 and 6, including point 1 publication. This is not a claim that every feature is implemented. CANARD activation is complete; country selection is next. Binary research may be needed before some reduced BIN builds can succeed.

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

Released and public-browser verified on 2026-09-21: [deployment 35622164123](https://github.com/szkocot/mivue-trafficcam/actions/runs/35622164123), source `c8f3f99`, accepted data `3597190`. All implementation/release boxes below are complete; subsequent paragraphs retain historical milestones. Deferred minor: ISO-friendly filenames. Points 3, 4 and 6 remain open.

Merged into `main` on 2026-09-21 with 237 Node and 62 browser tests passing. Push/deployment verification is in progress.

Implementation and independent review fixes are complete on `feat/country-export`: 237 Node / 62 browser tests pass, one opt-in live-source skip. Decision-only cancellation preserves completed classifications; review rows disclose coordinates, candidate countries, names and linked IDs. Deferred minor: filenames use stable dataset IDs rather than available ISO codes. Integration and public deployment verification remain pending; the historical task milestones below are retained as evidence.

Task 6 local performance/release-candidate checks pass: 236 Node tests, 62 browser tests (one opt-in live-source skip), real-sample classification/cancellation, byte-identical full rebuild and both CANARD/no-CANARD builds. Independent review and deployment remain pending.

Design and [six-task implementation plan](superpowers/plans/2026-09-20-country-export.md) approved for native execution. Task 1 boundary artifacts/validation are implemented and tested on the feature branch; classifier, selection, exports and UI remain in progress. Points 3, 4 and 6 remain open, not superseded by this increment.

Task 2 classifier/lazy cache implemented: synthetic border/holes/islands/overlap/dateline/polar and cancellation/retry tests; 220 Node pass/one private-sample skip. Selection and UI remain unfinished.

Task 3 pure selection engine implemented/tested: whole linked components in either direction, no deleted-target resurrection, uncertainty review and whole source sections. Full suite226 pass/one private skip. Export integration and UI still pending.

Task 4 scoped exports/worker integration tested (234 Node pass/one private skip): immutable project/history, reparsed reduced synthetic BINs, unchanged safety blockers, attribution, stale-token rejection and cancellation. UI and real-data release verification remain pending.

Task 5 PL/EN UI implemented on the feature branch: export-only country scope, explicit uncertainty decisions, endpoint acknowledgement, paginated previews, cancellation/retry and stale-download guards. Verification: 234 Node pass/one skip, 60 browser pass/two skips, build/diff checks pass. Real-data benchmarks, final review and release checks remain pending; boxes below stay open until that gate.

- [x] Let users select one or more countries for a reduced export, separately from map display filters.
- [x] Use a versioned boundary dataset with verified reuse terms and attribution — pinned Natural Earth 5.1.1; see [evidence](country-boundaries.md).
- [x] Define handling for border points, unknown/invalid coordinates and cross-border OPP before implementation.
- [x] Preview kept, excluded and unresolved records; preserve linked OPP endpoints and the original project for recovery.
- [x] Build and reparse the reduced BIN, or explain why unresolved links/header semantics prevent a safe build. Do not bypass existing encoder safeguards.
- [x] Integrate and deploy the country-export branch; verify the public artifact and fresh-browser workflows.

See [country-selection requirements](roadmap.md#shared-project-model).

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
