import {OSM_SOURCE} from './import-osm.js';
export {validateNotices} from './canard-snapshot.js';
/** Attribution follows source contributions, not unrelated reference-only data. */
export function projectNotices(project,{encodedOnly=false}={}){
 let selected=null;
 if(encodedOnly){
  const active=new Set(project.records.filter(r=>!r.deleted).map(r=>r.id));selected=new Set();
  for(const b of project.ingestion.bindings)if(active.has(b.recordId))selected.add(b.namespace);
  for(const r of project.records)if(active.has(r.id))for(const p of r.provenance)if(typeof p?.source==='string')selected.add(p.source);
 }
 return project.ingestion.sources.filter(s=>(s.notices||s.namespace===OSM_SOURCE.namespace)&&(!selected||selected.has(s.namespace))).map(s=>s.namespace===OSM_SOURCE.namespace?{attribution:OSM_SOURCE.attribution,sourceUrl:OSM_SOURCE.url,termsUrl:OSM_SOURCE.url,licenceLabel:'ODbL 1.0',licenceUrl:'https://opendatacommons.org/licenses/odbl/1-0/',transformation:'Local camera-node selection; speed units normalized to km/h; original element tags retained. Unknown status is not evidence of operation.'}:structuredClone(s.notices));
}
