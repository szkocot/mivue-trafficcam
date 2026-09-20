export class CountryError extends Error {
 constructor(code,message=code){super(message);this.name='CountryError';this.code=code;}
}
export const countryFail=code=>{throw new CountryError(code);};
const check=(ok,code='COUNTRY_DATA_INVALID')=>{if(!ok)countryFail(code);};
const keys=(x,list)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===list.length&&list.every(k=>Object.hasOwn(x,k));
const string=(s,max=200)=>typeof s==='string'&&s.length>0&&s.length<=max&&!/[\u0000-\u001f]/.test(s);
const https=s=>{try{return typeof s==='string'&&s.length<2048&&new URL(s).protocol==='https:'&&!new URL(s).username&&!new URL(s).password;}catch{return false;}};
const digest=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
export const COUNTRY_MAX_BYTES=20*1024*1024;
export async function countryHash(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
export function validateCountryManifest(m){
 check(keys(m,['schemaVersion','release','path','sha256','byteLength','featureCount','positionCount','sourceUrl','sourceCommit','sourceArchiveSha256','sourceGeoJsonSha256','noticePath','noticeSha256']));
 check(m.schemaVersion===1&&m.release==='5.1.1'&&m.path==='data/countries/countries.json'&&m.noticePath==='data/countries/NOTICE.json');
 check([m.sha256,m.sourceArchiveSha256,m.sourceGeoJsonSha256,m.noticeSha256].every(digest)&&typeof m.sourceCommit==='string'&&/^[a-f0-9]{40}$/.test(m.sourceCommit)&&https(m.sourceUrl));
 for(const [field,max]of [['byteLength',COUNTRY_MAX_BYTES],['featureCount',1000],['positionCount',2000000]]){
  check(Number.isSafeInteger(m[field])&&m[field]>0);check(m[field]<=max,'COUNTRY_DATA_LIMIT');
 }
 return m;
}
function validateDataset(d){
 check(keys(d,['schemaVersion','countries'])&&d.schemaVersion===1&&Array.isArray(d.countries)&&d.countries.length>0);
 check(d.countries.length<=1000,'COUNTRY_DATA_LIMIT');
 let positionCount=0;const ids=new Set(),isos=new Set();
 for(const c of d.countries){
  check(keys(c,['id','iso2','names','geometry'])&&string(c.id,80)&&/^[a-zA-Z0-9:._-]+$/.test(c.id)&&!ids.has(c.id));ids.add(c.id);
  check(c.iso2===null||(typeof c.iso2==='string'&&/^[A-Z]{2}$/.test(c.iso2)&&!isos.has(c.iso2)));if(c.iso2)isos.add(c.iso2);
  check(keys(c.names,['en','pl'])&&string(c.names.en)&&string(c.names.pl));
  const g=c.geometry;check(keys(g,['type','coordinates'])&&['Polygon','MultiPolygon'].includes(g.type)&&Array.isArray(g.coordinates));
  const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;check(polygons.length>0&&polygons.length<=2000000);
  for(const p of polygons){
   check(Array.isArray(p)&&p.length>0&&p.length<=2000000);
   for(const r of p){
    check(Array.isArray(r)&&r.length>=4);positionCount+=r.length;check(positionCount<=2000000,'COUNTRY_DATA_LIMIT');
    for(const xy of r)check(Array.isArray(xy)&&xy.length===2&&xy.every(Number.isFinite)&&Math.abs(xy[0])<=180&&Math.abs(xy[1])<=90);
    check(r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1]);
    check(new Set(r.map(x=>`${x[0]},${x[1]}`)).size>=3);
   }
  }
 }
 return positionCount;
}
function parse(bytes){try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{countryFail('COUNTRY_DATA_INVALID');}}
export async function validateCountryData(bytes,manifest,noticeBytes){
 check(bytes instanceof Uint8Array&&noticeBytes instanceof Uint8Array);
 check(bytes.byteLength<=COUNTRY_MAX_BYTES&&noticeBytes.byteLength<=65536,'COUNTRY_DATA_LIMIT');
 validateCountryManifest(manifest);
 check(bytes.byteLength===manifest.byteLength&&await countryHash(bytes)===manifest.sha256,'COUNTRY_DATA_HASH');
 check(await countryHash(noticeBytes)===manifest.noticeSha256,'COUNTRY_DATA_HASH');
 const dataset=parse(bytes),notice=parse(noticeBytes),positions=validateDataset(dataset);
 check(dataset.countries.length===manifest.featureCount&&positions===manifest.positionCount);
 check(keys(notice,['attribution','licence','sourceUrl','termsUrl','disclaimer','transformation']));
 check(string(notice.attribution,500)&&string(notice.licence,500)&&string(notice.disclaimer,4000)&&string(notice.transformation,1000)&&https(notice.sourceUrl)&&https(notice.termsUrl));
 return {dataset,manifest:structuredClone(manifest),notice};
}
export function normalizeCountries(geojson,review){
 check(geojson?.type==='FeatureCollection'&&Array.isArray(geojson.features)&&Array.isArray(review?.nullIsoIds));
 const countries=geojson.features.map(f=>{
  const p=f.properties;check(f.type==='Feature'&&Number.isSafeInteger(p?.NE_ID)&&p.NE_ID>0);
  const id=`ne:${p.NE_ID}`,omit=review.nullIsoIds.includes(id);
  check(omit||/^[A-Z]{2}$/.test(p.ISO_A2));
  return {id,iso2:omit?null:p.ISO_A2,names:{en:p.NAME_EN,pl:p.NAME_PL||p.NAME_EN},geometry:structuredClone(f.geometry)};
 }).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 const dataset={schemaVersion:1,countries};validateDataset(dataset);return dataset;
}
