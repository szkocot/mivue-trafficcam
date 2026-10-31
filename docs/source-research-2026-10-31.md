# Source research, 2026-10-31

This bounded recheck supports a **local OSM camera-node JSON adapter**. It does not authorize a new hosted scraper, change binary encodings, or establish device acceptance. The CANARD publication history in [source-access.md](source-access.md) remains unchanged.

## OpenStreetMap: supported local input

[OSM's copyright page](https://www.openstreetmap.org/copyright) identifies ODbL licensing. [OSMF attribution guidance](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) describes attribution and the copyright link. Data access and reuse are separate: the [editing API policy](https://operations.osmfoundation.org/policies/api/) directs heavy/read-only users to other providers, while Overpass services have their own policies. This adapter makes no network request to either API and publishes no hosted dataset. Anyone redistributing a derived database must assess the ODbL obligations for that output; the code licence does not replace data licensing.

The [OSM JSON description](https://wiki.openstreetmap.org/wiki/OSM_JSON) documents the `elements` envelope, typed IDs, coordinates and tags. The [camera tag documentation](https://wiki.openstreetmap.org/wiki/Tag:highway%3Dspeed_camera) supports node geometry, `maxspeed` and camera-facing `direction`; the [enforcement relation](https://wiki.openstreetmap.org/wiki/Relation:enforcement) instead uses member roles. A relation's members do not establish a road route. The adapter deliberately rejects enforcement relations and camera ways with a translated error rather than importing guessed geometry or silently dropping those records.

Supported elements are nodes with `highway=speed_camera`, `proposed:highway=speed_camera`, or `disused:highway=speed_camera`. IDs are `node/<positive-safe-integer>` in namespace `openstreetmap`; way/relation namespaces cannot collide with them. Coordinates must be present and within WGS84 bounds. Planned/disused lifecycle tags normalize to planned/inactive; ordinary camera tagging leaves operational status unknown. Deleted elements are rejected. Unrelated nodes/ways/relations are ignored, but malformed elements, unsupported enforcement geometry and a result with no cameras reject the entire batch.

Only numeric `maxspeed` in implicit km/h, explicit `km/h`, or `mph` normalizes to speed; original units survive. Only numeric bearings in [0,360) normalize to direction. Conditional limits, symbolic values, cardinal names and forward/backward remain original evidence with unknown normalized values. `name` is copied; place/address tags remain original metadata. All original element properties/tags survive unchanged. The local import timestamp is recorded as retrieval time; it is **not** a claim that the file was freshly downloaded. Element timestamps, where present, remain original evidence. File-level headers are not retained.

The existing worker, atomic reconciliation, manual-coordinate/deletion protections and project persistence are reused. A node refresh replaces its current nullable source metadata rather than carrying old limits/bearings forward when tags disappear or become symbolic. Omitted identities are retained, not treated as deletions. Source strings remain safely rendered as text. The existing 20 MiB, 100,000-element, metadata depth and 64 KiB-per-observation limits apply. A local file is user supplied, not authenticated by OSM.

Attribution, ODbL name, copyright/licence links and transformation notice accompany reference exports and any manually associated BIN contribution through the existing notice downloads. Ordinary unknown/planned/inactive observations do not automatically generate BIN records. Speed and facing direction remain source metadata; no binary field meaning is inferred.

## CANARD: bounded enrichment recheck

The current [public map](https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen) still lists point, section, red-light and control-point layers and describes its display as illustrative. Its search instructions refer to a serial number or control-point code from correspondence. That does not provide a public control-point coordinate dataset. The visible page continues to publish the general reuse notice. These observations do not establish completeness, operational status, speed/direction fields or stable detail-response schemas.

The research browser could not open the client/robots URLs or follow a session-bearing report-description action. A subsequent bounded direct HTTP recheck succeeded and supersedes that tool limitation. Public GETs used the project-identifying user agent, 30-second timeouts and 20 MiB body limits, without cookies or authentication. At 2026-10-31 21:55 UTC:

| Resource | HTTP / bytes | SHA-256 |
| --- | --- | --- |
| [Map HTML](https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen) | 200 / 203,521 | `ed02b5c32287640a5ea65a291ab73d8ee2217680ddbc461ab2b7a389fa709530` |
| [Public client](https://www.canard.gitd.gov.pl/cms/o/pl.canard.cms.portlet.mapa/js/page.min.js) | 200 / 23,824 | `91bd8b24b8a84f34a7cb11a828d00e3c2c45b60fcaeecee5c230f1b5a8f4fd77` |
| [robots.txt](https://www.canard.gitd.gov.pl/robots.txt) | 200 / 23 | `1a64ba72fb329dda8e1b4cada84d07776d28b86e3a4fc4df7e4d6688195b77bf` |

Robots remains `User-Agent: *` with empty `Disallow:`; this is not a licence or bulk-service agreement. The existing bounded decoder and reviewed normalizer accepted the current arrays: **PP 506, OPP 136, RL 169; total 811; PK unavailable**. The seven fields remain `id`, `lon`, `lat`, `rodzajPomiaru`, `nrSeryjny`, `lok2PktDlugosc`, `lok2PktSzerokosc`. PK is still the exact literal `[{}]`, normalized to null under the existing approved policy. These newly observed counts are research evidence, not a publication or replacement of the released snapshot.

The client still POSTs the namespaced `id` to the public Liferay resource `/objdata`, with namespaced `type=PP|OPP|RL|PK`, and decompresses the response using LZString UTF16. One read-only object-detail POST was made for PP `91352187`, taken from the current map; no bulk scan, PK guessing, search-by-correspondence-code, session extraction or report-action request was made. It returned HTTP 200 / 6,018 bytes, response SHA-256 `53c69ab3c621a4647eae4f1a4b61894eb3b7065cf34a929bf8fc874debb9886a`. The existing installed decoder yielded JSON whose top-level and nested device IDs matched the requested ID. This proves one current lookup, not stable identity over time or complete schemas across categories.

That sample provides concrete enrichment evidence:

- `limity[0]` contains string limits `limitOsobowe="50"`, `limitCiezarowe="50"`, and `typ` with empty `kierunek`/`godziny` plus `kierunekPikietazu="ROSNACY"`. No explicit speed-unit field was observed. Vehicle class, time windows and chainage direction must not collapse into one unqualified limit.
- `urzadzenie` includes municipality/street/road and place-description fields (`lokalizacjaAdresMiejscowosc`, `lokalizacjaAdresUlica`, `lokalizacjaNrDrogi`, `lokalizacjaMiejsce`) and coordinate components.
- `masztKierunekPomiaru="Pikietaz rosnacy"` describes road-chainage direction, not a compass bearing. Device/mast `stanTechniczny="Sprawne"` describes technical condition, not a verified active enforcement status.
- Additional certificate and collision-statistics arrays are present; they were inspected for schema only and were not copied into repository fixtures or published.

The client groups limits by chainage enum; its use confirms why that enum must not become a guessed numeric bearing. Raw fetched bodies remain temporary local research inputs. The [GITD reuse information page](https://www.gov.pl/web/gitd/ponowne-wykorzystanie-informacji-sektora-publicznego) remains available. The exact remaining enrichment blockers are a permitted unattended retrieval-volume arrangement, response-specific notice review, samples across OPP/RL/PK and conditional-limit variants, documented units/direction/status meanings, and identity evidence across updates. Current detail access works, but those production contracts are not established by one successful response. No hosted enrichment connector was enabled. PK coordinates still require actual source evidence.

## Other sites

No particular additional provider or dataset was supplied. No unrelated website was scraped, no third-party permission was presumed, and no generic HTML adapter was introduced. Another adapter needs a named source, reusable machine-readable sample, access/terms assessment, attribution requirements and typed stable identities before implementation. CSV/GeoJSON remain the local interchange path for lawful user-provided data.

## Import/export preservation check

CSV, GeoJSON and selected OSM observations are tested through reconciliation, project serialization/reload and reference GeoJSON export. Tests compare every selected identity, geometry, original property, unit, normalized value, attribution and timestamp, verify deterministic repeated output/import, and confirm baseline BIN records stay unchanged. This is a semantic round trip of supported observations, not reconstruction of the source file's whitespace, quoting, envelope or unrelated OSM elements. Project JSON is the authoritative reopenable format; reference GeoJSON carries selected observations and source notices.
