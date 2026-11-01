# CANARD–Mio verification implementation

User requested implementing the TODO audit, including legitimate source-only coverage, complete OPP ranges and unknown speeds. Continue the existing local-file architecture; no new hosted data publication or inferred BIN encoding.

## Deliverable

A Node CLI reads a BIN (or saved project), accepted CANARD snapshot and pinned country boundaries. It produces a private reproducible JSON report, CSV review table, GeoJSON evidence and an offline HTML map/table under a new ignored exports directory. No input is rewritten, no nearby points are automatically merged, and the report distinguishes spatial candidates from confirmed identities.

## Steps

- [x] Test candidate, ambiguity/source-only classification, country scope, both OPP orientations, full-range/one-sided/overlap cases, malformed links and raw/unknown speeds.
- [x] Implement a minimal shared comparison module using existing decoding, classification and proximity helpers; keep unknown type/unit/road semantics explicit.
- [x] Exercise actual hosted import → project persistence → reference export and unchanged BIN rebuilding; report every original normalized observation/notice and actual bindings.
- [x] Add CLI/report generation with escaped local HTML, bounded inputs, pinned hashes, deterministic outputs and no-overwrite file creation. Test CLI and report safety.
- [x] Run against the latest local official BIN and current accepted CANARD data; inspect reports, record counts/unknowns/OPP range exceptions and leave uncertain identities for human review.
- [x] Run integrated checks, update TODO/README and retain explicit evidence/physical-device blockers.

## Limits

100 m is a candidate-search tolerance, not identity proof. OPP spans are endpoint connectors, not verified road routes. The later reviewed finite BIN decoder supplies firmware-scoped km/h/zero interpretation while retaining unclassified raw values. Missing source speeds, source-only records and foreign Mio coverage are not importer failures. No undisclosed defaults or proximity-based speed filling.

## Implemented result

CLI and six private artifacts cover source/range candidates, full BIN speed inventory and exact hosted import preservation. Real data:53,338 Mio /811 CANARD; all811 references preserved and unchanged BIN bytes. Explicit unresolved identities/road semantics remain manual/evidence work. Independent review caught ancestor-symlink containment and an adjacent/opposite-range omission; both have red/green regressions and fixes. No input or device bytes are rewritten.
