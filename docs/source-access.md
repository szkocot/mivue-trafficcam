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

## Access gate result — 2026-09-20

**Direct browser connector disabled: `CORS_BLOCKED`.** A public GET with `Origin: https://szkocot.github.io` returned HTTP 200 but no `Access-Control-Allow-Origin`. Chromium, running a minimal page at that origin, rejected a credentials-omitted fetch with a CORS error explicitly naming that missing header. This is observed browser evidence, not an inference from curl. No proxy, credentials, CORS bypass, or dataset publication has been added.

The map footer states that published content may be used without GITD permission; marked copyright content defaults to CC BY 4.0 unless otherwise stated. This is positive general reuse evidence, superseding the preliminary uncertainty above, but it does not document an API contract or bulk-detail service. Preserve GITD/CANARD attribution, retrieval time and the illustrative-map disclaimer in any future connector. See the [published footer and map disclaimer](https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen).

Object-detail URLs are Liferay resource URLs under `/cms/en/web/guest/mapa-urzadzen`, with `p_p_id=pl_canard_cms_portlet_mapa_INSTANCE_URMGfsNrnTYd`, `p_p_lifecycle=2`, `p_p_resource_id=%2Fobjdata`, and `_pl_canard_cms_portlet_mapa_INSTANCE_URMGfsNrnTYd_type=PP|OPP|RL|PK`. The client POSTs `_pl_canard_cms_portlet_mapa_INSTANCE_URMGfsNrnTYd_id`; responses are UTF16 LZString-compressed JSON. Client references include `rodzaj`, `urzadzenie.rodzajPomiaru` (`PP`, `PO`, `PC`) and `punktKontrolny`. These observed names are not a stable supported API promise. No bulk detail retrieval was performed. Stable IDs across updates, complete detail schemas, status/speed semantics and retrieval-volume expectations remain unverified; do not infer active status from visibility on the map.

Local CSV/GeoJSON imports remain usable without network access. Live CANARD needs a separately agreed preprocessing/server-side workflow or a documented cross-origin endpoint, plus field/identity verification. This gate is complete; **CANARD ingestion itself is not implemented**. Other website adapters remain follow-up work.
