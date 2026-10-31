# Remaining work

Updated **2026-10-31** after the user authorized all programmatic TODO work and subagents. The completed programmatic increment covers browser engines, local OSM camera-node imports, verified 22×22 binary support, ISO export filenames and repeated lossless round trips. Physical browser/device testing and the evidence-dependent items below remain open.

## Resume here

1. Use [browser/device acceptance](user-acceptance.md) to test your actual browser/phone and MiVue 955W. Keep the original database, full project and recovery backup.
2. Return observations with model/firmware, source/output SHA-256, record IDs and exact symptoms. Automated structural validity is not device acceptance.
3. Continue semantic BIN controls only when the firmware-reader trace or controlled tests establish the remaining flag/header/endpoint meanings. Keep existing build blockers.
4. CANARD detail enrichment needs verified units, direction/status semantics, cross-category/identity evidence, notices and an unattended-access arrangement. PK coordinates remain unavailable. Additional named providers require their own access/identity assessment.

## Verification and preservation

- **256 Node tests pass, zero skips**, with both private official and firmware databases present. The preview-server artifact test requires a local listening port; sandboxed Node attempts crashed natively, while the unrestricted integrated run passed.
- **201 deterministic browser tests pass** across Chromium, Firefox and WebKit; three opt-in live checks are skipped in that command. The separate live Mio run passes **all three engines**, each with one GET, one HEAD and no second body download.
- Repeated BIN → parsed JSON → reconstruction → project save/reopen → BIN cycles preserve every byte, SHA-256, record and diagnostic for the 53,338-record official file and 51,790-record firmware file. Synthetic 20×20/22×22 fixtures exercise every raw byte, unknown types/references and unusual numeric encodings.
- CSV/GeoJSON/OSM selected observation identities, geometry, original metadata, units, normalized fields, attribution and timestamps survive project save/reopen and deterministic reference export. This preserves supported data, not the source file's whitespace/quoting/envelope or unrelated OSM elements. Full project JSON is the reopenable backup; data exports are projections.
- The current hosted CANARD snapshot validates at **811 observations** (506 PP, 136 OPP, 169 RL, PK unavailable); its 401,881 bytes, SHA-256 `f7f136127a9b32a8ce3470af84bc8d27dbefad9d2abd83e4d280ef6523754d87`, and canonical JSON parse/re-export match exactly.
- Independent implementation review found no actionable issues. Build/diff checks and release verification are recorded in [deployment](deployment.md) and [browser evidence](cross-browser-verification.md).

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
- [ ] Hosted CANARD detail enrichment: current access works, but one sample does not establish units, conditional/vehicle-class limits, direction/status semantics, all category schemas, stable updates, notices or permitted unattended volume.
- [ ] PK/control-point coordinates: current public array remains `[{}]`, not an authoritative empty dataset.
- [ ] OSM enforcement ways/relations: explicitly rejected until supported role/geometry semantics are implemented; no road-route inference. Only selected camera nodes are imported.
- [ ] Real OSM acquisition: one bounded provider request timed out without data. Synthetic parser/project/browser coverage passes; an actual local OSM export has not been validated.
- [ ] Other providers: no additional concrete dataset supplied; require a named reusable source and verified access/schema/identity before adding an adapter.

[Source research and exact blockers](source-research-2026-10-31.md). Missing speed/direction/status stays unknown; source metadata is distinct from BIN-encoded values.

## 4. Binary research — verified extension completed, semantics remain open

- [x] Re-extract and verify the supplied firmware database privately with CRC, lengths, SHA-256 and manifest MD5 checks.
- [x] Support the verified 3×3 region / **20×20 and 22×22** cell layouts across parser, spatial indexing, reconstruction and edited builds; reject other/nonsquare dimensions.
- [x] Compare raw fields, candidate endpoint links, header variants and bearing hypotheses quantitatively; retain all opaque bytes. Trace the real ARM/Thumb firmware reader: header word 20 participates in displayed version text; byte 17 is doubled in the observed direction branch; recorded links use a direct absolute seek. Full alias/state/units semantics remain unproved.
- [x] Repeated exact-byte/hash reconstruction and project persistence for both real variants and adversarial synthetic raw fields.
- [ ] Establish complete speed/direction/type-flag, endpoint-role and opaque-header mappings from reader evidence and controlled device observations before adding semantic controls.
- [ ] Resolve anomalous links safely: no universal arithmetic repair is supported. Keep unresolved references in unchanged output; block unsafe address-space changes.

[Binary follow-up and reader trace](binary-research-2026-10-31.md). Proprietary downloads/extracted bytes remain untracked and absent from public assets. Firmware inspection is not installation or device acceptance.

## 5. MiVue 955W — user's physical testing

- [x] Prepare browser/device procedure with original-file backups, unchanged rebuild first, recovery requirements and result template.
- [ ] Record your actual model, firmware, generated dataset, input/output hashes and installation/restart result.
- [ ] Verify point-camera/OPP alerts and displayed limits/direction safely; record failures separately from parser success.

Use [the acceptance checklist](user-acceptance.md). Confirm model-specific installation and restoration instructions before replacing a device file. Generated files remain experimental and use-at-own-risk.

## 6. PL/EN and browsers — programmatic coverage completed

- [x] Actionable PL/EN import errors with accurate record/file context.
- [x] Persistent Mio cache warnings until storage recovers.
- [x] Chromium, Firefox and WebKit projects, CI engine installation, file chooser, imports, editing, storage/recovery, map, downloads and emulated location checks.
- [x] Fix actual WebKit hidden-file-input pointer interception and test the visible file chooser.
- [x] Record versions, supported/tested environments, live endpoint behavior and limitations.
- [ ] Actual Safari/phone downloads/share destinations, physical GPS accuracy and OS permission prompts: user testing remains separate.

## Completion rules

Mark items complete only with evidence. Never turn a research hypothesis into a verified binary control, an unavailable source into zero records, a projected export into a full backup, or an engine test into hardware acceptance. Update this ledger, README and evidence when manual results or new authoritative data arrive.
