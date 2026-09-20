# External source access research

## CANARD — preliminary inspection, 2026-09-20

User priority: retain as much usable CANARD information as possible, including traffic/enforcement cameras. Inspect all four public-map categories, not only OPP. Preserve source IDs, names/serial identifiers, original metadata, attribution and retrieval time. Surface speed limits, direction, operational status and detailed location only when actually supplied; absent values remain unknown.

Read-only sources inspected:

- [Public device map](https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen).
- [Map client](https://www.canard.gitd.gov.pl/cms/o/pl.canard.cms.portlet.mapa/js/page.min.js).

The client reads compressed embedded arrays named `fotoradaryPP` (point speed), `fotoradaryOPP` (section enforcement), `fotoradaryRL` (red-light enforcement), and `punktyKontrolne` (control points). Its point reader uses `id`, `lat`, `lon`, and `nrSeryjny` or `kod`. Its OPP reader also uses `lok2PktDlugosc` and `lok2PktSzerokosc` for a second endpoint. These are observed client field references, not a verified stable public API contract. Two endpoints do not establish the road route.

The client refers to object-detail URLs (`objPPDataURL`, `objOPPDataURL`, `objRLDataURL`, `objPKDataURL`) and POST requests for selected objects. Those URLs and responses have not yet been inspected, and no bulk detail requests were made. The inspection does not establish that speed limits, status or direction are present. No evidence of live-video camera feeds was found in this inspection; do not advertise them as available.

The map describes its information as illustrative, not an official document. Data-specific reuse permission, complete schemas, ID stability, permitted retrieval volume and cross-origin browser access remain unverified. No CANARD connector is implemented or enabled. The ingestion plan's source-access task must resolve these checks before enabling live retrieval. Do not equate an HTTP fetch or visible map with permission to republish a dataset.

All usable categories can be retained as reference observations. Unknown/control-point categories remain labelled with their original category; no guessed MiVue mapping. Red-light cameras, like other points, require explicit supported-template configuration for BIN additions. OPP stays reference geometry until encoding is supported. Original source properties must survive normalization and project save/reopen, subject to documented size limits and safe text rendering.
