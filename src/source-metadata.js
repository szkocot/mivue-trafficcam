const number=n=>String(Math.round(n*100)/100);
export function speedLabel(references,t){
 const known=references.filter(r=>Number.isFinite(r.speedKmh));
 if(!known.length)return t('speedUnknown');
 if(new Set(known.map(r=>r.speedKmh)).size>1)return t('speedConflict');
 return `${number(known[0].speedKmh)} km/h · ${[...new Set(known.map(r=>r.attribution))].join(', ')}`;
}
export function safeSourceUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function metadataRows(r,t){
 const unknown=t('valueUnknown');
 return [['namespace',r.namespace],['sourceId',r.sourceId],['attribution',r.attribution],['sourceName',r.name??unknown],
 ['sourceKind',t(`kind_${r.kind}`)],['sourceStatusLabel',t(`status_${r.status}`)],['speedLimit',speedLabel([r],t)],
 ['originalSpeed',r.originalSpeed?`${r.originalSpeed.value} ${r.originalSpeed.unit}`:unknown],['direction',r.direction===null?unknown:`${r.direction}°`],
 ['retrievedAt',r.retrievedAt],['encodingStatus',t(`encoding_${r.encodingStatus}`)],['originalProperties',JSON.stringify(r.originalProperties,null,2)]]
 .map(([key,value])=>[t(key),String(value??unknown)]);
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
