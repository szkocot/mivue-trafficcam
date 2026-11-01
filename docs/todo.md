# Remaining work

Updated **2026-11-02** after the user authorized all programmatic TODO work and subagents. The completed programmatic increment covers browser engines, local OSM camera-node and explicit average-speed endpoint imports, verified 22×22 binary support, ISO export filenames, repeated lossless round trips and the executed CANARD–Mio/range/unknown-speed audit. Physical browser/device testing and the evidence-dependent items below remain open.

## Resume here

1. Review the generated CANARD–Mio candidate/range report in section 3a; the automated audit is implemented and run. Confirm uncertain identities/ranges using authoritative evidence or your manual tests.
2. Use [browser/device acceptance](user-acceptance.md) to test your actual browser/phone and MiVue 955W. Keep the original database, full project and recovery backup.
3. Return observations with model/firmware, source/output SHA-256, record IDs and exact symptoms. Automated structural validity is not device acceptance.
4. Continue semantic BIN controls only when the firmware-reader trace or controlled tests establish the remaining flag/header/endpoint meanings. Keep existing build blockers.
5. CANARD car speeds use the explicit minimum-over-time/direction policy documented in [car-speed imports](canard-speeds.md). Review original conditional rows when needed; active status and compass direction remain unknown. PK coordinates remain unavailable. Additional named providers require their own access/identity assessment.

## Verification and preservation

