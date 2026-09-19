import { parseDatabase } from './parser.js';
import { validateProject, hexToBytes, bytesToHex } from './project.js';
import { encodeCoordinate, decodeCoordinate, locate } from './spatial.js';

export class BuildError extends Error {
  constructor(code, message, recordId) {
    super(message); this.name = 'BuildError'; this.code = code;
    this.issues = [{ code, message, ...(recordId ? { recordId } : {}) }];
  }
}
const fail = (code, message, id) => { throw new BuildError(code, message, id); };
const equal = (a, b) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
};

/** Reconstruct from parsed raw nodes/records, without access to source bytes. */
export function reconstructDatabase(parsed) {
  try {
    const { regions, cells, records } = parsed;
    if (regions.length !== 9) fail('INVALID_PARSED_DATA', 'Expected nine regions');
    const size = 72 + 90 + regions.filter(r => r.count > 0).length * 1600 + cells.length * 10 + records.length * 28;
    if (!Number.isSafeInteger(size) || size > 0xffffffff) fail('SIZE_OVERFLOW', 'Binary length exceeds uint32');
    const output = new Uint8Array(size), view = new DataView(output.buffer);
    let cursor = 0, ci = 0, ri = 0;
    const write = (offset, rawHex, length) => {
      const data = hexToBytes(rawHex);
      if (offset !== cursor || data.length !== length || cursor + length > size)
        fail('INVALID_PARSED_DATA', 'Noncontiguous or invalid raw segment');
      output.set(data, cursor); cursor += length;
    };
    write(0, parsed.header.rawHex, 36);
    for (const region of regions) { view.setUint32(cursor, region.offset, true); cursor += 4; }
    for (const region of regions) {
      write(region.offset, region.rawHex, 10);
      if (!region.count) {
        if (region.cellOffsets.length) fail('INVALID_PARSED_DATA', 'Empty region has cell pointers');
        continue;
      }
      if (region.cellOffsets.length !== 400 || cursor + 1600 > size) fail('INVALID_PARSED_DATA', 'Bad cell table');
      for (const offset of region.cellOffsets) { view.setUint32(cursor, offset, true); cursor += 4; }
      for (let j = 0; j < 400; j++) {
        const cell = cells[ci++]; write(cell.offset, cell.rawHex, 10);
        if (!Number.isInteger(cell.count) || cell.count < 0 || cell.count > 65535) fail('INVALID_PARSED_DATA', 'Bad cell count');
        for (let k = 0; k < cell.count; k++) {
          const r = records[ri++]; write(r.offset, r.rawHex, 28);
        }
      }
    }
    if (cursor !== size || ci !== cells.length || ri !== records.length || !equal(parseDatabase(output), parsed))
      fail('INVALID_PARSED_DATA', 'Parsed fields contradict reconstructed bytes');
    return output;
  } catch (e) {
    if (e instanceof BuildError) throw e;
    throw new BuildError('INVALID_PARSED_DATA', e.message);
  }
}

function nodeBytes(existing, count, regionIndex, cellIndex, bounds) {
  const bytes = existing ? hexToBytes(existing.rawHex) : new Uint8Array(10), v = new DataView(bytes.buffer);
  v.setUint16(0, count, true);
  if (!existing) {
    const latSpan = (bounds.latitudeMax - bounds.latitudeMin) / 3;
    const lonSpan = (bounds.longitudeMax - bounds.longitudeMin) / 3;
    const latStart = bounds.latitudeMin + Math.floor(regionIndex / 3) * latSpan;
    const lonStart = bounds.longitudeMin + (regionIndex % 3) * lonSpan;
    const lat = latStart + Math.floor(cellIndex / 20) * latSpan / 20;
    const lon = lonStart + (cellIndex % 20) * lonSpan / 20;
    [lat, lon, lat + latSpan / 20, lon + lonSpan / 20].forEach((n, i) => v.setInt16(2 + i * 2, Math.trunc(n), true));
  }
  return bytes;
}

