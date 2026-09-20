import {identity} from './import-normalize.js';

/** Source positions are observations, not claims about encoded raw fields. */
export function referenceView(project){
 const state=project.ingestion;if(!state)return [];
 const sources=new Map(state.sources.map(s=>[s.namespace,s]));
 const bindings=new Map(state.bindings.map(b=>[identity(b.namespace,b.sourceId),b.recordId]));
 const records=new Map(project.records.map(r=>[r.id,r]));
 return state.observations.map(o=>{
  const recordId=bindings.get(identity(o.namespace,o.sourceId))??null,record=records.get(recordId),source=sources.get(o.namespace);
  return {...structuredClone(o),id:`import:${identity(o.namespace,o.sourceId)}`,recordId,
   encoded:Boolean(record&&!record.deleted),encodingStatus:record?.deleted?'deleted':record?'bound':'reference',
   attribution:source.attribution,sourceUrl:source.url};
 });
}
export function exportReferences(project){
 return JSON.stringify({type:'FeatureCollection',schema:'mivue-source-observations',version:1,
  features:referenceView(project).map(({id,geometry,...properties})=>({type:'Feature',id,geometry,properties}))},null,2)+'\n';
}
