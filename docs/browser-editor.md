# Local browser editor

Build with `npm ci && npm run build:web`; preview with `npm run preview:web -- --base /mivue-trafficcam/`. Open `http://127.0.0.1:4173/mivue-trafficcam/`. The preview exposes only generated assets. No Pages deployment is enabled.

## Working with data

The PL/EN interface detects the browser language and remembers an explicit choice. The initial map covers Poland; the database retains all countries. Display filters never limit exports. Select records from the map or keyboard-accessible list; the list is paginated at 100 rows. Aggregates zoom in; coincident cameras remain distinct in the list. Invalid coordinates have no invented map position.

Open a `.bin` or project JSON by file picker or drop. Apply/Cancel controls commit or discard tentative coordinate/raw-byte edits. Decimal comma and point are accepted. Pick on map changes only the form until Apply. Undo/redo retains up to 50 in-memory states; reload restores the project but not undo history. Clone, delete/restore, and explicit candidate-link resolution use the existing codec restrictions. Types and raw-byte units remain unverified. Dashed endpoint connectors are inferred, not verified OPP routes.

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

Project compatibility: current saves use version 2, including ingestion sources/observations, source bindings, template policies and explicit manual-coordinate ownership. Existing version 1 projects upgrade in memory on open without changing their embedded BIN; older app releases cannot open version 2 saves. Keep original project backups. Latitude/longitude share manual ownership, including an explicit edit back to original values. Source metadata does not change binary field meanings.

Choose **Locate me / Moja lokalizacja** above the map to request a single browser position. Allow location in the browser prompt if desired. The map shows a blue marker, reported accuracy circle and fix time. Accuracy may come from GPS or another provider; it is not guaranteed. The feature works before opening a database and does not move camera records or alter project history.

Use **Cancel location request** while waiting, or **Clear location** to remove the fix. Retry is always explicit. Failed retries retain the previous fix, labelled as such. Opening another file or reloading clears location. HTTPS or a trusted localhost preview is required; denied/unavailable location does not prevent manual map use.

Location is held in memory only, not included in saved projects, autosave, exports, URLs or application logs. Browser/OS location providers may process the position, and centring the map requests tiles for that area. Clear does not revoke browser permission; use browser settings for that. No tracking, reverse geocoding or navigation is provided.
