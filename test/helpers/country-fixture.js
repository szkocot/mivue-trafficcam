import {createHash} from 'node:crypto';
export const boxCountry=(id,w,s,e,n)=>({id,iso2:id,names:{en:id,pl:id},geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}});
const bytes=x=>new TextEncoder().encode(JSON.stringify(x)+'\n');
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function packCountryData(countries){
 const dataset={schemaVersion:1,countries},body=bytes(dataset);
 const notice={attribution:'Synthetic test boundaries',licence:'Public domain',sourceUrl:'https://example.test/countries',termsUrl:'https://example.test/terms',disclaimer:'Not authoritative',transformation:'Test fixture'};
 const noticeBytes=bytes(notice);let positionCount=0;
 for(const c of countries)for(const p of c.geometry.type==='Polygon'?[c.geometry.coordinates]:c.geometry.coordinates)for(const r of p)positionCount+=r.length;
 const manifest={schemaVersion:1,release:'5.1.1',path:'data/countries/countries.json',sha256:hash(body),byteLength:body.length,featureCount:countries.length,positionCount,sourceUrl:'https://example.test/countries',sourceCommit:'a'.repeat(40),sourceArchiveSha256:'b'.repeat(64),sourceGeoJsonSha256:'c'.repeat(64),noticePath:'data/countries/NOTICE.json',noticeSha256:hash(noticeBytes)};
 return {bytes:body,manifest,noticeBytes};
}
