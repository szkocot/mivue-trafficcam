export class ImportError extends Error {
 constructor(field,index=-1,reason='INVALID_VALUE') {super(`Invalid import: ${field}`);this.name='ImportError';this.code='INVALID_IMPORT';this.issues=[{index,field,code:reason}];}
}
export const requireImport=(ok,field,index=-1,reason)=>{if(!ok)throw new ImportError(field,index,reason);};
export const plainObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
export const identity=(namespace,sourceId)=>JSON.stringify([namespace,sourceId]);
export const byteLength=text=>new TextEncoder().encode(text).byteLength;
export function checkText(text){requireImport(typeof text==='string'&&byteLength(text)<=20*1024*1024,'file',-1,'INPUT_LIMIT');}
export function stableId(value,field='id',index=-1){
 requireImport(typeof value==='string'||Number.isSafeInteger(value),field,index);
 const text=String(value);requireImport(text.trim().length>0&&text.length<=256,field,index);return text;
}
export function jsonCopy(value,depth=0,seen=new Set()){
 requireImport(depth<=64,'metadata',-1,'METADATA_DEPTH');
 if(value===null||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value==='number'){requireImport(Number.isFinite(value),'metadata');return value;}
 requireImport((Array.isArray(value)||plainObject(value))&&!seen.has(value),'metadata');seen.add(value);
 const out=Array.isArray(value)?Array.from(value,item=>jsonCopy(item,depth+1,seen)):
  Object.fromEntries(Object.keys(value).sort().map(key=>[key,jsonCopy(value[key],depth+1,seen)]));
 seen.delete(value);return out;
}
const optionalText=(v,field,index)=>{if(v==null||v==='')return null;requireImport(typeof v==='string',field,index);return v;};
export function numeric(value,field,index=-1,{optional=false,strings=false}={}){
 if(optional&&(value==null||value===''))return null;
 if(strings&&typeof value==='string'&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value))value=Number(value);
 requireImport(typeof value==='number'&&Number.isFinite(value),field,index);return value;
}
export function fromProperties(properties,sourceId,geometry,index,strings=false){
 requireImport(plainObject(properties),'properties',index);
 const speed=numeric(properties.speed,'speed',index,{optional:true,strings});
 const unit=properties.speed_unit;
 if(speed!==null)requireImport(speed>=0&&['km/h','mph'].includes(unit),'speed_unit',index);
 return {sourceId:stableId(sourceId,'id',index),kind:properties.kind,status:properties.status||'unknown',geometry,
  name:optionalText(properties.name,'name',index),speedKmh:speed===null?null:speed*(unit==='mph'?1.609344:1),
  originalSpeed:speed===null?null:{value:speed,unit},direction:numeric(properties.direction,'direction',index,{optional:true,strings}),
  url:optionalText(properties.url,'url',index),originalProperties:properties};
}
export function normalizeObservation(o,index=-1){
 requireImport(plainObject(o),'observation',index);
 const sourceId=stableId(o.sourceId,'id',index);
 requireImport(['camera','section','red-light','unknown'].includes(o.kind),'kind',index);
 requireImport(['active','planned','inactive','unknown'].includes(o.status),'status',index);
 const g=o.geometry;requireImport(plainObject(g)&&['Point','LineString'].includes(g.type),'geometry',index);
 const points=g.type==='Point'?[g.coordinates]:g.coordinates;
 requireImport(Array.isArray(points)&&(g.type==='Point'||(o.kind==='section'&&points.length>=2&&points.length<=1000)),'geometry',index);
 for(const p of points)requireImport(Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Math.abs(p[0])<=180&&Number.isFinite(p[1])&&Math.abs(p[1])<=90,'coordinates',index);
 const speedKmh=numeric(o.speedKmh,'speed',index,{optional:true}),originalSpeed=o.originalSpeed??null;
 if(speedKmh===null)requireImport(originalSpeed===null,'speed',index);
 else requireImport(speedKmh>=0&&plainObject(originalSpeed)&&Number.isFinite(originalSpeed.value)&&originalSpeed.value>=0
  &&['km/h','mph'].includes(originalSpeed.unit)&&speedKmh===originalSpeed.value*(originalSpeed.unit==='mph'?1.609344:1),'speed',index);
 const direction=numeric(o.direction,'direction',index,{optional:true});requireImport(direction===null||(direction>=0&&direction<360),'direction',index);
 const originalProperties=jsonCopy(o.originalProperties??{});requireImport(plainObject(originalProperties)&&byteLength(JSON.stringify(originalProperties))<=65536,'metadata',index,'METADATA_LIMIT');
 return {sourceId,kind:o.kind,status:o.status,geometry:{type:g.type,coordinates:structuredClone(g.coordinates)},
  name:optionalText(o.name,'name',index),speedKmh,originalSpeed:originalSpeed?{value:originalSpeed.value,unit:originalSpeed.unit}:null,
  direction,url:optionalText(o.url,'url',index),originalProperties};
}
export function normalizeBatch(batch){
 requireImport(plainObject(batch)&&plainObject(batch.source),'source');const s=batch.source;
 const namespace=stableId(s.namespace,'namespace');
 requireImport(typeof s.attribution==='string'&&s.attribution.trim().length>0&&s.attribution.length<=4096,'attribution');
 requireImport(typeof batch.retrievedAt==='string'&&/^\d{4}-\d\d-\d\dT/.test(batch.retrievedAt)&&Number.isFinite(Date.parse(batch.retrievedAt)),'retrievedAt');
 requireImport(Array.isArray(batch.observations)&&batch.observations.length<=100000,'observations',-1,'COUNT_LIMIT');
 const ids=new Set();const observations=batch.observations.map((o,i)=>{
  const out=normalizeObservation(o,i);requireImport(!ids.has(out.sourceId),'id',i,'DUPLICATE_ID');ids.add(out.sourceId);return out;
 });
 return {source:{namespace,attribution:s.attribution,url:optionalText(s.url,'url',-1)},retrievedAt:new Date(batch.retrievedAt).toISOString(),observations};
}
