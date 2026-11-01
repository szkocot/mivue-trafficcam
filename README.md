# MiVue TrafficCam

An independent browser editor and CLI for inspecting, editing and rebuilding Mio MiVue speed-camera databases, with a focus on Poland and odcinkowy pomiar prędkości (OPP).

**[Open the app](https://szkocot.github.io/mivue-trafficcam/)** · [User guide](docs/browser-editor.md) · [Remaining work](docs/todo.md)

## Features

- Polish/English map and record list, search, display filters and optional browser location.
- Official Mio database download or local BIN/project import, local autosave and downloadable project backups.
- Coordinate edits, clone/delete/restore, undo/redo and validated binary exports.
- Attributed CSV, GeoJSON, OSM camera-node and hosted CANARD observation imports. CANARD car limits use the minimum across all supplied times/directions, retaining original conditions ([policy](docs/canard-speeds.md)). Source limits and metadata remain separate from BIN fields; imported OPP geometry is reference-only.
- Selected-country exports with boundary uncertainty and linked-endpoint review. Full project backups retain the complete dataset.
- Read-only, firmware-scoped speed/type interpretation alongside raw BIN codes, plus CANARD–Mio comparison reports.

Files are processed locally. The app fetches source data and OpenStreetMap tiles; it does not upload your working database to a backend. Proprietary Mio databases and firmware are not bundled in the public site.

## Run locally

Use Node.js 26 and npm. From the repository root:

```sh
npm ci
npm run build:web
npm run preview:web -- --base /mivue-trafficcam/
```

Open **http://127.0.0.1:4173/mivue-trafficcam/**. The preview serves the generated `dist/` assets.

## CLI

The CLI reads local files and needs no installed dependencies:

```sh
node bin/mivue-trafficcam.js inspect Speedcam_Data_FEU.bin
node bin/mivue-trafficcam.js export Speedcam_Data_FEU.bin --format geojson
```

Exports go to stdout; diagnostics go to stderr. Save exports to a new file, never over the source BIN. Project creation, edit and build examples are preserved in the [detailed CLI notes](docs/project-history.md#editable-projects-and-binary-builds).

## Tests

```sh
npm test
npx playwright install chromium firefox webkit
npm run test:browser
```

Tests primarily use synthetic data. Private-sample checks skip when their inputs are absent; optional live-source checks are separate. See [browser verification](docs/browser-verification.md) and the [manual browser/device procedure](docs/user-acceptance.md).

## Format support and lossless round trips

The codec supports the researched 3×3 regional grid with 20×20 or 22×22 cells and 28-byte records. Both inspected private databases reproduce byte-for-byte, including SHA-256, through repeated parse, parsed-JSON export/reload, project save/reopen and unchanged binary rebuilds. This is evidence for those supported files, not every MiVue format or device.

Edited builds validate counts, offsets, coordinates and understood links, then reparse the output. Unresolved references and unverified header/layout dependencies can block structural changes. Raw fields remain preserved; semantic editing of speed, direction and new OPP encoding is not established. GeoJSON/CSV are data exports; project JSON is the reopenable backup. **Acceptance of edited files on a physical MiVue 955W remains untested.**

## Documentation

Contributor/agent guidance: [AGENTS.md](AGENTS.md).

- [Browser editor and import instructions](docs/browser-editor.md)
- [CLI examples, release notes and project history](docs/project-history.md)
- [CANARD–Mio comparison: method, results and private artifacts](docs/canard-mio-verification.md)
- [Binary format](docs/binary-format.md), [reader evidence](docs/binary-reader-followup-2026-11-01.md) and [endpoint research](docs/binary-endpoint-followup-2026-11-01.md)
- [Sources and reuse](docs/source-access.md), [deployment](docs/deployment.md) and [TODO](docs/todo.md)

## License and use

No project-wide software license is currently declared in this repository. Third-party libraries and imported datasets retain their own licenses and attribution requirements; do not assume permission to redistribute Mio databases or firmware.

**Experimental, unofficial software: use at your own risk.** Back up original files before editing. Incorrect data or incompatible output may cause missing alerts, device problems or data loss. Follow posted signs and traffic rules; this project is not affiliated with or endorsed by Mio or MiVue.
