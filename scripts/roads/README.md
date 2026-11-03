# Offline road context extraction

This preparer parses a user-provided national OSM PBF locally. It does not query Overpass, upload files, download data, or add a product dependency. Keep source PBFs and generated context under ignored `.cache/roads/`; they are not public browser assets.

Use a temporary Python 3.13 environment with pinned `osmium==4.3.2` (BSD-2-Clause). For example, after obtaining the pinned PBF and verifying its provider checksum:

```sh
python3.13 -m venv /private/tmp/mivue-road-tools
/private/tmp/mivue-road-tools/bin/python -m pip install osmium==4.3.2
/private/tmp/mivue-road-tools/bin/python scripts/roads/test-extract-context.py
/private/tmp/mivue-road-tools/bin/python scripts/roads/extract-context.py \
  --pbf .cache/roads/poland-261101.osm.pbf \
  --canard-dir .cache/canard-enriched-candidate \
  --output .cache/roads/context-261101.json \
  --source-url https://download.geofabrik.de/europe/poland-261101.osm.pbf \
  --data-timestamp 2026-11-01T21:21:36Z
```

The CANARD directory must contain the existing `data/canard/manifest.json` and named snapshot. The script verifies active schema, exact snapshot path, SHA-256, byte length, canonical category-qualified identities, duplicate identities, per-category counts and total before deriving road references. Enriched device `lokalizacjaNrDrogi` supplies exact references; a plain accepted snapshot without details still selects the national major-road classes. `DK94` and `DW902` canonicalize to `94` and `902`; `A`/`S` prefixes and suffix letters remain distinct. Semicolon-separated references are supported.

Road selection includes every motorway, trunk, primary, secondary, tertiary and corresponding `_link` way, plus any other highway with a matching CANARD road reference. Foot/cycle/path-only classes and unconditional `access`, `vehicle`, `motor_vehicle` or `motorcar` values `no`/`private` are excluded. Destination-restricted roads remain tagged for the resolver to assess. This is a **full national filtered graph**, not the complete drivable OSM network; minor unreferenced roads and turn/access restriction relations are not included. `source.complete=true` means that this filter was applied to the complete supplied file without a spatial clip or skipped selected geometry. It does not assert OSM completeness, routing legality or coverage of every camera.

Output shape:

```text
{schemaVersion:1,
 source:{url,dataTimestamp,sha256,attribution,licenceUrl,complete:true},
 ways:[{id:"way/…",nodeIds:[…],coordinates:[[longitude,latitude],…],tags:{…}}],
 places:[{id:"node/…",coordinates:[longitude,latitude],tags:{…}}]}
```

Ordered node identities and all coordinates preserve topology and way direction. Way tags retain highway/ref/int_ref, source names, one-way/junction/access fields, layer/bridge/tunnel and every `destination*` tag. City/town/village/hamlet nodes retain names, Polish/alternate/official/local names and Wikidata; namesakes remain distinct IDs. `dataTimestamp` is the supplied timestamp, otherwise the PBF replication header value or null; it is not an invented retrieval date. SHA-256 is computed once over the entire input, and size/mtime must remain unchanged during processing.

Pyosmium `SimpleHandler.apply_file(..., locations=True, idx="sparse_file_array,/absolute/owned/path")` uses a disk-backed node-location index. Selected ways and places are serialized incrementally to private temporary spools; no national way list is held in Python memory. Caps are 512 MiB combined output, 2,000,000 ways and 300,000 places. Missing locations, invalid coordinates, short selected ways, limits or parse errors abort the run; they never silently truncate geometry. Temporary indexes/spools are removed on normal success/failure. A forced process kill can leave only the uniquely named `.road-extract-*` working directory, which can be removed after confirming that no extractor is using it.

The requested output must not already exist. The finished temporary file is flushed/fsynced, then atomically published with an exclusive hard link on the same filesystem. This deliberately avoids `rename()` overwriting a concurrently created user file. The temporary link is then removed during cleanup. A JSON report on stdout records counts, output size, PBF/CANARD hashes and selected source road references. Failures return a nonzero exit and leave the destination absent or its previous contents untouched.

Data attribution is `© OpenStreetMap contributors`; retain the [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) notice and [OSM copyright information](https://www.openstreetmap.org/copyright) with derived data. [Geofabrik](https://download.geofabrik.de/europe/poland.html) provides public bulk extracts. Tool/API references: [pyosmium stream geometries](https://docs.osmcode.org/pyosmium/latest/user_manual/03-Working-with-Geometries/), [SimpleHandler](https://docs.osmcode.org/pyosmium/latest/reference/Handler-Processing/), [disk index creation](https://docs.osmcode.org/pyosmium/latest/reference/Indexes/).

Road context is evidence for a separate resolver. Named destinations need topology and directional tags; a straight bearing to a city, a snapped road or a nearest camera alone does not prove measured travel direction, physical camera aim, cross-source identity or a missing measurement.

## Resolve and publish compact evidence

```sh
node --max-old-space-size=8192 scripts/roads/resolve.mjs \
  .cache/canard-enriched-candidate .cache/roads/context-261101.json \
  .cache/roads/resolved-261101
```

The fresh output directory contains only `data/roads/directions.json`, `manifest.json` and `NOTICE.json`. The manifest pins all 811 identity-qualified resolutions by SHA-256/size/count; read/write validation checks semantic evidence as well as hashes. The compact dataset is capped at 20 MiB. Review its resolved/ambiguous/unresolved counts and compare it with Mio before copying `data/roads/` into the source checkout. Keep the national graph/PBF private and ignored. The CANARD CLI automatically reads the reviewed source lookup and attaches it after detail enrichment. Missing or stale identities receive explicit unknown evidence; the live source does not silently reuse changed directions.

The resolver compresses degree-two routing vertices while retaining all local polyline geometry. It supports up to 5,000,000 geometry points, 500,000 routing vertices and 300,000 place nodes. Exact road references, one-way connectivity and local tangents are required. Explicit direction-tag evidence is high confidence; graph-route and the documented unique-city policy are medium confidence. Turn/access restriction relations are omitted, and the result is an import-review estimate, not a navigation route or physical camera azimuth.
