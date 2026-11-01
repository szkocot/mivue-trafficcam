import {boundRecordIds} from './ingestion-state.js';
import {identity} from './import-normalize.js';
import {projectNotices} from './source-notices.js';

/** Source positions are observations, not claims about encoded raw fields. */
export function referenceView(project){
 const state=project.ingestion;if(!state)return [];
 const sources=new Map(state.sources.map(s=>[s.namespace,s]));
 const bindings=new Map(state.bindings.map(b=>[identity(b.namespace,b.sourceId),b]));
 const records=new Map(project.records.map(r=>[r.id,r]));
 return state.observations.map(o=>{
  const recordIds=[...boundRecordIds(bindings.get(identity(o.namespace,o.sourceId)))],recordId=recordIds[0]??null,bound=recordIds.map(id=>records.get(id)),source=sources.get(o.namespace);
  const allActive=bound.length>0&&bound.every(r=>r&&!r.deleted);
  return {...structuredClone(o),id:`import:${identity(o.namespace,o.sourceId)}`,recordId,recordIds,
   encoded:allActive,encodingStatus:bound.some(r=>r?.deleted)?'deleted':allActive?'bound':'reference',
   attribution:source.attribution,sourceUrl:source.url};
 });
}
export function exportReferences(project){
 return JSON.stringify({type:'FeatureCollection',schema:'mivue-source-observations',version:1,sourceNotices:projectNotices(project),
  features:referenceView(project).map(({id,geometry,...properties})=>({type:'Feature',id,geometry,properties}))},null,2)+'\n';
}
