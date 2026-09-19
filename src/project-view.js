import { validateProject } from './project.js';

export const hasPosition = r => Number.isFinite(r.latitude) && Number.isFinite(r.longitude)
  && Math.abs(r.latitude) <= 90 && Math.abs(r.longitude) <= 180;

/** A view of an editable draft, deliberately independent of binary build eligibility. */
export async function projectView(project) {
  const { baseline, originals, entries } = await validateProject(project);
  const byOffset = new Map();
  for (const d of baseline.diagnostics) {
    if (!byOffset.has(d.offset)) byOffset.set(d.offset, []);
    byOffset.get(d.offset).push({ ...d, scope:'baseline' });
  }
  const records = project.records.map(entry => {
    const original = originals.get(entry.id) ?? originals.get(entry.templateId);
    const e = entry.edits;
    const linkTargetId = e.linkResolution?.targetId ?? (original.typeRaw === 964 && originals.has(`source:${original.linkRaw}`)
      ? `source:${original.linkRaw}` : null);
    const r = { id:entry.id, originalSourceOffset:entry.sourceOffset, templateId:entry.templateId,
      latitude:e.latitude ?? original.latitude, longitude:e.longitude ?? original.longitude,
      rawBytes16To19:[...(e.rawBytes16To19 ?? original.rawBytes16To19)], typeRaw:original.typeRaw,
      originalLinkRaw:original.linkRaw, linkTargetId, linkResolution:structuredClone(e.linkResolution??null), deleted:entry.deleted,
      changed:entry.sourceOffset === null || entry.deleted || Boolean(e.linkResolution)
        || ('latitude' in e && e.latitude !== original.latitude) || ('longitude' in e && e.longitude !== original.longitude)
        || (e.rawBytes16To19?.some((b,i)=>b !== original.rawBytes16To19[i]) ?? false),
      provenance:structuredClone(entry.provenance), diagnostics:[...(byOffset.get(entry.sourceOffset) ?? [])] };
    const warn = code => r.diagnostics.push({code,scope:'current',recordId:r.id});
    if (!entry.deleted) {
      if (!hasPosition(r)) warn('INVALID_COORDINATE');
      if (r.typeRaw === 964) {
        const target = entries.get(linkTargetId);
        if (!target) warn('LINK_TARGET_MISSING');
        else if (originals.get(target.id)?.typeRaw !== 9128) warn('LINK_TARGET_TYPE');
        else if (target.deleted) warn('LINK_TARGET_DELETED');
      }
    }
    return r;
  });
  return { schema:'mivue-project-view', version:1, source:{name:project.source.name,sha256:project.source.sha256},
    records, diagnostics:records.flatMap(r=>r.diagnostics.map(d=>({...d,recordId:r.id}))) };
}

function csvCell(value) {
  let text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (typeof value === 'string' && /^[\s\x00-\x1f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}
export function exportView(view, format) {
  if (!['json','geojson','csv'].includes(format)) throw new Error('Unsupported export format');
  const records = view.records.filter(r=>!r.deleted);
  if (format === 'json') return JSON.stringify({...view,records},null,2)+'\n';
  if (format === 'geojson') return JSON.stringify({type:'FeatureCollection',schema:view.schema,version:view.version,
    source:view.source,diagnostics:view.diagnostics,features:records.map(r=>({type:'Feature',id:r.id,
      geometry:hasPosition(r)?{type:'Point',coordinates:[r.longitude,r.latitude]}:null,properties:r}))},null,2)+'\n';
  const fields=['id','originalSourceOffset','templateId','latitude','longitude','rawBytes16To19','typeRaw',
    'originalLinkRaw','linkTargetId','changed','provenance','diagnostics'];
  return [['schema','sourceName',...fields].map(csvCell).join(','), ...records.map(r=>
    [view.schema,view.source.name,...fields.map(k=>r[k])].map(csvCell).join(','))].join('\r\n')+'\r\n';
}
