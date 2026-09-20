# CANARD public-array inventory — 2026-09-20

This is an observed schema, not an official API contract. No dataset has been republished. The approved four-category snapshot cannot yet pass its completeness gate: the PK value contains no usable records. See [reuse/access assessment](source-access.md) and [review configuration](../config/canard-review.json).

## Evidence

Read-only sources: [public map](https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen), [public client](https://www.canard.gitd.gov.pl/cms/o/pl.canard.cms.portlet.mapa/js/page.min.js) and [robots.txt](https://www.canard.gitd.gov.pl/robots.txt). No object-detail requests were made. Two local captures have filesystem times 2026-09-20 00:17:59 UTC and 10:22:00 UTC; these are capture times, not CANARD modification times. Raw captures remain outside the repository.

| Array | Encoding observed | Record count | Identity uniqueness | Measurement field |
| --- | --- | ---: | --- | --- |
| `fotoradaryPP` | LZString base64 | 499 | All IDs unique within layer | `PP` |
| `fotoradaryOPP` | LZString base64 | 138 | All IDs unique within layer | `PO` |
| `fotoradaryRL` | LZString base64 | 169 | All IDs unique within layer | `PC` |
| `punktyKontrolne` | Literal string `[{}]` | Unknown, not zero | No IDs supplied | None |

Both captures contain identical per-category ID sets in the three populated layers; digests are recorded in configuration. This supports short-term identity continuity, not a promise that IDs never change. Future identity-overlap gates remain necessary. Counts refer to records, not deduplicated physical locations or distinct road sections.

## Field meanings and limits

All populated-layer objects have exactly seven observed fields:

- `id`: numeric upstream identifier; qualify with the category, not a row index.
- `lon`, `lat`: numeric point longitude/latitude in the client's longitude-first map transform.
- `rodzajPomiaru`: original measurement category; all observed values match the table.
- `nrSeryjny`: string serial identifier, not a verified place name.
- `lok2PktDlugosc`, `lok2PktSzerokosc`: numeric second endpoint for OPP; null in PP/RL.

Observed example geometry: a PP point near longitude 21.3418, latitude 53.3878667; an OPP endpoint pair near (18.2892056, 52.1496833) and (18.4479917, 52.1512417). Coordinate-range checks found no invalid primary points; no OPP record had identical endpoints. These examples establish coordinate order, not surveyed precision or road geometry. Reviewed types/requiredness are in configuration; new fields require review.

No speed limit, operational status, direction, place name or live-video feed is supplied by these arrays. All remain unknown; visibility does not imply active operation. Richer detail endpoints remain separately gated, not silently scraped.

## Control-point blocker

The public client calls `LZString.decompressFromBase64` on every category, including PK. With the observed literal `[{}]`, the pinned decoder returns an empty string; the client's feature reader only parses nonempty decoded input. This explains an absent layer but does not establish an authoritative empty dataset. Interpreting the literal as JSON instead gives one object with no ID or coordinates—also unusable.

Do not invent an ID, copy a synthetic control point, or label this as verified zero records. Production configuration leaves PK descriptors/count null and `publicationApproved:false`. Continuing to publication requires either usable PK evidence or user approval of a revised design that explicitly publishes the three available categories and labels PK unavailable. No contact with GITD has been made.

## Decoder and retrieval

Pinned dependency: [lz-string 1.5.0](https://github.com/pieroxy/lz-string/tree/1.5.0), MIT, copyright pieroxy. Exact package integrity is locked in `package-lock.json`. Its upstream `_decompress` has no incremental output-size limit. Research decoded known local inputs in a memory-limited process; unattended decoding must first gain the bounded wrapper required by Task 2. Installing the dependency does not satisfy that gate.

The tested Node retrieval boundary uses identified public GETs with no credentials, strict same-resource HTTPS redirects, 20 MiB response bounds, 30-second request timeouts, a 120-second total budget, at most two transient retries and Retry-After handling. It extracts/hash-checks no dataset itself: its private result feeds a future, separately gated adapter/publisher. No response HTML is shipped by the website build.
