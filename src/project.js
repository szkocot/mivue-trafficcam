import { parseDatabase } from './parser.js';

export class ProjectError extends Error {
  constructor(message) { super(message); this.name = 'ProjectError'; this.code = 'INVALID_PROJECT'; }
}
const requireValue = (condition, message) => { if (!condition) throw new ProjectError(message); };
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
function keys(value, allowed) {
  requireValue(object(value) && Object.keys(value).every(k => allowed.includes(k)), 'Unexpected object fields');
}
export const bytesToHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
/** Validate before decoding; never let parseInt silently truncate malformed hex. */
export function hexToBytes(hex) {
  requireValue(typeof hex === 'string' && hex.length % 2 === 0 && /^[\da-f]*$/i.test(hex), 'Invalid hexadecimal bytes');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
async function fingerprint(bytes) {
  return bytesToHex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes)));
}
function coordinate(value, limit) {
  requireValue(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit, 'Invalid coordinate edit');
}
function changes(value, allowLink = true) {
  keys(value, ['latitude', 'longitude', 'rawBytes16To19', ...(allowLink ? ['linkResolution'] : [])]);
  if ('latitude' in value) coordinate(value.latitude, 90);
  if ('longitude' in value) coordinate(value.longitude, 180);
  if ('rawBytes16To19' in value) requireValue(Array.isArray(value.rawBytes16To19)
    && value.rawBytes16To19.length === 4 && Array.from(value.rawBytes16To19).every(n => Number.isInteger(n) && n >= 0 && n <= 255), 'Expected four raw bytes');
  if ('linkResolution' in value) {
    keys(value.linkResolution, ['targetId', 'reason']);
    requireValue(typeof value.linkResolution.targetId === 'string' && typeof value.linkResolution.reason === 'string'
      && value.linkResolution.reason.trim().length > 0, 'A link resolution needs a target and reason');
  }
}
function jsonData(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') { requireValue(Number.isFinite(value), 'Nonfinite provenance'); return; }
  requireValue((Array.isArray(value) || object(value)) && !ancestors.has(value), 'Provenance must be acyclic JSON data');
  ancestors.add(value);
  for (const item of Array.isArray(value) ? Array.from(value) : Object.values(value)) jsonData(item, ancestors);
  ancestors.delete(value);
}

/** Structural validation; deleted targets are allowed in drafts, never in builds. */
function inspectProject(project) {
  keys(project, ['projectVersion', 'targetDevice', 'source', 'records', 'nextId']);
  requireValue(project.projectVersion === 1 && project.targetDevice === 'MiVue 955W', 'Unsupported project version or target device');
  keys(project.source, ['name', 'sha256', 'bytesHex']);
  requireValue(typeof project.source.name === 'string' && typeof project.source.sha256 === 'string'
    && /^[\da-f]{64}$/i.test(project.source.sha256), 'Invalid source metadata');
  requireValue(Array.isArray(project.records) && Number.isSafeInteger(project.nextId) && project.nextId >= 1, 'Invalid project records or counter');
  const bytes = hexToBytes(project.source.bytesHex), baseline = parseDatabase(bytes);
  const originals = new Map(baseline.records.map(r => [`source:${r.offset}`, r]));
  const entries = new Map();
  for (const r of project.records) {
    keys(r, ['id', 'sourceOffset', 'templateId', 'edits', 'deleted', 'provenance']);
    requireValue(typeof r.id === 'string' && !entries.has(r.id) && typeof r.deleted === 'boolean' && Array.isArray(r.provenance), 'Invalid or duplicate record');
    changes(r.edits); jsonData(r.provenance); entries.set(r.id, r);
    if (originals.has(r.id)) {
      requireValue(r.sourceOffset === originals.get(r.id).offset && r.templateId === null, 'Original record identity changed');
    } else {
      requireValue(/^new:[1-9]\d*$/.test(r.id) && Number.isSafeInteger(Number(r.id.slice(4)))
        && Number(r.id.slice(4)) < project.nextId && r.sourceOffset === null, 'Invalid new record identity');
      const template = originals.get(r.templateId);
      requireValue(template && [1, 3, 5].includes(template.typeRaw) && template.linkRaw === 0, 'Unsupported clone template');
      requireValue('latitude' in r.edits && 'longitude' in r.edits, 'Clones need explicit coordinates');
    }
  }
  for (const id of originals.keys()) requireValue(entries.has(id), 'Missing original record; use deletion instead');
  for (const r of project.records) {
    if (!r.edits.linkResolution) continue;
    const from = originals.get(r.id), target = entries.get(r.edits.linkResolution.targetId);
    const to = target && originals.get(target.id);
    requireValue(from?.typeRaw === 964 && to?.typeRaw === 9128, 'Resolution requires a 964 source and 9128 target');
  }
  return { bytes, baseline, originals, entries };
}

