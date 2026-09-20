# MiVue TrafficCam: complete workflow

Approved direction, 2026-09-20. Target device supplied by the user: **Mio MiVue 955W**, firmware unspecified. The user approved the roadmap, then requested a Polish/English interface and a startup database cache that downloads again only when a newer version is available. This roadmap covers the original feature request; individual increments remain separately testable.

## Product experience

A GitHub Pages application that lets a user open a local database, inspect Polish cameras and OPP on a map and table, edit records, review imported source data, and download a rebuilt binary. Parsing and editing run locally in the browser. Map tiles and explicitly requested source downloads can use network services. The existing CLI shares the data model and codec with the website.

Recommended architecture: extend the existing JavaScript core and build a static browser UI around it. A CLI-only expansion would delay map editing; a backend application would add hosting and upload requirements without helping the initial local-file workflow. GitHub Pages serves static HTML, CSS, and JavaScript, so any source requiring server-side access needs a separate explicit ingestion command or preprocessing workflow.

UI languages: Polish and English, with browser-language detection, a visible PL/EN switch, and a remembered choice. Code and developer documentation remain English. Automatically load/cache the official database on first startup; reuse it and check for updates on later visits. Autosave applied edits locally and restore the working project on return; offer an explicit Discard changes action that resets to that project's original baseline. Never replace an edited project with a source update. Keep a visible experimental/own-risk notice. The product must distinguish verified binary structure, tentative field interpretations, source claims, and actual device testing.

## Delivery sequence

| Increment | User-visible result | Acceptance evidence |
| --- | --- | --- |
| 1. Project model and encoder | Open a binary, save a project, edit records, rebuild a binary through the CLI | Unchanged sample reconstructs byte-for-byte; edited output parses; offsets/counts/link relocation tested |
| 2. Map and editor | Local file picker/drop target, map/table selection, filters, record forms, undo/redo, downloads | Full sample loads; table/map agree; edits survive project save/reopen; browser interaction checks |
| 3. Ingestion and reconciliation | Load points from CANARD and other websites where access/reuse permits; import CSV/GeoJSON and OSM data; preview additions, duplicates, conflicts, and provenance on the map | Source access/terms verified; synthetic imports, unit normalization, repeated-import idempotence, conflict review; source attribution retained |
| 3b. Country-limited datasets | Choose one or more countries and explicitly prepare a reduced dataset/binary, independently of map display filters | Versioned country boundaries; border/unknown-coordinate review; linked-endpoint integrity; preview of kept/excluded records; validated build or actionable refusal |
| 4. OPP completion and 955W validation | Explicit directional sections, endpoint editing, validated binary mappings | Known-location comparison, link investigation, then user-reported device acceptance/alerts |
| 5. GitHub Pages release | Public static application and automated checks/deployment configuration | Repository-subpath assets work; end-to-end open/edit/export check; sample data excluded from published assets |

The map can ship before all OPP type meanings are resolved. Source-backed OPP sections and inferred binary links must remain visibly distinguishable. A straight endpoint connector is not a surveyed road route. Imported records without a supported encoding can be viewed and saved to a project even if they are not yet eligible for binary export.

## Shared project model

Use stable record IDs independent of file offsets. A saved project keeps original binary bytes, source fingerprint, parsed raw metadata, edits, provenance, candidate links, and user resolutions. Separate editable fields from the original raw bytes so unknown bits survive edits. Binary offsets are assigned only during encoding.

Preserve full European coverage when opening the sample. A Poland view is a display/filter choice; excluding other countries from a rebuilt file is a separate explicit operation. Country filtering requires a boundary dataset; a bounding box must be labeled approximate.

The user explicitly requested country selection as a follow-up. Allow one or multiple countries, preview included/excluded/unknown records, and retain the original project for recovery. Define border points and cross-border OPP handling before implementation; do not silently drop a linked endpoint. Missing coordinates require an explicit user decision. A reduced binary remains subject to unresolved-link and unknown-header build restrictions, rather than bypassing existing safety checks.

## Binary builds and unresolved references

First implement reconstruction from the parser's header/index/record data, not a shortcut that returns the input buffer. Require exact byte equality on the untouched sample, including its 13 anomalous candidate links.

For edited projects, deterministically regroup records into cells, recompute counts and offsets, and relocate understood links by stable target ID. Reject numeric overflow and coordinates outside supported bounds. Keep unverified header fields intact; if an edit changes layout relevant to an unknown field, require investigation rather than invent its semantics.

