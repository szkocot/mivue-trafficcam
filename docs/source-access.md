# External source access research

Hosted snapshot implementation now includes a fail-closed publisher: only reviewed normalized observations and attribution are public outputs, never raw pages or downloaded JavaScript. Daily checks are disabled until both the repository variable and review record permit publication. Changes to observed terms/robots or schema stop updates; withdrawal requires no upstream access and removes the active hosted body without purging historical Git commits. See the [deployment procedure](deployment.md#hosted-canard-pipeline-not-released-yet). This is an engineering reuse assessment, not legal certification; bulk detail endpoints and live-video sources remain out of scope.

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

## Hosted-snapshot reuse assessment — 2026-09-20

The user selected a GitHub-hosted CANARD snapshot, subject to lawful reuse. This is research for the design, not approval of a finished implementation or a legal guarantee. No snapshot has been published.

### Published evidence

- The [CANARD map footer](https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen) permits use of published site content without seeking GITD consent, regardless of purpose or method. Marked copyrighted material defaults to an attribution 4.0 licence unless otherwise stated. It calls that licence “4.0 Polska”; do not silently treat this wording as a dataset-specific licence declaration. The map itself is illustrative, not an official document.
- [GITD's reuse policy](https://www.gov.pl/web/gitd/ponowne-wykorzystanie-informacji-sektora-publicznego) permits reuse of its website information under CC BY 3.0 Poland unless otherwise specified. It also provides a request procedure for additional information or access arrangements. The CANARD-specific notice is more directly relevant to this source; retain its wording and URL rather than labelling every GITD dataset CC BY 4.0.
- [CC BY 4.0's legal text](https://creativecommons.org/licenses/by/4.0/legalcode.en), sections 2–4, permits sharing/adaptation and covers licensed database rights. It requires attribution, retained notices, a licence link and modification disclosure; it does not grant endorsement, trademark or privacy rights. This explains the referenced licence, but does not independently prove that every upstream asset is covered.
- A read-only GET of [robots.txt](https://www.canard.gitd.gov.pl/robots.txt) returned HTTP 200 with a wildcard user-agent and empty Disallow on the assessment date. This is a crawl signal, not a licence, rate limit or bulk-detail API agreement. Browser CORS restrictions are likewise not reuse terms.

### Assessment and proposed safeguards

The published notices provide a reasonable documented basis for a snapshot of CANARD's publicly published camera/control-point information, subject to any item-specific exceptions. This is an assessment, not legal certification. It does not cover Mio BIN/firmware redistribution, third-party websites, or the legality of device use in every country.

The proposed design should retain source/notice URLs, GITD/CANARD attribution, retrieval date, original categories and modification history in the snapshot and downstream exports. Include PL/EN illustrative-data, no-endorsement and use-at-own-risk notices. Keep upstream data terms separate from the project's code licence; exports unable to hold attribution need an accompanying notice. Do not copy map tiles, imagery, logos, personal records or unrelated page assets. Unexpected or restricted fields must be held for review rather than automatically published.

Start with public map arrays across all four categories. Additional public device metadata remains in scope, but unattended bulk object-detail retrieval is gated on checking response-specific notices and establishing acceptable access arrangements; request clarification from GITD if these remain unclear. No such request has been sent. Do not interpret the absence of a published rate limit as unrestricted permission.

Proposed updater safeguards: infrequent scheduled checks, identified requests, caching, bounded retries/backoff, respect for access denials and Retry-After, and a publication stop on changed terms or unexpected schemas. Retain the last validated snapshot on ordinary fetch/validation failures; a rights concern requires review of whether it can remain served. The browser should check a small manifest on startup and download data only when its content hash changes. These are design proposals, not implemented capabilities.

## Implementation access check — 2026-09-20

The isolated CANARD feature branch now has a tested bounded Node retrieval boundary; no browser connector, publisher or public dataset is enabled. [Actual array inventory](canard-field-inventory.md) records 499 PP, 138 OPP and 169 RL records with matching per-layer ID sets across two captures. PK instead contains a literal empty-object placeholder, not a verified empty dataset. The [review configuration](../config/canard-review.json) therefore keeps publication disabled. The approved four-category completeness requirement cannot be satisfied from the current map arrays without inventing PK data or changing the agreed coverage.
