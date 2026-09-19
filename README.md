# MiVue TrafficCam

An independent project for inspecting and building speed-camera databases for Mio MiVue products, with an initial focus on Poland.

The intended scope includes fixed speed cameras and section-based average-speed enforcement (Polish: **odcinkowy pomiar prędkości**, or **OPP**).

## Status

Initial project setup. No decoder, encoder, editor, source importer, or website is implemented yet. The binary format and device compatibility still need to be investigated and verified.

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
