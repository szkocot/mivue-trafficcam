# MiVue TrafficCam

An independent project for inspecting and building speed-camera databases for Mio MiVue products, with an initial focus on Poland.

The intended scope includes fixed speed cameras and section-based average-speed enforcement (Polish: **odcinkowy pomiar prędkości**, or **OPP**).

## Status

A read-only parser and CLI support the layout documented in [binary-format research notes](docs/binary-format.md). They inspect databases and export JSON or GeoJSON while preserving raw fields. The local sample contains 52,935 records; all parse successfully, with 13 candidate-link warnings matching the research notes. Encoding, editing, source ingestion, and the website are not implemented yet.

## Usage

Use Node.js (verified with v26.8.2). No dependencies or installation are required.

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

## Planned capabilities

- Decode and inspect speed-camera `.bin` databases.
- Extract records into documented, editable formats.
- Edit camera locations, speed limits, and supported metadata.
- Represent OPP sections and their endpoints as supported by the device format.
- View cameras and OPP sections on a map.
- Ingest and reconcile records from external sources, retaining provenance and attribution.
- Encode records and build `.bin` files for supported MiVue products.
- Validate generated files through round-trip checks and device-specific compatibility testing.

## Possible GitHub Pages website

A browser-based interface hosted on GitHub Pages is being considered for importing files, viewing and editing records on a map, and downloading rebuilt databases. Local processing in the browser is a design goal. Source ingestion will need to account for source licenses, browser access restrictions, and any preprocessing that cannot run on a static site.

## Research sample

The initial local sample is `Speedcam_Data_FEU.bin`. It is excluded from version control and is not distributed with this repository. Its name alone does not establish its format, coverage, or supported devices.

## Use at your own risk

**This is experimental, unofficial software. Use this project and any generated databases entirely at your own risk.** Incorrect or incomplete data and incompatible files may cause missing or incorrect alerts, device malfunction, or data loss. There is no guarantee of accuracy, completeness, fitness for purpose, or compatibility with any MiVue model or firmware.

Keep backups of original files before making changes. Always follow posted signs and applicable traffic rules; camera alerts are not a substitute for attentive driving.

This project is not affiliated with or endorsed by Mio, MiVue, or their manufacturers. Product names and trademarks belong to their respective owners. Only import or redistribute data that you have permission to use, and retain required source attribution.
