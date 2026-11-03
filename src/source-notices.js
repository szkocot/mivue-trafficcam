import {identity} from './import-normalize.js';
import {boundRecordIds} from './ingestion-state.js';
import {getRoadDirection,ROAD_DIRECTION_NOTICE} from './road-direction-data.js';
import {OSM_SOURCE} from './import-osm.js';
export {validateNotices} from './canard-snapshot.js';
/** Attribution follows source contributions, not unrelated reference-only data. */
export function projectNotices(project,{encodedOnly=false}={}){
 const active=new Set(project.records.filter(r=>!r.deleted).map(r=>r.id));
 const activeBindings=new Set(project.ingestion.bindings.filter(b=>boundRecordIds(b).some(id=>active.has(id))).map(b=>identity(b.namespace,b.sourceId)));
 let selected=null;
 if(encodedOnly){
  selected=new Set();
  for(const b of project.ingestion.bindings)if(boundRecordIds(b).some(id=>active.has(id)))selected.add(b.namespace);
  for(const r of project.records)if(active.has(r.id))for(const p of r.provenance)if(typeof p?.source==='string')selected.add(p.source);
 }
 const notices=project.ingestion.sources.filter(s=>(s.notices||s.namespace===OSM_SOURCE.namespace)&&(!selected||selected.has(s.namespace))).map(s=>s.namespace===OSM_SOURCE.namespace?{attribution:OSM_SOURCE.attribution,sourceUrl:OSM_SOURCE.url,termsUrl:OSM_SOURCE.url,licenceLabel:'ODbL 1.0',licenceUrl:'https://opendatacommons.org/licenses/odbl/1-0/',transformation:'Local camera-node and explicit average-speed endpoint selection; endpoint connectors are not road routes; speed units normalized to km/h; original element tags retained. Unknown status is not evidence of operation.'}:structuredClone(s.notices));
 const roadContribution=project.ingestion.observations.some(o=>getRoadDirection(o)&&(!encodedOnly||activeBindings.has(identity(o.namespace,o.sourceId))));
 if(roadContribution)notices.push(structuredClone(ROAD_DIRECTION_NOTICE));
 return notices;
}
