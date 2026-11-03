# Vehicle direction and camera aim

The editor distinguishes vehicle alert direction from the physical aiming direction of a camera. CANARD's similarly named fields are not interchangeable.

## Evidence and presentation

- `limity[].typ.kierunek`: passenger-limit direction text. Exact approach (`najazd`) / departure (`odjazd`) wording can establish a source claim about traffic relative to the camera. Named places remain named destinations, not compass angles. Truck-only rows do not determine passenger-car capture mode.
- `limity[].typ.kierunekPikietazu`: limit applicability relative to road chainage. It is not a camera azimuth.
- `urzadzenie.nazwaKierunku1/2`: named section directions, retained as source text.
- `urzadzenie.masztKierunekPomiaru`: a separate mast-direction claim. It is displayed independently, including when it differs from the limit row. Different fields do not by themselves prove an upstream error or establish physical aim.
- Qualified Mio BIN record: in the inspected firmware branch, mode byte 19 = 1 consumes heading byte 17 as `2 × value`, compared with GPS heading. The UI labels this **Vehicle alert heading (Mio)**, with the record ID. Only researched types and byte values 0–179 are interpreted; deleted/unknown-type/other-mode records stay unclassified. This is firmware-scoped alert logic, not a surveyed road tangent or optical camera azimuth.

A selected BIN point gets an alert-heading arrow when its heading format is qualified. The legend explicitly distinguishes that arrow from physical camera aim. Merge candidates and selected details display the evidence separately; raw bytes are untouched.

If an exact passenger capture label establishes approach or departure and a qualified alert heading is available, the editor can calculate an explicitly **derived road-axis aiming estimate**: opposite travel for approach, same travel for departure. A roadside camera may be mounted at an angle to the road, so this estimate is never labelled as its physical optical azimuth. Both-direction, mixed or unspecified capture modes cannot establish a single aiming axis.

The existing generic source `direction` number is not silently reclassified as either travel or physical aim. Actual physical camera azimuth remains unknown until a source with that explicit meaning or a verified measurement is supplied. These display calculations never rewrite BIN direction bytes or change merge identity decisions.

## Actual CANARD/Mio check — 2026-11-02

All 811 cached detail responses were analyzed. None supplies an unambiguous passenger approach/departure label or physical camera azimuth. There are 256 point-camera records whose limit-row chainage differs from the mast field; those values remain separate rather than being joined into one direction.

For PP `91359960`, the car-limit row says `MALEJACY`; the mast says `Pikietaz rosnacy`; the associated Mio record `source:1357896` stores heading byte 50 / mode 1, giving a **100° alert heading** in the traced reader. The data does not establish the physical camera azimuth, so it remains unknown and no road-axis aiming estimate is fabricated.

OPP `91414277` names two opposite car-limit destinations but marks both rows `ROSNACY`; its truck-only row says `najazd i odjazd`. That truck row is not used to infer passenger capture mode or a physical bearing.

The unchanged official BIN rebuild retains SHA-256 `69759a67d9442bfa1a636c38ccbc16623a2208ef34564e11f68ad0d696becdb1`. Private machine-readable verification is `exports/direction-verification-2026-11-02/summary.json`.

