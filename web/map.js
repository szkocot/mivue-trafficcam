import { hasPosition } from '../src/project-view.js';
import { aggregatePoints } from '../src/view-filter.js';
export function createMap(element,{onSelect,onPick,onViewport,onTileError}){
 const L=globalThis.L,map=L.map(element,{preferCanvas:true}).setView([52,19],6);
 const locationPane=map.createPane('location');locationPane.style.zIndex='460';locationPane.style.pointerEvents='none';
 const positionLayer=L.layerGroup().addTo(map),positionRenderer=L.svg({pane:'location'});
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',onTileError).addTo(map);
 const canvas=document.createElement('canvas');canvas.className='points';element.append(canvas);
 let records=[],selectedId=null,pick=false,groups=[];
 function draw(){
  const size=map.getSize(),ratio=devicePixelRatio||1;canvas.width=size.x*ratio;canvas.height=size.y*ratio;canvas.style.width=`${size.x}px`;canvas.style.height=`${size.y}px`;
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
  const points=[];
  for(const r of records){if(!hasPosition(r))continue;const p=map.latLngToContainerPoint([r.latitude,r.longitude]);if(p.x>=-20&&p.y>=-20&&p.x<=size.x+20&&p.y<=size.y+20)points.push({id:r.id,x:p.x,y:p.y});}
  groups=aggregatePoints(points,map.getZoom()<12?40:10);
  const lookup=new Map(records.map(r=>[r.id,r]));
  const selected=lookup.get(selectedId),target=lookup.get(selected?.linkTargetId);
  if(selected && target && hasPosition(selected)&&hasPosition(target)){
   const a=map.latLngToContainerPoint([selected.latitude,selected.longitude]),b=map.latLngToContainerPoint([target.latitude,target.longitude]);
   ctx.strokeStyle='#ad6800';ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
  }
  for(const g of groups){const active=g.ids.includes(selectedId);ctx.beginPath();ctx.arc(g.x,g.y,g.ids.length>1?15:active?8:5,0,Math.PI*2);ctx.fillStyle=active?'#e59a13':'#087f77';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();
   if(g.ids.length>1){ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='11px system-ui';ctx.fillText(String(g.ids.length),g.x,g.y);}
  }
 }
 function viewport(){const b=map.getBounds();onViewport({south:b.getSouth(),north:b.getNorth(),west:b.getWest(),east:b.getEast()});}
 map.on('move zoom resize',draw);map.on('moveend',viewport);
 map.on('click',e=>{if(pick){onPick(e.latlng.lat,e.latlng.lng);return;}
  const p=e.containerPoint,g=groups.find(g=>Math.hypot(p.x-g.x,p.y-g.y)<18);if(!g)return;
  if(g.ids.length>1)map.setView(map.containerPointToLatLng([g.x,g.y]),Math.min(19,map.getZoom()+2));else onSelect(g.ids[0]);
 });
 const resize=new ResizeObserver(()=>map.invalidateSize());resize.observe(element);
 return {render(next,id){records=next;selectedId=id;draw();},fit(next){const coords=next.filter(hasPosition).map(r=>[r.latitude,r.longitude]);if(coords.length)map.fitBounds(coords,{padding:[30,30],maxZoom:14});},
  center(r){if(hasPosition(r))map.setView([r.latitude,r.longitude],Math.max(map.getZoom(),13));},setPickMode(v){pick=v;element.style.cursor=v?'crosshair':'';},
  showLocation({latitude,longitude,accuracy}){
   positionLayer.clearLayers();const latlng=[latitude,longitude];
   const options={renderer:positionRenderer,interactive:false,color:'#365bb5',weight:2};
   L.circle(latlng,{...options,radius:accuracy,fillOpacity:.1,className:'location-accuracy'}).addTo(positionLayer);
   L.circleMarker(latlng,{...options,radius:7,fillColor:'#365bb5',fillOpacity:1,color:'white',className:'location-marker'}).addTo(positionLayer);
   map.setView(latlng,Math.max(14,map.getZoom()),{animate:false});
  },
  clearLocation(){positionLayer.clearLayers();},
  setLanguage(t){for(const [suffix,key] of [['in','zoomIn'],['out','zoomOut']]){const button=element.querySelector(`.leaflet-control-zoom-${suffix}`);button.title=t(key);button.setAttribute('aria-label',t(key));}},
  destroy(){resize.disconnect();map.remove();}};
}
