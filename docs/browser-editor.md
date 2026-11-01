# Local browser editor

Use the [published editor](https://szkocot.github.io/mivue-trafficcam/), or build with `npm ci && npm run build:web` and preview with `npm run preview:web -- --base /mivue-trafficcam/` at `http://127.0.0.1:4173/mivue-trafficcam/`. Both publication and preview expose only generated assets. See [deployment details](deployment.md).

## Working with data

The PL/EN interface detects the browser language and remembers an explicit choice. The initial map covers Poland; the database retains all countries. Display filters never limit exports. Select records from the map or keyboard-accessible list; the list is paginated at 100 rows. Aggregates zoom in; coincident cameras remain distinct in the list. Invalid coordinates have no invented map position.

Open a `.bin` or project JSON by file picker or drop. Apply/Cancel controls commit or discard tentative coordinate/raw-byte edits. Decimal comma and point are accepted. Pick on map changes only the form until Apply. Undo/redo retains up to 50 in-memory states; reload restores the project but not undo history. Clone, delete/restore, and explicit candidate-link resolution use the existing codec restrictions. The table/details retain raw BIN codes and show the reviewed, firmware-scoped speed/type interpretation: recognized km/h values, zero as Not specified, and generic/red-light/mobile announcement categories. Unsupported values remain unclassified; other flags and endpoint roles remain unverified. Dashed endpoint connectors are inferred, not verified OPP routes.

## Cache, autosave, and backups

First startup downloads and validates the official Mio source. Subsequent visits reuse IndexedDB bytes and check exposed HTTP metadata without a full unchanged-body download. When freshness cannot be checked, the UI says so and retains the cache. Retry or explicitly download again. New source bytes are validated before replacing the cached source, independently of the active working project; opening them requires a separate action.

Applied edits autosave to a separate working-project store. “Saved locally” means its IndexedDB transaction committed. Local storage can be unavailable, cleared, or evicted: download project backups for durable recovery. Corrupt saved data is preserved for recovery download and requires explicit replacement. Discard changes resets the current project's own embedded baseline, not a newer cached official database. Unapplied form drafts are not autosaved.

Files are processed locally in module workers. Network requests retrieve the official database and normal OpenStreetMap tiles; there is no backend upload, account, bulk tile download, or offline tile cache. A cached database may open without network access, but the application assets must still be available from the host/local preview; this is not an installable offline app.

## Downloads and safety

Project JSON is the authoritative reopenable document including the original database. Data JSON, GeoJSON and CSV contain all current active records and are explicitly project-view exports, not CLI parsed-binary schema. CSV text is quoted and formula-neutralized. Binary download requires a successful build and report for the current revision. Edits invalidate prepared reports; there is no force-build bypass.

Experimental and unofficial: use at your own risk. Device acceptance on MiVue 955W is untested. Current codec supports only the researched 20×20 layout. Unknown header dependencies and unresolved links can block structural edits, including future country-reduced builds. CANARD/other website imports and exact country selection remain future work.

## Verification

`npm test` runs Node checks, including a localhost-only static-server test. `npm run test:browser` starts Chromium against the repository subpath with synthetic data and stubbed external requests. A separate optional local-sample browser test measures real-size behavior without publishing the sample.

Implementation references: [Leaflet 1.9.4 API](https://leafletjs.com/reference.html), [Playwright installation](https://playwright.dev/docs/intro), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).
# Browser location

Project compatibility: current saves use version 3, adding hosted-source notices and synchronization preferences to ingestion sources/observations, bindings, template policies and manual-coordinate ownership. Existing version 1/2 projects upgrade in memory on open without changing their embedded BIN, and do not automatically opt into synchronization. Older app releases cannot open version 3 saves. Keep original project backups. Latitude/longitude share manual ownership, including an explicit edit back to original values. Source metadata does not change binary field meanings.

Choose **Locate me / Moja lokalizacja** above the map to request a single browser position. Allow location in the browser prompt if desired. The map shows a blue marker, reported accuracy circle and fix time. Accuracy may come from GPS or another provider; it is not guaranteed. The feature works before opening a database and does not move camera records or alter project history.

Use **Cancel location request** while waiting, or **Clear location** to remove the fix. Retry is always explicit. Failed retries retain the previous fix, labelled as such. Opening another file or reloading clears location. HTTPS or a trusted localhost preview is required; denied/unavailable location does not prevent manual map use.

Location is held in memory only, not included in saved projects, autosave, exports, URLs or application logs. Browser/OS location providers may process the position, and centring the map requests tiles for that area. Clear does not revoke browser permission; use browser settings for that. No tracking, reverse geocoding or navigation is provided.

## Importing source observations

Open a BIN/project first. Choose **Import / Importuj**, enter a stable source namespace and attribution (remembered locally), and select CSV or GeoJSON. File selection starts a validated, automatic merge. IDs identify updates within that namespace; proximity only suggests duplicates. Invalid batches change nothing. Undo reverses the whole import. Manual coordinate edits and deletions stay protected, including after project save/reopen.

Example CSV (UTF-8, decimal dots):

```csv
id,latitude,longitude,kind,status,speed,speed_unit,name
camera-a,52.1,19.1,camera,active,50,km/h,Example camera
```

GeoJSON FeatureCollection accepts Point and section LineString geometries, WGS84 longitude/latitude, Feature.id (or properties.id), and the same property fields. A supplied speed requires units; omitted values remain unknown. Extra properties survive as metadata. Limits: 20 MiB, 100,000 features, 1,000 vertices per section, 64 KiB metadata per feature, 256 characters per ID/namespace.

No saved or newly configured template means reference-only for new points. To enable automatic BIN additions for a supported kind, copy the ID of an original non-linked raw-type 1/3/5 record into the template field and acknowledge its unverified raw fields. That source/kind policy persists and is displayed whenever its source namespace is entered; leaving the template field blank retains it, not a reference-only override. Only active points can be added; source speed, direction and labels are never converted into raw bytes. Possible duplicates remain references unless explicitly associated with an existing record or added as distinct using a configured policy. Association alone does not move existing coordinates. Sections never generate new MiVue endpoint links. A bound identity changing to unsupported geometry/category becomes explicitly reference-only; later reactivation requires review and cannot silently recreate a deleted camera.

Purple markers/lines and the separate reference table represent unencoded observations; bound observations appear in their BIN record's details instead of duplicate markers. Source geometry and inferred BIN links are not verified road routes. The reference table has its own 100-row pagination. BIN points explicitly associated with source observations are blue; unbound BIN points are teal and unencoded references are purple. An amber ring shows selection. The legend reports visible point counts; overlapping status groups are offset visually without changing coordinates. Existing filters apply to BIN records, not source observations. **Reference GeoJSON** exports all source observations separately, with attribution and encoding status; regular exports retain their active-BIN-record scope. Displayed speed is source-reported, not proof of device encoding.

Speed-limit and metadata label switches are independent, off by default, remembered locally and absent from project history. Individual visible points can show labels; aggregates cannot. Collision suppression caps labels at 200 per frame. Selected details always include available source data, original units and unknown values. Source links are restricted to HTTP(S); all source strings are rendered as text.

Direct browser access to CANARD remains blocked by CORS. The hosted-snapshot implementation instead reads a validated same-origin dataset when one is published (publication and daily gated updates are enabled). Importing it opts the project into startup synchronization; the checkbox disables future automatic merges. Updates wait for unapplied forms/recovery, and Undo is respected for the rest of the session; use Reapply to intentionally apply that version again. Reload checks the manifest once, without redownloading unchanged snapshot bytes. Failed checks retain the last valid copy with a warning; withdrawal clears the separate cache but does not delete your saved project.

Coverage is point-speed cameras, OPP endpoints and red-light enforcement. Control-point data is explicitly unavailable, not zero. Unknown speed/status/direction remain unknown and OPP lines are not road routes. The source panel shows retrieval/check times and attribution. When a CANARD observation is associated with a BIN record, keep the downloadable source notices alongside distributed BIN/CSV exports; project/reference exports embed notices. The publisher enriches device details serially with a private cache. Passenger-car speed is the minimum across all supplied times and directions; the original conditional rows and the explicit km/h interpretation policy are preserved. See [car-speed import policy](canard-speeds.md). No live-video source is supplied. See [access evidence](source-access.md).

## Local OpenStreetMap JSON

Choose **OpenStreetMap JSON (cameras / sections)** in Import after opening a BIN/project. The namespace and attribution fill automatically. Select a local OSM/Overpass JSON export containing `elements`, for example:

```json
{"elements":[{"type":"node","id":123,"lat":52,"lon":21,"tags":{"highway":"speed_camera","maxspeed":"30 mph","direction":"90","name":"Example"}}]}
```

Supported inputs are speed-camera nodes with coordinates and the explicit average-speed relations described below. Ordinary cameras have unknown operational status and remain references; proposed/disused tags retain planned/inactive status. Numeric speed limits retain original units, bearings remain camera-facing metadata, and other tags survive unchanged. Average-speed enforcement relations are supported only with exactly one distinct from/to node and both coordinate-bearing nodes included in the file. They remain reference-only endpoint connectors, never road routes. Other enforcement relations and camera ways produce an actionable error. There is no automatic API download, route inference or speed/direction BIN encoding. The retrieval time is local import time, not file freshness. Reimporting a node clears stale source limits/bearings when its current tags no longer supply them, while manual BIN edits remain protected.

Keep the OpenStreetMap contributors / ODbL licence notice when sharing derived outputs; reference exports embed it and the existing notice download covers associated BIN records. See [supported fields, research and limits](source-research-2026-10-31.md).

## BIN speed and type display

The BIN records table and selected-record details show the current stored speed value (record byte 16) and raw type code (record word 20), including zero and unknown codes. The reviewed firmware-scoped decoder labels a finite set of values as km/h, zero as Not specified, and whole codes as generic/red-light/mobile announcement categories or linked-section endpoints. Other values remain raw/unclassified; complete flags and endpoint-role semantics remain unverified. Source-reported limits remain separately labelled with attribution. These read-only fields do not alter the project or encoded bytes; advanced raw-byte editing remains explicit.


## Merge matching points and OPPs

After importing source observations, use **Merge matching observations** above the reference table. The paginated review shows compatible BIN point records within 100 m and existing complete OPP pairs whose two endpoints and straight-line span fit the source section. It shows source car speed, candidate BIN speeds/distances, and CANARD `kierunek`/named direction evidence. Unique, uncontested candidates are preselected; ambiguous candidates need an explicit selection. The selection is a source association, not a claim that spatial proximity proves identity.

One source camera can attach to several compatible BIN records (for example, separately represented approaches). An OPP can attach to one or more complete existing 964→9128 pairs. Select whole pairs; missing, deleted, wrong-type or half-pair associations are rejected. Existing associations remain selectable as whole units even if new nearby candidates share an endpoint. Manual record-ID entry remains available in selected reference details; multiple IDs are comma-separated. **Unmerge source observation** removes the complete source association.

Applying the review is one undoable transaction. All associated BIN points/endpoints become blue and merged OPP connectors are blue dashed lines. Source direction names appear in details/review and optional map metadata labels. Road chainage is labelled separately and never converted to a guessed compass bearing; blank source direction does not imply both camera approaches. The car-speed minimum-over-time/direction policy remains unchanged.

Merging changes source associations, not coordinates, raw speed/type bytes or links. Complete section bindings survive save/reopen/reimport, and manually owned coordinates/deletions stay protected. Source/reference exports retain every associated record ID. Country projections include a reference when any associated record is kept and disclose `selectedRecordIds`; actual linked OPP pairs remain whole. These associations do not create new device-format OPP records or encode source speed/direction into raw bytes.
