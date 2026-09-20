import { inspectProject,applyImportTransaction,bytesToHex } from './project.js';
import { upgradeProject } from './ingestion-state.js';
import { normalizeBatch,identity,jsonCopy,requireImport } from './import-normalize.js';
import { createProximityIndex } from './import-spatial.js';

const key=o=>identity(o.namespace,o.sourceId);
const equal=(a,b)=>JSON.stringify(jsonCopy(a))===JSON.stringify(jsonCopy(b));
const order=(a,b)=>key(a)<key(b)?-1:key(a)>key(b)?1:0;
const supported=o=>o.geometry.type==='Point'&&['camera','red-light'].includes(o.kind);
function ownerOf(p,id){return p.ingestion.ownership.find(o=>o.recordId===id)?.coordinates;}
function detachOwner(ingestion,namespace,sourceId){
 ingestion.ownership=ingestion.ownership.map(o=>o.coordinates!=='manual'&&o.coordinates.namespace===namespace&&o.coordinates.sourceId===sourceId?{...o,coordinates:'manual'}:o);
}
export function setImportPolicy(project,policy){
 project=upgradeProject(project);requireImport(policy&&Object.keys(policy).every(k=>['namespace','kind','templateId'].includes(k)),'policy');
 const policies=project.ingestion.policies.filter(p=>p.namespace!==policy.namespace||p.kind!==policy.kind);
 policies.push({...policy});policies.sort((a,b)=>identity(a.namespace,a.kind).localeCompare(identity(b.namespace,b.kind)));
 if(equal(policies,project.ingestion.policies))return project;
 return applyImportTransaction(project,{ingestion:{...project.ingestion,policies}});
}

export async function reconcile(project,input){
 project=upgradeProject(project);const checked=inspectProject(project),batch=normalizeBatch(input),namespace=batch.source.namespace;
 const digest=bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(jsonCopy({source:batch.source,observations:[...batch.observations].sort((a,b)=>a.sourceId<b.sourceId?-1:1)}))))));
 const ingestion={...project.ingestion,sources:project.ingestion.sources.filter(s=>s.namespace!==namespace),bindings:[...project.ingestion.bindings],ownership:[...project.ingestion.ownership]};
 ingestion.sources.push({...project.ingestion.sources.find(s=>s.namespace===namespace),...batch.source,contentSha256:digest});ingestion.sources.sort((a,b)=>a.namespace<b.namespace?-1:1);
 const oldObservations=new Map(project.ingestion.observations.map(o=>[key(o),o])),observations=new Map(oldObservations);
 const incoming=[];
 for(const o of batch.observations){
  const k=identity(namespace,o.sourceId),old=oldObservations.get(k),next={...o,namespace,retrievedAt:batch.retrievedAt,disposition:old?.disposition??'auto',codes:[]};
  if(old){
   for(const field of ['name','direction','url'])if(next[field]===null)next[field]=old[field];
   if(next.speedKmh===null){next.speedKmh=old.speedKmh;next.originalSpeed=old.originalSpeed;}
   if(!Object.hasOwn(o.originalProperties,'status')&&next.status==='unknown')next.status=old.status;
   next.originalProperties={...old.originalProperties,...next.originalProperties};
  }
  observations.set(k,next);incoming.push(next);
 }
 incoming.sort(order);
 const index=createProximityIndex();
 for(const r of project.records){const original=checked.originals.get(r.id)??checked.originals.get(r.templateId);
  index.add([r.edits.longitude??original.longitude,r.edits.latitude??original.latitude],`record:${r.id}`);
 }
 for(const o of observations.values())if(o.geometry.type==='Point')index.add(o.geometry.coordinates,key(o));
 const records=[...project.records],recordIndices=new Map(records.map((r,i)=>[r.id,i]));let nextId=project.nextId,recordsChanged=false;
 const bindings=new Map(ingestion.bindings.map(b=>[key(b),b])),owners=new Map(ingestion.ownership.map(o=>[o.recordId,o.coordinates]));
 const policies=new Map(ingestion.policies.map(p=>[identity(p.namespace,p.kind),p]));
 const summary={added:0,updated:0,unchanged:0,protected:0,referenceOnly:0,ambiguous:0,items:[]};
 for(const o of incoming){
  const k=key(o),binding=bindings.get(k),codes=[];let recordId=binding?.recordId??null,changed=false;
  if(binding){
   const i=recordIndices.get(recordId),record=records[i],owner=owners.get(recordId);
   if(!supported(o)){
    o.disposition='reference';
    codes.push('UNSUPPORTED');ingestion.bindings=ingestion.bindings.filter(b=>key(b)!==k);detachOwner(ingestion,namespace,o.sourceId);
    recordId=null;summary.referenceOnly++;
   }
   else if(record.deleted){codes.push('DELETED');summary.protected++;}
   else if(!owner||owner==='manual'||identity(owner.namespace,owner.sourceId)!==k){codes.push('MANUAL_PROTECTED');summary.protected++;}
   else {
    const [longitude,latitude]=o.geometry.coordinates;
    if(record.edits.latitude!==latitude||record.edits.longitude!==longitude){records[i]={...record,edits:{...record.edits,latitude,longitude}};changed=true;recordsChanged=true;}
   }
   if(supported(o)&&o.status!=='active')codes.push('NOT_ACTIVE');
  }else{
   if(o.disposition==='reference')codes.push('REFERENCE_ONLY');
   else if(!supported(o))codes.push('UNSUPPORTED');
   else if(o.status!=='active')codes.push('NOT_ACTIVE');
   else if(index.hasNearby(o.geometry.coordinates,k)){codes.push('POSSIBLE_DUPLICATE');summary.ambiguous++;}
   else if(!policies.has(identity(namespace,o.kind)))codes.push('NO_TEMPLATE');
   else {
    const policy=policies.get(identity(namespace,o.kind)),[longitude,latitude]=o.geometry.coordinates;
    recordId=`new:${nextId++}`;
    records.push({id:recordId,sourceOffset:null,templateId:policy.templateId,edits:{latitude,longitude},deleted:false,provenance:[{source:namespace,sourceId:o.sourceId}]});
    ingestion.bindings.push({namespace,sourceId:o.sourceId,recordId});ingestion.ownership.push({recordId,coordinates:{namespace,sourceId:o.sourceId}});
    summary.added++;recordsChanged=true;
   }
   if(!recordId)summary.referenceOnly++;
  }
  o.codes=codes;
  const old=oldObservations.get(k);
  if(old&&equal({...old,retrievedAt:''},{...o,retrievedAt:''}))o.retrievedAt=old.retrievedAt;
  else if(old)changed=true;
  if(changed)summary.updated++;else if(old)summary.unchanged++;
  summary.items.push({namespace,sourceId:o.sourceId,recordId,codes});
 }
 ingestion.observations=[...observations.values()].sort(order);ingestion.bindings.sort(order);
 ingestion.ownership.sort((a,b)=>a.recordId<b.recordId?-1:1);
 if(!recordsChanged&&equal(ingestion,project.ingestion))return {project,summary};
 return {project:applyImportTransaction(project,{records,nextId,ingestion}),summary};
}

