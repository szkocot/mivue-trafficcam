import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDatabase } from '../src/parser.js';
import { serializeJson, serializeGeoJson, toGeoJson } from '../src/export.js';
import { makeFixture } from './helpers/fixture.js';

test('JSON preserves parsed data and GeoJSON uses longitude first', () => {
  const db = parseDatabase(makeFixture([{ typeRaw: 964, linkRaw: 123 }]).bytes);
  const before = structuredClone(db);
  assert.deepEqual(JSON.parse(serializeJson(db)), db);
  const geo = JSON.parse(serializeGeoJson(db));
  assert.equal(geo.type, 'FeatureCollection'); assert.equal(geo.schemaVersion, 1);
  assert.deepEqual(geo.features[0].geometry, { type: 'Point', coordinates: [-7, 37] });
  assert.deepEqual(geo.features[0].properties, db.records[0]);
  assert.equal(geo.features[0].id, db.records[0].offset);
  assert.deepEqual(geo.diagnostics, db.diagnostics); assert.deepEqual(geo.header, db.header);
  assert.deepEqual(db, before);
});
test('invalid coordinates retain raw bits with null geometry', () => {
  const db = parseDatabase(makeFixture([{ latitudeRaw: NaN }, { longitudeRaw: Infinity }]).bytes);
  assert.equal(JSON.parse(serializeJson(db)).records[0].latitudeRaw, 'NaN');
  assert.equal(JSON.parse(serializeJson(db)).records[1].longitudeRaw, 'Infinity');
  const geo = toGeoJson(db);
  assert.deepEqual(geo.features.map(f => f.geometry), [null, null]);
  assert.equal(geo.features[0].properties.rawHex, db.records[0].rawHex);
});
test('empty database exports valid empty collections', () => {
  const db = parseDatabase(makeFixture().bytes);
  assert.deepEqual(JSON.parse(serializeJson(db)).records, []);
  assert.deepEqual(JSON.parse(serializeGeoJson(db)).features, []);
});