/** Validate both JSON structure and embedded source fingerprint. */
export async function validateProject(project) {
  const checked = inspectProject(project);
  requireValue(await fingerprint(checked.bytes) === project.source.sha256.toLowerCase(), 'Source SHA-256 mismatch');
  return checked;
}
/** Create a versioned project with immutable source identity and no edits. */
export async function createProject(bytes, { name = '' } = {}) {
  requireValue(typeof name === 'string', 'Invalid source name');
  const baseline = parseDatabase(bytes);
  const copy = Uint8Array.from(bytes);
  return { projectVersion: 1, targetDevice: 'MiVue 955W',
    source: { name, sha256: await fingerprint(copy), bytesHex: bytesToHex(copy) },
    records: baseline.records.map(r => ({ id: `source:${r.offset}`, sourceOffset: r.offset,
      templateId: null, edits: {}, deleted: false, provenance: [] })), nextId: 1 };
}
/** Load untrusted project JSON, verifying schema and the baseline hash. */
export async function loadProject(text) {
  let p;
  try { p = JSON.parse(text); } catch { throw new ProjectError('Invalid project JSON'); }
  await validateProject(p); return p;
}
/** Save validated JSON; source bytes and all provenance remain in the project. */
export async function serializeProject(project) {
  await validateProject(project); return JSON.stringify(project, null, 2) + '\n';
}
/** Apply one explicit operation without changing the supplied project. */
export function applyEdit(project, operation) {
  const checked = inspectProject(project);
  requireValue(object(operation), 'Invalid edit operation');
  const schemas = { update: ['kind', 'id', 'changes'], delete: ['kind', 'id'], restore: ['kind', 'id'],
    clone: ['kind', 'templateId', 'latitude', 'longitude'], 'resolve-link': ['kind', 'id', 'targetId', 'reason'] };
  requireValue(Object.hasOwn(schemas, operation.kind), 'Unknown edit operation'); keys(operation, schemas[operation.kind]);
  const result = { ...project, records: [...project.records] };
  if (operation.kind === 'clone') {
    const template = checked.originals.get(operation.templateId);
    requireValue(template && [1, 3, 5].includes(template.typeRaw) && template.linkRaw === 0, 'Unsupported clone template');
    coordinate(operation.latitude, 90); coordinate(operation.longitude, 180);
    requireValue(Number.isSafeInteger(project.nextId + 1), 'Record counter overflow');
    result.records.push({ id: `new:${project.nextId}`, sourceOffset: null, templateId: operation.templateId,
      deleted: false, provenance: [], edits: { latitude: operation.latitude, longitude: operation.longitude } });
    result.nextId++;
  } else {
    const index = project.records.findIndex(r => r.id === operation.id);
    requireValue(index !== -1, 'Unknown record ID');
    const entry = project.records[index], edits = { ...entry.edits };
    result.records[index] = { ...entry, edits };
    if (operation.kind === 'update') { changes(operation.changes, false); Object.assign(edits, structuredClone(operation.changes)); }
    if (operation.kind === 'delete' || operation.kind === 'restore') result.records[index].deleted = operation.kind === 'delete';
    if (operation.kind === 'resolve-link') edits.linkResolution = { targetId: operation.targetId, reason: operation.reason };
  }
  inspectProject(result); return result;
}
