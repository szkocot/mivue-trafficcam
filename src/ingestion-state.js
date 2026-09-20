import { plainObject,identity,stableId,normalizeObservation,normalizeBatch } from './import-normalize.js';
export const emptyIngestion=()=>({sources:[],observations:[],bindings:[],ownership:[],policies:[]});
const check=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'INVALID_PROJECT'});};
function fields(o,allowed){check(plainObject(o)&&Object.keys(o).every(k=>allowed.includes(k)),'Invalid ingestion fields');}
export function upgradeProject(project){
 if(project.projectVersion===2)return project;
 check(project.projectVersion===1,'Unsupported project version');
 return {...project,projectVersion:2,ingestion:{...emptyIngestion(),ownership:project.records
  .filter(r=>'latitude'in r.edits||'longitude'in r.edits).map(r=>({recordId:r.id,coordinates:'manual'}))}};
}
export function isProjectModified(project){
 return project.records.some(r=>r.deleted||r.sourceOffset===null||Object.keys(r.edits).length>0||r.provenance.length>0)
  ||Object.values(project.ingestion??{}).some(a=>a.length>0);
}
export function validateIngestionState(project,originals){
 if(project.projectVersion===1)return;
 const s=project.ingestion;fields(s,['sources','observations','bindings','ownership','policies']);
 for(const key of ['sources','observations','bindings','ownership','policies'])check(Array.isArray(s[key]),`Missing ${key}`);
 const sources=new Map(),observations=new Map(),bindings=new Map(),records=new Map(project.records.map(r=>[r.id,r]));
 for(const source of s.sources){
  fields(source,['namespace','attribution','url','contentSha256']);
  normalizeBatch({source,retrievedAt:'2026-01-01T00:00:00.000Z',observations:[]});
  check(typeof source.namespace==='string'&&!sources.has(source.namespace),'Duplicate source');
  if(source.contentSha256!==undefined)check(/^[a-f0-9]{64}$/.test(source.contentSha256),'Invalid source digest');
  sources.set(source.namespace,source);
 }
 for(const o of s.observations){
  fields(o,['sourceId','kind','status','geometry','name','speedKmh','originalSpeed','direction','url','originalProperties','namespace','retrievedAt','disposition','codes']);
  normalizeObservation(o);check(typeof o.sourceId==='string'&&sources.has(o.namespace),'Unknown observation source');
  check(typeof o.retrievedAt==='string'&&Number.isFinite(Date.parse(o.retrievedAt)),'Invalid retrieval time');
  check(['auto','reference'].includes(o.disposition)&&Array.isArray(o.codes)&&o.codes.every(c=>typeof c==='string'&&c.length<=80),'Invalid observation state');
  const key=identity(o.namespace,o.sourceId);check(!observations.has(key),'Duplicate observation');observations.set(key,o);
 }
 for(const b of s.bindings){
  fields(b,['namespace','sourceId','recordId']);const key=identity(b.namespace,b.sourceId),o=observations.get(key);
  check(o&&!bindings.has(key)&&records.has(b.recordId),'Invalid binding');
  check(o.geometry.type==='Point'&&['camera','red-light'].includes(o.kind),'Unsupported observation binding');
  bindings.set(key,b);
 }
 const owners=new Set();
 for(const owner of s.ownership){
  fields(owner,['recordId','coordinates']);check(records.has(owner.recordId)&&!owners.has(owner.recordId),'Invalid ownership');owners.add(owner.recordId);
  if(owner.coordinates!=='manual'){
   fields(owner.coordinates,['namespace','sourceId']);
   check(bindings.get(identity(owner.coordinates.namespace,owner.coordinates.sourceId))?.recordId===owner.recordId,'Ownership must refer to binding');
  }
 }
 const policies=new Set();
 for(const p of s.policies){
  fields(p,['namespace','kind','templateId']);stableId(p.namespace,'namespace');
  check(['camera','red-light'].includes(p.kind),'Unsupported template kind');const key=identity(p.namespace,p.kind);
  const template=records.get(p.templateId);check(!policies.has(key)&&template?.sourceOffset!==null&&template,'Invalid policy');policies.add(key);
  if(originals){const raw=originals.get(p.templateId);check(raw&&[1,3,5].includes(raw.typeRaw)&&raw.linkRaw===0,'Unsupported template');}
 }
}
