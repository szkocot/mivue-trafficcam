import { plainObject,identity,stableId,normalizeObservation,normalizeBatch } from './import-normalize.js';
import {validateNotices,CANARD_NAMESPACE} from './canard-snapshot.js';
export const emptyIngestion=()=>({sources:[],observations:[],bindings:[],ownership:[],policies:[]});
const check=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'INVALID_PROJECT'});};
function fields(o,allowed){check(plainObject(o)&&Object.keys(o).every(k=>allowed.includes(k)),'Invalid ingestion fields');}
/** All explicitly associated records; scalar bindings remain readable. */
export const boundRecordIds=b=>b?.recordIds??(b?.recordId?[b.recordId]:[]);

/** Whole point categories or complete effective linked pairs, never proximity guesses. */
export function bindingTargetsSupported(o,ids,records,originals){
 if(!Array.isArray(ids)||!ids.length||ids.some(id=>typeof id!=='string'||!records.has(id))||new Set(ids).size!==ids.length)return false;
 const raw=id=>originals.get(id)??originals.get(records.get(id)?.templateId);
 if(o.geometry.type==='Point'&&['camera','red-light'].includes(o.kind))return ids.every(id=>o.kind==='camera'?[1,5].includes(raw(id)?.typeRaw):raw(id)?.typeRaw===3);
 if(o.geometry.type!=='LineString'||o.kind!=='section')return false;
 const selected=new Set(ids),targets=new Set();let sources=0;
 for(const id of ids){
  const original=raw(id);if(original?.typeRaw===9128)continue;
  if(original?.typeRaw!==964)return false;
  const target=records.get(id).edits.linkResolution?.targetId??`source:${original.linkRaw}`;
  if(!selected.has(target)||raw(target)?.typeRaw!==9128||targets.has(target))return false;
  targets.add(target);sources++;
 }
 return sources>0&&sources*2===ids.length&&targets.size===sources;
}
export function upgradeProject(project){
 if(project.projectVersion===3)return project;
 check([1,2].includes(project.projectVersion),'Unsupported project version');
 const ingestion=project.projectVersion===2?project.ingestion:{...emptyIngestion(),ownership:project.records
  .filter(r=>'latitude'in r.edits||'longitude'in r.edits).map(r=>({recordId:r.id,coordinates:'manual'}))};
 return {...project,projectVersion:3,ingestion:{...ingestion,sources:ingestion.sources.map(s=>({...s,syncEnabled:false}))}};
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
  fields(source,['namespace','attribution','url','contentSha256',...(project.projectVersion===3?['syncEnabled','notices']:[])]);
  if(source.syncEnabled!==undefined)check(typeof source.syncEnabled==='boolean','Invalid source sync setting');
  if(source.notices!==undefined)validateNotices(source.notices);
  if(source.syncEnabled)check(source.namespace===CANARD_NAMESPACE&&source.notices,'Source not eligible for hosted sync');
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
  fields(b,['namespace','sourceId','recordId','recordIds']);const key=identity(b.namespace,b.sourceId),o=observations.get(key);
  check(o&&!bindings.has(key)&&records.has(b.recordId),'Invalid binding');
  if(b.recordIds!==undefined){
   check(Array.isArray(b.recordIds)&&b.recordIds[0]===b.recordId&&originals&&bindingTargetsSupported(o,b.recordIds,records,originals),'Unsupported observation binding');
  }else check(o.geometry.type==='Point'&&['camera','red-light'].includes(o.kind),'Unsupported observation binding');
  bindings.set(key,b);
 }
 const owners=new Set();
 for(const owner of s.ownership){
  fields(owner,['recordId','coordinates']);check(records.has(owner.recordId)&&!owners.has(owner.recordId),'Invalid ownership');owners.add(owner.recordId);
  if(owner.coordinates!=='manual'){
   fields(owner.coordinates,['namespace','sourceId']);
   check(boundRecordIds(bindings.get(identity(owner.coordinates.namespace,owner.coordinates.sourceId))).includes(owner.recordId),'Ownership must refer to binding');
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
