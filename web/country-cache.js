import {COUNTRY_MAX_BYTES,validateCountryManifest,validateCountryData,countryFail,CountryError} from '../src/country-data.js';
export function createCountryCache({fetchImpl=fetch,baseUrl=new URL('../',import.meta.url)}={}){
 let cached=null,pending=null;
 async function bounded(path,max,signal){
  if(signal?.aborted)countryFail('COUNTRY_CANCELLED');
  const response=await fetchImpl(new URL(path,baseUrl),{signal});
  if(!response.ok)countryFail('COUNTRY_DATA_UNAVAILABLE');
  if(Number(response.headers.get('content-length'))>max){await response.body?.cancel();countryFail('COUNTRY_DATA_LIMIT');}
  const reader=response.body?.getReader();if(!reader)countryFail('COUNTRY_DATA_INVALID');
  const chunks=[];let size=0;
  try{while(true){if(signal?.aborted)countryFail('COUNTRY_CANCELLED');const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)countryFail('COUNTRY_DATA_LIMIT');chunks.push(value);}}
  catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
  if(signal?.aborted)countryFail('COUNTRY_CANCELLED');
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
 }
 return {clearFailure(){/* Failures are evicted automatically; accepted data is retained. */},
  load({signal}={}){
   if(signal?.aborted)return Promise.reject(new CountryError('COUNTRY_CANCELLED'));
   if(cached)return Promise.resolve(cached);if(pending)return pending;
   pending=(async()=>{
    try{
     const m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bounded('data/countries/manifest.json',65536,signal)));validateCountryManifest(m);
     const bytes=await bounded(m.path,COUNTRY_MAX_BYTES,signal),notice=await bounded(m.noticePath,65536,signal);
     const result=await validateCountryData(bytes,m,notice);if(signal?.aborted)countryFail('COUNTRY_CANCELLED');cached=result;return result;
    }catch(e){if(e instanceof CountryError)throw e;if(signal?.aborted)countryFail('COUNTRY_CANCELLED');countryFail('COUNTRY_DATA_UNAVAILABLE');}
    finally{pending=null;}
   })();return pending;
  }};
}
