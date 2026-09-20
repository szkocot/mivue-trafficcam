# Country-limited exports

Status: written design approved by the user on 2026-09-20. The user approved the export-only approach and keeping both endpoints of cross-border OPP sections with warnings. The implementation plan awaits review. This document does not claim implementation or device compatibility.

## Intent and scope

Let a MiVue owner export cameras for one or more selected countries without deleting anything from the working project. Preserve understood links, raw bytes, provenance and source notices. Explain which records are kept, excluded or uncertain before download. A successful country classification is not a guarantee that a reduced BIN can safely be built.

This implements backlog point 2. Other source adapters, binary-field research, general translation fixes and extended browser coverage remain points 3, 4 and 6. Physical MiVue 955W testing remains outside this increment. Update README and the checklist after each implementation task.

## Chosen approach and alternatives

Use an export-only selection evaluated locally in the existing worker. Map filters, project history and autosave are unaffected. Compared with deleting unwanted records, this retains a recovery path without adding undo transactions. Compared with exporting the current map view, it makes the geographic scope explicit and independent of viewport, search and display settings.

Keep the current full-export path as the default. Country mode is optional and requires at least one country; an empty selection never silently means all countries. The full Project JSON backup always contains the original project, including original European data. Label it **Full project backup — not country-filtered** in both languages. Do not offer a reduced project format in this increment.

Country mode applies to BIN, encoded-record JSON/CSV/GeoJSON and reference GeoJSON. Encoded records and source observations are counted separately; reference-only CANARD sections do not become BIN records through selection.

## Boundary data and reuse

