#!/usr/bin/env python3
"""Small real-pyosmium regression; writes only temporary synthetic inputs."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import sys
sys.dont_write_bytecode = True
import unittest

spec = importlib.util.spec_from_file_location('extract_context', Path(__file__).with_name('extract-context.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ExtractTests(unittest.TestCase):
    def inputs(self, directory, missing=False):
        root = Path(directory)
        canard = root / 'canard'
        folder = canard / 'data/canard'
        folder.mkdir(parents=True)
        observation = {'sourceId': '["PP","1"]', 'originalProperties': {'sourceCategory': 'PP', 'canardDetail': {'raw': {'urzadzenie': {'lokalizacjaNrDrogi': 'DK94'}}}}}
        body = module.compact({'schemaVersion': 1, 'batch': {'source': {'namespace': 'pl.gitd.canard.public-map'}, 'observations': [observation]}})
        digest = hashlib.sha256(body).hexdigest()
        path = f'data/canard/snapshot-{digest}.json'
        (canard / path).write_bytes(body)
        manifest = {'schemaVersion': 1, 'state': 'active', 'path': path, 'sha256': digest, 'byteLength': len(body), 'total': 1, 'counts': {'PP': 1, 'OPP': 0, 'RL': 0, 'PK': None}}
        (folder / 'manifest.json').write_bytes(module.compact(manifest))
        nodes = ''.join(f'<node id="{i}" version="1" lon="{20+i}" lat="52">'+('<tag k="place" v="city"/><tag k="name" v="Twin"/>' if i < 3 else '')+'</node>' for i in range(1, 5))
        def way(identifier, tags, refs=(1, 2)):
            return f'<way id="{identifier}" version="1">'+''.join(f'<nd ref="{ref}"/>' for ref in refs)+''.join(f'<tag k="{k}" v="{v}"/>' for k, v in tags.items())+'</way>'
        ways = way(11, {'highway': 'primary', 'ref': 'A2'})+way(12, {'highway': 'residential', 'ref': '94'})+way(13, {'highway': 'residential', 'ref': 'S94'})+way(14, {'highway': 'primary', 'access': 'private'})+way(15, {'highway': 'cycleway', 'ref': '94'})+way(16, {'highway': 'primary', 'motor_vehicle': 'no'})+way(17, {'highway': 'trunk', 'oneway': '-1', 'destination:backward': 'Dobroń', 'name:pl': 'Przykład'}, (3, 99) if missing else (3, 4))
        pbf = root / 'synthetic.osm'
        pbf.write_text('<?xml version="1.0" encoding="UTF-8"?><osm version="0.6">'+nodes+ways+'</osm>')
        return argparse.Namespace(pbf=str(pbf), canard_dir=str(canard), output=str(root / 'context.json'), source_url='https://example.test/synthetic.osm', data_timestamp='2026-11-02T00:00:00Z')

    def test_stream_preserves_filtered_graph_identity_tags_namesakes_and_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            args = self.inputs(directory)
            result = module.extract(args)
            output = json.loads(Path(args.output).read_bytes())
            self.assertEqual(result['ways'], 3)
            self.assertEqual([way['id'] for way in output['ways']], ['way/11', 'way/12', 'way/17'])
            self.assertEqual(output['ways'][0]['nodeIds'], [1, 2])
            self.assertEqual(output['ways'][0]['coordinates'], [[21, 52], [22, 52]])
            self.assertEqual(output['ways'][2]['tags']['destination:backward'], 'Dobroń')
            self.assertEqual(output['ways'][2]['tags']['oneway'], '-1')
            self.assertEqual(len(output['places']), 2)
            self.assertEqual(output['places'][0]['tags']['name'], output['places'][1]['tags']['name'])
            self.assertTrue(output['source']['complete'])
            self.assertEqual(output['source']['sha256'], hashlib.sha256(Path(args.pbf).read_bytes()).hexdigest())
            before = Path(args.output).read_bytes()
            with self.assertRaises(ValueError):
                module.extract(args)
            self.assertEqual(Path(args.output).read_bytes(), before)
            self.assertFalse(list(Path(directory).glob('.road-extract-*')))

    def test_missing_geometry_or_output_limit_never_publishes_partial_file(self):
        for missing in [True, False]:
            with self.subTest(missing=missing), tempfile.TemporaryDirectory() as directory:
                args = self.inputs(directory, missing=missing)
                original = module.MAX_BYTES
                try:
                    if not missing:
                        module.MAX_BYTES = 200
                    with self.assertRaises(Exception):
                        module.extract(args)
                    self.assertFalse(Path(args.output).exists())
                    self.assertFalse(list(Path(directory).glob('.road-extract-*')))
                finally:
                    module.MAX_BYTES = original

    def test_canard_hash_size_counts_and_ref_normalization(self):
        self.assertEqual(module.canonical_refs('DK 94; S14; A2; DW-902'), {'94', 'S14', 'A2', '902'})
        for field, value in [('byteLength', 1), ('total', 2), ('counts', {'PP': 0, 'OPP': 0, 'RL': 0, 'PK': None})]:
            with self.subTest(field=field), tempfile.TemporaryDirectory() as directory:
                args = self.inputs(directory)
                path = Path(args.canard_dir) / 'data/canard/manifest.json'
                manifest = json.loads(path.read_bytes())
                manifest[field] = value
                path.write_bytes(module.compact(manifest))
                with self.assertRaises(ValueError):
                    module.extract(args)
                self.assertFalse(Path(args.output).exists())
        with tempfile.TemporaryDirectory() as directory:
            args = self.inputs(directory)
            path = next((Path(args.canard_dir) / 'data/canard').glob('snapshot-*.json'))
            path.write_bytes(path.read_bytes()+b' ')
            with self.assertRaises(ValueError):
                module.extract(args)


if __name__ == '__main__':
    unittest.main()