The official [CANARD safety analysis report](https://www.canard.gitd.gov.pl/cms/documents/20123/159327/Raport%2BAnaliza%2Bstanu%2Bbezpiecze%C5%84stwa.pdf/039d9da1-7f44-655a-3b5b-8454408f3852?t=1651141683593), printed pages 51/54, distinguishes approach/departure from increasing/decreasing chainage. It does not define a physical-azimuth contract for these API fields. The bounded read-only download was 3,437,970 bytes, SHA-256 `1b78f7678d7fe259b2fbbe3405810235b9401d4a3774a6ac629cebeaa5ffe995`.

## Named destinations and road-aware imports

CANARD direction text now has an independent road-resolution layer. The offline preparer uses a checksum-pinned national OpenStreetMap extract from Geofabrik, retains exact road references and directed connectivity, and derives the local travel bearing on that road. It does not point a straight line at the city centre. Explicit directional destination tags are preferred; otherwise a unique named place and a directed road route supply a medium-confidence estimate. Finite Polish destination aliases handle forms such as `w kierunku Warszawy`. On an A/S motorway or expressway, one unique OSM city may be preferred over homonymous villages/hamlets; that explicit place-selection policy is recorded as medium-confidence evidence. Multiple cities and other road-class namesakes remain ambiguous, as do competing carriageways. Disconnected sections and missing roads remain unresolved.

For OPP sections both source endpoints must match connected roads. Destination tags at the section exit are usable; a route that turns around beyond an endpoint cannot establish the section direction. Paths are bounded by the positive numeric CANARD section-length fields interpreted as metres (20% plus 200 m tolerance), or a conservative endpoint-span bound when no plausible reported length exists. Evidence retains the route length and applied bound; strongly curved sections lacking range evidence may remain unresolved. Evidence records entry/exit orientation and a local bearing at each endpoint, including curved sections. `Brak pomiaru w kierunku …` is an excluded direction; it never implies that the opposite direction is monitored. Passenger-car speed reduction remains the minimum across supplied times/directions, independent of this direction resolution.

The source snapshot retains the original CANARD fields and a separate `canardRoadDirection` annotation with input fingerprint, provenance, confidence and evidence. Changed geometry, road reference or eligible direction labels invalidate a prepared estimate. Daily updates retain explicit missing/stale status until the offline lookup is refreshed. Road evidence carries OpenStreetMap attribution and ODbL terms through project/reference/data exports.

Merge review keeps every geometric candidate. Qualified Mio headings agreeing within 60° can be recommended only when there is one uncontested eligible association. Opposite headings, excluded directions, unknown Mio headings with resolved road evidence, and unresolved/ambiguous road annotations require explicit selection. Existing associations remain intact. OPP comparison uses the actual 964 entry endpoint and its local travel bearing. These are review suggestions, not automatic identity proof or a rewrite of raw BIN bytes.

Selected CANARD references show dashed purple estimated travel arrows. Mio's existing solid alert-heading arrow retains its separate meaning. Estimates and physical camera aim remain distinct; no physical optical azimuth is inferred.

Offline extraction and compact lookup preparation are documented in [the road preparer](../scripts/roads/README.md). National PBFs, full graphs and private Mio comparisons remain ignored local files. Only the compact prepared lookup is versioned; browsers receive per-observation evidence in the normal CANARD snapshot.

The road lookup enriches review metadata; it does not convert an unknown BIN mode into a known heading or encode a new OPP. CANARD point records without a usable named destination remain direction-unknown. Street labels, origins (`od strony …`), generic `Centrum` and ambiguous settlement names are retained verbatim rather than assigned guessed bearings. Such observations and every geometric candidate remain manually associable.

## Prepared lookup and Mio audit — 2026-11-03

The pinned Geofabrik Poland extract `poland-261101.osm.pbf` contains data through 2026-11-01 21:21:36 UTC. Its provider MD5 is `af15d3bfe7081e0be6b0678c786f5770`; independently computed SHA-256 is `ee8528448aa0581a8fc275b909a9a6acc5de6fe7c2528c152a43098a4d13834a`. The national filtered context contains 469,280 ways and 105,433 places (220,521,324 bytes). The compact reviewed lookup has 811 identities, 838,375 bytes, SHA-256 `631ee7bf32b5ebf9eed11649144951186b48f20e035bf2fb466b52505634408c`.

59 observations have fully resolved direction evidence, 57 remain ambiguous and 695 unresolved. Only 136 observations supply eligible named directions; absence of such a claim is not evidence of all-direction measurement. The enriched CANARD snapshot retains all 811 observations and original source retrieval timestamps: SHA-256 `d242d0795403d9779f68f9d9960cfd122f37187f112401e0daa7922b957ba3aa` (5,407,815 bytes).

Against the unchanged official Mio file, 78 geometric section candidates agree with resolved travel evidence and 25 oppose it; 1,685 candidates lack sufficient independent direction evidence. There are 26 unique uncontested recommendations, 762 manually reviewable observations and 23 without geometric candidates. These are candidate comparisons, not declarations of incorrect import or cross-source identity. Mio-only and CANARD-only coverage remains legitimate.

For A2 OPP `112732201`, Terespol resolves from the first source endpoint to the second, and Warszawa resolves in reverse. Connected paths are approximately 17,292 m and 17,301 m, consistent with the separately retained 17,374/17,384 m CANARD lengths. This actual case caught and now guards against treating an exit destination tag as an entry followed by a motorway turnaround. OPP `113414005` retains the Warszawa travel estimate and a separate excluded Katowice direction.

Private reproducible audit/merge artifacts are under `exports/canard-road-directions-final-2026-11-03/`; proprietary Mio input and projects are not published. The hosted-import audit preserves all observation fields, repeated import, project/reference round trips, OSM/CANARD notices and the byte-identical original BIN. A private explicit batch association of the 26 recommendations covers 52 existing Mio endpoints; saving/reopening and rebuilding still preserves the original bytes.

Release verification: 393 Node tests pass, with two optional firmware-fixture skips; three Python extractor checks pass. Browser coverage exercises 243 cases across Chromium, Firefox and WebKit; the final full run had 241 passes and two Chromium timeouts, and a serial recheck of both affected files passed all 20 tests. The three opt-in live official-Mio checks also pass with the unchanged source hash. A production-sized local smoke imports all 811 actual observations, displays the resolved/excluded directions for OPP `113414005` in PL/EN, reloads the saved project, retains zero BIN edits and records no page errors. Physical device/Safari/GPS acceptance remains untested.

Released application commit: [`b6db700`](https://github.com/szkocot/mivue-trafficcam/commit/b6db7006d1ee0baea0a334e80738b9ec01528e66). Accepted CANARD data commit: `c7ce5c69000b8cdbdb63f55da90d06f50a7ba8d1`. [Pages run 41562350315](https://github.com/szkocot/mivue-trafficcam/actions/runs/41562350315) completed successfully, including the actual **deploy** job. CI passed 391 Node tests (four private-fixture skips) and 237 browser tests (nine private-fixture/live skips), with no failures.

The public site serves the expected `d242d079…` snapshot. A fresh Chromium smoke using a generated synthetic BIN and the real public 811-observation CANARD snapshot passed PL/EN direction/exclusion labels, the estimated 111.2569° arrow for OPP `113414005`, saved-project reload, zero BIN edits and zero page errors. Automatic approval review rejected placing the proprietary Mio BIN into the public-site browser context; that sensitive upload was not performed. Real-Mio import/merge/byte-preservation checks were completed locally; public verification used only generated test input.

CANARD's original retrieval/check time remains 2026-11-01T18:05:12.571Z. The preceding scheduled update (run `41436658027`) stopped on `CANARD_DETAIL_FETCH_FAILED` and left the accepted data intact. This release enriches that accepted source capture; it does not claim a successful new upstream detail fetch. Future missing/stale lookup identities remain explicitly unknown until refreshed.