Proposed source: Natural Earth Admin 0 Countries, 1:10 million, release 5.1.1, ordinary countries variant. The [download page](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/) identifies this release and explains that its default borders represent de facto control. The [terms](https://www.naturalearthdata.com/about/terms-of-use/), checked 2026-09-20, place the map data in the public domain and permit modification and redistribution. Retain attribution voluntarily, plus the upstream accuracy disclaimer. This is not an authoritative legal-boundary service or a statement about disputed sovereignty.

During implementation, retrieve a pinned upstream release, record the exact source URL, upstream archive SHA-256, conversion procedure and output SHA-256 in a versioned manifest. The version label alone is insufficient. Check the actual downloaded licence and schema before bundling. No floating latest URLs in production. No camera coordinates go to a geocoder or boundary API.

Convert to validated longitude/latitude Polygon/MultiPolygon data with holes intact, without additional simplification. Use stable dataset feature IDs and a reviewed ISO-code mapping; unavailable, duplicated or sentinel ISO codes must not be guessed. Such regions receive explicit dataset labels rather than being silently assigned to another country. PL/EN labels may fall back to the reviewed source name, never a fabricated ISO identity.

Bundle the world dataset once as a lazy-loaded, same-origin static asset with its manifest and notice. The existing build allowlist must explicitly admit only those reviewed assets. Validate hash, geometry, unique IDs, coordinate ranges and resource limits before classification. Cap the decoded artifact at 20 MiB and two million positions; if the chosen conversion exceeds either limit, pause for a revised data representation rather than silently simplify or truncate it. Load once per worker session, use browser HTTP caching across visits, and require no live boundary refresh.

## Classification and uncertainty

Use current edited coordinates, not the original coordinate bytes. Deleted BIN entries are not candidates. A bounding-box index narrows polygon tests but never decides membership by itself. Support polygon holes, disconnected islands and wrapped longitudes/antimeridian geometries.

Classify each point as:

- **Assigned:** exactly one dataset country contains it and it is outside the review band.
- **Border review:** on a ring boundary, inside multiple countries, or within 1 km of a polygon ring.
- **Unassigned:** valid position without a country match, including gaps and offshore points.
- **Invalid:** missing, non-finite or out-of-range coordinates.

The 1 km band is a conservative product review trigger, not a claim that dataset error is bounded by 1 km. Show that limitation beside the preview. Classifications are estimates against a named version of the data. Do not use camera-source country tags to override geometric uncertainty automatically.

Assigned points in selected countries seed inclusion; assigned points elsewhere are excluded unless needed by a retained link. Uncertain points require an explicit keep/exclude decision for the current export, including those outside selected countries. For points retained by link closure or a section's other endpoint, the explicit section/component warning acknowledgement serves as that decision. Offer individual decisions and clearly labelled bulk decisions by uncertainty category, with affected counts. Keeping an invalid coordinate never bypasses BIN validation. JSON/GeoJSON retain diagnostic metadata and null geometry where the existing serializers support it.

Decisions are transient export settings, keyed by stable record/observation ID. They do not edit a camera's country, coordinates or source metadata. Changing the project revision, selected countries or boundary version invalidates the preview, decisions and prepared downloads; the user must review a new preview.

## Link and section preservation

For understood BIN links, form undirected connected components using the same verified target rules as the encoder, including valid explicit resolutions. If any member is retained, retain every active member of that component. Apply transitively and in both directions: choosing the target's country must retain its source too. Do not infer a link from proximity or raw type alone.

Outside-country members added by this closure are labelled **kept to preserve a linked section**, list the triggering record IDs, and count as linked extras. A manual exclusion conflicting with a retained component cannot cut a link: the UI explains that the whole component must be kept or excluded. Border/unknown decisions apply consistently to the whole component. Require acknowledgement of extras before scoped downloads.

Never resurrect a record already deleted in the working project. Missing, deleted, wrong-type and unresolved link targets remain diagnostics; retain the encoder's existing restrictions. Country selection does not repair the sample's anomalous references or establish new OPP type meanings. A non-BIN export can retain unresolved raw-link metadata with warnings; a BIN must satisfy the existing build rules.

Source LineString sections are indivisible observations. Include the entire section if either endpoint is included, preserving its complete original geometry and warning for outside-country endpoints. An uncertain endpoint requires review unless the section is already retained by its other endpoint; in that case disclose the uncertainty in the retained-section warning. If both endpoints are outside selected countries, do not infer that a straight connector crosses a selected country's road network. State that section selection is endpoint-based, not route intersection. Never clip or invent a route.

Bound source observations use their retained BIN record's inclusion for exported source metadata; independent reference-only observations use their own geometry. Keep source IDs, original tags and notices. Do not double-count bound observations as new encoded records.

## Components and data flow

1. **Boundary loader/classifier:** owns validated boundary data, spatial index, membership and uncertainty. Returns classifications, never mutates a project.
2. **Selection engine:** consumes the current project view, reference observations, country IDs and review decisions; calculates inclusion, link closure, exclusions and diagnostics deterministically.
3. **Worker export integration:** creates a temporary clone for BIN construction, marks non-retained active entries deleted only in that clone, and calls the existing encoder. Record/reference serializers filter export views without changing history. The clone is never committed to history, saved, reconciled or used to trigger source sync.
4. **Export dialog:** owns transient controls, paginated preview and explicit acknowledgements; uses worker request IDs plus project session/revision and selection generation to reject stale replies.

Preview output includes boundary identity, project identity, selected countries, kept/excluded/unresolved stable IDs, linked-extra reasons and separate record/observation counts. The worker recomputes/validates the selection for download; the UI cannot submit an arbitrary accepted ID list to bypass closure or review checks. Close, cancel, language rerender, edits, undo/redo, source updates or file replacement invalidate prepared bytes. Never allow bytes built under one selection to download under another label.

No project schema migration is needed: export settings and the preview are ephemeral. The existing worker queue remains the ordering boundary. Cache classification by project revision and boundary digest; invalidate it on edits or imports. Keep heavy geometry work off the UI thread and paginate preview rows at 100, following existing table limits.

## UI and error handling

The existing PL/EN Export dialog gains Full project / Selected countries scope controls, a searchable keyboard-accessible multi-select, boundary attribution/version, preview totals, uncertainty review and linked-extra acknowledgement. It must remain usable at narrow widths. Country mode never changes the map filters.

Make scope clear on every download control and use reviewed country codes (or sanitized dataset IDs where no ISO mapping exists) in data-export filenames; keep the existing BIN filename `Speedcam_Data_FEU.bin`. Display the active selection beside that filename. Full project backup remains available independently of failed boundary loading or blocked BIN creation.

Missing/corrupt/oversized boundary data disables country mode with a localized explanation and retry. It never falls back to rectangular clipping or an unrestricted export. A zero-record scoped BIN is blocked with an explicit empty-selection result; empty non-BIN collections remain valid after preview.

Translate classification, review, empty selection, stale preview and build failures into PL/EN, retaining technical details in the existing expandable diagnostics area. Unknown header semantics and unresolved links must say why the BIN is blocked and offer full backup and scoped non-BIN exports. Do not claim that Poland-only BIN output from the supplied sample is currently guaranteed: dropping its first populated region can trigger the existing header safeguard.

## Exports and notices

Scoped JSON and GeoJSON embed an export-selection report with boundary version/digest, country IDs, uncertainty decisions, linked extras and applicable source notices. Do not relabel raw speed/direction fields or modify source metadata.

CSV and BIN provide a companion JSON report/NOTICE download containing the same selection/provenance information. The BIN itself contains only the validated device format, no appended metadata. Clearly state that the companion report is for the user, not an extra file known to be required by the device. Keep all potentially applicable source notices when attribution scope cannot safely be narrowed.

The full project backup continues to preserve all original data and notices. Warn that it is not a country-limited or privacy-redacted dataset.

## Verification and acceptance

- Synthetic polygon tests: inside/outside, holes, islands, boundaries, overlap, review-band distance, antimeridian, invalid coordinates and unknown IDs; deterministic classifications independent of feature order.
- Selection tests: multiple countries, empty selection, explicit uncertainty decisions, both link directions, transitive closure, conflicting exclusions, deleted/missing/wrong-type endpoints and unresolved links.
- Section tests: either endpoint selected, both outside, uncertain endpoint, whole geometry retained, no route-clipping inference; bound and independent source observations remain distinct.
- Mutation tests: serialize the full project before and after preview, export, cancellation, failure and successful build; equality, revision and undo history must remain unchanged.
- Build tests: reparse reduced synthetic binaries, verify retained IDs through the build report and understood relocated links, preserve unknown raw fields, retain current header/link blockers, and continue byte-identical unchanged-sample reconstruction.
- Export tests: matching preview/export counts, no excluded encoded records, correct reference subset, source/boundary notices and selection report retained, CSV injection protections unchanged.
- Worker/browser tests: selection/revision races, stale download rejection, failed boundary fetch/hash, retry, multi-select keyboard use, paginated review, PL/EN and narrow layout. Existing regression suites remain passing.
- Performance evidence: exercise the full local sample and synthetic 100,000-observation input with the real pinned boundaries; record wall time, asset size and bounded DOM counts. Maintain responsive UI and cancellation. Do not publish proprietary test inputs.

Completion requires recorded tests, README/checklist updates and a separately verified deployment if released. Physical mobile browser behavior, new source connectors and MiVue acceptance cannot be claimed from these tests.

## Review handoff

The user approved this written design, including Natural Earth 5.1.1, the 1 km uncertainty band, endpoint-based section inclusion, ephemeral selection settings, and an unfiltered full-project backup. Source hashes will be recorded from the actual fetched artifacts during implementation, not invented in this design. The [implementation plan](../plans/2026-09-20-country-export.md) awaits review; no product changes have been made yet.
