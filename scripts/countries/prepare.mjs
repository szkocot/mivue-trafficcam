import {readFile,mkdir,writeFile,lstat,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {countryHash,normalizeCountries,validateCountryData,countryFail,COUNTRY_MAX_BYTES} from '../../src/country-data.js';
const encode=x=>new TextEncoder().encode(JSON.stringify(x)+'\n');
export async function prepareCountries(input,review){
 if(input.byteLength>COUNTRY_MAX_BYTES)countryFail('COUNTRY_DATA_LIMIT');
 if(await countryHash(input)!==review.sourceGeoJsonSha256)countryFail('COUNTRY_DATA_HASH');
 const dataset=normalizeCountries(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(input)),review),bytes=encode(dataset),noticeBytes=encode(review.notice);
 let positionCount=0;for(const c of dataset.countries)for(const p of c.geometry.type==='Polygon'?[c.geometry.coordinates]:c.geometry.coordinates)for(const r of p)positionCount+=r.length;
 const manifest={schemaVersion:1,release:review.release,path:'data/countries/countries.json',sha256:await countryHash(bytes),byteLength:bytes.length,featureCount:dataset.countries.length,positionCount,sourceUrl:review.sourceUrl,sourceCommit:review.sourceCommit,sourceArchiveSha256:review.sourceArchiveSha256,sourceGeoJsonSha256:review.sourceGeoJsonSha256,noticePath:'data/countries/NOTICE.json',noticeSha256:await countryHash(noticeBytes)};
 await validateCountryData(bytes,manifest,noticeBytes);return {bytes,manifest,noticeBytes};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [input,output,...extra]=process.argv.slice(2);if(!input||!output||extra.length)throw Error('Usage: prepare.mjs INPUT OUTPUT');
 if((await lstat(input)).size>COUNTRY_MAX_BYTES)countryFail('COUNTRY_DATA_LIMIT');
 const review=JSON.parse(await readFile(new URL('../../config/countries-review.json',import.meta.url))),result=await prepareCountries(await readFile(input),review);
 await mkdir(output,{recursive:true});if(!(await lstat(output)).isDirectory()||(await readdir(output)).length)throw Error('Output must be a fresh real directory');
 for(const [name,bytes]of [['countries.json',result.bytes],['manifest.json',encode(result.manifest)],['NOTICE.json',result.noticeBytes]])await writeFile(resolve(output,name),bytes,{flag:'wx'});
 console.log(JSON.stringify(result.manifest));
}
