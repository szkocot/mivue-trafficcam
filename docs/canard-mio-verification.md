# CANARD–Mio verification — 2026-11-01

The executable audit compares a local Mio BIN or saved project with a validated accepted CANARD snapshot. It checks import preservation separately from cross-source coverage. It never merges nearby points, guesses a limit/type or changes an input. Generated reports contain locally derived Mio data and stay in ignored `exports/`, outside the public website/artifact.

## Run and inspect

```sh
node scripts/compare-sources.mjs \
  --mio Speedcam_Data_FEU.bin \
  --canard-dir .cache/canard-accepted \
  --output exports/canard-mio-audit-2026-11-01
```

Use an accepted `canard-data` checkout containing `data/canard/manifest.json` as the data input; the existing deployment pipeline supplies this layout. The CLI rejects disabled/corrupt snapshots, invalid notices/boundaries, existing output directories and output paths inside the accepted data, including ancestor-symlink aliases. Use a new output directory for another run. Replace `--mio` with a saved project JSON to inspect current edits, bindings, coordinate ownership and build blockers without modifying that project.

The generated package contains:

- `index.html`: offline overview map and review tables, source/endpoint coordinates, distances, stored values, range evidence and current-project build status. No remote assets or data upload.
- `comparison.json`: complete candidate and scope evidence, input hashes, import checks, speed inventories, boundary uncertainty, invalid records and link diagnostics.
- `comparison.csv`: CANARD observations plus Mio-only records/pairs for spreadsheet review; negative numeric coordinates are preserved and formula-like strings are escaped.
- `comparison.geojson`: source and candidate geometry, Mio-only coverage and notices. For detailed interactive inspection, import it into the existing app with a **new audit namespace**, the supplied attribution and no template. Its observations have unknown operational status and remain reference-only; `comparisonStatus` retains the audit category. OPP connectors are not road routes.
- `bin-speed-inventory.csv`: every active input BIN/project record, including foreign points, with raw type/speed/direction-mode values, decoded speed status/km/h, whole-value type classification and firmware scope.
- `NOTICE.json`: source/boundary notices and input provenance. Keep it with derived exports. No permission to redistribute Mio's input data is asserted.

Project JSON remains the reopenable backup; these evidence exports are projections, not replacements for the original BIN or its full project.

## Pinned inputs and import result

- Mio: **53,338 records**, 1,532,826 bytes, SHA-256 `69759a67d9442bfa1a636c38ccbc16623a2208ef34564e11f68ad0d696becdb1`, embedded version candidate `202609010125`. The file was downloaded locally on 2026-10-31; the generic CLI cannot recover authoritative upstream retrieval time from a BIN and explicitly records that as unknown. HTTP Last-Modified observed during the download: 2026-09-21.
- CANARD: **811 observations** — 506 PP, 136 OPP, 169 RL; PK unavailable. Snapshot SHA-256 `f7f136127a9b32a8ce3470af84bc8d27dbefad9d2abd83e4d280ef6523754d87`, retrieved/checked `2026-10-31T09:48:16.708Z`.
- Country scope: pinned Natural Earth 5.1.1 / reviewed PL ID `ne:1159321179`, with the existing 1 km country-boundary review band. **1,767** Mio records are in Poland/border scope, including 17 uncertain border records; **51,571** outside/unassigned records are excluded from missing-CANARD coverage totals. Whole linked pairs remain available when an endpoint crosses that scope.

The real hosted worker import preserved **all 811 source IDs, geometry, normalized/original fields and notices**, through project save/reopen and reference export. Reimport was unchanged. The rebuilt original BIN was **byte-identical**. This was a reference import: 811 reference observations, zero encoded bindings. Unknown-status observations and OPP geometry are not silently encoded as new device records. No existing user-edited browser project was supplied; saved-project binding/ownership behavior is regression-tested and can be audited with the JSON input mode.

## Geometric results

A 100 m endpoint radius generates candidates. A complete range candidate additionally needs a connector-span difference within `max(20 m, 10% of the CANARD span)` and unambiguous endpoint orientation. These are stated review tolerances, not proof of identity or road coverage. Both endpoint orientations and all four endpoint distances are retained. A shared endpoint with an opposite-extending range remains a range-review case.

