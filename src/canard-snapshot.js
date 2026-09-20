import {normalizeBatch,plainObject,jsonCopy} from './import-normalize.js';
export const CANARD_NAMESPACE='pl.gitd.canard.public-map';
const SOURCE_URL='https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen';
const LIMIT=20*1024*1024,HEX=/^[a-f0-9]{64}$/;
const categories=['PP','OPP','RL'];
const coverage={PP:'available',OPP:'available',RL:'available',PK:'unavailable'};
const check=(ok,code='CANARD_INVALID_SNAPSHOT')=>{if(!ok)throw Object.assign(new Error(code),{code});};
const exact=(value,fields)=>check(plainObject(value)&&Object.keys(value).length===fields.length&&fields.every(k=>Object.hasOwn(value,k)));
export const canonical=value=>JSON.stringify(jsonCopy(value));
const encode=value=>new TextEncoder().encode(canonical(value)+'\n');
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function timestamp(value){check(typeof value==='string'&&/^\d{4}-\d\d-\d\dT/.test(value)&&Number.isFinite(Date.parse(value)));return Date.parse(value);}

export function validateNotices(value){
 exact(value,['attribution','sourceUrl','termsUrl','licenceLabel','licenceUrl','disclaimerPl','disclaimerEn','transformation','transformationVersion','reviewedTermsSha256']);
 for(const [key,text] of Object.entries(value))if(key!=='transformationVersion')check(typeof text==='string'&&text.trim().length>0&&text.length<=4096&&text.isWellFormed());
 check(Number.isSafeInteger(value.transformationVersion)&&value.transformationVersion>0&&HEX.test(value.reviewedTermsSha256));
 for(const key of ['sourceUrl','termsUrl','licenceUrl']){let url;try{url=new URL(value[key]);}catch{check(false);}check(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password);}
 return structuredClone(value);
}

export function validateManifest(value,{now=Date.now()}={}){
 check(value?.schemaVersion===1);
 if(value.state==='disabled'){
  exact(value,['schemaVersion','state','checkedAt','reasonCode','messagePl','messageEn']);
  check(value.reasonCode==='RIGHTS_REVIEW');
  for(const key of ['messagePl','messageEn'])check(typeof value[key]==='string'&&value[key].trim().length>0&&value[key].length<=4096);
 }else{
  exact(value,['schemaVersion','state','sha256','byteLength','path','counts','total','retrievedAt','checkedAt','noticePath']);
  check(value.state==='active'&&HEX.test(value.sha256)&&value.path===`data/canard/snapshot-${value.sha256}.json`&&value.noticePath==='data/canard/NOTICE.json');
  check(Number.isSafeInteger(value.byteLength)&&value.byteLength>0&&value.byteLength<=LIMIT);
  exact(value.counts,['PP','OPP','RL','PK']);check(value.counts.PK===null);
  for(const c of categories)check(Number.isSafeInteger(value.counts[c])&&value.counts[c]>=0&&value.counts[c]<=100000);
  check(value.total===categories.reduce((sum,c)=>sum+value.counts[c],0)&&value.total<=100000);
  check(timestamp(value.retrievedAt)<=timestamp(value.checkedAt));
 }
 check(timestamp(value.checkedAt)<=Number(now)+300000);
 return structuredClone(value);
}

function normalized(batch){
 const result=normalizeBatch(batch);
 check(result.source.namespace===CANARD_NAMESPACE&&result.source.attribution==='GITD / CANARD'&&result.source.url===SOURCE_URL);
 for(const observation of result.observations){
  let id;try{id=JSON.parse(observation.sourceId);}catch{check(false);}
  check(Array.isArray(id)&&id.length===2&&categories.includes(id[0])&&typeof id[1]==='string'&&id[1].trim()!==''&&observation.sourceId===JSON.stringify(id));
  check(observation.originalProperties.sourceCategory===id[0]&&observation.kind==={PP:'camera',OPP:'section',RL:'red-light'}[id[0]]);
 }
 result.observations.sort((a,b)=>a.sourceId<b.sourceId?-1:a.sourceId>b.sourceId?1:0);
 return result;
}
function countsFor(batch){const counts={PP:0,OPP:0,RL:0,PK:null};for(const o of batch.observations)counts[JSON.parse(o.sourceId)[0]]++;return counts;}

export async function validateSnapshot(bytes,manifest){
 const m=validateManifest(manifest);check(m.state==='active'&&bytes instanceof Uint8Array&&bytes.byteLength===m.byteLength);
 check(await sha256(bytes)===m.sha256);
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{check(false);}
 exact(value,['schemaVersion','batch','notices','coverage']);check(value.schemaVersion===1&&canonical(value.coverage)===canonical(coverage));
 const batch=normalized(value.batch),notices=validateNotices(value.notices);
 check(notices.sourceUrl===SOURCE_URL&&notices.attribution===batch.source.attribution);
 check(canonical(batch)===canonical(value.batch)&&batch.retrievedAt===m.retrievedAt);
 check(canonical(countsFor(batch))===canonical(m.counts)&&batch.observations.length===m.total);
 return {schemaVersion:1,batch,notices,coverage:structuredClone(coverage)};
}

export async function prepareSnapshot({batch,notices,previous=null,checkedAt,review}){
 const current=normalized(batch),notice=validateNotices(notices);
 const prior=previous?await validateSnapshot(previous.bytes,previous.manifest):null;
 if(previous)check(timestamp(checkedAt)>=timestamp(previous.manifest.checkedAt));
 const semantic=b=>({source:b.source,observations:b.observations});
 const same=prior&&canonical(semantic(prior.batch))===canonical(semantic(current))&&canonical(prior.notices)===canonical(notice);
 const value={schemaVersion:1,batch:same?prior.batch:current,notices:notice,coverage};
 const bytes=same?previous.bytes.slice():encode(value);check(bytes.length<=LIMIT);
 const hash=await sha256(bytes);
 if(prior&&review?.reviewedCandidateSha256!==hash){
  for(const category of categories){
   const ids=b=>new Set(b.observations.filter(o=>JSON.parse(o.sourceId)[0]===category).map(o=>o.sourceId));
   const before=ids(prior.batch),after=ids(current),overlap=[...before].filter(id=>after.has(id)).length;
   check(!before.size||(after.size>0&&after.size>=before.size*.8&&overlap>=before.size*.8),'CANARD_REVIEW_REQUIRED');
  }
 }
 const manifest={schemaVersion:1,state:'active',sha256:hash,byteLength:bytes.length,path:`data/canard/snapshot-${hash}.json`,
  counts:countsFor(value.batch),total:value.batch.observations.length,retrievedAt:value.batch.retrievedAt,checkedAt,noticePath:'data/canard/NOTICE.json'};
 await validateSnapshot(bytes,manifest);
 return {manifest,bytes,noticeBytes:encode(notice),changed:!same};
}
