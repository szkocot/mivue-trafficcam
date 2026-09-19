# Polish/English browser map and editor

Approved design for roadmap increment 2 (2026-09-20). Increment 1 is implemented and pushed to GitHub. Target device remains MiVue 955W; actual device acceptance is untested.

## Outcome

A working static browser application for opening a local `.bin` or saved project, loading the official Mio database, inspecting records on a map/table, editing supported fields, undoing changes, and downloading projects, data exports, or validated binaries. Polish and English cover all controls, errors, warnings, and human-readable export reports; developer documentation stays English. Detect browser language initially (Polish for `pl`, otherwise English), provide a visible PL/EN switch, and remember the user's choice. Machine-readable keys and diagnostic codes remain language-independent. Use the existing codec and project model as the authority. Everyday editing is the default; binary research details are in advanced mode.

General source ingestion, exact Polish administrative-boundary filtering, new OPP encoding, 22×22 codec support, and actual Pages publication are later work. Do not advertise those as implemented. Preparing a static site suitable for Pages is part of this increment.

## Architecture and alternatives

Recommended: vanilla JavaScript ES modules with pinned Leaflet 1.9.4, reusing the existing project/encoder modules. A small build script copies an explicit allowlist of app/core/library assets into `dist/`. Local preview serves only `dist/`, never the repository root or the user's binary. No application backend or account is needed.

A framework-based app would add a component/build system before there is enough UI complexity to justify it. A custom map engine would add projection, tile and interaction work already handled by Leaflet. Use a locally packaged map library, with its license and attribution, rather than a runtime CDN dependency.

Keep decoding, project validation, edit application, projection, and binary building in a module Web Worker. Requests carry document/session and request IDs; stale responses cannot replace a newer document or overwrite current form state. The worker owns project history. Handle loading, busy, cancelled, failed and ready states explicitly. Long work shows progress/status and leaves the browser chrome usable.

## Screen and visual direction

A light workspace with a dark navy header, teal primary actions, and amber diagnostic accents. The map is the main surface; record details are readable without covering it. Avoid dashboard decoration unrelated to the task.

- Header: product name, filename/version candidate, visible PL/EN switch, `Otwórz plik` / `Open file`, official-source/update action, `Zapisz projekt` / `Save project`, and `Eksportuj` / `Export`.
- Secondary bar: active record count, result count, local save status, changes relative to the starting database, warning count, `Cofnij` / `Undo` and `Ponów` / `Redo`. Distinguish locally saved changes from a downloaded project backup; autosave is not an export.
- Main desktop layout: large map, collapsible record list, and a details panel that opens on selection. The paginated table remains accessible by keyboard. Narrow screens use map/list tabs and a details section below.
- Empty state: explain local file processing and offer file selection or the official source. Drag-and-drop supports `.bin` and project JSON and has an equivalent file-picker action.
- Persistent short notice: experimental software, use at own risk. Explain once that files are processed locally; external requests are map tiles and official database update checks/downloads.

## Loading and map behavior

The user explicitly requested automatic startup loading, superseding the earlier manual-download-only proposal. On the first visit, download and validate the official Mio database once, then cache its bytes and source/version metadata in IndexedDB. On subsequent visits, use the validated cached copy immediately and check the source for an update, avoiding a full transfer when the source is unchanged. Use supported HTTP freshness metadata or browser conditional revalidation, verified against the live endpoint during implementation. Do not assume ETag is readable from JavaScript merely because cross-origin fetching is permitted. If freshness cannot be verified, retain the cache and show the check status rather than claim it is current.

Replace the cached database only after a complete new response parses successfully; a failed, cancelled, or unsupported update must not destroy the last usable copy. Offline visits can open the cached database; map tiles may remain unavailable. If browser storage is unavailable or has been cleared, explain that the cache could not be retained and fall back to an in-memory download/local-file import. Coalesce concurrent startup requests to avoid duplicate full transfers.

Source URL, retrieval time and last-check status remain available in the UI and project provenance where appropriate. Update the source cache independently of the active edited project: offer a newly available version without replacing edits or automatically rebasing them. A local project opened during the startup request takes precedence over a late download response. Keep an explicit retry/check-for-update action and cancellation. Never ship the sample in app assets.

Initial map view centers on Poland. `Pokaż całą bazę` fits all valid records without removing records from other countries. A Poland viewport is navigation, not a country-membership claim. Invalid-coordinate records remain in the table and warning list, with no invented map position.

Render only relevant viewport points, using canvas and screen-space aggregation at low zoom. Display aggregate counts; selecting an aggregate zooms in rather than choosing an arbitrary camera. Avoid a DOM marker per record. Render selected records distinctly. Coincident records remain independently selectable in the table/details; do not silently deduplicate them.

Use OpenStreetMap standard raster tiles with visible attribution, ordinary browser caching, and no offline/bulk prefetch. If tiles fail, retain the point layer and table and report the background-map failure. Bound rendering work when all 52,935 records are loaded.

## Linked table, selection and filters

Search by stable record ID and available provenance text. Filters cover viewport, warnings, changed/deleted state, and raw type (under advanced filters until meanings are verified). Table and map use the same filtered projection. Changing display filters never changes binary export scope. Show the matching count and paginate at 100 records; do not insert all records into the DOM.

Selecting a table row centers/highlights its point when coordinates are valid. Clicking a point selects the same stable ID and shows its record in the table. If filters hide a selected record, show that state without silently selecting a different record. Deleted records are hidden by default but can be shown and restored.

