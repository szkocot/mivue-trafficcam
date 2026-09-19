# Automatic source ingestion with protected manual edits

Status: approved for implementation planning on 2026-09-20, including metadata display and opt-in browser location. No ingestion implementation is included in this task. The source-ingestion and browser-location plans are separate, independently testable deliverables.

## Intent and agreed choices

Extend the existing Polish/English MiVue 955W editor with external camera and OPP data. The user chose automatic merging instead of per-camera approval, with manual edits taking precedence over imported values. Imports must be repeatable, attributable, reversible, and honest about unsupported binary encoding.

Approved behavior: match stable source IDs first; automatically apply supported additions and updates; preserve manual edits and deletions; flag ambiguous matches and unsupported OPP encoding; show a summary; undo an entire import in one step. Proximity alone must not identify two cameras as the same device.

This is a new subsystem. The schema and interface details below are proposed for written review, not previously approved implementation decisions.

User-requested additions: optional speed-limit/metadata display and opt-in browser location. The user approved these feature additions; their detailed behavior below is included in this revised spec for review.

## Scope and delivery boundaries

This increment delivers CSV/GeoJSON ingestion, persistent source observations, deterministic reconciliation, automatic supported project changes, map/table visibility, and PL/EN results. CANARD is the first requested website adapter: investigate its public data interface, attribution/reuse conditions, and browser access as an explicit implementation-plan task. Enable a live connector only if those checks succeed; otherwise report the exact blocker and retain local-file import. Do not substitute an unverified scraper or public proxy.

Other live website adapters, including OSM, follow through the same interface in later increments. Country filtering, Pages deployment, scheduled external-data refresh, new device profiles, and newly invented OPP binary records are outside this increment. The official Mio startup cache remains unchanged. External imports are explicitly initiated by the user and then merge automatically.

## Architecture

The flow is: adapter -> normalized source batch -> reconciliation -> validated atomic project transaction -> existing worker snapshot, autosave, map and result panel.

- Adapters parse source formats without changing project state. Each returns records plus source attribution, source namespace, retrieval time, content digest and diagnostics.
- A normalizer validates coordinates, units, identities and geometry; it never interprets external metadata as undocumented MiVue bytes.
- A pure reconciler takes a project and normalized batch and returns proposed changes and categorized results. It has no fetch, DOM or storage dependencies.
- A project transaction validates the candidate once and commits it through bounded history. Do not repeatedly parse the full baseline for every imported row.
- The worker owns parsing, reconciliation and commit; UI modules own file/source selection, configuration and translated results. Existing session isolation and build-revision invalidation apply.

Use focused modules for adapters, schema/normalization, reconciliation and browser controls. Extend existing project/history/projection interfaces explicitly rather than putting ingestion logic into the app controller.

## Input contract

Local imports use UTF-8 CSV or GeoJSON FeatureCollection. Initial CSV uses a documented comma-separated header schema: required `id`, `latitude`, `longitude`, `kind`; optional `name`, `speed`, `speed_unit`, `direction`, `status`, `url`. Quoted fields and CRLF are supported. Decimal coordinates use a dot; blank optional values mean unknown, never zero. `kind` accepts `camera`, `section`, `red-light`, `unknown`; `status` accepts `active`, `planned`, `inactive`, `unknown`.

GeoJSON uses Feature.id or properties.id as stable identity and the same property names. Accept Point features and LineString section geometry in WGS84 longitude/latitude order. Section geometry remains source geometry, not inferred MiVue endpoint links. CSV section rows without geometry may be retained as reference points but cannot create endpoint pairs.

The import form requires a reusable source namespace and attribution label; remembers them for subsequent batches. IDs are scoped by namespace, not filename or row number. Records without IDs are rejected with a clear diagnostic: inventing location-based IDs would break updates when a camera moves. Changing namespace intentionally creates a different source.

Preserve original properties and original units as JSON data. Normalize explicitly declared km/h or mph to km/h in metadata; missing units for a supplied speed are an error. Direction is a finite degree value in [0,360); do not infer it. Coordinates must be finite and within geographic ranges. Duplicate IDs, invalid rows, unsupported geometry, or malformed files reject the complete batch before mutation, with row/feature diagnostics.

Bound inputs to 20 MiB and 100,000 features, 1,000 vertices per section, 256 characters per ID/namespace and 64 KiB of metadata per feature. Reject larger inputs explicitly, not by truncation. Treat all labels and properties as untrusted text; preserve CSV formula-injection defenses on export.

## Project persistence and migration

