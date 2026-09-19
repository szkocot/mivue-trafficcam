// Independent binary fixture packer; deliberately imports no production code.
export function makeFixture(input = []) {
  const records = input.map((r, id) => ({ regionIndex: 0, cellIndex: 21,
    latitudeRaw: 3700, longitudeRaw: -700, rawBytes16To19: [50, 0, 0, 1],
    typeRaw: 1, linkRaw: 0, ...r, id }));
  const regionOffsets = [], cellOffsets = [], recordOffsets = [];
  const groups = Array.from({ length: 9 }, (_, i) => records.filter(r => r.regionIndex === i));
  let size = 72;
  for (let i = 0; i < 9; i++) {
    regionOffsets[i] = size;
    size += 10;
    cellOffsets[i] = [];
    if (!groups[i].length) continue;
    size += 1600;
    for (let j = 0; j < 400; j++) {
      cellOffsets[i][j] = size;
      size += 10;
      for (const r of groups[i].filter(r => r.cellIndex === j)) {
        recordOffsets[r.id] = size;
        size += 28;
      }
    }
  }
  const bytes = new Uint8Array(size), v = new DataView(bytes.buffer);
  const bounds = (p, count, lat, lon, latEnd, lonEnd) => {
    v.setUint16(p, count, true);
    [lat, lon, latEnd, lonEnd].forEach((x, i) => v.setInt16(p + 2 + i * 2, Math.trunc(x), true));
  };
  [-8, 36, 31, 70, 20, 20, 3, 3].forEach((x, i) => v.setInt16(i * 2, x, true));
  bytes.set([4, 32, 32, 32], 16);
  v.setUint32(20, 82, true);
  bytes.set(new TextEncoder().encode('202607060125'), 24);
  for (let i = 0; i < 9; i++) {
    const p = regionOffsets[i], lat = 36 + Math.floor(i / 3) * 34 / 3, lon = -8 + (i % 3) * 13;
    v.setUint32(36 + i * 4, p, true);
    bounds(p, groups[i].length, lat, lon, lat + 34 / 3, lon + 13);
    for (let j = 0; j < cellOffsets[i].length; j++) {
      const q = cellOffsets[i][j], members = groups[i].filter(r => r.cellIndex === j);
      v.setUint32(p + 10 + j * 4, q, true);
      const a = lat + Math.floor(j / 20) * 34 / 60, b = lon + (j % 20) * 13 / 20;
      bounds(q, members.length, a, b, a + 34 / 60, b + 13 / 20);
    }
  }
  for (const r of records) {
    const p = recordOffsets[r.id];
    v.setFloat64(p, r.latitudeRaw, true); v.setFloat64(p + 8, r.longitudeRaw, true);
    bytes.set(r.rawBytes16To19, p + 16);
    v.setUint32(p + 20, r.typeRaw, true);
    v.setUint32(p + 24, r.linkTo === undefined ? r.linkRaw : recordOffsets[r.linkTo], true);
  }
  return { bytes, recordOffsets, cellOffsets, regionOffsets };
}
