import {normalizeBatch,plainObject,checkText} from './import-normalize.js';
import {decodeBase64Bounded} from './canard-decode.js';
export const CANARD_NAMESPACE='pl.gitd.canard.public-map';
export const CANARD_URL='https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen';
const names={PP:'fotoradaryPP',OPP:'fotoradaryOPP',RL:'fotoradaryRL',PK:'punktyKontrolne'};
const fail=()=>{throw Object.assign(new Error('Unreviewed CANARD schema'),{code:'CANARD_SCHEMA_CHANGED'});};

export function decodeCanardPage(html,{review,decode=decodeBase64Bounded}){
 checkText(html);const layers={};let remaining=20*1024*1024;
 for(const [category,name] of Object.entries(names)){
  const matches=[...html.matchAll(new RegExp(`\\b${name}\\s*:\\s*`, 'g'))];
  if(matches.length!==1)fail();
  const rest=html.slice(matches[0].index+matches[0][0].length);
  const literal=rest.match(/^"([^"\\\r\n]*)"\s*(?=[,}])/);
  if(!literal)fail();
  if(category==='PK'){
   if(review?.unavailableCategoryPolicy?.PK?.userApproved!==true||literal[1]!==review.unavailableCategoryPolicy.PK.exactLiteral||literal[1]!=='[{}]')fail();
   layers.PK=null;continue;
  }
  const text=decode(literal[1],remaining);remaining-=new TextEncoder().encode(text).length;
  try{layers[category]=JSON.parse(text);}catch{fail();}
  if(!Array.isArray(layers[category]))fail();
 }
 return layers;
}

export function normalizeCanardLayers(layers,{review,retrievedAt}){
 if(!plainObject(layers)||Object.keys(layers).length!==4||layers.PK!==null||review?.unavailableCategoryPolicy?.PK?.userApproved!==true)fail();
 const observations=[];
 for(const category of ['PP','OPP','RL']){
  const rows=layers[category],fields=review.fieldsByCategory[category];
  if(!Array.isArray(rows)||!plainObject(fields)||rows.length>100000)fail();
  for(const row of rows){
   if(!plainObject(row)||Object.keys(row).some(k=>!Object.hasOwn(fields,k)))fail();
   for(const [key,descriptor] of Object.entries(fields)){
    if(!Object.hasOwn(row,key)){if(descriptor.required)fail();continue;}
    const value=row[key],type=value===null?'null':typeof value;
    if(type!==descriptor.type||descriptor.values&&!descriptor.values.includes(value))fail();
    if(type==='string'&&(!value.isWellFormed()||value.length>65536))fail();
   }
   if(!Number.isSafeInteger(row.id))fail();
   const start=[row.lon,row.lat],end=[row.lok2PktDlugosc,row.lok2PktSzerokosc];
   if(category==='OPP'&&start.every((v,i)=>v===end[i]))fail();
   observations.push({sourceId:JSON.stringify([category,String(row.id)]),kind:{PP:'camera',OPP:'section',RL:'red-light'}[category],
    status:'unknown',geometry:category==='OPP'?{type:'LineString',coordinates:[start,end]}:{type:'Point',coordinates:start},
    name:null,speedKmh:null,originalSpeed:null,direction:null,url:CANARD_URL,
    originalProperties:{...row,sourceCategory:category,...(category==='OPP'?{geometryBasis:'endpoints-not-road-route'}:{})}});
  }
 }
 return normalizeBatch({source:{namespace:CANARD_NAMESPACE,attribution:'GITD / CANARD',url:CANARD_URL},retrievedAt,observations});
}
