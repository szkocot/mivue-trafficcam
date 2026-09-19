# Browser Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centre the map on an explicitly requested browser position without recording a location history or modifying camera data.

**Architecture:** A small injectable controller wraps one-shot browser geolocation with request-token invalidation. A separate Leaflet marker/circle displays location; app-level buttons and translated statuses connect the controller to the existing map.

**Tech Stack:** Existing ES modules, browser Geolocation API, Leaflet, Node tests and Playwright; no dependency additions.

**Spec:** `docs/superpowers/specs/2026-09-20-source-ingestion-design.md`, Locate me section.

## Global Constraints

- Request a single position only after a click, using browser geolocation with high accuracy requested, maximumAge 0 and a 15-second acquisition timeout.
- Keep location in memory only: exclude it from project JSON, autosave, exports, URLs, analytics and logs.
- No application-level location upload or reverse-geocoding service is added.
- Browser location may come from GPS or other location providers; do not claim GPS-level accuracy.
- PL/EN controls, explicit privacy notice, accuracy circle, fix time, cancellation and clear action are required.
- Clear pending requests/markers on document replacement or page teardown; no location survives reload.
- Update README after every task. No country filtering, routing, continuous tracking or Pages deployment here.

## Review Focus

- A browser callback arriving after Clear must not restore the marker: Task 1.
- Browser permission prompts can outlast acquisition timeout; cancellation must stay usable: Task 1.
- Invalid mocked/device coordinates or accuracy must not crash Leaflet: Task 1.
- A late success after opening another project must not recenter it: Task 2.
- Viewed-area tile requests must not be misreported as no third-party location exposure: Task 2.

## Task 1: One-shot location controller

**Files:** Create `web/location.js`, `test/location.test.js`; update README.

**Interfaces:** `createLocation({geolocation,secureContext,onState,onPosition,onClear})` returns `{locate,cancel,clear,destroy}`. State callbacks receive `{code}` where code is idle/pending/located/denied/unavailable/timeout/unsupported/insecure. Position callbacks receive `{latitude,longitude,accuracy,timestamp}` only; ignore device speed/heading. Controller does not read storage, project state or DOM.

- [ ] Write tests using an injected fake geolocation object; assert no request at construction, one request while pending, API options, validated fix, all error codes, unsupported/insecure guards, clear/cancel/destroy invalidation, retry and invalid/nonfinite results.

```js
let success,calls=0;const fixes=[];
const controller=createLocation({secureContext:true,
 geolocation:{getCurrentPosition(ok,error,options){calls++;success=ok;assert.deepEqual(options,{enableHighAccuracy:true,maximumAge:0,timeout:15000});}},
 onState(){},onPosition:p=>fixes.push(p),onClear(){}});
assert.equal(calls,0);
controller.locate();controller.locate();assert.equal(calls,1);
controller.clear();
success({coords:{latitude:52,longitude:19,accuracy:15},timestamp:1});
assert.equal(fixes.length,0);
```

- [ ] Run `node --test test/location.test.js`; confirm RED.
- [ ] Implement a monotonically increasing token and pending flag. Validate finite coordinates in bounds, nonnegative finite accuracy and finite timestamp before callbacks. Cancel invalidates the token; clear additionally calls onClear. Destroy permanently disables new requests. Catch synchronous API errors as unavailable; map API error codes to state codes, never expose raw provider errors. Do not add watchPosition, timers recording location or automatic retries.

```js
// Every completion checks its captured token before using the result.
let token=0,pending=false,destroyed=false;
const invalidate=()=>{token++;pending=false;};
// locate checks pending/destroyed and captures ++token before requesting.
```

- [ ] Run location tests and `npm test`; document controller-only status in README; commit `feat: add opt-in one-shot location controller`.

## Task 2: Map controls, privacy and browser verification

**Files:** Modify `web/map.js`, `web/app.js`, `web/index.html`, `web/styles.css`, `web/locales/en.js`, `web/locales/pl.js`, `scripts/build-web.mjs`, README, `docs/browser-editor.md`, `docs/browser-verification.md`; create `test/browser/location.spec.js`.

**Interfaces:** Add `map.showLocation({latitude,longitude,accuracy,timestamp})` and `map.clearLocation()`. A single separate Leaflet layer group owns marker/accuracy circle; neither enters map camera records nor export paths. App creates controller with navigator.geolocation and window.isSecureContext and routes onPosition to map.showLocation. Existing document replacement flow calls controller.clear; teardown calls destroy.

- [ ] Write browser tests before controls exist. Use injected stubs for delayed callbacks/errors and browser-context mocked geolocation for integration. Assert no startup permission request, explicit locate success, accuracy/fix display, clear, cancel, retry, locale switching, project replacement and denied/unsupported/insecure states. Assert no changed project/revision/exports or storage writes caused by location.

```js
await context.grantPermissions(['geolocation']);
await context.setGeolocation({latitude:52.2297,longitude:21.0122,accuracy:20});
await page.getByRole('button',{name:'Locate me',exact:true}).click();
await expect(page.getByTestId('location-status')).toContainText('20');
await page.getByRole('button',{name:'Clear location',exact:true}).click();
await expect(page.getByTestId('location-status')).not.toContainText('20');
```

- [ ] Run `npm run test:browser -- test/browser/location.spec.js`; confirm RED.
- [ ] Implement accessible locate/cancel/clear buttons, aria-live status and visible pre-request privacy copy explaining browser providers and map-tile area exposure. On success center at zoom 14 or the current closer zoom, label accuracy and fix time, and draw a noninteractive marker/circle that cannot trigger coordinate picking. Keep previous successful fix on failed retry, explicitly labelled as previous; Clear removes it. Controls work without a BIN open. Add location module to build allowlist; use existing PL/EN key-parity test.

```js
// Location layers are separate from camera canvas state.
const positionLayer=L.layerGroup().addTo(map);
// showLocation clears previous positionLayer then creates one circle/marker;
// clearLocation calls positionLayer.clearLayers(), not map record mutation.
```

- [ ] Run `npm test`, `npm run build:web`, `npm run test:browser`, `git diff --check`. Verify page reload has no marker and no automatic geolocation call. Inspect 390px and desktop controls. Record mocked-provider testing, not physical GPS acceptance.
- [ ] Update README, editor guide and verification record; commit `feat: locate the map with explicit browser permission`. Follow the execution skill's final review/integration gate; no Pages publication.

## Execution handoff

Await user review before execution; preserve native execution. This plan is independent of source ingestion and can run first. Location work does not complete the remaining ingestion, country-filtering or deployment roadmap items.
