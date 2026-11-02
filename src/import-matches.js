import {hasPosition} from './project-view.js';
import {decodeBinSpeed} from './bin-metadata.js';

const R=6371008.8,RAD=Math.PI/180,RADIUS=100,LAT_RADIUS=RADIUS/(R*RAD);
const recordId=r=>r.id??`source:${r.offset}`;
const position=r=>[r.longitude,r.latitude];
const validPoint=p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Math.abs(p[0])<=180&&Number.isFinite(p[1])&&Math.abs(p[1])<=90;
function distance(a,b){
 const x=Math.sin((b[1]-a[1])*RAD/2),y=Math.sin((b[0]-a[0])*RAD/2);
 return 2*R*Math.asin(Math.min(1,Math.sqrt(x*x+Math.cos(a[1]*RAD)*Math.cos(b[1]*RAD)*y*y)));
}
const describe=r=>({id:recordId(r),latitude:r.latitude,longitude:r.longitude,rawType:r.typeRaw,typeRaw:r.typeRaw,rawBytes16To19:[...r.rawBytes16To19],rawSpeed:r.rawBytes16To19[0],decodedSpeed:decodeBinSpeed(r.rawBytes16To19[0])});

/** Pure geometric suggestions: callers must review identity and explicitly choose associations. */
export function findImportMatches({records,references}){
 const active=records.filter(r=>!r.deleted&&hasPosition(r)),byId=new Map(active.map(r=>[recordId(r),r]));
 const byOffset=new Map(active.filter(r=>Number.isInteger(r.offset??r.originalSourceOffset)).map(r=>[r.offset??r.originalSourceOffset,r]));
 const sorted=[...active].sort((a,b)=>a.latitude-b.latitude);
 function nearby(xy){
  let lo=0,hi=sorted.length;while(lo<hi){const mid=(lo+hi)>>>1;if(sorted[mid].latitude<xy[1]-LAT_RADIUS)lo=mid+1;else hi=mid;}
  const result=[];for(let i=lo;i<sorted.length&&sorted[i].latitude<=xy[1]+LAT_RADIUS;i++){
   const r=sorted[i],metres=distance(xy,position(r));if(metres<=RADIUS)result.push({r,metres});
  }return result;
 }
 const endpointPairs=new Map();
 for(const a of active.filter(r=>r.typeRaw===964)){
  const b=a.linkTargetId?byId.get(a.linkTargetId):byOffset.get(a.linkRaw??a.originalLinkRaw);
  if(!b||b.typeRaw!==9128||distance(position(a),position(b))===0)continue;
  const pair={a,b};for(const endpoint of [a,b]){const id=recordId(endpoint);if(!endpointPairs.has(id))endpointPairs.set(id,[]);endpointPairs.get(id).push(pair);}
 }
 const rows=references.map(reference=>{
  const limits=reference.originalProperties?.canardDetail?.raw?.limity;
  const boundRecordIds=[...new Set(reference.recordIds?.length?reference.recordIds:reference.recordId?[reference.recordId]:[])];
  const row={id:reference.id??`import:${JSON.stringify([reference.namespace,reference.sourceId])}`,namespace:reference.namespace,sourceId:reference.sourceId,kind:reference.kind,name:reference.name??null,
   geometry:structuredClone(reference.geometry),direction:reference.direction??null,sourceSpeedKmh:reference.speedKmh??null,sourceStatus:reference.status??'unknown',originalProperties:structuredClone(reference.originalProperties??{}),
   directions:[...new Set((Array.isArray(limits)?limits:[]).map(limit=>limit?.typ?.kierunek).filter(value=>typeof value==='string'&&value.trim()))],
   boundRecordIds,candidates:[],identityVerified:false,contestedRecordIds:[],bulkSafe:false};
  const geometry=reference.geometry;
  if(geometry?.type==='Point'&&validPoint(geometry.coordinates)&&['camera','red-light'].includes(reference.kind)){
   for(const {r,metres}of nearby(geometry.coordinates))if(reference.kind==='red-light'?r.typeRaw===3:[1,5].includes(r.typeRaw)){
    row.candidates.push({recordIds:[recordId(r)],records:[describe(r)],metres,identityVerified:false});
   }
  }else if(reference.kind==='section'&&geometry?.type==='LineString'&&geometry.coordinates.length>=2&&geometry.coordinates.every(validPoint)){
   const a=geometry.coordinates[0],b=geometry.coordinates.at(-1),span=distance(a,b),seen=new Set();
   if(span>0)for(const {r}of nearby(a))for(const pair of endpointPairs.get(recordId(r))??[]){
    const id=recordId(pair.a);if(seen.has(id))continue;seen.add(id);
    const c=position(pair.a),d=position(pair.b),direct=[distance(a,c),distance(b,d)],reverse=[distance(a,d),distance(b,c)];
    const reversed=Math.max(...reverse)<Math.max(...direct),endpointMetres=reversed?reverse:direct,maxEndpointMetres=Math.max(...endpointMetres);
    const spanDifferenceMetres=distance(c,d)-span;
    if(maxEndpointMetres>RADIUS||Math.abs(spanDifferenceMetres)>Math.max(20,span*.1))continue;
    row.candidates.push({recordIds:[recordId(pair.a),recordId(pair.b)],records:[describe(pair.a),describe(pair.b)],endpointMetres,maxEndpointMetres,orientation:reversed?'reversed':'direct',
     orientationUncertain:Math.max(...direct)<=RADIUS&&Math.max(...reverse)<=RADIUS,spanDifferenceMetres,identityVerified:false,routeVerified:false});
   }
  }
  row.candidates.sort((a,b)=>(a.metres??a.maxEndpointMetres)-(b.metres??b.maxEndpointMetres)||a.recordIds.join(',').localeCompare(b.recordIds.join(',')));
  return row;
 });
 const owners=new Map(),key=(namespace,id)=>JSON.stringify([namespace,id]);
 for(const row of rows)for(const id of row.boundRecordIds.length?row.boundRecordIds:row.candidates.flatMap(c=>c.recordIds)){
  const k=key(row.namespace,id);if(!owners.has(k))owners.set(k,new Set());owners.get(k).add(row.id);
 }
 const summary={total:rows.length,unique:0,ambiguous:0,unmatched:0,bound:0};
 for(const row of rows){
  row.contestedRecordIds=[...new Set(row.candidates.flatMap(c=>c.recordIds).filter(id=>owners.get(key(row.namespace,id))?.size>1))].sort();
  row.status=row.boundRecordIds.length?'bound':!row.candidates.length?'unmatched':row.candidates.length>1||row.contestedRecordIds.length||row.candidates[0].orientationUncertain?'ambiguous':'unique';
  row.bulkSafe=row.status==='unique';summary[row.status]++;
 }
 return {rows,summary};
}
