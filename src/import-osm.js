import {checkText,requireImport,plainObject,normalizeBatch,ImportError} from './import-normalize.js';
export const OSM_SOURCE={namespace:'openstreetmap',attribution:'© OpenStreetMap contributors — ODbL 1.0; https://www.openstreetmap.org/copyright',url:'https://www.openstreetmap.org/copyright'};
export function parseOsmJson(text,_source,retrievedAt){
 checkText(text);let data;try{data=JSON.parse(text.replace(/^\ufeff/,''));}catch{throw new ImportError('json');}
 requireImport(plainObject(data)&&Array.isArray(data.elements),'elements');
 requireImport(data.elements.length<=100000,'elements',-1,'COUNT_LIMIT');
 const elements=new Map();
 for(const [i,e] of data.elements.entries()){
  requireImport(plainObject(e)&&['node','way','relation'].includes(e.type)&&Number.isSafeInteger(e.id)&&e.id>0,'id',i);
  const key=`${e.type}/${e.id}`;requireImport(!elements.has(key),'id',i,'DUPLICATE_ID');elements.set(key,e);
 }
 const observations=[];
 for(const [i,e] of data.elements.entries()){
  const tags=e.tags??{};requireImport(plainObject(tags)&&Object.values(tags).every(v=>typeof v==='string'),'tags',i);
  const camera=tags.highway==='speed_camera'||tags['proposed:highway']==='speed_camera'||tags['disused:highway']==='speed_camera';
  const section=e.type==='relation'&&tags.type==='enforcement'&&tags.enforcement==='average_speed';
  requireImport(!((camera&&e.type!=='node')||(tags.type==='enforcement'&&!section)),'geometry',i,'OSM_UNSUPPORTED_GEOMETRY');
  if(!camera&&!section)continue;
  let geometry={type:'Point',coordinates:[e.lon,e.lat]},originalProperties=e;
  if(section){
   requireImport(Array.isArray(e.members)&&e.members.length<=100000&&e.members.every(m=>plainObject(m)&&['node','way','relation'].includes(m.type)&&Number.isSafeInteger(m.ref)&&m.ref>0&&typeof m.role==='string'),'geometry',i,'OSM_UNSUPPORTED_GEOMETRY');
   const endpoints=['from','to'].map(role=>{
    const members=e.members.filter(m=>m.role===role);
    requireImport(members.length===1&&members[0].type==='node','geometry',i,'OSM_UNSUPPORTED_GEOMETRY');
    const node=elements.get(`node/${members[0].ref}`);
    requireImport(node&&node.visible!==false,'geometry',i,'OSM_UNSUPPORTED_GEOMETRY');return node;
   });
   requireImport(endpoints[0].id!==endpoints[1].id&&(endpoints[0].lon!==endpoints[1].lon||endpoints[0].lat!==endpoints[1].lat),'geometry',i,'OSM_UNSUPPORTED_GEOMETRY');
   geometry={type:'LineString',coordinates:endpoints.map(n=>[n.lon,n.lat])};
   originalProperties={relation:e,endpointNodes:endpoints,geometryBasis:'endpoints-not-road-route'};
  }
  requireImport(e.visible!==false,'geometry',i,'OSM_UNSUPPORTED_GEOMETRY');
  const speed=/^(\d+(?:\.\d+)?)(?: (km\/h|mph))?$/.exec(tags.maxspeed??'');
  const originalSpeed=speed?{value:Number(speed[1]),unit:speed[2]??'km/h'}:null;
  const direction=!section&&/^(?:\d+(?:\.\d+)?)$/.test(tags.direction??'')&&Number(tags.direction)<360?Number(tags.direction):null;
  observations.push({sourceId:`${e.type}/${e.id}`,kind:section?'section':'camera',status:section?'unknown':tags['disused:highway']==='speed_camera'?'inactive':tags['proposed:highway']==='speed_camera'?'planned':'unknown',
   geometry,name:tags.name??null,originalSpeed,speedKmh:originalSpeed?originalSpeed.value*(originalSpeed.unit==='mph'?1.609344:1):null,
   direction,url:`https://www.openstreetmap.org/${e.type}/${e.id}`,originalProperties});
 }
 requireImport(observations.length>0,'elements',-1,'OSM_NO_CAMERAS');
 return normalizeBatch({source:OSM_SOURCE,retrievedAt,observations});
}