Treat the 13 anomalous references as unresolved data. Byte-preserving reconstruction can retain them exactly. A modified build must not carry an unresolved numeric reference into a changed address space without analysis: offer explicit record review/resolution or block the affected build with actionable diagnostics. Do not silently delete, repair, or reinterpret records. New camera/OPP encoding requires a documented template or verified device profile, including raw type/flags and direction semantics.

## Map and editing

Use a map alongside a searchable, paginated record table and details panel. Show camera points, optional candidate endpoint connectors, source-backed OPP geometry, and warnings. Use clustering or canvas rendering for the 52,935-record sample; do not create one DOM element per record. Filters include viewport, source, warning state, and supported record types. Keep selection and draft edits consistent between map and table.

Provide add/delete/move operations, explicit apply/cancel, undo/redo, project save/reopen, and downloads of JSON, GeoJSON, CSV, and binary. Show a change summary and build diagnostics before download. Unknown raw fields belong in an advanced inspector, not ordinary user forms. Do not label unconfirmed raw fields as verified km/h or compass headings.

## Sources

Start with user-supplied CSV/GeoJSON and OpenStreetMap adapters. Keep source IDs, original tags, retrieval time, attribution, and units. Match exact source IDs before spatial suggestions; do not merge nearby cameras automatically because opposing directions or multiple devices can share a location. Distinguish active, planned, and unknown status when the source provides it. Missing speed or direction remains unknown.

CANARD remains a priority for Polish locations, including point-speed, OPP, red-light and control-point layers. The 2026-09-20 access gate found positive site-wide reuse terms, but Chromium cannot fetch the map from GitHub Pages because the response lacks a CORS header. The registry therefore reports `CORS_BLOCKED`; a live adapter is not implemented. A separately agreed preprocessing workflow or supported cross-origin endpoint is needed, with stable-ID and field-semantics verification. See [access evidence](source-access.md). Local CSV/GeoJSON remain the current import path; no proxy or external publication is implied.

## Validation and release boundaries

Retain the existing 40-test baseline. Add synthetic edit/encoding cases, byte-identical reconstruction, offset relocation, malformed project/import checks, and browser tests. Validate generated bytes by reparsing and comparing intended changes. Binary structural validity does not prove that the 955W accepts the file or interprets it correctly; device verification remains a separate recorded result.

Prepare the website and deployment configuration without including the user's sample or derived databases. Actual GitHub Pages publication and merges are explicit release steps. Do not publish source credentials or proprietary input data.

## References checked 2026-09-20

- [Mio MiVue 955W, Polish product page](https://www.mio.com/pl_pl/mivue-955w): advertises average-speed enforcement alerts, including remaining time/distance and average speed; does not document this binary format.
- [CANARD device map](https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen): displays point and section enforcement layers; describes its map as illustrative.
- [OSM enforcement relations](https://wiki.openstreetmap.org/wiki/Relation:enforcement): describes enforcement relations and endpoint/member roles; useful input structure, not evidence of Mio field meanings.
- [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages): static-site hosting model.

## Current next increment

Increment 1 is implemented and pushed. Increment 2's [approved design](superpowers/specs/2026-09-20-map-editor-design.md) and [implementation plan](superpowers/plans/2026-09-20-map-editor.md) have implementation, independent-review fixes and browser results in [the verification record](browser-verification.md). Increment 2 is merged into `main`; verification on the merged tree passed all 83 Node tests and 23 deterministic browser tests (the opt-in live-source test is skipped in the normal run). GitHub Pages deployment is not enabled. CANARD/other website ingestion and country-limited datasets follow it.

Update `README.md` after every task, recording actual progress and limitations without presenting planned features as implemented.

### Full-scope tracking, 2026-09-20

| Work | Current state / next artifact |
| --- | --- |
| Decode, extract, edit and rebuild BIN | Implemented for the researched layout; physical 955W acceptance remains unverified |
| PL/EN map, official dataset cache and working-project recovery | Implemented; preserve regression coverage |
| Automatic imports protecting manual edits/deletions | CSV/GeoJSON workflow integrated into local `main`; 134 Node / 41 browser tests pass after independent-review fixes; not yet pushed |
| CANARD and other websites | CANARD gate completed: direct browser CORS blocked; live adapter/preprocessing workflow remains outstanding; other website adapters remain follow-up work |
| Speed limits and other metadata | Implemented independent local presentation toggles and attributed details; source-reported values, not guessed BIN fields |
| Browser location | Integrated into `main`; independent review found no blocking issues |
| Restrict dataset to selected countries | Separate future design: versioned boundaries, unknown/border policy, paired OPP preservation and existing build blockers |
| GitHub Pages website | Static build exists; user authorized deployment after all work is complete and verified; configuration/publication still pending |
| README, tests and own-risk warning | Required for every implementation task and release |
