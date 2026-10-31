import {checkText,requireImport,plainObject,normalizeBatch,ImportError} from './import-normalize.js';
export const OSM_SOURCE={namespace:'openstreetmap',attribution:'© OpenStreetMap contributors — ODbL 1.0; https://www.openstreetmap.org/copyright',url:'https://www.openstreetmap.org/copyright'};
export function parseOsmJson(text,_source,retrievedAt){
 checkText(text);let data;try{data=JSON.parse(text.replace(/^\ufeff/,''));}catch{throw new ImportError('json');}
 requireImport(plainObject(data)&&Array.isArray(data.elements),'elements');
 requireImport(data.elements.length<=100000,'elements',-1,'COUNT_LIMIT');
 const observations=[];
 for(const [i,e] of data.elements.entries()){
  requireImport(plainObject(e)&&['node','way','relation'].includes(e.type)&&Number.isSafeInteger(e.id)&&e.id>0,'id',i);
  const tags=e.tags??{};requireImport(plainObject(tags)&&Object.values(tags).every(v=>typeof v==='string'),'tags',i);
  const camera=tags.highway==='speed_camera'||tags['proposed:highway']==='speed_camera'||tags['disused:highway']==='speed_camera';
  // shortcut: only camera nodes have verified point geometry, add relations after role/route semantics are supported.
  requireImport(!((camera&&e.type!=='node')||tags.type==='enforcement'),'geometry',i,'OSM_UNSUPPORTED_GEOMETRY');
  if(!camera)continue;
  requireImport(e.visible!==false,'geometry',i,'OSM_UNSUPPORTED_GEOMETRY');
  const speed=/^(\d+(?:\.\d+)?)(?: (km\/h|mph))?$/.exec(tags.maxspeed??'');
  const originalSpeed=speed?{value:Number(speed[1]),unit:speed[2]??'km/h'}:null;
  const direction=/^(?:\d+(?:\.\d+)?)$/.test(tags.direction??'')&&Number(tags.direction)<360?Number(tags.direction):null;
  observations.push({sourceId:`node/${e.id}`,kind:'camera',status:tags['disused:highway']==='speed_camera'?'inactive':tags['proposed:highway']==='speed_camera'?'planned':'unknown',
   geometry:{type:'Point',coordinates:[e.lon,e.lat]},name:tags.name??null,originalSpeed,speedKmh:originalSpeed?originalSpeed.value*(originalSpeed.unit==='mph'?1.609344:1):null,
   direction,url:`https://www.openstreetmap.org/node/${e.id}`,originalProperties:e});
 }
 requireImport(observations.length>0,'elements',-1,'OSM_NO_CAMERAS');
 return normalizeBatch({source:OSM_SOURCE,retrievedAt,observations});
}
