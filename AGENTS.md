# Working on MiVue TrafficCam

This is an unofficial browser editor and Node CLI for Mio MiVue camera databases. Keep changes small, preserve source evidence, and distinguish structural validity from device acceptance.

## Start here

- Read `docs/todo.md` for current work and genuine evidence/hardware gates.
- Read the relevant implementation before changing it. Use `rg` to find callers and tests.
- `README.md` is the short project overview and quick start. Put detailed design, research, release evidence and historical notes under `docs/`; do not turn README into a running work log.
- Current behavior and source code take precedence over historical milestone notes in `docs/project-history.md`.
- Use independent subagents when the user requests them or when suitable tasks can be delegated without overlapping file ownership. Agree on owned files and shared APIs, then review and integrate their results.

## Code map

- `src/parser.js`, `spatial.js`, `encoder.js`, `project.js`: binary parsing, layout, preservation and validated builds.
- `src/import-matches.js`: compatible point/complete-pair merge suggestions; ambiguity is reviewed, not silently resolved.
- `src/import-*.js`, `reconcile.js`, `source-metadata.js`: attributed observations, identity, ownership, imports and exports.
- `src/canard-adapter.js`, `canard-details.js`, `canard-snapshot.js`: CANARD map/detail normalization and snapshot validation.
- `scripts/canard/`: bounded upstream acquisition, private cache, preparation and separately gated publication.
- `src/road-directions.js`, `road-direction-data.js`, `scripts/roads/`: offline directed-road resolution, fingerprint/schema validation and compact CANARD lookup. National OSM PBF/graphs stay in `.cache/roads/`; only the compact attributed lookup belongs in `data/roads/`.
- Road-derived travel estimates remain distinct from raw Mio headings and physical aim. Keep explicit no-measurement directions negative; compare OPPs using actual 964 entry endpoint plus local bearings at both source endpoints. Never use a straight city bearing or silently reuse stale direction evidence.
- `src/bin-metadata.js`: finite, read-only interpretation backed by the documented firmware trace.
- `web/`: PL/EN UI, worker protocol, storage, map and source synchronization.
- `scripts/compare-sources.mjs`, `scripts/verification/`: private CANARD–Mio coverage/range/speed audit.
- `scripts/build-web.mjs`: explicit public asset allowlist. Add required browser modules there; never publish the repository root.
- `test/*.test.js`, `test/browser/`: Node and Playwright checks.

## Preservation and meaning

- Unchanged supported BIN input must rebuild byte-for-byte, including opaque bytes, unusual numeric encodings, unresolved links and hashes. Preserve project save/reopen and repeated round trips.
- Supported researched layout: 3×3 regions, 20×20 or 22×22 cells, 28-byte records. Reject unsupported layouts rather than guessing.
- Keep encoder/header/link blockers. Do not repair pointers using nearest addresses, nearby cameras or equal type counts. Do not remove guards based on incomplete static traces.
- Full project JSON is the reopenable backup. CSV/GeoJSON/reference exports are projections; they do not preserve arbitrary source whitespace, envelopes or unrelated OSM elements.
- Keep vehicle alert heading, CANARD limit-row chainage, named directions, mast claims and physical camera aim separate. Mode-1 researched Mio heading byte ×2 is alert logic; approach/departure can yield only a labelled road-axis estimate, never an optical azimuth. Never retype generic source direction numbers or guess physical aim from town names/ROSNACY/MALEJACY. See docs/direction-interpretation.md.
- Raw BIN speed/type and attributed source limits are separate. Presentation decoding must not mutate bytes. Unknown codes remain visible as raw values.
- The BIN speed whitelist/type labels are firmware-scoped; use the shared helper. Do not invent bitmask meanings, fixed-camera labels for generic type 1, or start/end roles from neutral linked codes.
- Coordinate order in GeoJSON is longitude, latitude. OPP endpoint connectors are not road routes. Proximity gives review candidates, not identity or an automatic merge.
- Mio-only and CANARD-only coverage is legitimate. Compare complete OPP endpoint pairs and range evidence; one nearby endpoint does not verify the section.
- Bindings may contain `recordIds` for multiple point records or complete existing OPP pairs; retain legacy primary `recordId`. Project views, map colors, notices, reimport and country projections must handle every associated record. Never reduce a saved section association to one endpoint.
- Respect manual coordinate ownership/deletions during reimport. Preserve source-qualified IDs, notices, original units/conditions, timestamps and metadata through reconciliation and export.

