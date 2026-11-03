import {analyzeDirections} from './direction-analysis.js';
import {sourceDirectionLabel,sourceChainageLabel,sourceMastDirectionLabel} from './source-direction.js';
const number=n=>String(Math.round(n*100)/100);
export function speedLabel(references,t){
 const known=references.filter(r=>Number.isFinite(r.speedKmh));
 if(!known.length)return t('speedUnknown');
 if(new Set(known.map(r=>r.speedKmh)).size>1)return t('speedConflict');
 const policy=known.some(r=>r.originalProperties?.canardDetail?.selectionPolicy==='minimum-passenger-car-any-time-any-direction')?` · ${t('canardCarMinimum')}`:'';
 return `${number(known[0].speedKmh)} km/h · ${[...new Set(known.map(r=>r.attribution))].join(', ')}${policy}`;
}
export function safeSourceUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function directionRows(reference,t,records=[]){
 const analysis=analyzeDirections(reference,{records}),known=analysis.mioAlertBearings.filter(r=>r.bearingDegrees!==null);
 const heading=known.length?known.map(r=>`${r.bearingDegrees}° · ${r.recordId}`).join(' / '):t('alertHeadingUnknown');
 const road=analysis.roadDirection;
 const roadRows=road?[[t('roadDirectionStatus'),t(`roadDirection_${road.status}`)+(road.reason?` · ${road.reason}`:'')],...(road.travelBearings.length?[[t('roadDirectionTravel'),road.travelBearings.map(n=>`${number(n)}°`).join(' / ')]]:[]),...(road.excludedBearings.length?[[t('roadDirectionExcluded'),road.excludedBearings.map(n=>`${number(n)}°`).join(' / ')]]:[]),[t('roadDirectionConfidence'),t(`roadDirection_${road.confidence}`)],...road.claims.map(c=>[t(c.excluded?'roadDirectionExcluded':'roadDirectionDestination'),`${c.raw} → ${c.destination} · ${t(`roadDirection_${c.status}`)}${c.bearings.length?' · '+c.bearings.map(n=>`${number(n)}°`).join(' / '):''}`]),[t('roadDirectionEvidence'),`${road.source.attribution} · ${road.source.dataTimestamp} · ${t('roadDirectionEstimate')}${road.source.coverage?' · '+road.source.coverage:''}`]]:[];
 return [...roadRows,...[['vehicleAlertHeading',heading],['captureMode',t(`capture_${analysis.sourceCaptureMode}`)],['physicalCameraAim',t('physicalAimUnknown')],
  ...(analysis.roadAxisAimEstimates.length?[['roadAxisAim',analysis.roadAxisAimEstimates.map(r=>`${r.bearingDegrees}° · ${r.recordId} · ${t('roadAxisDerived')}`).join(' / ')]]:[]),
  ...(analysis.sourceChainage.conflict?[['directionConflict',t('directionConflictText')]]:[])].map(([key,value])=>[t(key),value])];
}
export function metadataRows(r,t,records=[]){
 const unknown=t('valueUnknown'),direction=sourceDirectionLabel(r,t),chainage=sourceChainageLabel(r),mast=sourceMastDirectionLabel(r);
 const rows=[['namespace',r.namespace],['sourceId',r.sourceId],['attribution',r.attribution],['sourceName',r.name??unknown],
 ['sourceKind',t(`kind_${r.kind}`)],['sourceStatusLabel',t(`status_${r.status}`)],['speedLimit',speedLabel([r],t)],
 ['originalSpeed',r.originalSpeed?`${r.originalSpeed.value} ${r.originalSpeed.unit}`:unknown],['direction',direction],
 ...(chainage&&direction!==`${t('roadChainage')}: ${chainage}`?[['roadChainage',chainage]]:[]),
 ...(mast&&direction!==`${t('mastDirection')}: ${mast}`?[['mastDirection',mast]]:[]),
 ['retrievedAt',r.retrievedAt],['encodingStatus',t(`encoding_${r.encodingStatus}`)],...((r.recordIds?.length||r.recordId)?[['associatedRecords',(r.recordIds??[r.recordId]).join(', ')]]:[]),['originalProperties',JSON.stringify(r.originalProperties,null,2)]]
 .map(([key,value])=>[t(key),String(value??unknown)]);
 if(r.originalProperties?.canardDetail)rows.splice(rows.length-1,0,...directionRows(r,t,records));
 return rows;
}
export function placeLabels(items,measure){
 const placed=[];
 for(const item of items){
  const box={...item,left:item.x+10,top:item.y-16,right:item.x+14+measure(item.text),bottom:item.y+2};
  if(placed.some(b=>box.left<b.right&&box.right>b.left&&box.top<b.bottom&&box.bottom>b.top))continue;
  placed.push(box);if(placed.length===200)break;
 }
 return placed;
}
