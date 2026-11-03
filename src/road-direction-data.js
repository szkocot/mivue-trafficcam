import {normalizeBatch,plainObject,jsonCopy,byteLength} from './import-normalize.js';
import {roadDirectionInputKey} from './road-directions.js';
import {CANARD_NAMESPACE} from './canard-snapshot.js';
export const ROAD_DIRECTION_NOTICE={attribution:'© OpenStreetMap contributors; road context prepared from Geofabrik extracts',sourceUrl:'https://www.openstreetmap.org/copyright',termsUrl:'https://www.openstreetmap.org/copyright',licenceLabel:'Open Database Licence (ODbL) 1.0 — road-derived direction evidence',licenceUrl:'https://opendatacommons.org/licenses/odbl/1-0/',transformation:'Local road topology and destination evidence used to estimate vehicle travel direction. Estimates are not physical camera azimuths; original CANARD evidence is retained separately.'};
const bearings=v=>Array.isArray(v)&&v.length<=32&&v.every(n=>Number.isFinite(n)&&n>=0&&n<360);
const https=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
function boundedJson(value,maxBytes=65536){
 const ancestors=new Set();let size=0,items=0;
 function visit(v,depth){
  if(++items>1000000||depth>20)return false;
  if(v===null||typeof v==='boolean'){size+=5;return size<=maxBytes;}
  if(typeof v==='number'){size+=24;return Number.isFinite(v)&&size<=maxBytes;}
  if(typeof v==='string'){if(v.length>maxBytes)return false;size+=byteLength(v)+2;return size<=maxBytes;}
  if(!Array.isArray(v)&&!plainObject(v)||ancestors.has(v)||Array.isArray(v)&&v.length>maxBytes)return false;
  ancestors.add(v);const entries=Array.isArray(v)?v.map(x=>[null,x]):Object.entries(v);size+=entries.length+2;
  if(size>maxBytes)return false;for(const [k,x]of entries)if(k!==null&&!visit(k,depth+1)||!visit(x,depth+1))return false;
  ancestors.delete(v);return true;
 }return visit(value,0);
}
export function validRoadSource(source){try{return plainObject(source)&&boundedJson(source,16384)&&https(source.url)&&typeof source.attribution==='string'&&source.attribution.length>0&&source.attribution.length<=4096&&https(source.licenceUrl)&&/^[a-f0-9]{64}$/.test(source.sha256??'')&&typeof source.dataTimestamp==='string'&&Number.isFinite(Date.parse(source.dataTimestamp))&&typeof source.complete==='boolean';}catch{return false;}}
const sameBearings=(a,b)=>a.length===b.length&&a.every(n=>b.some(v=>Math.abs(n-v)<1e-6));
const distinct=values=>values.reduce((out,n)=>{if(!out.some(v=>Math.abs(((v-n+540)%360)-180)<20))out.push(n);return out;},[]);
const id=v=>typeof v==='string'&&v.length>0&&v.length<=256||Number.isSafeInteger(v);
const number=(v,max)=>Number.isFinite(v)&&v>=0&&v<=max;
/** Invalid, foreign or stale annotations cannot make directional candidates automatically eligible. */
export function getRoadDirection(reference){try{
 const r=reference?.originalProperties?.canardRoadDirection;
 if(reference?.namespace!==undefined&&reference.namespace!==CANARD_NAMESPACE)return null;
 if(!plainObject(r)||!boundedJson(r)||r.schemaVersion!==1||!['resolved','ambiguous','unresolved'].includes(r.status)||!['high','medium','none'].includes(r.confidence)||r.inputKey!==roadDirectionInputKey(reference)||!validRoadSource(r.source)||r.physicalAim!==null||!bearings(r.travelBearings)||!bearings(r.excludedBearings)||!Array.isArray(r.claims)||r.claims.length>32)return null;
 if(r.status==='resolved'&&(!r.claims.length||r.claims.some(c=>c?.status!=='resolved')||r.confidence==='none'))return null;
 if(r.status!=='resolved'&&r.confidence!=='none')return null;
 for(const c of r.claims){
  if(!plainObject(c)||typeof c.raw!=='string'||c.raw.length>4096||typeof c.destination!=='string'||c.destination.length>4096||typeof c.excluded!=='boolean'||!['resolved','ambiguous','unresolved'].includes(c.status)||!bearings(c.bearings)||!plainObject(c.evidence))return null;
  const e=c.evidence;if(!Array.isArray(e.wayIds)||e.wayIds.length>32||!e.wayIds.every(id))return null;
  if(c.status==='resolved'){
   if(!c.bearings.length||!e.wayIds.length||!['graph-route','destination-tag'].includes(e.method)||!number(e.snapMetres,5000))return null;
   if(e.method==='graph-route'&&(!r.source.complete||!id(e.placeId)||!number(e.routeMetres,1000000)))return null;
   if(reference.geometry?.type==='LineString'){
    const entry=e.endpointOrientation==='forward'?0:e.endpointOrientation==='reverse'?1:null;
    if(entry===null||e.entryEndpointIndex!==entry||e.exitEndpointIndex!==1-entry||!bearings(e.endpointBearings)||e.endpointBearings.length!==2||!sameBearings(c.bearings,[e.endpointBearings[0]]))return null;
   }else if(['endpointBearings','endpointOrientation','entryEndpointIndex','exitEndpointIndex'].some(k=>e[k]!==undefined))return null;
  }else{
   if(e.method!==null&&!['graph-route','destination-tag'].includes(e.method))return null;
   if(e.endpointBearings!==undefined&&(!bearings(e.endpointBearings)||e.endpointBearings.length!==2))return null;
   if(e.endpointOrientation!==undefined&&!['forward','reverse'].includes(e.endpointOrientation))return null;
  }
 }
 const selected=excluded=>distinct(r.claims.filter(c=>c.status==='resolved'&&c.excluded===excluded).flatMap(c=>c.bearings));
 if(!sameBearings(r.travelBearings,selected(false))||!sameBearings(r.excludedBearings,selected(true)))return null;
 if(r.status==='resolved'&&r.confidence==='high'&&r.claims.some(c=>c.evidence.method!=='destination-tag'))return null;
 return r;
}catch{return null;}}
export function applyRoadDirectionData(input,data){
 const fail=()=>{throw Object.assign(Error('Invalid road direction dataset'),{code:'ROAD_DIRECTION_DATA_INVALID'});};
 if(data?.schema!=='mivue-canard-road-directions'||data.version!==1||!validRoadSource(data.source)||!plainObject(data.resolutions)||Object.keys(data.resolutions).length>100000||!boundedJson(data,20*1024*1024))fail();
 const batch=normalizeBatch(input);if(batch.source.namespace!==CANARD_NAMESPACE)fail();
 const sourceKey=JSON.stringify(jsonCopy(data.source));let total=0;
 const observations=batch.observations.map(o=>{
  const candidate=Object.hasOwn(data.resolutions,o.sourceId)?data.resolutions[o.sourceId]:null,reference={...o,namespace:batch.source.namespace,originalProperties:{...o.originalProperties,canardRoadDirection:candidate}};
  const valid=getRoadDirection(reference),current=valid&&JSON.stringify(jsonCopy(valid.source))===sourceKey?valid:null;
  const resolution=current??{schemaVersion:1,inputKey:roadDirectionInputKey(o),status:'unresolved',confidence:'none',travelBearings:[],excludedBearings:[],claims:[],source:data.source,physicalAim:null,reason:candidate?'stale-road-context':'missing-road-context'};
  total+=byteLength(JSON.stringify(resolution));if(total>20*1024*1024)fail();
  return {...o,originalProperties:{...o.originalProperties,canardRoadDirection:structuredClone(resolution)}};
 });
 return normalizeBatch({...batch,observations});
}
