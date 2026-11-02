import {analyzeDirections} from '../src/direction-analysis.js';
import {sourceDirectionLabel} from '../src/source-direction.js';
import { hasPosition } from '../src/project-view.js';
import { aggregatePoints } from '../src/view-filter.js';
import { speedLabel,placeLabels } from '../src/source-metadata.js';
export function createMap(element,{onSelect,onPick,onViewport,onTileError}){
 const L=globalThis.L,map=L.map(element,{preferCanvas:true}).setView([52,19],6);
 const locationPane=map.createPane('location');locationPane.style.zIndex='460';locationPane.style.pointerEvents='none';
 const positionLayer=L.layerGroup().addTo(map),positionRenderer=L.svg({pane:'location'});
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',onTileError).addTo(map);
 const canvas=document.createElement('canvas');canvas.className='points';element.append(canvas);
 let records=[],references=[],selectedId=null,pick=false,groups=[],display={},translate=key=>key;
 function draw(){
  const size=map.getSize(),ratio=devicePixelRatio||1;canvas.width=size.x*ratio;canvas.height=size.y*ratio;canvas.style.width=`${size.x}px`;canvas.style.height=`${size.y}px`;
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
  const points=[];
  for(const r of [...records,...references]){if(!hasPosition(r))continue;const p=map.latLngToContainerPoint([r.latitude,r.longitude]);if(p.x>=-20&&p.y>=-20&&p.x<=size.x+20&&p.y<=size.y+20)points.push({id:r.id,x:p.x,y:p.y,reference:r.reference,merged:!r.reference&&Boolean(r.sourceObservations?.length)});}
  const grid=map.getZoom()<12?40:10;
  groups=[...aggregatePoints(points.filter(p=>!p.reference&&!p.merged),grid),
   ...aggregatePoints(points.filter(p=>p.merged),grid).map(g=>({...g,merged:true})),
   ...aggregatePoints(points.filter(p=>p.reference),grid).map(g=>({...g,reference:true}))];
  // Separate status groups within one grid cell so coincident colors remain visible.
  const buckets=new Map();for(const g of groups){const key=`${Math.floor(g.x/grid)}:${Math.floor(g.y/grid)}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(g);}
  for(const bucket of buckets.values())if(bucket.length>1)bucket.forEach((g,i)=>{g.x+=(i-(bucket.length-1)/2)*34;});
  const legend=element.parentElement.querySelector('.legend');
  if(legend)legend.textContent=translate('mapLegend',{bin:points.filter(p=>!p.reference&&!p.merged).length,merged:points.filter(p=>p.merged).length,references:points.filter(p=>p.reference).length})+' '+translate('links')+' '+translate('directionArrowLegend');
  const lookup=new Map([...records,...references].map(r=>[r.id,r]));
  ctx.strokeStyle='#7351a2';ctx.lineWidth=2;ctx.setLineDash([3,5]);
  for(const r of references)if(r.geometry.type==='LineString'){
   ctx.beginPath();r.geometry.coordinates.forEach(([lon,lat],i)=>{const p=map.latLngToContainerPoint([lat,lon]);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.stroke();
  }
  ctx.setLineDash([5,4]);ctx.strokeStyle='#365b9b';
  for(const r of records){
   const target=lookup.get(r.linkTargetId);
   if(!target||r.typeRaw!==964||target.typeRaw!==9128||!hasPosition(r)||!hasPosition(target)||!r.sourceObservations?.some(o=>o.kind==='section'&&o.recordIds?.includes(target.id)))continue;
   const a=map.latLngToContainerPoint([r.latitude,r.longitude]),b=map.latLngToContainerPoint([target.latitude,target.longitude]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  ctx.setLineDash([]);
  const selected=lookup.get(selectedId),target=lookup.get(selected?.linkTargetId);
  if(selected && target && hasPosition(selected)&&hasPosition(target)){
   const a=map.latLngToContainerPoint([selected.latitude,selected.longitude]),b=map.latLngToContainerPoint([target.latitude,target.longitude]);
   ctx.strokeStyle='#ad6800';ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
  }
  for(const g of groups){const active=g.ids.includes(selectedId),radius=g.ids.length>1?15:5;ctx.beginPath();ctx.arc(g.x,g.y,radius,0,Math.PI*2);ctx.fillStyle=g.reference?'#7351a2':g.merged?'#365b9b':'#087f77';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();
   if(active){ctx.beginPath();ctx.arc(g.x,g.y,radius+4,0,Math.PI*2);ctx.strokeStyle='#e59a13';ctx.lineWidth=3;ctx.stroke();}
   if(g.ids.length>1){ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='11px system-ui';ctx.fillText(String(g.ids.length),g.x,g.y);}
  }
  const active=groups.find(g=>g.ids.includes(selectedId));
  const heading=selected&&!selected.reference?analyzeDirections({}, {records:[selected]}).mioAlertBearings[0]?.bearingDegrees:null;
  canvas.dataset.alertHeading=heading==null?'':String(heading);
  if(active&&heading!=null){
   const angle=(heading-90)*Math.PI/180,x=active.x+Math.cos(angle)*30,y=active.y+Math.sin(angle)*30;
   ctx.strokeStyle='#185a8d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(active.x,active.y);ctx.lineTo(x,y);ctx.lineTo(x-Math.cos(angle-.5)*9,y-Math.sin(angle-.5)*9);ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(angle+.5)*9,y-Math.sin(angle+.5)*9);ctx.stroke();
  }
  const labels=[];ctx.font='12px system-ui';
  if(display.showSpeedLimits||display.showMetadata)for(const g of groups){
   if(g.ids.length!==1)continue;const r=lookup.get(g.ids[0]),refs=r.reference?[r]:r.sourceObservations??[],parts=[];
   if(display.showSpeedLimits&&refs.some(ref=>Number.isFinite(ref.speedKmh)))parts.push(speedLabel(refs,translate));
   if(display.showMetadata)for(const ref of refs){if(ref.name)parts.push(`${ref.name} · ${ref.attribution}`);const direction=sourceDirectionLabel(ref,translate);if(direction!==translate('valueUnknown'))parts.push(direction);}
   if(parts.length)labels.push({...g,text:parts.join(' / ').slice(0,160)});
  }
  const placed=placeLabels(labels,text=>ctx.measureText(text).width);canvas.dataset.labelCount=String(placed.length);
  ctx.textAlign='left';ctx.textBaseline='top';for(const label of placed){ctx.fillStyle='#ffffffeb';ctx.fillRect(label.left,label.top,label.right-label.left,18);ctx.fillStyle='#172f3d';ctx.fillText(label.text,label.left+2,label.top+1);}
 }
 function viewport(){const b=map.getBounds();onViewport({south:b.getSouth(),north:b.getNorth(),west:b.getWest(),east:b.getEast()});}
 map.on('move zoom resize',draw);map.on('moveend',viewport);
 map.on('click',e=>{if(pick){onPick(e.latlng.lat,e.latlng.lng);return;}
  const p=e.containerPoint;let g,nearest=18;for(const candidate of groups){const distance=Math.hypot(p.x-candidate.x,p.y-candidate.y);if(distance<nearest){g=candidate;nearest=distance;}}if(!g)return;
  if(g.ids.length>1)map.setView(map.containerPointToLatLng([g.x,g.y]),Math.min(19,map.getZoom()+2));else onSelect(g.ids[0]);
 });
 const resize=new ResizeObserver(()=>map.invalidateSize());resize.observe(element);
 return {render(next,id){records=next;selectedId=id;draw();},fit(next){const coords=next.filter(hasPosition).map(r=>[r.latitude,r.longitude]);if(coords.length)map.fitBounds(coords,{padding:[30,30],maxZoom:14});},
  center(r){if(r&&hasPosition(r))map.setView([r.latitude,r.longitude],Math.max(map.getZoom(),13));},setPickMode(v){pick=v;element.style.cursor=v?'crosshair':'';},
  setReferenceLayers(next){references=next;},setDisplayOptions(values){display={...values};draw();},
  showLocation({latitude,longitude,accuracy}){
   positionLayer.clearLayers();const latlng=[latitude,longitude];
   const options={renderer:positionRenderer,interactive:false,color:'#365bb5',weight:2};
   L.circle(latlng,{...options,radius:accuracy,fillOpacity:.1,className:'location-accuracy'}).addTo(positionLayer);
   L.circleMarker(latlng,{...options,radius:7,fillColor:'#365bb5',fillOpacity:1,color:'white',className:'location-marker'}).addTo(positionLayer);
   map.setView(latlng,Math.max(14,map.getZoom()),{animate:false});
  },
  clearLocation(){positionLayer.clearLayers();},
  setLanguage(t){translate=t;for(const [suffix,key] of [['in','zoomIn'],['out','zoomOut']]){const button=element.querySelector(`.leaflet-control-zoom-${suffix}`);button.title=t(key);button.setAttribute('aria-label',t(key));}draw();},
  destroy(){resize.disconnect();map.remove();}};
}
