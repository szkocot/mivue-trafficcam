/** A structural failure in the supported database layout. */
export class ParseError extends Error {
  /** @param {string} code @param {number} offset @param {string} message */
  constructor(code, offset, message) {
    super(message);
    this.name = 'ParseError';
    this.code = code;
    this.offset = offset;
  }
}

const hex = bytes => Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
const jsonNumber = n => Number.isFinite(n) ? n : String(n);
const decode = n => Math.trunc(n / 100) + (n - Math.trunc(n / 100) * 100) / 60;
const validRaw = n => Number.isFinite(n) && Math.abs(n % 100) < 60;

/**
 * Parse the researched 3×3 / 20×20 layout without changing the input.
 * All returned arrays/objects own their data; no input views are retained.
 * @param {Uint8Array} bytes File bytes (including sliced Node Buffers).
 * @returns {object} Schema-v1 header, regions, cells, records, diagnostics and summary.
 * @throws {ParseError} Unsupported or structurally malformed data.
 */
export function parseDatabase(bytes) {
  const fail = (code, offset, message) => { throw new ParseError(code, offset, message); };
  if (!(bytes instanceof Uint8Array)) fail('INVALID_INPUT', 0, 'Expected a Uint8Array');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const span = (offset, length) => {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length)
      || offset < 0 || length < 0 || offset > bytes.length - length)
      fail('TRUNCATED', offset, 'Read exceeds input bounds');
  };
  const u16 = p => { span(p, 2); return view.getUint16(p, true); };
  const i16 = p => { span(p, 2); return view.getInt16(p, true); };
  const u32 = p => { span(p, 4); return view.getUint32(p, true); };
  const f64 = p => { span(p, 8); return view.getFloat64(p, true); };
  const raw = (p, n) => { span(p, n); return hex(bytes.subarray(p, p + n)); };
  const exactSpan = (p, end, n) => {
    if (end - p !== n) fail('SPAN_MISMATCH', p, `Expected ${n} bytes, found ${end - p}`);
  };
  const node = p => {
    span(p, 10);
    return { offset: p, count: u16(p), rawHex: raw(p, 10), storedBounds: {
      latitudeMin: i16(p + 2), longitudeMin: i16(p + 4),
      latitudeMax: i16(p + 6), longitudeMax: i16(p + 8),
    } };
  };
  // Validate a complete pointer table before traversing anything it references.
  const pointers = (p, count, first, end) => {
    span(p, count * 4);
    const values = Array.from({ length: count }, (_, i) => u32(p + i * 4));
    for (let i = 0; i < count; i++) {
      if ((i === 0 && values[i] !== first) || values[i] < first
        || values[i] > end - 10 || (i > 0 && values[i] <= values[i - 1]))
        fail('INVALID_OFFSET', p + i * 4, 'Invalid or unordered node offset');
    }
    return values;
  };
  span(0, 36);
  const bounds = { longitudeMin: i16(0), latitudeMin: i16(2), longitudeMax: i16(4), latitudeMax: i16(6) };
  if (u16(8) !== 20 || u16(10) !== 20 || u16(12) !== 3 || u16(14) !== 3)
    fail('UNSUPPORTED_GRID', 8, 'Only the researched 3×3 / 20×20 grid is supported');
  if (bounds.latitudeMin < -90 || bounds.latitudeMax > 90
    || bounds.longitudeMin < -180 || bounds.longitudeMax > 180
    || bounds.latitudeMin >= bounds.latitudeMax || bounds.longitudeMin >= bounds.longitudeMax)
    fail('INVALID_BOUNDS', 0, 'Invalid global geographic bounds');
  const header = { rawHex: raw(0, 36), bounds,
    cellDimensions: { rows: 20, columns: 20 }, regionDimensions: { rows: 3, columns: 3 },
    unknown16Hex: raw(16, 4), unknown20: u32(20),
    versionCandidate: String.fromCharCode(...bytes.subarray(24, 36)) };
  const regionOffsets = pointers(36, 9, 72, bytes.length);
  const regions = [], cells = [], records = [], diagnostics = [];
  const warn = (code, offset, message, targetOffset) => {
    diagnostics.push({ code, offset, message, ...(targetOffset === undefined ? {} : { targetOffset }) });
  };
  const axisIndex = (n, min, max) => n === max ? 59 : Math.floor((n - min) / (max - min) * 60);
  const readRecord = (offset, regionIndex, cellIndex) => {
    span(offset, 28);
    const a = f64(offset), b = f64(offset + 8);
    let latitude = decode(a), longitude = decode(b);
    if (!validRaw(a) || !validRaw(b) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      latitude = longitude = null;
      warn('INVALID_COORDINATE', offset, 'Invalid degrees-and-minutes coordinate');
    } else {
      const x = axisIndex(latitude, bounds.latitudeMin, bounds.latitudeMax);
      const y = axisIndex(longitude, bounds.longitudeMin, bounds.longitudeMax);
      if (latitude < bounds.latitudeMin || latitude > bounds.latitudeMax
        || longitude < bounds.longitudeMin || longitude > bounds.longitudeMax
        || Math.floor(x / 20) * 3 + Math.floor(y / 20) !== regionIndex
        || (x % 20) * 20 + y % 20 !== cellIndex)
        warn('CELL_MISMATCH', offset, 'Coordinate does not belong to its indexed cell');
    }
    return { offset, regionIndex, cellIndex, rawHex: raw(offset, 28),
      latitudeRaw: jsonNumber(a), longitudeRaw: jsonNumber(b), latitude, longitude,
      rawBytes16To19: Array.from(bytes.subarray(offset + 16, offset + 20)),
      typeRaw: u32(offset + 20), linkRaw: u32(offset + 24) };
  };
  for (let i = 0; i < 9; i++) {
    const p = regionOffsets[i], end = regionOffsets[i + 1] ?? bytes.length;
    if (end - p < 10) fail('SPAN_MISMATCH', p, 'Region header overlaps next region');
    const region = { index: i, ...node(p), cellOffsets: [] };
    regions.push(region);
    if (!region.count) { exactSpan(p, end, 10); continue; }
    if (end - p < 1610) fail('SPAN_MISMATCH', p, 'Region cannot contain its cell table');
    region.cellOffsets = pointers(p + 10, 400, p + 1610, end);
    let count = 0;
    for (let j = 0; j < 400; j++) {
      const q = region.cellOffsets[j], cellEnd = region.cellOffsets[j + 1] ?? end;
      if (cellEnd - q < 10) fail('SPAN_MISMATCH', q, 'Cell header overlaps next cell');
      const cell = { regionIndex: i, index: j, ...node(q) };
      exactSpan(q, cellEnd, 10 + cell.count * 28);
      cells.push(cell); count += cell.count;
      for (let k = 0; k < cell.count; k++) records.push(readRecord(q + 10 + k * 28, i, j));
    }
    if (count !== region.count) fail('COUNT_MISMATCH', p, `Region count ${region.count} differs from cell sum ${count}`);
  }
  const byOffset = new Map(records.map(r => [r.offset, r]));
  const typeCounts = {}, diagnosticCounts = {};
  for (const r of records) {
    typeCounts[r.typeRaw] = (typeCounts[r.typeRaw] ?? 0) + 1;
    if (r.typeRaw !== 964 || !r.linkRaw) continue;
    const target = byOffset.get(r.linkRaw);
    if (!target) warn('LINK_TARGET_MISSING', r.offset, 'Candidate link does not target a record start', r.linkRaw);
    else if (target.typeRaw !== 9128)
      warn('LINK_TARGET_TYPE', r.offset, `Candidate link targets raw type ${target.typeRaw}, expected 9128`, r.linkRaw);
  }
  for (const d of diagnostics) diagnosticCounts[d.code] = (diagnosticCounts[d.code] ?? 0) + 1;
  return { schemaVersion: 1, header, regions, cells, records, diagnostics, summary: {
    byteLength: bytes.length, regionCount: regions.length, cellCount: cells.length,
    populatedCellCount: cells.filter(c => c.count > 0).length,
    recordCount: records.length, typeCounts, diagnosticCounts,
  } };
}
