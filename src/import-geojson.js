import { checkText,requireImport,plainObject,fromProperties,normalizeBatch,stableId,ImportError } from './import-normalize.js';
export function parseGeoJson(text,source,retrievedAt){
 checkText(text);let data;try{data=JSON.parse(text.replace(/^\ufeff/,''));}catch{throw new ImportError('json');}
 requireImport(plainObject(data)&&data.type==='FeatureCollection'&&Array.isArray(data.features)&&data.features.length<=100000,'features');
 requireImport(!Object.hasOwn(data,'crs'),'crs');
 const observations=data.features.map((f,i)=>{
  requireImport(plainObject(f)&&f.type==='Feature'&&plainObject(f.properties),'feature',i);
  const id=f.id??f.properties.id;
  if(f.id!=null&&f.properties.id!=null)requireImport(stableId(f.id)===stableId(f.properties.id),'id',i,'CONFLICTING_ID');
  return fromProperties(f.properties,id,f.geometry,i);
 });
 return normalizeBatch({source,retrievedAt,observations});
}