| CANARD observation | Unique spatial candidate | Ambiguous | Range review | CANARD-only under tolerance |
| --- | ---: | ---: | ---: | ---: |
| Point-speed / red-light points | 54 | 606 | — | 15 |
| OPP sections | 17 | 111 | 7 | 1 |

There are **165 Mio-only records** and **8 Mio-only linked pairs** in scope. Record and pair counts are different views of the same data and must not be added as independent camera counts. Mio can contain non-CANARD providers, and CANARD can contain newer/different observations; source-only coverage is legitimate. Ambiguity can include opposing encoded directions or co-located devices; no candidate is automatically selected or bound.

The seven range-review source IDs are `113414032`, `116594640`, `118680069`, `118680098`, `118680228`, `12931379`, `89605782` (category OPP). Their best candidate endpoint discrepancies reach approximately 108–266 m; the report retains exact values, both endpoints, orientation and span differences. OPP `90798213` has no qualifying linked-pair candidate. These are review findings, not proof of an importer defect. The original Mio file has 13 unresolved link diagnostics globally, all outside this Poland comparison scope; no in-scope linked pair has a stored-speed disagreement.

Source-reported road length/direction and route geometry are unavailable in the reviewed map snapshot. Connector overlap flags possible shifted, adjacent, extended or split/merged ranges, but cannot establish the actual road path or enforcement start/end roles. Those identities/extents still need authoritative road/source or device evidence.

## Unknown speed findings

- **All 811 CANARD map observations lack numeric source limits.** The reviewed seven-field public arrays do not supply speed limits. The import retained those unknowns; it did not lose supplied values. A separate supplied-mph regression verifies known values and original units through the actual hosted import path.
- **265** of the 1,767 Poland/border Mio records store speed value zero; all use raw type **3**. The entire 53,338-record BIN contains **3,361** stored zeros, again all type 3. Raw values are retained exactly. The reviewed decoder classifies 1,502 Poland/border values as known km/h, 265 as unspecified and zero as unclassified. Globally the counts are 49,977 known, 3,361 unspecified and zero unclassified; these labels do not change bytes.
- Under the stated point tolerance, PP candidates comprise 918 unique Mio type-1 records; RL candidates comprise 240 unique Mio type-3 records, all with zero stored speed. This candidate correlation alone does not establish identity. Independent firmware evidence now supports raw type 3 as a red-light announcement category; it also has nonzero values elsewhere.
- Missing source limits, unavailable BIN limits, conditional/symbolic limits and conflicting observations are separate issues. No nearest-camera/default value is assigned and no endpoint limit is silently copied. Read-only BIN interpretation is scoped to MiVue 955W VF538.10.20.BE1AD.18, backed by the [reader trace](binary-reader-followup-2026-11-01.md): only the finite reviewed whitelist is labeled km/h, zero is Not specified, and all other values (including 5/139/255) remain raw/unclassified. Whole types 1/3/5 identify generic camera/red-light/mobile announcement categories; 964/9128 are distinct linked-section endpoint categories without start/end claims. This does not establish posted road limits or universal device behavior.

## Verification and remaining work

Tests cover source-only/ambiguous coverage, country scope, cross-boundary pairs, both orientations, partial/adjacent ranges, short-range length differences, invalid coordinates/links, raw zeros and known source values, protected manual versus source-owned coordinates, repeat imports, exact input preservation, no-overwrite/symlink guards, formula/HTML safety and reimportable analysis GeoJSON. The report runs offline in Chromium/Firefox/WebKit and links source/candidate map evidence to review rows.

The automated consistency/import audit is implemented. Human identity/range review, actual road distance/direction, remaining BIN semantics beyond the reviewed finite contract and device acceptance are not declared complete by geometric agreement. CANARD enrichment/PK and real OSM acquisition retain the independent evidence/access blockers documented in the TODO/source research.


## Enriched car-speed follow-up

The earlier snapshot/results above pin the map-only baseline. The enriched run imports 642 numeric passenger-car limits under the user-selected minimum-over-time/direction policy and retains 169 legitimately unavailable RL limits. See [car-speed evidence and differences](canard-speeds.md#live-verification--2026-11-01) and private `exports/canard-mio-car-speeds-2026-11-01/`. Unique geometric candidates agree for 53/54 PP and 16/17 OPP; differing values and all ambiguous/range-review evidence remain explicit. Both OPP endpoints are compared, and numerical agreement never establishes identity or road-route validity.
