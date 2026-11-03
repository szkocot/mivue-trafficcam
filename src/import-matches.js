import {hasPosition} from './project-view.js';
import {decodeBinSpeed} from './bin-metadata.js';
import {analyzeDirections} from './direction-analysis.js';
import {getRoadDirection} from './road-direction-data.js';

const R=6371008.8,RAD=Math.PI/180,RADIUS=100,LAT_RADIUS=RADIUS/(R*RAD);
const recordId=r=>r.id??`source:${r.offset}`;
const position=r=>[r.longitude,r.latitude];
const validPoint=p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Math.abs(p[0])<=180&&Number.isFinite(p[1])&&Math.abs(p[1])<=90;
function distance(a,b){
 const x=Math.sin((b[1]-a[1])*RAD/2),y=Math.sin((b[0]-a[0])*RAD/2);
 return 2*R*Math.asin(Math.min(1,Math.sqrt(x*x+Math.cos(a[1]*RAD)*Math.cos(b[1]*RAD)*y*y)));
}
const describe=r=>({id:recordId(r),latitude:r.latitude,longitude:r.longitude,rawType:r.typeRaw,typeRaw:r.typeRaw,rawBytes16To19:[...r.rawBytes16To19],rawSpeed:r.rawBytes16To19[0],decodedSpeed:decodeBinSpeed(r.rawBytes16To19[0])});

const angleList=value=>Array.isArray(value)&&value.length<=1000&&value.every(n=>Number.isFinite(n)&&n>=0&&n<=360);
const angleDelta=(a,b)=>Math.min(Math.abs(a-b)%360,360-Math.abs(a-b)%360);
function directionComparison(reference,candidate){
 const annotation=reference.originalProperties?.canardRoadDirection;
 const result={status:'unknown',deltaDegrees:null,mioBearingDegrees:null,travelBearings:[],excludedBearings:[],basis:'road-derived',confidence:'none',reason:annotation?'unresolved-source':'no-road-evidence'};
 const bearing=analyzeDirections({}, {records:[candidate.records[0]]}).mioAlertBearings[0]?.bearingDegrees;
 result.mioBearingDegrees=bearing??null;
 if(!annotation)return result;
 let road;try{road=getRoadDirection(reference);}catch{result.reason='invalid-source-direction-evidence';return result;}
 if(!road||!road.source.complete){result.reason='invalid-road-evidence';return result;}
 result.confidence=road.confidence;
 if(road.status!=='resolved'||road.confidence==='none')return result;
 if(bearing==null){result.reason='mio-heading-unclassified';return result;}
 result.mioBearingDegrees=bearing;
 let allowed=road.travelBearings,excluded=road.excludedBearings;
 if(reference.kind==='section'){
  if(candidate.orientationUncertain){result.reason='section-orientation-uncertain';return result;}
  const entry=candidate.orientation==='reversed'?1:0;
  const resolved=road.claims.filter(c=>c?.status==='resolved'&&typeof c.excluded==='boolean'&&angleList(c.bearings)&&[0,1].includes(c.evidence?.entryEndpointIndex)&&angleList(c.evidence.endpointBearings)&&c.evidence.endpointBearings.length===2&&c.evidence.endpointOrientation===(c.evidence.entryEndpointIndex===0?'forward':'reverse'));
  const relevant=resolved.filter(c=>c.evidence.entryEndpointIndex===entry);
  allowed=relevant.filter(c=>!c.excluded).map(c=>c.evidence.endpointBearings[entry]);excluded=relevant.filter(c=>c.excluded).map(c=>c.evidence.endpointBearings[entry]);
  if(!allowed.length&&!excluded.length){
   if(resolved.some(c=>!c.excluded)){result.status='opposite';result.reason='section-entry-opposite';}
   else result.reason='section-entry-unresolved';
   return result;
  }
 }
 result.travelBearings=[...allowed];result.excludedBearings=[...excluded];
 const delta=allowed.length?Math.min(...allowed.map(n=>angleDelta(bearing,n))):null;
 const excludedDelta=excluded.length?Math.min(...excluded.map(n=>angleDelta(bearing,n))):null;
 result.deltaDegrees=delta;result.excludedDeltaDegrees=excludedDelta;
 if(excludedDelta!==null&&excludedDelta<=60){result.status='excluded';result.reason='excluded-road-bearing';}
 else if(delta!==null){result.status=delta<=60?'agree':'opposite';result.reason='qualified-road-bearing';}
 else result.reason='no-allowed-road-bearing';
 return result;
}
const eligibleCandidates=row=>{
 const agreed=row.candidates.filter(c=>c.directionComparison.status==='agree');
 return agreed.length?agreed:row.candidates.filter(c=>c.directionComparison.status==='unknown');
};

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
  for(const c of row.candidates)c.directionComparison=directionComparison(reference,c);
  const rank={agree:0,unknown:1,opposite:2,excluded:3};
  row.candidates.sort((a,b)=>rank[a.directionComparison.status]-rank[b.directionComparison.status]||(a.metres??a.maxEndpointMetres)-(b.metres??b.maxEndpointMetres)||a.recordIds.join(',').localeCompare(b.recordIds.join(',')));
  row.recommendedRecordIds=[];
  return row;
 });
 const owners=new Map(),key=(namespace,id)=>JSON.stringify([namespace,id]);
 for(const row of rows)for(const id of row.boundRecordIds.length?row.boundRecordIds:eligibleCandidates(row).flatMap(c=>c.recordIds)){
  const k=key(row.namespace,id);if(!owners.has(k))owners.set(k,new Set());owners.get(k).add(row.id);
 }
 const summary={total:rows.length,unique:0,ambiguous:0,unmatched:0,bound:0};
 for(const row of rows){
  const eligible=eligibleCandidates(row),roadAnnotated=Object.hasOwn(row.originalProperties,'canardRoadDirection');
  row.contestedRecordIds=[...new Set(eligible.flatMap(c=>c.recordIds).filter(id=>owners.get(key(row.namespace,id))?.size>1))].sort();
  const safe=eligible.length===1&&!row.contestedRecordIds.length&&!eligible[0].orientationUncertain&&(!roadAnnotated||eligible[0].directionComparison.status==='agree');
  row.status=row.boundRecordIds.length?'bound':!row.candidates.length?'unmatched':safe?'unique':'ambiguous';
  row.bulkSafe=row.status==='unique';if(row.bulkSafe)row.recommendedRecordIds=[...eligible[0].recordIds];summary[row.status]++;
 }
 return {rows,summary};
}