## Editing and history

Forms have `Zastosuj` and `Anuluj`; moving selection with an unapplied draft requires applying or discarding it. Coordinates accept a decimal point or decimal comma with strict validation. A `Wskaż na mapie` mode places a tentative location, committed only by Apply. Do not save on every pointer move.

Support existing project operations: coordinate changes, raw-byte changes in an advanced inspector, delete/restore, and `Dodaj na podstawie wybranego` for supported non-link templates. Show unknown types/flags as unknown; do not present raw values as confirmed km/h or heading units. Keep raw details out of the basic editing flow.

Candidate 964→9128 endpoint connections can be shown as dashed connectors with a legend identifying them as inferred links, not verified OPP road geometry. A selected unresolved source can choose a target and supply a reason through the existing resolve-link operation. Explain unsupported operations at their controls rather than offering actions that always fail.

Undo/redo operates on committed project operations, retains stable IDs, and clears the redo branch after a new edit. Retain the last 50 states in memory, sharing the unchanged baseline rather than copying it per state. Project save/reopen restores data, provenance, and applied edits; history need not survive reload.

The user approved local autosave. Store the active working project in IndexedDB separately from the official source cache, after every successful Apply, clone, delete/restore, link resolution, undo, or redo. Save complete validated project revisions transactionally; serialize writes so an older save cannot replace a newer revision. A new document/session invalidates pending saves from the previous one. Show `Zapisywanie…` / `Saving…`, `Zapisano lokalnie` / `Saved locally`, or an actionable save-failure message. Do not mark a revision saved until its transaction completes.

On startup, restore the last valid saved working project before considering the official source as an active document. Continue source-update checks independently, without rebasing or replacing that project. If stored working data is incompatible or corrupt, preserve it for recovery/export and offer a fresh/local-file workflow; do not silently erase it. If IndexedDB is unavailable or its quota is exceeded, keep the current project in memory, explain that autosave failed, and offer a project download. Browser storage can be cleared or evicted, so project download remains the durable backup action. No cloud storage is involved.

`Odrzuć zmiany` / `Discard changes` asks for confirmation, then restores the current project's own embedded starting database (not the latest downloaded Mio version), removes applied edits/clones/deletions/resolutions, clears undo/redo and pending form state, and autosaves that reset revision. Replacing a modified working project with another file or source version also requires an explicit choice to save/download or discard it. Changing language, viewport or filters never discards edits.

Autosave covers applied project operations, not unfinished form input. Warn before losing an unapplied form draft or leaving while a save is pending/failed; do not rely on unload-time asynchronous writes. After a confirmed reset or document replacement, stale worker responses and stale save completions must not resurrect old changes.

## Projection and export correctness

Add a tested projection function that materializes current record values from baseline plus edits without requiring a successful binary build. This lets unresolved drafts remain visible and saveable. Retain original source offsets under explicitly original names, not as freshly computed binary offsets. Do not mutate the baseline or infer a filtered build.

Export options:

- Project JSON: authoritative reopenable project, including baseline and edits.
- Data JSON / GeoJSON / CSV: current active records, effective coordinates/raw fields, stable IDs, provenance, and diagnostics. Identify this as project-view data, distinct from the CLI's parsed-binary schema. CSV quoting and text values must be safe to open in spreadsheets.
- Binary: call `buildProject`, show a report with changes/warnings, then enable download only for that validated project revision. Any later edit invalidates prepared bytes. A failed build keeps the project editable and offers the relevant record/warning; do not generate a partial binary or force-build option.

Use Blob URLs for downloads and revoke them after use/replacement. Use explicit filenames. Display filters never restrict exports implicitly. Keep source data out of logs, committed fixtures, and published assets.

## Verification and delivery

Keep the existing 60 tests passing. Add tests for effective projection, history transitions, filters, exports, and worker response ordering. Use a real browser test runner for file open, official-source error/cancel flows, linked selection, coordinate/raw editing, undo/redo, save/reopen, binary download and blocked builds. Verify first-visit caching, unchanged-source revalidation without a full transfer, changed-source replacement, offline reuse, failed-update preservation, storage failure, and edited-project protection. Test edit→autosave→reload restoration, undo/redo persistence, transaction failure, incompatible stored-project recovery, and races between saves, document replacement, reset and source updates. Verify Discard changes uses the project's original baseline even when a newer official database is cached. Check PL/EN switching and remembered selection, including errors and reports. Stub external tile/download requests in deterministic tests; separately check the live official download when available.

Smoke-test the local 52,935-record sample with bounded DOM rendering, keyboard navigation, narrow-screen layout, and responsive loading/build states. Browser-uploaded sample data stays local. Verify static hosting under `/mivue-trafficcam/`, relative asset/worker paths, no repository-source serving, and no binary/project files in `dist/`. Report measured timing observations rather than promising unmeasured performance.

Create the app, build/preview scripts, and browser tests. Prepare Pages-compatible output, but do not enable Pages, merge, or publish automatically in this increment.

## References checked 2026-09-20

- [Leaflet download](https://leafletjs.com/download.html): 1.9.4 is the current stable release listed by the project.
- [Leaflet reference](https://leafletjs.com/reference.html): canvas path rendering and map interaction APIs.
- [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/): attribution, caching, and no bulk/offline tile downloading.