Introduce project version 2 with an explicit ingestion state: sources keyed by namespace, observations keyed by namespace and source ID, bindings to project record IDs, per-field ownership, and source-scoped template policies. Observations retain latest normalized values, original metadata, retrieval metadata, and any unresolved reason. Bindings and provenance survive project export, reopen and autosave.

Keep embedded original BIN bytes and SHA unchanged. Continue accepting version 1 projects; upgrade in memory without editing the input file. Existing record edits, deletions and link resolutions are classified as manual. New version 2 output must be identified as such; old releases need not read it. Reject unknown versions and invalid ingestion-state references. The encoder consumes validated binary records and does not encode source observations by accident.

Track manual ownership explicitly rather than comparing values: a user setting a field to its existing value still protects it. Coordinate latitude/longitude form one ownership group so an import cannot combine a manually moved latitude with a source longitude. Raw bytes and link resolutions remain manual-only. Retain ownership through save/reopen and undo/redo. No automatic operation clears manual ownership.

Metadata-only imports make the project modified and eligible for autosave/replacement warnings. Reset-to-original clears ingestion state as well as binary edits, using the existing explicit discard guard.

## Matching and automatic merge rules

1. An existing `(namespace, source ID)` binding updates its bound record, except manually owned fields. Missing imported values do not clear existing values. Save the source's latest observation even when a manual override wins.
2. A known observation without a binding is updated in place and reconsidered for supported addition; it does not create another observation.
3. A new identity is not automatically bound to an unrelated baseline or another source's record. A point within 100 metres of an existing point, or of another new identity in the batch, is a possible duplicate. Hold it for review without creating a binary clone. This radius is a conservative candidate rule, not proof of identity. Use a spatial index and deterministic, order-independent batch handling.
4. A new point without possible duplicates can create a binary record only with a previously user-selected supported template policy for that namespace and kind. Otherwise retain it as an unencoded observation, visible on the map and in the summary.
5. A manually deleted bound record stays deleted on all later imports. A source record absent from a batch is not deleted: feeds may be partial. Explicit inactive/planned status is retained and flagged; it neither deletes existing records nor creates new binary records. Unknown status is also reference-only for new additions.
6. When two sources conflict, do not apply last-import-wins. An existing binding's source owns its imported coordinate group; another source can be associated only by an explicit review action. Manual ownership always takes priority.

An optional conflict action lets the user associate a source identity with an existing record, leave it reference-only, or approve a distinct addition using a configured template. Association alone does not overwrite existing coordinates; replacing those requires an explicit edit. This is exception handling, not mandatory review of every imported camera.

Same-content imports are no-ops: no duplicate records, provenance entries, history steps or autosave writes solely due to a newer retrieval timestamp. Changing source values updates the one observation. Import undo restores observations, bindings, ownership and binary records together; redo restores the identical result. No historical source snapshot grows indefinitely inside the project.

## Binary safety and template configuration

The current codec supports cloning original non-linked raw types 1, 3 and 5; these numbers are not verified camera categories. For a source/kind policy, the user must explicitly select an eligible original record as the template and acknowledge that raw fields are copied unchanged and device interpretation is unverified. Do not choose a template by nearest distance or assign a raw type from a source label.

Automatic addition copies that template and changes coordinates only. External speed, direction, status and labels remain provenance/reference metadata; the UI must not imply they were encoded. Show this limitation in the import setup and result summary. No eligible template means reference-only, not failed data loading.

Section/OPP data remains visible reference geometry. Do not generate MiVue link pairs, change existing link resolutions, or claim compatibility from matching source labels. Existing encoder limits, unresolved-link checks and first-region constraints remain enforced. A successful import can still produce a project whose BIN build is blocked; show actionable build diagnostics separately.

## UI and failure behavior

Add a bilingual Import action with file selection, source namespace/attribution and optional template configuration. A CANARD fetch option is conditional on completed access/reuse checks. Successful import commits automatically, then displays counts for encoded additions, updated records, unchanged records, protected manual edits and unencoded/ambiguous observations. One record may have protected and updated fields; label counters accordingly rather than implying they sum to input count.

Map and table distinguish source observations from encoded records. Bound observations do not draw duplicate point markers. Unbound observations and source-backed sections have a reference-only style and explicit labels. Preserve bounded DOM/canvas rendering. Existing project-data exports retain their encoded-record meaning; provide a separate reference GeoJSON export with attribution and `encoded: false` for unbound observations.

Imports obey the existing unfinished-form guard. Network/parse/validation failures and cancellation leave the working project untouched. Reject stale results if document session or revision has changed. Serialize import commit with existing worker edits. A persistence failure leaves the committed in-memory project available and displays the existing save-error state with project download recovery. Fetch failures never erase prior source observations or replace the working project.

