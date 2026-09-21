# Country boundary evidence

Natural Earth Admin 0 Countries 1:10 million, 5.1.1. Terms checked 2026-09-20: [public-domain reuse](https://www.naturalearthdata.com/about/terms-of-use/). These are generalized de facto boundaries, not authoritative survey/legal boundaries. Attribution and limitations are retained in `data/countries/NOTICE.json`. No proprietary Mio input is included.

The official [countries archive](https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip) identifies version 5.1.1 in its VERSION file and README. Archive SHA-256: `ce1ac7036499a0edd641fbc093cd209a98f96a49d2eca8480aaacad35138a7f6`. Only its listing, VERSION and README were inspected; no downloaded scripts ran.

Actual geometry input is upstream GeoJSON pinned to tag commit `9380cca83db5f9aef52d5e762765100745f84b27`; URL and hash are recorded in `config/countries-review.json`. Input SHA-256: `239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255`. The small official archive is separate version/reuse evidence, not a claim that the converter reads shapefiles or that archive coordinates were independently compared.

Conversion retains all coordinate values/rings, `NE_ID`, EN/PL names and verified-format unique ISO_A2 codes; all 23 sentinel/nonstandard codes are explicitly listed as null, including France/Norway's upstream sentinels and Taiwan's non-two-letter value. Countries remain selectable by dataset ID/name; no ISO mapping is guessed. No extra simplification or rounding is applied.

Normalized artifact: 258 features, 548,471 positions, 12,419,617 bytes; SHA-256 `7c06a47b9d0eebf1e568a0492924a910832f77bf566dac82037c609d73c9802c`. Generate into a fresh directory with `node scripts/countries/prepare.mjs INPUT OUTPUT`; only the reviewed exact input digest is accepted. Normal app builds never download boundaries.

Task 1 verification: seven new validation/conversion/build tests, full suite 213 pass/one private-sample skip, static build and diff checks pass. Tests cover altered bytes/notices/counts, unsafe fields, duplicate IDs/ISO, invalid rings/coordinates, resource caps, deterministic conversion and symlink rejection. Country selection/classifier/UI remain subsequent tasks; this is not a released feature.

Task 2: planar longitude-unwrapped polygon membership with holes and explicit polar closure; spherical shortest-segment distance for the 1,000 m review band (radius 6,371,008.8 m). Latitude buckets and expanded segment envelopes narrow searches without treating boxes as membership. Duplicate vertices use point distance. These calculations do not improve source boundary accuracy. Batch classification yields every 256 points and supports cancellation. Lazy same-origin loads enforce stream size/hash limits and evict failed requests for retry. Seven new tests pass, with full suite 220 pass/one private skip; real-data performance and public UI verification remain Task 6 work.

## Local performance verification (2026-09-21)

Read-only `node scripts/countries/benchmark.mjs --synthetic 100000` ran twice: 1,773/1,783 ms classification, 511/491 ms validation/indexing. Both runs counted 32,857 assigned, 535 border-review and 66,608 unassigned points. The deterministic global lattice includes oceans; unassigned is not a failure count.

The private 52,935-record sample took 2,024 ms classification and 487 ms validation/indexing: 50,973 assigned, 1,901 border-review, 61 unassigned, zero invalid. No sample coordinates or bytes are emitted by the benchmark. Early-abort and repeatability tests pass. Timings are local observations, not performance guarantees.

Real Chromium country preview after cancellation took 3,488 ms and rendered 100 rows. Unresolved points correctly blocked a scoped export. Full-sample reconstruction remained byte-identical (849 ms browser build); the sample is not published. Final review and public release verification remain pending.