## CANARD car-speed policy

The user explicitly chose **passenger-car limits, selecting the minimum positive numeric limit over every supplied time and direction**. Exclude truck limits. Interpret the numeric result as km/h under this explicit policy; record the assumption rather than claiming the upstream response declares units.

Preserve all original conditional/vehicle rows, selected row indexes and provenance under `originalProperties.canardDetail`. Disclose the reduction in PL/EN labels. Missing or symbolic limits stay unknown; do not fill from nearby cameras/defaults. Status and compass bearing remain unknown unless separately established. PK's current placeholder is unavailable data, not zero observations.

Fetch public details in the existing server-side pipeline and serve the prepared snapshot to browsers. Use identified, credential-free, bounded serial requests and identity-bound private caching. Stop on denied/rate-limited/malformed responses; never publish a partial batch or bypass withdrawal, notice, schema, count or identity gates. Review `docs/canard-speeds.md` and `config/canard-review.json` before changing this policy.

## Verification

```sh
npm ci
npm test
npx playwright install chromium firefox webkit
npm run test:browser
npm run build:web
```

- Write a focused regression for nontrivial behavior. Run appropriate checks and read their actual exit status before claiming success.
- Run Node/build and browser suites sequentially: the Node artifact tests and browser startup both build shared `dist/`. Concurrent builds can invalidate browser evidence.
- Full browser projects are Chromium, Firefox and WebKit. Live Mio checks are opt-in: `MIVUE_LIVE_SOURCE=1 npm run test:browser -- test/browser/live-source.spec.js`.
- `MIVUE_BROWSER_PORT` selects a preview port. A denied local listener/network operation may require the environment's normal escalation; do not weaken tests to hide sandbox failures.
- Optional private firmware fixture: `MIVUE_FIRMWARE_DATABASE=/path/to/database.bin npm test`. Do not depend on a previous session's `/private/tmp` files being present. Record skips honestly.
- Do not use forced clicks or arbitrary timeout increases to hide browser races. Tabs remain disabled during worker file loading; a previous Linux Firefox failure was caused by controls shifting between mouse down/up.
- Automated WebKit/mobile emulation is not actual Safari/phone/GPS or MiVue device acceptance. Keep those manual gates open.
- For documentation-only changes, check local links and `git diff --check`; application suites need not be rerun unless code/config changed too.

## Private inputs and releases

- Never commit or host proprietary Mio BIN/firmware, extracted executables, raw research captures, private projects or generated comparison reports. Keep generated reports in ignored `exports/` and HTTP caches in ignored `.cache/`.
- Never expose credentials or run extracted firmware. Research is read-only static inspection unless the user explicitly requests otherwise.
- CANARD accepted data lives on `canard-data`; application source lives on `main`. Use the existing isolated-index, normal fast-forward publisher. Do not manually mix data files into source history or force-push branches.
- Commit/push only within user authorization, preserve unrelated work, and inspect staged files. Use the project's public author email when committing: `478549+szkocot@users.noreply.github.com`.
- After an authorized release, verify the actual Pages **deploy job**, then smoke-test the public site. Workflow success alone is insufficient if deployment was skipped. Documentation-only changes normally do not redeploy.
- Update TODO and deployment evidence with exact commit/run, test outcomes and remaining limitations. Do not label evidence-dependent or physical checks complete because synthetic tests passed.