/** Build validated project bytes and a report; device compatibility is untested. */
export async function buildProject(project) {
  // Snapshot caller data before asynchronous hash verification.
  project = structuredClone(project);
  const { baseline, originals } = await validateProject(project);
  const originalBytes = reconstructDatabase(baseline), bounds = baseline.header.bounds;
  const entries = new Map(project.records.map(r => [r.id, r]));
  const ordered = [...baseline.records.map(r => entries.get(`source:${r.offset}`)),
    ...project.records.filter(r => r.sourceOffset === null).sort((a, b) => Number(a.id.slice(4)) - Number(b.id.slice(4)))];
  const groups = Array.from({ length: 9 }, () => Array.from({ length: 400 }, () => []));
  const active = new Map(), changedRecordIds = [];
  for (const entry of ordered) {
    if (entry.deleted) { if (entry.sourceOffset !== null) changedRecordIds.push(entry.id); continue; }
    const original = originals.get(entry.sourceOffset === null ? entry.templateId : entry.id);
    const bytes = hexToBytes(original.rawHex), v = new DataView(bytes.buffer);
    let coordinateChanged = false;
    for (const [field, offset] of [['latitude', 0], ['longitude', 8]]) {
      if (Object.hasOwn(entry.edits, field) && entry.edits[field] !== original[field]) {
        const value = entry.edits[field], raw = encodeCoordinate(value);
        if (!Number.isFinite(raw) || Math.abs(raw % 100) >= 60 || Math.abs(decodeCoordinate(raw) - value) > 1e-10)
          fail('INVALID_COORDINATE', 'Coordinate cannot be encoded accurately', entry.id);
        v.setFloat64(offset, raw, true); coordinateChanged = true;
      }
    }
    if (entry.edits.rawBytes16To19) bytes.set(entry.edits.rawBytes16To19, 16);
    const latitude = decodeCoordinate(v.getFloat64(0, true)), longitude = decodeCoordinate(v.getFloat64(8, true));
    const position = (coordinateChanged || entry.sourceOffset === null) ? locate(latitude, longitude, bounds)
      : { regionIndex: original.regionIndex, cellIndex: original.cellIndex };
    if (!position) fail('INVALID_COORDINATE', 'Edited coordinate is outside database bounds', entry.id);
    const row = { entry, original, bytes, ...position, latitude, longitude, offset: 0 };
    active.set(entry.id, row); groups[position.regionIndex][position.cellIndex].push(row);
  }
  const counts = groups.map(cells => cells.reduce((n, list) => n + list.length, 0));
  if (counts.some(n => n > 65535)) fail('COUNT_OVERFLOW', 'Region record count exceeds uint16');
  const regionOffsets = [], cellOffsets = [];
  let size = 72;
  for (let i = 0; i < 9; i++) {
    regionOffsets[i] = size; size += 10; cellOffsets[i] = [];
    if (!counts[i]) continue;
    size += 1600;
    for (let j = 0; j < 400; j++) {
      cellOffsets[i][j] = size; size += 10;
      for (const row of groups[i][j]) { row.offset = size; size += 28; }
    }
  }
  if (!Number.isSafeInteger(size) || size > 0xffffffff) fail('SIZE_OVERFLOW', 'Binary length exceeds uint32');
  const layoutChanged = size !== originalBytes.length || active.size !== baseline.records.length
    || [...active.values()].some(r => r.offset !== r.entry.sourceOffset || r.regionIndex !== r.original.regionIndex || r.cellIndex !== r.original.cellIndex);
  if (layoutChanged && counts.findIndex(n => n > 0) !== baseline.regions.findIndex(r => r.count > 0))
    fail('UNKNOWN_HEADER_DEPENDENCY', 'Changing the first populated region requires research of header offset 20');
  if (layoutChanged && baseline.diagnostics.some(d => ['INVALID_COORDINATE', 'CELL_MISMATCH'].includes(d.code)
    && active.has(`source:${d.offset}`) && !('latitude' in active.get(`source:${d.offset}`).entry.edits || 'longitude' in active.get(`source:${d.offset}`).entry.edits)))
    fail('INVALID_COORDINATE', 'Resolve invalid/misplaced coordinates before changing layout');
  const warnings = [];
  for (const row of active.values()) {
    const { entry, original } = row;
    let targetId = entry.edits.linkResolution?.targetId;
    if (!targetId && original.typeRaw === 964 && originals.get(`source:${original.linkRaw}`)?.typeRaw === 9128)
      targetId = `source:${original.linkRaw}`;
    if (targetId) {
      const target = active.get(targetId);
      if (!target) fail('DANGLING_LINK', `Link target ${targetId} is deleted`, entry.id);
      new DataView(row.bytes.buffer).setUint32(24, target.offset, true);
    } else if (original.linkRaw) {
      if (layoutChanged) fail('UNRESOLVED_LINK', 'Resolve the opaque reference before changing address space', entry.id);
      warnings.push({ code: 'UNRESOLVED_LINK', recordId: entry.id, targetOffset: original.linkRaw });
    }
    if (entry.sourceOffset === null || bytesToHex(row.bytes) !== original.rawHex) changedRecordIds.push(entry.id);
  }
  const output = new Uint8Array(size), v = new DataView(output.buffer);
  output.set(hexToBytes(baseline.header.rawHex));
  const oldCells = new Map(baseline.cells.map(c => [`${c.regionIndex}:${c.index}`, c]));
  for (let i = 0; i < 9; i++) {
    const p = regionOffsets[i]; v.setUint32(36 + i * 4, p, true);
    output.set(nodeBytes(baseline.regions[i], counts[i], i, null, bounds), p);
    if (!counts[i]) continue;
    for (let j = 0; j < 400; j++) {
      const q = cellOffsets[i][j]; v.setUint32(p + 10 + j * 4, q, true);
      output.set(nodeBytes(oldCells.get(`${i}:${j}`), groups[i][j].length, i, j, bounds), q);
      for (const row of groups[i][j]) output.set(row.bytes, row.offset);
    }
  }
  const parsed = parseDatabase(output);
  if (parsed.records.length !== active.size) fail('VERIFY_FAILED', 'Output record count mismatch');
  const byOffset = new Map([...active.values()].map(r => [r.offset, r]));
  for (const record of parsed.records) {
    const row = byOffset.get(record.offset);
    if (!row || record.rawHex !== bytesToHex(row.bytes)) fail('VERIFY_FAILED', 'Output record differs from intended bytes');
  }
  for (const d of parsed.diagnostics) {
    const row = byOffset.get(d.offset), original = row?.original;
    if (!original || d.offset !== original.offset || bytesToHex(row.bytes) !== original.rawHex
      || !baseline.diagnostics.some(old => old.code === d.code && old.offset === d.offset && old.targetOffset === d.targetOffset))
      fail('NEW_DIAGNOSTIC', `Build introduced or changed ${d.code}`, row?.entry.id);
  }
  return { bytes: output, report: { layoutChanged, changedRecordIds, recordCount: parsed.records.length,
    byteLength: size, warnings, diagnostics: parsed.diagnostics, deviceAcceptance: 'untested' } };
}
