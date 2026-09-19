# Automatic source ingestion with protected manual edits

Status: proposed written design; awaiting user review. No ingestion implementation is included in this task.

## Intent and agreed choices

Extend the existing Polish/English MiVue 955W editor with external camera and OPP data. The user chose automatic merging instead of per-camera approval, with manual edits taking precedence over imported values. Imports must be repeatable, attributable, reversible, and honest about unsupported binary encoding.

Approved behavior: match stable source IDs first; automatically apply supported additions and updates; preserve manual edits and deletions; flag ambiguous matches and unsupported OPP encoding; show a summary; undo an entire import in one step. Proximity alone must not identify two cameras as the same device.

This is a new subsystem. The schema and interface details below are proposed for written review, not previously approved implementation decisions.

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

## CANARD acceptance gate

The public map at https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen is a research starting point, not a promised API or reuse license. Record the exact inspected endpoints, inspection date, response schema, stable identifiers, attribution/reuse evidence, geometry/status semantics and observed cross-origin behavior before enabling an adapter. Lack of usable access or unresolved reuse permission produces a documented deferred connector, not a bypass. Do not commit downloaded third-party datasets; use synthetic fixtures in tests.

## Verification and acceptance

- Unit tests: CSV quoting, GeoJSON order/geometry, limits, malformed input, duplicate IDs, units, hostile properties and deterministic normalization.
- Reconciliation tests: repeated import no-op, moved stable ID, coordinate ownership, protected deletion, source omissions, nearby/opposing cameras, within-batch duplicates, source conflicts, template restrictions and reference-only OPP.
- Project tests: v1 migration, strict v2 validation, metadata-only modified state, export/reopen, atomic rollback, undo/redo, reset and provenance preservation.
- Encoder tests: unchanged baseline identity, coordinates-only template clone, no metadata-to-byte guessing, unchanged build blockers and reparsed output checks.
- Browser tests: PL/EN controls and results, import/save/reload, one-step undo, manual edit protection, draft guards, failed/cancelled/stale imports, storage failure and reference-only visibility. Existing full-sample tests remain green.
- Live connector checks are opt-in and separate from deterministic CI; report access and reuse evidence honestly.

Update README after each implementation task, distinguishing reference data from BIN-encoded data and implemented adapters from planned ones. Preserve the own-risk warning and unverified-device status. Completion requires passing existing and new tests plus documentation; it does not imply Pages publication or physical-device acceptance.