## Speed limits and metadata display

Provide independent PL/EN display toggles for speed-limit labels and extra metadata, off by default to avoid crowding the map. Remember only these presentation preferences locally, not in the project or undo history. The selected-record details panel always exposes available metadata regardless of label toggles.

Display source-reported speed limits in km/h with the source attribution; preserve the original value/unit in details. The import contract's `speed` field means the reported enforcement speed limit, not vehicle speed. Show name, kind, direction, operational status, source ID, retrieval date and encoding status when available. Unknown values are explicitly unknown in details and omitted from map labels, never displayed as zero. Conflicting source values remain separately attributed rather than becoming a fabricated single limit. For BIN-only records, do not derive a speed limit or direction from unverified raw bytes; retain those bytes in the advanced inspector.

Render optional labels only for individual visible points, with collision suppression and a maximum of 200 labels per frame. Aggregates retain counts, not misleading shared limits. Source metadata remains read-only in this increment; labels and metadata controls do not change BIN output. All source strings use safe text rendering.

## Locate me

Add a keyboard-accessible PL/EN `Locate me` / `Moja lokalizacja` map button. Request a single position only after a click, using browser geolocation with high accuracy requested, maximumAge 0 and a 15-second acquisition timeout. Browser location may come from GPS or other location providers; do not claim GPS-level accuracy. A successful request centres the map and draws a distinct position marker plus an accuracy circle in metres, separate from camera records. Show the fix time and a Clear location action. Do not start continuous tracking, request vehicle speed, edit any camera coordinates, or mark the project modified.

Handle denied permission, unavailable position, timeout, unavailable API and insecure context with localized guidance; leave manual map navigation functional. Offer retry only on another explicit click. While a request is pending, allow cancellation at the application level: invalidate its request token so any later callback is ignored. Repeated clicks must not create competing requests. Clear pending requests/markers on document replacement or page teardown; no location survives reload.

Keep location in memory only: exclude it from project JSON, autosave, exports, URLs, analytics and logs. No application-level location upload or reverse-geocoding service is added. Explain before requesting location that browser/OS location services may process location and centring the existing online map fetches tiles for that area; do not promise that no third party can infer the viewed area. A clear action removes the marker and accuracy circle, but does not revoke browser permission.

API and privacy reference checked 2026-09-20: [W3C Geolocation](https://www.w3.org/TR/geolocation/). This is a small map interaction within the current editor, not navigation or a background tracking subsystem.

## CANARD acceptance gate

The public map at https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen is a research starting point, not a promised API or reuse license. Record the exact inspected endpoints, inspection date, response schema, stable identifiers, attribution/reuse evidence, geometry/status semantics and observed cross-origin behavior before enabling an adapter. Lack of usable access or unresolved reuse permission produces a documented deferred connector, not a bypass. Do not commit downloaded third-party datasets; use synthetic fixtures in tests.

## Verification and acceptance

- Unit tests: CSV quoting, GeoJSON order/geometry, limits, malformed input, duplicate IDs, units, hostile properties and deterministic normalization.
- Reconciliation tests: repeated import no-op, moved stable ID, coordinate ownership, protected deletion, source omissions, nearby/opposing cameras, within-batch duplicates, source conflicts, template restrictions and reference-only OPP.
- Project tests: v1 migration, strict v2 validation, metadata-only modified state, export/reopen, atomic rollback, undo/redo, reset and provenance preservation.
- Encoder tests: unchanged baseline identity, coordinates-only template clone, no metadata-to-byte guessing, unchanged build blockers and reparsed output checks.
- Browser tests: PL/EN controls and results, import/save/reload, one-step undo, manual edit protection, draft guards, failed/cancelled/stale imports, storage failure and reference-only visibility. Existing full-sample tests remain green.
- Live connector checks are opt-in and separate from deterministic CI; report access and reuse evidence honestly.
- Metadata tests: known/unknown limits, mph conversion and original units, conflicting sources, BIN-only unknown fields, PL/EN toggles, persisted presentation preferences, escaped source text and bounded labels on the full sample.
- Mocked browser-geolocation tests: no request on startup, success/accuracy circle, permission denial, timeout, unsupported/insecure environment, retry, cancelled/stale callbacks and marker cleanup. Assert location never enters project persistence, exports or application requests; distinguish expected map-tile requests. Physical GPS is not required for deterministic tests.

Update README after each implementation task, distinguishing reference data from BIN-encoded data and implemented adapters from planned ones. Preserve the own-risk warning and unverified-device status. Completion requires passing existing and new tests plus documentation; it does not imply Pages publication or physical-device acceptance.
