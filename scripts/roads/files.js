import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {sha256,canonical} from '../../src/canard-snapshot.js';
import {plainObject} from '../../src/import-normalize.js';
import {validRoadSource,ROAD_DIRECTION_NOTICE,getRoadDirection} from '../../src/road-direction-data.js';
export const ROAD_DATA_MAX_BYTES=20*1024*1024;
const fail=()=>{throw Object.assign(Error('Invalid road direction files'),{code:'ROAD_DIRECTION_DATA_INVALID'});};
const check=value=>{if(!value)fail();};
const encode=value=>new TextEncoder().encode(canonical(value)+'\n');
function validate(data){
 check(data?.schema==='mivue-canard-road-directions'&&data.version===1&&validRoadSource(data.source)&&plainObject(data.resolutions)&&Object.keys(data.resolutions).length<=100000);
 for(const [id,r] of Object.entries(data.resolutions)){
  check(id.length>0&&id.length<=256&&plainObject(r)&&typeof r.inputKey==='string'&&r.inputKey.length<=65536&&['resolved','ambiguous','unresolved'].includes(r.status)&&canonical(r.source)===canonical(data.source));
  let key;try{key=JSON.parse(r.inputKey);}catch{fail();}check(key.sourceId===id&&plainObject(key.geometry)&&Array.isArray(key.eligiblePassengerNamedClaims)&&key.eligiblePassengerNamedClaims.length<=32&&Array.isArray(key.deviceNames)&&key.deviceNames.length===2);
  const reference={sourceId:id,geometry:key.geometry,originalProperties:{canardDetail:{raw:{urzadzenie:{lokalizacjaNrDrogi:key.roadRef,dlugoscOdcinka1:key.sectionLengthsMetres?.[0],dlugoscOdcinka2:key.sectionLengthsMetres?.[1],nazwaKierunku1:key.deviceNames[0],nazwaKierunku2:key.deviceNames[1]},limity:key.eligiblePassengerNamedClaims.map(name=>({limitOsobowe:'1',typ:{kierunek:name}}))}},canardRoadDirection:r}};
  check(getRoadDirection(reference));
 }
 return data;
}
async function bounded(path,limit){const stat=await lstat(path);check(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=limit);const bytes=await readFile(path);check(bytes.length<=limit);return bytes;}
export async function readRoadData(directory,{optional=false}={}){
 const root=resolve(directory);let bytes;
 try{bytes=await bounded(resolve(root,'data/roads/manifest.json'),65536);}catch(error){
  if(optional&&error.code==='ENOENT'){try{await lstat(resolve(root,'data/roads'));}catch(missing){if(missing.code==='ENOENT')return null;throw missing;}fail();}
  throw error;
 }
 const manifest=JSON.parse(new TextDecoder().decode(bytes));
 check(manifest?.schemaVersion===1&&manifest.path==='data/roads/directions.json'&&manifest.noticePath==='data/roads/NOTICE.json'&&/^[a-f0-9]{64}$/.test(manifest.sha256??'')&&Number.isSafeInteger(manifest.byteLength)&&manifest.byteLength>0&&manifest.byteLength<=ROAD_DATA_MAX_BYTES&&Number.isSafeInteger(manifest.count)&&manifest.count>=0&&manifest.count<=100000);
 const body=await bounded(resolve(root,manifest.path),ROAD_DATA_MAX_BYTES);check(body.length===manifest.byteLength&&await sha256(body)===manifest.sha256);
 const data=validate(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body)));check(Object.keys(data.resolutions).length===manifest.count);
 const notice=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bounded(resolve(root,manifest.noticePath),65536)));check(canonical(notice)===canonical(ROAD_DIRECTION_NOTICE));
 return data;
}
export async function writeRoadData(directory,input){
 const data=validate(input),bytes=encode(data);check(bytes.length<=ROAD_DATA_MAX_BYTES);
 const manifest={schemaVersion:1,path:'data/roads/directions.json',noticePath:'data/roads/NOTICE.json',sha256:await sha256(bytes),byteLength:bytes.length,count:Object.keys(data.resolutions).length};
 const root=resolve(directory);await mkdir(dirname(root),{recursive:true});await mkdir(root);
 await mkdir(resolve(root,'data/roads'),{recursive:true});
 for(const [path,body] of [['data/roads/directions.json',bytes],['data/roads/NOTICE.json',encode(ROAD_DIRECTION_NOTICE)],['data/roads/manifest.json',encode(manifest)]])await writeFile(resolve(root,path),body,{flag:'wx'});
 return manifest;
}
