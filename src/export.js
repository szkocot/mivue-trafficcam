/** Serialize a parseDatabase result, including all raw fields and warnings. */
export function serializeJson(database) {
  return JSON.stringify(database, null, 2) + '\n';
}

/** Convert decoded records to points; unverified endpoint links remain properties. */
export function toGeoJson(database) {
  return {
    type: 'FeatureCollection', schemaVersion: database.schemaVersion,
    header: database.header, summary: database.summary, diagnostics: database.diagnostics,
    features: database.records.map(record => ({
      type: 'Feature', id: record.offset,
      geometry: Number.isFinite(record.latitude) && Number.isFinite(record.longitude)
        ? { type: 'Point', coordinates: [record.longitude, record.latitude] } : null,
      properties: { ...record },
    })),
  };
}

/** Serialize a GeoJSON collection as newline-terminated JSON. */
export function serializeGeoJson(database) {
  return JSON.stringify(toGeoJson(database), null, 2) + '\n';
}
