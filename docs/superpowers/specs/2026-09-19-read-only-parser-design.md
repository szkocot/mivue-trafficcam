# Read-only MiVue binary parser

Status: approved by the user on 2026-09-19; implementation has not started.

## Purpose and scope

Turn the documented binary investigation into a reusable parser that extracts records without changing input bytes. Preserve unknown fields and report suspected endpoint-link anomalies. The user's longer-term aim includes a GitHub Pages map/editor, so browser reuse is a design constraint. Encoding, editing, map UI, source ingestion, and identifying official camera types are outside this increment.

## Approach

Use dependency-free JavaScript ES modules with JSDoc types. The core accepts a Uint8Array and uses DataView, without Node-specific APIs, network calls, or filesystem access. A small Node.js CLI supplies file input and output. This makes the decoding logic reusable by a future static website.

Alternatives considered: Python offers convenient research tooling but would require a separate browser implementation or runtime; TypeScript provides compile-time types but introduces a build toolchain. Plain JavaScript keeps this first component directly executable in both environments.

## Components and interface

- `src/parser.js`: `parseDatabase(bytes)` returns header metadata, regions, cells, records, diagnostics, and summary counts. Export a structured ParseError with a code, byte offset, and human-readable message.
- `src/export.js`: serialize the parsed result as JSON and as a GeoJSON FeatureCollection of Point features. GeoJSON coordinates use longitude, latitude order. Do not create OPP lines while endpoint semantics remain uncertain.
- `bin/mivue-trafficcam.js`: `inspect <file>` prints a summary; `export <file> --format json|geojson` writes the export to stdout. Diagnostics go to stderr. No command overwrites the input or creates an output file implicitly.
- `test/`: Node's built-in test runner and synthetic binary fixtures generated in test code. No sample database is committed.

Each record carries its absolute offset, region/cell indices, raw coordinate numbers, decoded latitude/longitude, the four raw bytes at offsets 16–19, raw type word, raw link word, and its complete 28 bytes as hexadecimal. Names identify tentative fields as candidates rather than presenting speed units, headings, or type labels as established facts. Header and index headers retain their original bytes and stored integer bounds as well as decoded values. Unknown fields must never be normalized or repaired.

JSON output has a `schemaVersion: 1`, complete parsed metadata, records, diagnostics, and summary. GeoJSON properties retain record offsets and raw fields; collection metadata carries schemaVersion, header, summary, and diagnostics. Invalid coordinates become null geometry with a diagnostic instead of invalid JSON numbers or an invented position.

## Format acceptance and validation

Support the documented layout with a 36-byte header, 3×3 regions, 20×20 cells per populated region, 10-byte node headers, and 28-byte records. Reject other grid dimensions as unsupported for this first implementation; do not claim general compatibility based on one sample.

Validate input length before every read and validate complete spans before allocating or iterating through tables or records. Require ordered, non-overlapping region/cell offsets, exact node spans, matching regional sums, and complete file accounting. Reject truncation, pointers into headers/tables, impossible counts, and unexplained trailing bytes with a structured error. Unknown header bytes and type values alone are not structural errors.

Validate finite coordinates, valid minute components, geographic limits, and fractional cell membership using the global bounds. Derive fractional bounds from grid indices; stored integer bounds are metadata, not exact clipping limits. Exact upper global edges belong to the last cell; interior cells use lower-inclusive, upper-exclusive intervals. Invalid or misplaced coordinates produce diagnostics and preserve raw bytes.

After collecting records, resolve nonzero candidate link words through a map of record-start offsets. For raw type 964, report missing targets and targets whose raw type differs from 9128. Keep these findings as warnings, since the inferred semantics may have exceptions. Never follow links recursively or treat them as structural pointers.

CLI exit codes: 0 for successfully parsed data, including research warnings; 1 for malformed/unsupported input or I/O failure; 2 for invalid command-line usage. JSON/GeoJSON exports remain valid machine-readable stdout even when warnings exist.

## Verification

Synthetic tests cover valid populated/empty nodes, negative longitude, nonzero Uint8Array byte offsets, unknown-field preservation, truncated headers/records, invalid offsets/counts/dimensions, trailing data, invalid coordinates, and each candidate-link warning. CLI tests check usage, exit codes, stdout/stderr separation, and parseable exports. Verify the browser core has no Node imports.

An optional local integration test uses the ignored sample when present, otherwise explicitly skips. Require 52,935 records, nine regions, 2,800 cells, 898 populated cells, no coordinate-grid warnings, and the documented 13 link anomalies. Check sample SHA-256 before and after execution. The normal test suite must pass without the sample.

Update README usage and status after implementation. Exports derived from the sample remain local and must not be committed or published automatically. No device compatibility or re-encoding claim is part of this work.
