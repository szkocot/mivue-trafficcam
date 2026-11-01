import {checkText,plainObject,jsonCopy,byteLength,normalizeBatch} from './import-normalize.js';
import {decodeBase64Bounded} from './canard-decode.js';
import {CANARD_NAMESPACE,CANARD_URL} from './canard-adapter.js';
const measurements={PP:'PP',OPP:'PO',RL:'PC'},alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const check=ok=>{if(!ok)throw Object.assign(new Error('Invalid CANARD detail'),{code:'CANARD_INVALID_DETAIL'});};
function identity(category,sourceId){
 let parts;try{parts=JSON.parse(sourceId);}catch{check(false);}
 check(Object.hasOwn(measurements,category)&&Array.isArray(parts)&&parts.length===2&&parts[0]===category&&typeof parts[1]==='string'&&/^[1-9]\d*$/.test(parts[1])&&Number.isSafeInteger(Number(parts[1]))&&JSON.stringify(parts)===sourceId);
 return Number(parts[1]);
}
export function validateCanardDetail(raw,{category,sourceId}){
 const id=identity(category,sourceId);
 check(plainObject(raw)&&raw.id===id&&raw.rodzaj==='URZADZENIE'&&plainObject(raw.urzadzenie)&&raw.urzadzenie.id===id&&raw.urzadzenie.rodzajPomiaru===measurements[category]&&Array.isArray(raw.limity)&&raw.limity.length<=100000);
 for(const row of raw.limity)check(plainObject(row)&&(row.limitOsobowe==null||typeof row.limitOsobowe==='string')&&(row.limitCiezarowe==null||typeof row.limitCiezarowe==='string')&&plainObject(row.typ)&&['kierunek','godziny','kierunekPikietazu'].every(key=>row.typ[key]==null||typeof row.typ[key]==='string'));
 const copy=jsonCopy(raw);check(byteLength(JSON.stringify(copy))<=65536);return copy;
}
/** Transcode the documented 15-bit UTF16 stream; the shared decoder enforces expansion budgets. */
export function decodeCanardDetail(text,options){
 checkText(text);text=text.replace(/[\r\n]+$/,'');check(byteLength(text)<=1024*1024&&text.endsWith(' '));
 const out=[];let bits=0,value=0;
 for(let i=0;i<text.length-1;i++){
  const unit=text.charCodeAt(i)-32;check(unit>=0&&unit<32768);
  value=value*32768+unit;bits+=15;
  while(bits>=6){bits-=6;out.push(alphabet[Math.floor(value/2**bits)&63]);value%=2**bits;}
 }
 if(bits)out.push(alphabet[value*2**(6-bits)]);
 while(out.length%4)out.push('=');
 let raw;try{raw=JSON.parse(decodeBase64Bounded(out.join(''),65536));}catch(error){if(error.code)throw error;check(false);}
 return validateCanardDetail(raw,options);
}
/** User policy: the lowest positive passenger limit across every time/direction row, assumed km/h. */
export function enrichCanardBatch(input,details){
 const batch=normalizeBatch(input);check(batch.source.namespace===CANARD_NAMESPACE&&(details instanceof Map||plainObject(details)));
 const entries=details instanceof Map?details:new Map(Object.entries(details));
 const known=new Set(batch.observations.map(o=>o.sourceId));for(const key of entries.keys())check(known.has(key));
 const observations=batch.observations.map(o=>{
  if(!entries.has(o.sourceId))return o;
  const entry=entries.get(o.sourceId);check(plainObject(entry));
  let category;try{[category]=JSON.parse(o.sourceId);}catch{check(false);}
  const raw=validateCanardDetail(entry.raw,{category,sourceId:o.sourceId});
  check(typeof entry.retrievedAt==='string'&&/^\d{4}-\d\d-\d\dT/.test(entry.retrievedAt)&&Number.isFinite(Date.parse(entry.retrievedAt))&&typeof entry.sourceUrl==='string'&&/^[a-f0-9]{64}$/.test(entry.responseSha256));
  let url;try{url=new URL(entry.sourceUrl);}catch{check(false);}check(url.protocol==='https:'&&url.origin===new URL(CANARD_URL).origin&&!url.username&&!url.password);
  let minimum=null,selectedRows=[];
  raw.limity.forEach((row,index)=>{
   const text=row.limitOsobowe?.trim();if(!/^\d+(?:\.\d+)?$/.test(text??''))return;
   const value=Number(text);if(!Number.isFinite(value)||value<=0)return;
   if(minimum===null||value<minimum){minimum=value;selectedRows=[index];}else if(value===minimum)selectedRows.push(index);
  });
  return {...o,speedKmh:minimum,originalSpeed:minimum===null?null:{value:minimum,unit:'km/h'},originalProperties:{...o.originalProperties,canardDetail:{raw,
   selectionPolicy:'minimum-passenger-car-any-time-any-direction',unitPolicy:'km/h-assumed-by-user-policy',selectedRows,
   retrievedAt:new Date(entry.retrievedAt).toISOString(),sourceUrl:entry.sourceUrl,responseSha256:entry.responseSha256}}};
 });
 return normalizeBatch({...batch,observations});
}
