# MiVue TrafficCam

An independent project for inspecting and building speed-camera databases for Mio MiVue products, with an initial focus on Poland.

The intended scope includes fixed speed cameras and section-based average-speed enforcement (Polish: **odcinkowy pomiar prędkości**, or **OPP**).

## Status

The parser, editable project model, encoder, and CLI support the 20×20 layout documented in [binary-format research notes](docs/binary-format.md). They inspect databases, export JSON/GeoJSON, save/reopen projects, apply validated edits, and rebuild binaries while preserving raw fields. Unchanged reconstruction of the 52,935-record sample is byte-identical, including its 13 candidate-link warnings. A local PL/EN map editor is available; general ingestion and deployment are still upcoming; see the [approved roadmap](docs/roadmap.md).

Tasks 1–6 of the [implementation plan](docs/superpowers/plans/2026-09-20-map-editor.md) provide a bilingual map editor, cache/autosave, tentative forms, undo/redo, project recovery and validated downloads. Verification includes 82 Node tests, 18 deterministic browser tests and a separate successful live-source check. The full 52,935-record sample loads with bounded DOM rendering and rebuilds byte-identically; see [verification details and limitations](docs/browser-verification.md). Final independent review precedes integration. CANARD/other website imports and country-limited datasets follow this increment. This README is updated after every task.

## Usage

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

Use the [official European speed-camera database](https://dl-mio.akamaized.net/dvr/MiVue8xx/Speedcam_Data_FEU.bin) as the download source. `src/sources.js` exports this URL and a browser-compatible `fetchOfficialDatabase({ signal })` loader that validates downloads; the future GitHub Pages UI can call it when the user requests the official data. The endpoint currently permits cross-origin access. It is fetched from Mio, not copied into the published website; local file import remains the fallback for network or format changes.

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

## Possible GitHub Pages website

A local PL/EN map editor is implemented: file picker/drop, worker-backed loading, automatic official-source cache checks, paginated linked table, display filters, canvas map, autosave, coordinate/raw-field edits, clone/delete/restore, link resolution, undo/redo, and downloads. Binary download is enabled only after a validated report for the current revision. See the [browser guide](docs/browser-editor.md) for recovery, limitations and own-risk precautions. GitHub Pages publication has not been enabled.

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
