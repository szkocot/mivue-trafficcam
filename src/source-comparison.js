import {decodeBinSpeed,decodeBinType,BIN_METADATA_SCOPE} from './bin-metadata.js';
import {createProximityIndex} from './import-spatial.js';
import {hasPosition} from './project-view.js';

export const COMPARISON_RADIUS_METRES=100;
const R=6371008.8,RAD=Math.PI/180;
const position=r=>[r.longitude,r.latitude];
const distance=(a,b)=>{
 const x=Math.sin((b[1]-a[1])*RAD/2),y=Math.sin((b[0]-a[0])*RAD/2);
 return 2*R*Math.asin(Math.min(1,Math.sqrt(x*x+Math.cos(a[1]*RAD)*Math.cos(b[1]*RAD)*y*y)));
};
const recordId=r=>r.id??`source:${r.offset}`;
const describe=r=>({id:recordId(r),coordinates:position(r),rawType:r.typeRaw,rawSpeed:r.rawBytes16To19[0],rawBytes16To19:[...r.rawBytes16To19],decodedSpeed:decodeBinSpeed(r.rawBytes16To19[0]),decodedType:decodeBinType(r.typeRaw)});

// Connector overlap is review evidence only: these segments are not surveyed road routes.
function connectorOverlap(a,b,c,d){
 const scale=R*RAD,cos=Math.cos((a[1]+b[1])*RAD/2);
 const xy=p=>[(p[0]-a[0])*scale*cos,(p[1]-a[1])*scale];
 const v=xy(b),length=Math.hypot(...v);if(!length)return false;
 const q=[c,d].map(xy),along=q.map(p=>(p[0]*v[0]+p[1]*v[1])/length);
 const perpendicular=q.map(p=>Math.abs(p[0]*v[1]-p[1]*v[0])/length);
 return perpendicular.every(x=>x<=COMPARISON_RADIUS_METRES)&&Math.min(length,Math.max(...along))>Math.max(0,Math.min(...along));
}

function speedInventory(records){
 const histogram={},byRawType={},rawZeroIds=[],decodedCounts={known:0,unspecified:0,unclassified:0};
 for(const r of records){
  const value=r.rawBytes16To19[0];decodedCounts[decodeBinSpeed(value).status]++;histogram[value]=(histogram[value]??0)+1;
  const group=byRawType[r.typeRaw]??={total:0,rawZero:0,histogram:{}};
  group.total++;if(value===0){group.rawZero++;rawZeroIds.push(recordId(r));}group.histogram[value]=(group.histogram[value]??0)+1;
 }
 return {total:records.length,rawZero:rawZeroIds.length,rawZeroIds,byRawType,histogram,decodedCounts};
}