export async function resolveImport(project,{namespace,sourceId,action,recordId}){
 project=upgradeProject(project);inspectProject(project);
 const k=identity(namespace,sourceId),o=project.ingestion.observations.find(o=>key(o)===k);
 requireImport(o&&['bind','reference','add-distinct'].includes(action),'resolution');
 const ingestion={...project.ingestion,observations:project.ingestion.observations.map(v=>key(v)===k?{...v,codes:[],disposition:action==='reference'?'reference':'auto'}:v),bindings:project.ingestion.bindings.filter(b=>key(b)!==k),ownership:[...project.ingestion.ownership]};
 detachOwner(ingestion,namespace,sourceId);
 if(action==='reference')return applyImportTransaction(project,{ingestion});
 requireImport(supported(o),'resolution');
 if(action==='bind'){
  const record=project.records.find(r=>r.id===recordId);requireImport(record,'recordId');
  ingestion.bindings.push({namespace,sourceId,recordId});
  if(!ownerOf(project,recordId))ingestion.ownership.push({recordId,coordinates:'manual'});
  return applyImportTransaction(project,{ingestion});
 }
 requireImport(o.status==='active','status');
 const policy=ingestion.policies.find(p=>p.namespace===namespace&&p.kind===o.kind);requireImport(policy,'template');
 const id=`new:${project.nextId}`,[longitude,latitude]=o.geometry.coordinates;
 ingestion.bindings.push({namespace,sourceId,recordId:id});ingestion.ownership.push({recordId:id,coordinates:{namespace,sourceId}});
 return applyImportTransaction(project,{ingestion,nextId:project.nextId+1,records:[...project.records,
  {id,sourceOffset:null,templateId:policy.templateId,edits:{latitude,longitude},deleted:false,provenance:[{source:namespace,sourceId}]}]});
}
