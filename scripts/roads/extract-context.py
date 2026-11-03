#!/usr/bin/env python3
"""Extract a national, filtered OSM road graph with bounded memory and output."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import tempfile

MAX_BYTES = 512 * 1024 * 1024
MAX_WAYS = 2_000_000
MAX_PLACES = 300_000
MAJOR = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary'}
MAJOR |= {kind + '_link' for kind in tuple(MAJOR)}
NON_MOTOR = {'footway', 'cycleway', 'pedestrian', 'steps', 'bridleway', 'corridor', 'path'}
ROAD_TAGS = {'highway', 'ref', 'int_ref', 'name', 'name:pl', 'alt_name', 'official_name', 'loc_name', 'oneway', 'oneway:motor_vehicle', 'junction', 'access', 'vehicle', 'motor_vehicle', 'motorcar', 'bridge', 'tunnel', 'layer'}
PLACE_TAGS = {'place', 'name', 'name:pl', 'alt_name', 'official_name', 'loc_name', 'wikidata'}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')


def canonical_refs(value):
    if not isinstance(value, str):
        return set()
    result = set()
    for part in value.split(';'):
        ref = re.sub(r'\s+', '', part.upper())
        ref = re.sub(r'^(?:DK|DW)-?', '', ref)
        if re.fullmatch(r'[AS]?\d+[A-Z]?', ref):
            result.add(ref)
    return result


def road_selected(tags, refs):
    highway = tags.get('highway')
    if not highway or highway in NON_MOTOR:
        return False
    if any(tags.get(key) in {'no', 'private'} for key in ['access', 'vehicle', 'motor_vehicle', 'motorcar']):
        return False
    return highway in MAJOR or bool(canonical_refs(tags.get('ref')) & refs)


def load_canard(directory):
    root = Path(directory).resolve()
    manifest_path = root / 'data/canard/manifest.json'
    require(not manifest_path.is_symlink() and manifest_path.stat().st_size <= 65536, 'Invalid CANARD manifest file')
    manifest = json.loads(manifest_path.read_bytes())
    digest = manifest.get('sha256', '')
    require(type(manifest.get('schemaVersion')) is int and manifest.get('schemaVersion') == 1 and manifest.get('state') == 'active' and re.fullmatch('[a-f0-9]{64}', digest), 'Invalid CANARD manifest')
    require(manifest.get('path') == f'data/canard/snapshot-{digest}.json', 'Invalid CANARD snapshot path')
    path = root / manifest['path']
    require(not path.is_symlink() and path.stat().st_size <= 20 * 1024 * 1024, 'Invalid CANARD snapshot file')
    require(type(manifest.get('byteLength')) is int and type(manifest.get('total')) is int, 'Invalid CANARD manifest lengths')
    expected_counts = manifest.get('counts', {})
    require(isinstance(expected_counts, dict) and set(expected_counts) == {'PP', 'OPP', 'RL', 'PK'} and expected_counts['PK'] is None and all(type(expected_counts[key]) is int and 0 <= expected_counts[key] <= 100000 for key in ['PP', 'OPP', 'RL']), 'Invalid CANARD manifest counts')
    body = path.read_bytes()
    require(len(body) == manifest.get('byteLength') and hashlib.sha256(body).hexdigest() == digest, 'CANARD snapshot hash/size mismatch')
    snapshot = json.loads(body)
    batch = snapshot.get('batch', {})
    observations = batch.get('observations')
    require(type(snapshot.get('schemaVersion')) is int and snapshot.get('schemaVersion') == 1 and batch.get('source', {}).get('namespace') == 'pl.gitd.canard.public-map' and isinstance(observations, list) and len(observations) <= 100000, 'Invalid CANARD batch')
    counts = {'PP': 0, 'OPP': 0, 'RL': 0, 'PK': None}
    refs, ids = set(), set()
    for observation in observations:
        source_id = observation.get('sourceId')
        parts = json.loads(source_id)
        require(isinstance(parts, list) and len(parts) == 2 and parts[0] in {'PP', 'OPP', 'RL'} and isinstance(parts[1], str) and source_id not in ids and json.dumps(parts, separators=(',', ':')) == source_id, 'Invalid CANARD identity')
        ids.add(source_id)
        properties = observation.get('originalProperties', {})
        require(properties.get('sourceCategory') == parts[0], 'CANARD category mismatch')
        counts[parts[0]] += 1
        device = properties.get('canardDetail', {}).get('raw', {}).get('urzadzenie', {})
        refs |= canonical_refs(device.get('lokalizacjaNrDrogi'))
    require(manifest.get('counts') == counts and manifest.get('total') == len(observations), 'CANARD category/total count mismatch')
    return refs, digest


def file_hash(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def coordinates(location):
    require(location.valid(), 'Missing selected OSM node location')
    xy = [location.lon, location.lat]
    require(all(math.isfinite(x) for x in xy) and abs(xy[0]) <= 180 and abs(xy[1]) <= 90, 'Invalid OSM coordinates')
    return xy


def extract(args):
    import osmium
    refs, canard_hash = load_canard(args.canard_dir)
    pbf, output = Path(args.pbf).resolve(), Path(args.output).absolute()
    require(not output.exists() and not output.is_symlink(), 'Output must be a fresh file')
    require('sparse_file_array' in osmium.index.map_types(), 'Installed pyosmium lacks disk-backed sparse_file_array')
    source_stat = pbf.stat()
    digest = file_hash(pbf)
    timestamp = args.data_timestamp
    if timestamp is None:
        with osmium.io.Reader(str(pbf)) as reader:
            timestamp = reader.header().get('osmosis_replication_timestamp') or None
    source = {'url': args.source_url, 'dataTimestamp': timestamp, 'sha256': digest, 'attribution': '© OpenStreetMap contributors', 'licenceUrl': 'https://opendatacommons.org/licenses/odbl/1-0/', 'complete': True, 'coverage': 'National major-road and CANARD road-reference filter; minor unreferenced roads and turn/access restriction relations are omitted.'}
    prefix = b'{"schemaVersion":1,"source":' + compact(source) + b',"ways":['
    output.parent.mkdir(parents=True, exist_ok=True)
    counts = {'ways': 0, 'places': 0}
    with tempfile.TemporaryDirectory(prefix='.road-extract-', dir=output.parent) as directory:
        temporary = Path(directory)
        with (temporary / 'ways.ndjson').open('xb') as ways, (temporary / 'places.ndjson').open('xb') as places:
            written = len(prefix) + 32

            class Handler(osmium.SimpleHandler):
                def emit(self, kind, value):
                    nonlocal written
                    counts[kind] += 1
                    require(counts[kind] <= (MAX_WAYS if kind == 'ways' else MAX_PLACES), f'{kind} count limit exceeded')
                    body = compact(value) + b'\n'
                    written += len(body)
                    require(written <= MAX_BYTES, 'Road context exceeds 512 MiB')
                    (ways if kind == 'ways' else places).write(body)

                def node(self, node):
                    if node.tags.get('place') not in {'city', 'town', 'village', 'hamlet'}:
                        return
                    require(0 < node.id <= 2**53 - 1, 'Unsafe OSM place identity')
                    self.emit('places', {'id': f'node/{node.id}', 'coordinates': coordinates(node.location), 'tags': {tag.k: tag.v for tag in node.tags if tag.k in PLACE_TAGS}})

                def way(self, way):
                    if not road_selected(way.tags, refs):
                        return
                    require(0 < way.id <= 2**53 - 1 and len(way.nodes) >= 2, f'Invalid selected OSM way {way.id}')
                    node_ids, geometry = [], []
                    for node in way.nodes:
                        require(0 < node.ref <= 2**53 - 1, f'Unsafe node identity in way {way.id}')
                        node_ids.append(node.ref)
                        try:
                            geometry.append(coordinates(node.location))
                        except Exception as error:
                            raise ValueError(f'Incomplete selected OSM way {way.id}, node {node.ref}') from error
                    self.emit('ways', {'id': f'way/{way.id}', 'nodeIds': node_ids, 'coordinates': geometry, 'tags': {tag.k: tag.v for tag in way.tags if tag.k in ROAD_TAGS or tag.k.startswith('destination')}})

            handler = Handler()
            handler.apply_file(str(pbf), locations=True, idx=f'sparse_file_array,{temporary / "nodes.index"}')
            del handler
        final_stat = pbf.stat()
        require((source_stat.st_size, source_stat.st_mtime_ns) == (final_stat.st_size, final_stat.st_mtime_ns), 'PBF changed during extraction')
        staged = temporary / 'context.json'
        with staged.open('xb') as stream:
            stream.write(prefix)
            for index, kind in enumerate(['ways', 'places']):
                if index:
                    stream.write(b'],"places":[')
                with (temporary / f'{kind}.ndjson').open('rb') as spool:
                    for number, line in enumerate(spool):
                        if number:
                            stream.write(b',')
                        stream.write(line.rstrip(b'\n'))
            stream.write(b']}\n')
            require(stream.tell() <= MAX_BYTES, 'Road context exceeds 512 MiB')
            stream.flush()
            os.fsync(stream.fileno())
        # Atomic exclusive publication: rename() could overwrite a race-created user file.
        os.link(staged, output)
    result = {**counts, 'byteLength': output.stat().st_size, 'pbfSha256': digest, 'canardSnapshotSha256': canard_hash, 'roadRefs': sorted(refs), 'output': str(output)}
    print(json.dumps(result), flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pbf', required=True)
    parser.add_argument('--canard-dir', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--source-url', required=True)
    parser.add_argument('--data-timestamp')
    args = parser.parse_args()
    require(args.source_url.startswith('https://'), 'Source URL must use HTTPS')
    extract(args)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Road extraction failed: {error}', file=sys.stderr)
        sys.exit(1)