- **341 Node tests pass, two private-firmware checks skipped** (343 total); the official database is present, but the earlier temporary firmware extraction is unavailable. The preview-server artifact test requires a local listening port; sandboxed Node attempts crashed natively, while the unrestricted integrated run passed.
- **228 deterministic browser tests pass** across Chromium, Firefox and WebKit; three opt-in live checks are skipped in that command. The separate live Mio run passes **all three engines**, each with one GET, one HEAD and no second body download.
- Repeated BIN → parsed JSON → reconstruction → project save/reopen → BIN cycles preserve every byte, SHA-256, record and diagnostic for the 53,338-record official file and 51,790-record firmware file. Synthetic 20×20/22×22 fixtures exercise every raw byte, unknown types/references and unusual numeric encodings.
- CSV/GeoJSON/OSM selected observation identities, geometry, original metadata, units, normalized fields, attribution and timestamps survive project save/reopen and deterministic reference export. This preserves supported data, not the source file's whitespace/quoting/envelope or unrelated OSM elements. Full project JSON is the reopenable backup; data exports are projections.
- The map-only baseline CANARD snapshot validates at **811 observations** (506 PP, 136 OPP, 169 RL, PK unavailable); its 401,881 bytes, SHA-256 `f7f136127a9b32a8ce3470af84bc8d27dbefad9d2abd83e4d280ef6523754d87`, and canonical JSON parse/re-export match exactly.
- Merge verification: the real 53,338-record/811-observation project finds 71 unique uncontested candidates, 717 ambiguous and 23 without a complete fit; explicitly applying the unique set associates 88 BIN records, including 17 complete OPP pairs. Every endpoint is audited; saved/reopened BIN output retains the original SHA-256. Private demonstration project: `exports/opp-merge-verification-2026-11-02/project.json`.
- Enriched car-speed verification: all 811 detail responses validated, 642 numeric passenger minima (506 PP + 136 OPP), 169 genuinely unavailable RL limits. User point PP 91359960 imports as 50 km/h and agrees with its Mio candidate 3.22 m away. Unique candidates agree for 53/54 PP and 16/17 OPP pairs; retain differing and ambiguous evidence. [Full results](canard-speeds.md).
- Independent implementation review found no actionable issues. Latest app `b8e25bb` and enriched data `920a977` deployed successfully in [run 41335986512](https://github.com/szkocot/mivue-trafficcam/actions/runs/41335986512). Fresh public Chromium verified 811 observations/642 car limits, the quoted point at 50 km/h, blue explicit binding, PL/EN, private-file 404s and no page errors. Build/diff checks and release verification are recorded in [deployment](deployment.md) and [browser evidence](cross-browser-verification.md).

## 1. CANARD publication — completed

- [x] Publish reviewed snapshots with attribution and fail-closed terms/schema/count/identity gates.
- [x] Enable and observe daily gated checks; verify accepted source/data deployments.
- [x] Confirm current manifest/snapshot hash, counts and freshness, cache reuse, PL/EN and private-file exclusions.

The previous code release `3972fa5` deployed in [run 41245309208](https://github.com/szkocot/mivue-trafficcam/actions/runs/41245309208). Fresh public Chromium loaded 53,338 official records, exercised PL/EN errors and persistent cache warnings, saw private-file 404s and no page errors. The programmatic follow-up `39ecdbe` subsequently deployed in [run 41246260899](https://github.com/szkocot/mivue-trafficcam/actions/runs/41246260899): Linux CI passed 254 Node tests (two skips) and 195 browser tests (nine skips). Fresh public Chromium confirmed 22×22 support, OSM import/licence, exact official BIN download, Poland filenames, private-file 404s and no page errors. Full evidence is in deployment.md. Publication safeguards are not a blanket permission for arbitrary new services.

## 2. Country selection — completed

- [x] Versioned/hash-verified boundaries, uncertainty decisions, linked-endpoint integrity, bounded previews and scoped exports.
- [x] Keep full backups unfiltered and preserve existing invalid-coordinate/link/header BIN blockers.
- [x] Use reviewed ISO codes in scoped data filenames with stable dataset-ID fallback. Device output remains `Speedcam_Data_FEU.bin`; report IDs remain stable dataset IDs.

## 3. Sources and metadata — supported increment completed, evidence blockers remain

- [x] Recheck CANARD map/client/robots and one public detail response; record exact hashes, field schema and semantic limits.
- [x] Assess OSM access, ODbL attribution and typed stable identities; implement local OSM/Overpass JSON camera-node imports, including proposed/disused lifecycle tags.
- [x] Preserve original element metadata/units/IDs/import times, OSM notices and manual edits/deletions. Reimport clears obsolete OSM source metadata without changing manually owned BIN coordinates.
- [x] Test repeats, malformed input, conflicts/bindings, original metadata, notice retention, project persistence and PL/EN errors across all three engines.
- [x] Import CANARD detail speeds using the user-selected minimum positive passenger-car limit across all times/directions. Preserve full raw conditional/vehicle evidence and provenance, and disclose the explicit km/h interpretation policy in metadata. Serial bounded server-side acquisition, identity-bound cache and complete-batch publication retain existing source gates. [Policy and operation](canard-speeds.md). Status/bearing and legal applicability are not inferred.
- [ ] PK/control-point coordinates: current public array remains `[{}]`, not an authoritative empty dataset.
- [x] Import documented `type=enforcement` / `enforcement=average_speed` relations with exactly one distinct from/to node and both coordinate-bearing nodes supplied in the file. Preserve `relation/<id>`, original relation/endpoint evidence, units and notices; sections remain reference-only endpoint connectors. Ambiguous/missing geometry, camera ways and other enforcement relations fail visibly. No road route or MiVue endpoint encoding is inferred.
- [ ] Real OSM acquisition: one bounded provider query timed out without data; a subsequent provider status check returned HTTP 406. Synthetic node/relation parser/project/browser coverage passes; a real lawful local OSM export is required for a real-data check. No retry/access workaround or live connector is enabled.
- [ ] Other providers: no additional concrete dataset supplied; require a named reusable source and verified access/schema/identity before adding an adapter.

[Source research and exact blockers](source-research-2026-10-31.md). The endpoint extension passes 16 targeted Node tests and all 12 PL/EN OSM browser cases across Chromium, Firefox and WebKit, including repeat/persistence and notice retention. Missing speed/direction/status stays unknown; source metadata is distinct from BIN-encoded values. Broader OSM role/way geometries remain outside the verified input contract; support needs a concrete export and an unambiguous geometry contract before extending the adapter.

## 3a. CANARD–Mio verification — implemented and run

- [x] Pin the CANARD snapshot and original Mio BIN by retrieval/check date, counts and SHA-256 so the comparison is reproducible.
- [x] Define the geographic comparison scope (Poland / CANARD coverage) with the reviewed boundary dataset and explicit border uncertainty. Keep other European Mio records out of missing-CANARD error totals, and retain whole OPP pairs that cross the chosen boundary.
- [x] Verify importer correctness first: every CANARD source ID, category, coordinate/OPP geometry, original metadata and notice must survive import, project save/reopen and reference export exactly. Report omissions, duplicates, changed coordinates and wrong bindings separately.
- [x] Compare CANARD point-speed and red-light observations with nearby Mio records using decoded WGS84 coordinates. Reuse proximity candidates (initially the existing 100 m suggestion radius), report exact distances and review ambiguous or unmatched records. Proximity alone must not establish identity or silently merge records; do not invent semantic names for unverified Mio type codes.
- [x] Compare each CANARD OPP's two endpoints with linked Mio endpoint pairs, considering both endpoint orientations. Check pair completeness, endpoint distances, link integrity and reversed/swapped or one-sided matches.
- [x] Implement complete OPP range-consistency checks, not only point proximity: compare the paired start/end positions, coordinate extents, straight-line span and source-reported length/road/direction where available. Flag materially shorter/longer or shifted ranges, partial overlap, split/merged/extended sections and a near endpoint paired with the wrong far endpoint. Establish section identity and acceptable endpoint/range tolerances explicitly before declaring a range verified. Straight connectors are not road routes; actual road distance/coverage requires route evidence, and unknown direction/role semantics stay unknown.
- [x] Audit unknown speeds separately for each source/category and BIN code: missing source limits, zero/special stored values, unsupported/symbolic/conditional limits, conflicting values and unverified units. Report counts and record IDs, including source-only and matched points; a missing source limit must not hide a present BIN speed value or imply that the BIN itself lacks one.
- [x] For every originally supplied speed, verify parsing, unit conversion, project save/reopen, binding and export preserve the value and original units. Trace any known-to-unknown transition to a specific source or pipeline step; distinguish deliberate removal of a stale source value from accidental data loss. Display raw BIN values separately from attributed source-reported limits.
- [x] Verify OPP speed consistency over the entire paired range: compare both stored endpoint values and source-reported section limits where available. Flag endpoint disagreements, changes within a range and vehicle/time/direction-dependent limits; do not silently copy one endpoint's limit to the other or collapse conditional limits.
- [x] Keep genuinely unavailable speeds unknown and retain the raw evidence/reason. Add a limit only from a verified matching source with established units and applicability; never fill gaps from the nearest camera, a default speed, or an unverified byte/code interpretation. Record remaining enrichment/semantic blockers and representative manual-check cases.
- [x] Verify any explicit bindings or generated BIN additions against the intended Mio records, including stored coordinates, preserved raw fields, manual edits/deletions and duplicate protection. CANARD OPP can associate with complete existing BIN pairs but never generates unverified endpoint encoding; absence from BIN alone is not proof of an import failure.
- [x] Produce a review report and map/table evidence for matched, ambiguous, CANARD-only and Mio-only records, split by source category, with IDs, positions, candidate distances and both dataset versions. Separate genuine importer defects from independent coverage, timing, rounding, planned/inactive status or source-data differences. Mio includes non-CANARD providers, and CANARD can contain records absent from Mio: source-only coverage is legitimate, not an automatic failure, and equal counts or a one-to-one cross-source match must not be required.
- [x] Add regression fixtures for import/binding preservation and comparison edge cases; record automated candidate/discrepancy counts. Cross-source agreement supports consistency; it does not establish identity, completeness or device alert behavior.
- [ ] Resolve ambiguous identities and confirm actual road/direction-dependent OPP extents and speed applicability against authoritative evidence or the user’s manual observations. No automatic identity or road-route claim is made.

Executable: `scripts/compare-sources.mjs`; [method, results and artifact instructions](canard-mio-verification.md). Private output: `exports/canard-mio-audit-2026-11-01/`. Real import checks preserve all 811 CANARD observations and the original BIN byte-for-byte. Results: points 54 unique spatial candidates / 606 ambiguous / 15 CANARD-only; OPP 17 unique / 111 ambiguous / 7 range review / 1 CANARD-only. Poland/border scope contains 1,767 Mio records, with 165 record / 8 linked-pair Mio-only views. All 265 scoped stored zeros (3,361 globally) use raw type 3; all 811 map-only baseline source limits were unknown; the enriched follow-up imports 642 car limits under the explicit minimum policy. No limits were guessed.


## 4. Binary research — verified extension completed, semantics remain open

- [x] Re-extract and verify the supplied firmware database privately with CRC, lengths, SHA-256 and manifest MD5 checks.
- [x] Support the verified 3×3 region / **20×20 and 22×22** cell layouts across parser, spatial indexing, reconstruction and edited builds; reject other/nonsquare dimensions.
- [x] Compare raw fields, candidate endpoint links, header variants and bearing hypotheses quantitatively; retain all opaque bytes. Trace the real ARM/Thumb firmware reader: header word 20 participates in displayed version text; byte 17 is doubled in the observed direction branch; recorded links use a direct absolute seek. The reviewed finite read-only speed/type mapping is implemented; full alias/state/flag semantics remain unproved.
- [x] Add firmware-scoped read-only speed/type interpretation: finite known km/h values, zero as unavailable, unknown bytes retained raw; generic/red-light/mobile announcement categories and neutral linked endpoints. Exhaustive byte/type tests and both private-file counts preserve exact output.
- [x] Repeated exact-byte/hash reconstruction and project persistence for both real variants and adversarial synthetic raw fields.
- [ ] Establish complete speed/direction/type-flag, endpoint-role and opaque-header mappings from reader evidence and controlled device observations before adding semantic controls.
- [x] Trace endpoint registration/destination observation, two retained state slots and sampled-average arithmetic; classify every unresolved target by actual record/header bytes. [Evidence and remaining role limits](binary-endpoint-followup-2026-11-01.md). No universal repair exists in the inspected data.
- [ ] Resolve anomalous links safely: no universal arithmetic repair is supported. Keep unresolved references in unchanged output; block unsafe address-space changes.

[Binary follow-up and reader trace](binary-research-2026-10-31.md); [checksum consumer follow-up](binary-checksum-followup-2026-11-01.md). The traced additive sum covers all file bytes, but its caller/acceptance role remains unproved; no embedded checksum or repair rule is inferred. Proprietary downloads/extracted bytes remain untracked and absent from public assets. Firmware inspection is not installation or device acceptance.

## 5. MiVue 955W — user's physical testing

- [x] Prepare browser/device procedure with original-file backups, unchanged rebuild first, recovery requirements and result template.
- [ ] Record your actual model, firmware, generated dataset, input/output hashes and installation/restart result.
- [ ] Verify point-camera/OPP alerts and displayed limits/direction safely; record failures separately from parser success.

Use [the acceptance checklist](user-acceptance.md). Confirm model-specific installation and restoration instructions before replacing a device file. Generated files remain experimental and use-at-own-risk.

## 6. PL/EN and browsers — programmatic coverage completed

- [x] Actionable PL/EN import errors with accurate record/file context.
- [x] Read-only stored BIN speed and raw type display in the table/details, with explicit unit/meaning limits and separate source speed labels.
- [x] Review and merge compatible source observations with one/many BIN point records or complete existing OPP pairs, with atomic batch undo/reload/export, all associated endpoints visible in blue and complete OPP connectors. Unique uncontested candidates are preselected; ambiguous candidates remain explicit choices. CANARD kierunek/named directions are shown as text; road chainage is separate from bearings.
- [x] Distinct merged-point map color: blue for explicit source/BIN bindings, teal for unbound BIN points, purple for references, and amber selection rings; mixed status groups remain visible with a PL/EN legend.
- [x] Persistent Mio cache warnings until storage recovers.
- [x] Chromium, Firefox and WebKit projects, CI engine installation, file chooser, imports, editing, storage/recovery, map, downloads and emulated location checks.
- [x] Fix actual WebKit hidden-file-input pointer interception and test the visible file chooser.
- [x] Record versions, supported/tested environments, live endpoint behavior and limitations.
- [ ] Actual Safari/phone downloads/share destinations, physical GPS accuracy and OS permission prompts: user testing remains separate.

## Remaining gates after programmatic implementation

All currently specified, evidence-supported programmatic increments above are implemented. The unchecked items require upstream data/access or semantic evidence (PK, real OSM file, a named other provider, ambiguous cross-source identities, binary mappings/anomalous links), or the user's physical browser/device observations. These are retained as open verification gates, not claimed complete by synthetic tests. A lawful OSM file supplied locally can be tested with the implemented parser and round-trip workflow without new product code. New evidence can justify a further implementation increment; unknown values and build blockers remain until then.

## Completion rules

Mark items complete only with evidence. Never turn a research hypothesis into a verified binary control, an unavailable source into zero records, a projected export into a full backup, or an engine test into hardware acceptance. Update this ledger, README and evidence when manual results or new authoritative data arrive.
