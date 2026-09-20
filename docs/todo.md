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

Published coverage: 499 point-speed, 138 OPP and 169 red-light observations. Control-point data is unavailable, not a verified zero. Daily gated checks are enabled; the first scheduled run has not yet been observed. See [release evidence](deployment.md), [access assessment](source-access.md) and [field inventory](canard-field-inventory.md). Reuse safeguards are not legal certification.

## 2. Country selection — implementation

Design status: export-only selection and complete linked cross-border OPP retention approved in conversation. The [written specification](superpowers/specs/2026-09-20-country-export-design.md) now awaits review; implementation and dataset verification remain pending. Points 3, 4 and 6 remain open, not superseded by this increment.

- [ ] Let users select one or more countries for a reduced export, separately from map display filters.
- [ ] Use a versioned boundary dataset with verified reuse terms and attribution.
- [ ] Define handling for border points, unknown/invalid coordinates and cross-border OPP before implementation.
- [ ] Preview kept, excluded and unresolved records; preserve linked OPP endpoints and the original project for recovery.
- [ ] Build and reparse the reduced BIN, or explain why unresolved links/header semantics prevent a safe build. Do not bypass existing encoder safeguards.

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
