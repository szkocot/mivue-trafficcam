export {validateNotices} from './canard-snapshot.js';
/** Attribution follows source contributions, not unrelated reference-only data. */
export function projectNotices(project,{encodedOnly=false}={}){
 let selected=null;
 if(encodedOnly){
  const active=new Set(project.records.filter(r=>!r.deleted).map(r=>r.id));selected=new Set();
  for(const b of project.ingestion.bindings)if(active.has(b.recordId))selected.add(b.namespace);
  for(const r of project.records)if(active.has(r.id))for(const p of r.provenance)if(typeof p?.source==='string')selected.add(p.source);
 }
 return project.ingestion.sources.filter(s=>s.notices&&(!selected||selected.has(s.namespace))).map(s=>structuredClone(s.notices));
}