/** Compare validated observations with decoded BIN records; never establish identity by proximity. */
export function compareCanardMio({database,batch,classifier,countryId}){
 const records=database.records.filter(r=>!r.deleted),valid=records.filter(hasPosition);
 const byOffset=new Map(database.records.filter(r=>Number.isInteger(r.offset??r.originalSourceOffset)).map(r=>[r.offset??r.originalSourceOffset,r]));
 const byId=new Map(database.records.map(r=>[recordId(r),r]));
 const scopeById=new Map(records.map(r=>[recordId(r),classifier.classify(r)]));
 const inScope=r=>scopeById.get(recordId(r)).countryIds.includes(countryId);
 const scoped=valid.filter(inScope),index=createProximityIndex(),used=new Set(),usedPairs=new Set();
 for(const r of valid)index.add(position(r),recordId(r));
 const linkProblems=[],pairs=[];
 for(const r of records.filter(r=>r.typeRaw===964)){
  const target=r.linkTargetId?byId.get(r.linkTargetId):byOffset.get(r.linkRaw??r.originalLinkRaw);
  const problem=!target?'LINK_TARGET_MISSING':target.deleted?'LINK_TARGET_DELETED':target.typeRaw!==9128?'LINK_TARGET_TYPE':!hasPosition(r)||!hasPosition(target)?'INVALID_COORDINATE':distance(position(r),position(target))===0?'DEGENERATE_PAIR':null;
  if(problem){linkProblems.push({id:recordId(r),targetOffset:r.linkRaw??r.originalLinkRaw,code:problem,inScope:inScope(r)});continue;}
  pairs.push({id:recordId(r),a:r,b:target,inScope:inScope(r)||inScope(target)});
 }
 const pointRows=[],sectionRows=[];
 for(const o of batch.observations){
  if(o.originalProperties.sourceCategory==='OPP'&&(o.geometry.type!=='LineString'||o.geometry.coordinates.length!==2))throw Error('CANARD OPP comparison requires exactly two endpoints');
  const endpoints=o.geometry.type==='Point'?[o.geometry.coordinates]:[o.geometry.coordinates[0],o.geometry.coordinates.at(-1)];
  const row={sourceId:o.sourceId,category:o.originalProperties.sourceCategory,geometry:structuredClone(o.geometry),sourceSpeedKmh:o.speedKmh,sourceDirection:o.direction,sourceOperationalStatus:o.status,sourceMetadata:structuredClone(o.originalProperties),
   originalSpeed:structuredClone(o.originalSpeed),countryClassifications:endpoints.map(([longitude,latitude])=>classifier.classify({longitude,latitude})),identityVerified:false,routeVerified:false};
  if(o.geometry.type==='Point'){
   const xy=o.geometry.coordinates,candidates=[];
   if(index.hasNearby(xy))for(const r of valid){
    if(Math.abs(r.latitude-xy[1])>COMPARISON_RADIUS_METRES/(R*RAD))continue;
    const metres=distance(xy,position(r));if(metres<=COMPARISON_RADIUS_METRES)candidates.push({...describe(r),metres});
   }
   candidates.sort((a,b)=>a.metres-b.metres||a.id.localeCompare(b.id));for(const c of candidates)used.add(c.id);
   pointRows.push({...row,status:candidates.length>1?'ambiguous':candidates.length?'spatial-candidate':'canard-only',candidates});
  }else{
   const a=o.geometry.coordinates[0],b=o.geometry.coordinates.at(-1),span=distance(a,b),candidates=[];
   for(const pair of pairs){
    const c=position(pair.a),d=position(pair.b),direct=[distance(a,c),distance(b,d)],reverse=[distance(a,d),distance(b,c)];
    const nearest=Math.min(...direct,...reverse),overlap=connectorOverlap(a,b,c,d);if(nearest>COMPARISON_RADIUS_METRES&&!overlap)continue;
    // Retain a shared endpoint even when minimax alone favours an unrelated reversed range.
    const directNear=direct.filter(x=>x<=COMPARISON_RADIUS_METRES).length,reverseNear=reverse.filter(x=>x<=COMPARISON_RADIUS_METRES).length;
    const reversed=directNear!==reverseNear?reverseNear>directNear:Math.max(...reverse)<Math.max(...direct),ends=reversed?reverse:direct,max=Math.max(...ends),min=Math.min(...ends);
    const mioSpan=distance(c,d),delta=mioSpan-span,orientationUncertain=Math.max(...direct)<=COMPARISON_RADIUS_METRES&&Math.max(...reverse)<=COMPARISON_RADIUS_METRES;
    const rangeWithinTolerance=max<=COMPARISON_RADIUS_METRES&&Math.abs(delta)<=Math.max(20,span*.1)&&!orientationUncertain;
    candidates.push({id:pair.id,endpoints:[describe(pair.a),describe(pair.b)],orientation:reversed?'reversed':'direct',orientationUncertain,
     endpointMetres:ends,allEndpointDistances:{direct,reversed:reverse},nearestEndpointMetres:nearest,maxEndpointMetres:max,oneSided:min<=COMPARISON_RADIUS_METRES&&max>COMPARISON_RADIUS_METRES,connectorOverlap:overlap,
     mioSpanMetres:mioSpan,spanDifferenceMetres:delta,lengthRatio:span?mioSpan/span:null,rangeWithinTolerance,
     storedSpeedsAgree:pair.a.rawBytes16To19[0]===pair.b.rawBytes16To19[0]});
   }
   candidates.sort((a,b)=>a.maxEndpointMetres-b.maxEndpointMetres||a.id.localeCompare(b.id));
   const within=candidates.filter(c=>c.rangeWithinTolerance);
   for(const c of candidates){usedPairs.add(c.id);for(const e of c.endpoints)used.add(e.id);}
   sectionRows.push({...row,status:within.length>1?'ambiguous':within.length?'spatial-candidate':candidates.length?'range-review':'canard-only',spanMetres:span,possibleSplitOrMerge:!within.length&&candidates.length>1&&candidates.some(c=>c.connectorOverlap),candidates});
  }
 }
 const localInventory=speedInventory(scoped),globalInventory=speedInventory(records);
 const counts=rows=>Object.fromEntries(['spatial-candidate','ambiguous','range-review','canard-only'].map(k=>[k,rows.filter(r=>r.status===k).length]));
 return {schema:'mivue-canard-mio-comparison',version:1,tolerance:{endpointMetres:COMPARISON_RADIUS_METRES,spanMetresMinimum:20,spanFraction:.1},
  interpretation:'Geometric candidates require identity/road review. Source-only coverage is legitimate. Reviewed BIN metadata is firmware-scoped; unclassified values remain raw. Identity and road limits are not verified by decoded metadata.',
  scope:{countryId,total:records.length,validInScope:scoped.length,borderInScope:scoped.filter(r=>scopeById.get(recordId(r)).status==='border').length,
   borderRecordIds:scoped.filter(r=>scopeById.get(recordId(r)).status==='border').map(recordId),invalid:records.length-valid.length,outsideOrUnassigned:valid.length-scoped.length},
  counts:{points:counts(pointRows),sections:counts(sectionRows)},points:pointRows,sections:sectionRows,
  invalidRecords:records.filter(r=>!hasPosition(r)).map(describe),
  mioOnly:scoped.filter(r=>!used.has(recordId(r))).map(describe),
  mioOnlySections:pairs.filter(p=>p.inScope&&!usedPairs.has(p.id)).map(p=>({id:p.id,endpoints:[describe(p.a),describe(p.b)],spanMetres:distance(position(p.a),position(p.b))})),linkProblems,
  speed:{sourceTotal:batch.observations.length,sourceUnknown:batch.observations.filter(o=>o.speedKmh===null).length,
   sourceKnown:batch.observations.filter(o=>o.speedKmh!==null).length,binMetadataScope:BIN_METADATA_SCOPE,decodedCounts:localInventory.decodedCounts,rawZero:scoped.filter(r=>r.rawBytes16To19[0]===0).length,
   binHistogram:localInventory.histogram,byRawType:localInventory.byRawType,rawZeroIds:localInventory.rawZeroIds,global:globalInventory,
   sourceMissingReason:'No numeric limit supplied by the snapshot; this is separate from the stored BIN value.',rawZeroReason:'Stored zero denotes an unavailable numerical limit in the reviewed firmware; no default limit was assigned.',
   byCategory:Object.fromEntries(['PP','OPP','RL'].map(category=>{const list=batch.observations.filter(o=>o.originalProperties.sourceCategory===category);return [category,{total:list.length,unknown:list.filter(o=>o.speedKmh===null).length}];})),sectionEndpointDisagreements:pairs.filter(p=>p.inScope&&p.a.rawBytes16To19[0]!==p.b.rawBytes16To19[0]).map(p=>p.id)}};
}
