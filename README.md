# MiVue TrafficCam

An independent project for inspecting and building speed-camera databases for Mio MiVue products, with an initial focus on Poland.

The intended scope includes fixed speed cameras and section-based average-speed enforcement (Polish: **odcinkowy pomiar prędkości**, or **OPP**).

## Website

**[Open MiVue TrafficCam](https://szkocot.github.io/mivue-trafficcam/)** — published and live-browser verified on 2026-09-20. PL/EN, official database loading, local file editing/export, CSV/GeoJSON imports and hosted CANARD imports are available. CANARD contains 499 point-speed, 138 OPP and 169 red-light observations; control-point data is unavailable. Daily gated updates are enabled. Country filtering is not yet available. [Deployment workflow and safety notes](docs/deployment.md). **Use at your own risk; MiVue 955W device acceptance is untested.**

## Status

**Country-export implementation is ready for integration, not deployed.** Independent review found two important issues; both are regression-tested and fixed: decisions reuse revision-keyed classifications, and uncertain/linked rows show locations, country names and linked record IDs. Final local verification: **237 Node tests and 62 Chromium tests pass** (one opt-in live-source skip), including private-sample byte-identical rebuilding. Both static builds pass. One minor remains: scoped data filenames use stable dataset IDs even where ISO codes exist. README/TODO are updated; integration/public verification and backlog points 3, 4 and 6 remain open. Hardware acceptance is untested.

The first observed scheduled CANARD run [35581370719](https://github.com/szkocot/mivue-trafficcam/actions/runs/35581370719) successfully deployed on 2026-09-21. Earlier milestone notes saying its first scheduled execution was unobserved are historical. This run does not include the country-export branch.

Country-export task 6 local checks (2026-09-21): **236 Node and 62 browser tests pass**, including the private sample; only the opt-in live-source browser test is skipped. Real 52,935-record classification takes about 2.0 s; browser preview about 3.5 s with at most 100 rows. Full sample rebuild is byte-identical. Static builds with and without accepted CANARD data pass; built boundary hash/notices are validated. Independent review and integration/deployment remain pending; this is not a public release claim.

Country-export task 5 adds PL/EN export-only country selection, uncertainty decisions, linked-endpoint acknowledgement, 100-row previews, boundary retry/cancellation and scoped downloads. **Full project backups are never country-filtered.** Reports retain boundary and source notices. Nine new browser cases cover downloads, immutable backups, both link directions, cancellation, stale responses and keyboard/mobile use. Verification: 234 Node tests pass (one private-sample skip), 60 browser tests pass (two skips), static build and diff checks pass. This is still a feature-branch implementation; real-data performance, final review and release verification remain pending. Points 3, 4 and 6 remain open.

The [remaining-work checklist](docs/todo.md) tracks CANARD activation, country selection, additional sources/metadata, binary research, MiVue 955W testing and PL/EN/browser polish. The user authorized points 1–4 and 6 on 2026-09-20, including CANARD publication; hardware testing remains out of scope.

Country exports: the design and [six-task implementation plan](docs/superpowers/plans/2026-09-20-country-export.md) are approved for native execution. Task 1 adds pinned, public-domain country boundaries and fail-closed artifact validation (213 Node tests pass, one private-sample skip). [Boundary evidence](docs/country-boundaries.md). Classification, export selection and UI are still in progress on the feature branch; no country-export feature is released yet. Full backups, complete linked OPP sections, attribution and existing BIN safeguards remain required.

Country-export task 2 adds local polygon classification, a 1 km uncertainty-review band, dateline/polar handling and lazy hash-checked boundary caching with retry/cancellation. Synthetic geometry and streamed-fetch tests pass; the full Node suite passes 220 tests with one private-sample skip. This is worker infrastructure, not a released country selector.

Task 3 adds deterministic country selection, bidirectional linked-section retention, explicit uncertainty/component decisions and whole reference-section selection. Deleted/excluded BIN bindings cannot reappear as free reference points. Selection tests and the full suite pass (226 Node tests, one private-sample skip); export integration and UI remain unfinished.

Task 4 integrates non-mutating scoped BIN/JSON/CSV/GeoJSON/reference exports in the worker, retaining source/boundary notices and full backups. Revision/generation tokens and cancellation reject obsolete selections. Synthetic reduced BINs reparse and preserve raw fields/links; unresolved links, invalid coordinates and header-dependent layout changes remain blocked. Full suite: 234 Node pass, one private-sample skip; UI is next and nothing new is deployed.

CANARD activation is complete: [run 35529021193](https://github.com/szkocot/mivue-trafficcam/actions/runs/35529021193) deployed source `f95ea5f` with data `7bb196e` after 206 Node and 51 browser tests passed (private-sample/live-source skips). Fresh public Chromium verified the reviewed hash, all 806 references, PL/EN, edit/save/reopen/export, retained attribution and zero additional snapshot-body requests after reload. Private sample/firmware/research URLs returned 404. The Pages scheduling fix is regression-tested; daily checks are enabled, but their first scheduled execution is not yet observed. Points 2–4 and 6 remain open. The historical task notes below describe earlier milestones, not current release status.

The parser, editable project model, encoder, and CLI support the 20×20 layout documented in [binary-format research notes](docs/binary-format.md). They inspect databases, export JSON/GeoJSON, save/reopen projects, apply validated edits, and rebuild binaries while preserving raw fields. Unchanged reconstruction of the 52,935-record sample is byte-identical, including its 13 candidate-link warnings. The PL/EN map editor and CSV/GeoJSON ingestion are integrated into `main` and deployed to GitHub Pages. Live website connectors and country filtering remain outstanding; see the [approved roadmap](docs/roadmap.md).

Tasks 1–6 of the [implementation plan](docs/superpowers/plans/2026-09-20-map-editor.md) provide a bilingual map editor, cache/autosave, tentative forms, undo/redo, project recovery and validated downloads. That increment passed 83 Node tests, 23 deterministic browser tests and a separate live-source check. The full 52,935-record sample loads with bounded DOM rendering and rebuilds byte-identically; see [verification details and limitations](docs/browser-verification.md). Independent review found four blocking issues, now fixed with regression tests; one minor cache-warning display issue is deferred. The map editor is integrated into `main` and published on GitHub Pages. CANARD/other website imports and country-limited datasets remain follow-up work. This README is updated after every task.

The [automatic-ingestion design](docs/superpowers/specs/2026-09-20-source-ingestion-design.md) is integrated into `main`: local imports merge supported additions/updates while preserving manual edits/deletions, attribution and whole-import undo. Tasks 1–7 and independent-review fixes were fast-forward merged, pushed and deployed on 2026-09-20. The independent [browser-location plan](docs/superpowers/plans/2026-09-20-browser-location.md) is also included. The user explicitly requested publication of this version before live connectors and country-limited datasets are complete; those limitations remain unchanged.

Final verification: **134 Node tests, 41 browser tests pass**, with the opt-in live-source check skipped. The synthetic 100,000-point import took 5.4 s in the recorded pre-review run, with bounded table/label rendering; one extra observation is rejected. The full local sample still rebuilds byte-identically. Independent review found two important issues, now reproduced and fixed: category transitions cannot automatically recreate previously bound/deleted records, and saved template policies are explicitly shown before import (blank template input retains them). One minor remains: parser issue codes need localized descriptions. [Detailed verification](docs/browser-verification.md) records measurements and limitations; device acceptance remains untested.

## Usage

Source-ingestion tasks 3 and 5 add the tested reconciliation engine and worker integration: stable source identities, repeat-import no-ops, 100 m duplicate suggestions without automatic identity matching, preserved manual coordinate groups/deletions, and explicit bind/reference/distinct decisions. Worker imports commit atomically with whole-import undo and stale-revision rejection; metadata-only projects are marked modified. Reference GeoJSON exports are separate from encoded-record exports. Active supported points can clone only an explicitly configured original template; speed/direction metadata is never written into undocumented bytes. OPP remains reference-only.

Task 6 adds **Import / Importuj**: enter a reusable source namespace and attribution, choose CSV or GeoJSON, optionally specify a supported original template with explicit acknowledgement, then choose the file to merge automatically. Purple source references are distinct from BIN records, with read-only attributed details and optional conflict actions. Independent speed/metadata toggles persist locally; canvas labels are collision-suppressed and capped at 200, never displayed on aggregates. Reference-only OPP lines are source geometry, not encoded endpoint links. See [import instructions](docs/browser-editor.md#importing-source-observations).

Source-ingestion tasks 1–2 add tested local CSV/GeoJSON parsers and project v2 ingestion state with explicit manual-coordinate ownership and atomic undo transactions. Existing v1 projects load and upgrade in memory; newly saved v2 projects require this release. CSV requires `id,latitude,longitude,kind`; optional fields are `name,speed,speed_unit,direction,status,url`, with extra columns retained as metadata. Coordinates use decimal dots; a supplied speed requires `km/h` or `mph`. Kinds: `camera`, `section`, `red-light`, `unknown`; status: `active`, `planned`, `inactive`, `unknown`. GeoJSON accepts identified Point features and section LineStrings in longitude/latitude order. Source namespace and attribution are required separately. Malformed batches are rejected in full; inputs are limited to 20 MiB/100,000 features, 1,000 vertices per section and 64 KiB metadata per feature. Neither parser guesses MiVue speed or direction fields.

Source-ingestion task 4 adds a tested availability registry: local CSV/GeoJSON are available; live CANARD is disabled with `CORS_BLOCKED`. [Source research](docs/source-access.md) verifies that Chromium cannot fetch the public map from the Pages origin (missing CORS header), while the site footer permits reuse of published content. All four camera/control-point layers remain in scope for a future verified adapter, not only OPP. Detailed field semantics and stable IDs remain unverified. No proxy, live-video feeds or implemented CANARD connector are claimed.

Hosted CANARD snapshots are the selected next approach. The [reuse assessment](docs/source-access.md#hosted-snapshot-reuse-assessment--2026-09-20) records CANARD/GITD's published permissions and proposed attribution, access and publication safeguards. This is not legal certification; bulk detail access still needs verification. No CANARD snapshot is published, and the connector remains disabled pending design and implementation.

The [hosted CANARD snapshot spec](docs/superpowers/specs/2026-09-20-canard-snapshot-design.md) and [eight-task implementation plan](docs/superpowers/plans/2026-09-20-canard-snapshot.md) are approved for native execution. Tasks 1–2 add bounded public-page retrieval and a tested, memory-bounded adapter: 806 observations in the inspected capture (499 point-speed, 138 OPP, 169 red-light). The user approved explicitly marking control-point data unavailable (`PK: null`), not claiming zero records. Unknown speed/status/direction stay unknown, and OPP endpoints are not road routes. [Field inventory](docs/canard-field-inventory.md). Publication remains disabled pending candidate/release review; the browser connector, hosted cache and publisher are not yet implemented.

Task 3 adds deterministic, hash-verified snapshots and manifest validation. An unchanged dataset reuses its bytes/retrieval date while advancing only the successful-check timestamp; provenance changes create a new version. Count/identity losses over 20% require candidate-specific review. Initial publication, changed terms/robots and unverified identities are independently gated. No hosted snapshot has been published.

Task 4 adds project v3 source notices and opt-in synchronization settings, migrated safely from v1/v2. Verified hosted imports commit once with undo, revision/session protection and repeat-import no-ops. Local imports cannot impersonate the hosted namespace. Project/reference exports retain attribution; encoded-record exports and BIN builds expose applicable notices for the upcoming download UI. Older releases cannot reopen v3 projects; keep backups. The source download/cache UI and publication remain unfinished.

Task 5 adds a separately verified CANARD cache and an IndexedDB upgrade that preserves the existing Mio cache and saved edits. Startup checks are deduplicated; unchanged hashes avoid a body download. Failed/corrupt updates keep the last valid copy with freshness/persistence warnings, while a disabled-source manifest clears CANARD data. This cache is tested but not yet wired into the UI; no dataset is published.

Task 6 wires the hosted cache into the PL/EN interface: first import explicitly enables synchronization for that project; subsequent startups check the manifest once and download a body only when its hash changes. Updates wait for unfinished forms and recovery, respect manual edits, and remain undone until explicitly reapplied within the session. The interface distinguishes retrieval/check times, stale data, unavailable control points and failed persistence. Exports with bound CANARD contributions offer a companion attribution download; reference/project exports embed notices. This is implemented on the feature branch, **not yet published**; the hosted publisher and release review remain pending.

Task 7 implements the gated, serialized publisher and data-aware Pages build. Generated data lives on a separate data-only branch; exact-parent checks and normal fast-forward pushes prevent concurrent overwrites. The build rejects unexpected files, symlinks, mismatched hashes/counts/notices and removes withdrawn snapshots. Daily checks remain disabled until explicitly enabled and reviewed; an initial exact-byte candidate review is required. [Bootstrap, update and withdrawal instructions](docs/deployment.md#hosted-canard-pipeline-not-released-yet). The feature branch still awaits release review; no new dataset has been published.

Task 8 local release checks: the fresh candidate contains 806 observations with matching terms/robots and unchanged IDs. Independent review found three important boundary issues; regression-tested fixes prevent cross-tab withdrawal resurrection, stale-cache rollback and direct-publisher bypass of count/identity checks. **205 Node tests and 52 browser tests pass** with the local sample; one opt-in live-source test is skipped. A fresh local browser imported the actual candidate, reused it without a second body download and verified PL/EN and private-file exclusions. README/roadmap/release notes are updated. **Integration, publication approval and public-site verification remain pending; nothing new is deployed.** PK, richer detail sources, country filtering and MiVue 955W hardware acceptance remain unverified/unimplemented as documented.

Local integration: by user choice, the reviewed CANARD implementation was fast-forward merged into `main` at `9d2ce5e`. Verification on the merged checkout passed all 205 Node tests, 52 browser tests (one optional live-source skip), the 50-asset build and diff checks. The exact reviewed candidate and release ledger are preserved locally. **Nothing was pushed or deployed; CANARD publication remains disabled pending release approval and public-site verification.**

Source-only release: the user subsequently authorized pushing `main`. The source push triggers the existing test-gated Pages workflow, but does not publish the locally reviewed CANARD candidate or enable scheduled data updates. `publicationApproved` remains false and no `canard-data` branch is included. Check the Actions result before treating the website as deployed; initial CANARD data publication remains a separate release decision.

**Locate me / Moja lokalizacja** is available on the website: opt-in one-shot browser positioning, accuracy circle and fix time, cancel/clear, translated errors and no saved location history. It does not edit camera coordinates. The UI explains browser-provider and map-tile privacy implications. That increment passed 103 Node tests and 33 deterministic browser tests (one opt-in live-source test skipped); physical GPS and non-Chromium browsers remain untested. Local ingestion/metadata display is also deployed; live connectors and country filtering remain unfinished.

Use Node.js (verified with v26.8.2). The CLI needs no installed dependencies. Browser development uses the pinned dependencies in `package-lock.json`.

```sh
node bin/mivue-trafficcam.js inspect Speedcam_Data_FEU.bin
node bin/mivue-trafficcam.js export Speedcam_Data_FEU.bin --format json
node bin/mivue-trafficcam.js export Speedcam_Data_FEU.bin --format geojson
npm test
```

Exports go to stdout; warnings go to stderr. To save an export, redirect stdout to a new file under a local `exports/` directory, which is ignored by Git. Never redirect output onto the source binary. The CLI itself only reads the input.

Exit codes are 0 for successful parsing (including warnings), 1 for malformed/unsupported input or I/O failures, and 2 for invalid command syntax. Only the researched 3×3 regional / 20×20 cell layout is supported; this is not a device-compatibility guarantee.

JSON includes metadata, offsets, complete record hex, decoded coordinates, raw fields, and diagnostics. GeoJSON contains points with longitude-first coordinates; invalid coordinates have null geometry. Speed units, heading encoding, camera types, and OPP endpoint roles remain unverified, so exports retain raw values and do not draw section lines. Nonfinite raw coordinate numbers are represented as strings, with exact bytes retained in hex.

The core `parseDatabase(bytes)` in `src/parser.js` accepts a `Uint8Array` and has no Node-specific dependencies, for reuse in a future browser interface. Serializers are in `src/export.js`.

Tests use synthetic fixtures. The local-sample test runs when `Speedcam_Data_FEU.bin` is present and checks its SHA-256 and documented anomalies; it explicitly skips when absent. To run only the synthetic suite:

```sh
node --test test/parser.test.js test/export.test.js test/cli.test.js
```

## Editable projects and binary builds

Create local `projects/` and `exports/` directories first. Both are ignored by Git. Projects embed the original binary and its SHA-256, so they contain the source database and should be treated like that database when sharing.

```sh
node bin/mivue-trafficcam.js project Speedcam_Data_FEU.bin --output projects/original.json
node bin/mivue-trafficcam.js edit projects/original.json --patch changes.json --output projects/edited.json
node bin/mivue-trafficcam.js build projects/edited.json --output exports/Speedcam_Data_FEU.bin
```

For the documented sample, `changes.json` can contain this raw-field research edit (the ID is the original byte offset, not a camera identifier):

```json
[
  { "kind": "update", "id": "source:2032", "changes": { "rawBytes16To19": [70, 34, 0, 1] } }
]
```

Available operations are `update` (latitude, longitude, or the four raw bytes), `delete`, `restore`, `clone` (a supported original template plus explicit coordinates), and `resolve-link` (a 964 source, 9128 target, and reason). New records use stable `new:<number>` IDs. Raw fields are not verified speed/direction controls. Cloning is limited to non-link raw types 1, 3, and 5; new OPP creation is not yet supported. Project edits never change the original binary; every output path must be new, including when it is a symlink/hard-link alias of an input.

Unchanged builds reconstruct all parsed headers, indexes, and raw records. Edited builds regenerate counts and offsets, relocate understood links by stable ID, and reparse the output. Existing unresolved references can survive an unchanged address space; they block layout-changing builds until explicitly resolved. Changing the first populated region is also blocked while header semantics remain unknown. Invalid drafts can be saved, but invalid binary builds are rejected with diagnostics. No force-build bypass is provided. Output reports explicitly identify device acceptance as **untested**.

For all synthetic tests (without the optional sample integration test):

```sh
node --test test/parser.test.js test/export.test.js test/project.test.js test/encoder.test.js test/cli.test.js test/sources.test.js
```

## Official database and firmware references

Use the [official European speed-camera database](https://dl-mio.akamaized.net/dvr/MiVue8xx/Speedcam_Data_FEU.bin) as the download source. `src/sources.js` exports this URL and a browser-compatible `fetchOfficialDatabase({ signal })` loader that validates downloads; the Pages app uses it for startup caching and explicit source downloads. Cross-origin loading from the published site was verified on 2026-09-20. It is fetched from Mio, not copied into the published website; local file import remains the fallback for network or format changes.

The user-supplied [955W firmware](https://dl-mio.akamaized.net/Support/Downloads/Firmware/MiVue955W/EU/5651N7040009/VF538.10.20.BE1AD.18/SD_CarDV.bin) and [update guide](https://service.mio.com/M0100/FileReader_119674_Rest%20of%20Europe_English.html) are recorded in [firmware research notes](docs/firmware-research.md). Static analysis found an older bundled **22×22** database, which the current production codec explicitly rejects as unsupported. Do not assume all 955W database versions use the current sample's layout. The guide returned HTTP 403 during inspection.

## Planned capabilities

- Decode and inspect speed-camera `.bin` databases.
- Extract records into documented, editable formats.
- Edit camera locations, speed limits, and supported metadata.
- Represent OPP sections and their endpoints as supported by the device format.
- View cameras and OPP sections on a map.
- Ingest and reconcile records from external sources, retaining provenance and attribution.
- Load points from CANARD and other websites, subject to verified access and reuse terms.
- Select one or more countries for an explicitly reduced dataset, separately from map display filters.
- Encode records and build `.bin` files for supported MiVue products.
- Validate generated files through round-trip checks and device-specific compatibility testing.

## Website and local development

The deployed PL/EN map editor includes file picker/drop, worker-backed loading, automatic official-source cache checks, paginated linked tables, display filters, canvas map, autosave, coordinate/raw-field edits, clone/delete/restore, link resolution, undo/redo, imports and downloads. Binary download is enabled only after a validated report for the current revision. See the [browser guide](docs/browser-editor.md) for recovery, limitations and own-risk precautions. Non-documentation pushes to `main` run tests and publish only the allowlisted static build; documentation-only pushes do not redeploy.

```sh
npm ci
npm run build:web
npm run preview:web -- --base /mivue-trafficcam/
# Open http://127.0.0.1:4173/mivue-trafficcam/
npx playwright install chromium
npm run test:browser
```

The preview serves only allowlisted `dist/` assets, not repository files or the sample. The map uses locally packaged Leaflet 1.9.4 and attributed OpenStreetMap tiles; there is no bulk/offline tile download. Source ingestion will need to account for reuse terms, browser access restrictions, and preprocessing that cannot run on a static site.

## Research sample

The initial local sample is `Speedcam_Data_FEU.bin`. It is excluded from version control and is not distributed with this repository. Its name alone does not establish its format, coverage, or supported devices.

## Use at your own risk

**This is experimental, unofficial software. Use this project and any generated databases entirely at your own risk.** Incorrect or incomplete data and incompatible files may cause missing or incorrect alerts, device malfunction, or data loss. There is no guarantee of accuracy, completeness, fitness for purpose, or compatibility with any MiVue model or firmware.

Keep backups of original files before making changes. Always follow posted signs and applicable traffic rules; camera alerts are not a substitute for attentive driving.

This project is not affiliated with or endorsed by Mio, MiVue, or their manufacturers. Product names and trademarks belong to their respective owners. Only import or redistribute data that you have permission to use, and retain required source attribution.
