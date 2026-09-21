import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateCountryData,countryFail} from '../../src/country-data.js';
import {createCountryClassifier} from '../../src/country-classifier.js';
import {parseDatabase} from '../../src/parser.js';
export function syntheticPoints(count){
 if(!Number.isSafeInteger(count)||count<1||count>1000000)throw Error('Synthetic count must be 1–1000000');
 const width=Math.ceil(Math.sqrt(count*2)),height=Math.ceil(count/width);
 return Array.from({length:count},(_,i)=>({id:String(i),longitude:-180+360*((i%width)+0.5)/width,latitude:-90+180*(Math.floor(i/width)+0.5)/height}));
}
export async function benchmarkCountries(items,{signal}={}){
 if(signal?.aborted)countryFail('COUNTRY_CANCELLED');
 const start=performance.now(),root=new URL('../../data/countries/',import.meta.url);
 const [bytes,manifestBytes,notice]=await Promise.all(['countries.json','manifest.json','NOTICE.json'].map(p=>readFile(new URL(p,root))));
 const data=await validateCountryData(bytes,JSON.parse(manifestBytes),notice),classifier=createCountryClassifier(data),indexed=performance.now();
 const result=await classifier.classifyMany(items,{signal}),counts={assigned:0,border:0,unassigned:0,invalid:0};
 for(const r of result.values())counts[r.status]++;
 return {points:result.size,counts,assetBytes:bytes.length,indexMs:indexed-start,elapsedMs:performance.now()-indexed,boundarySha256:classifier.boundary.sha256};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);let items;
 if(args.length===2&&args[0]==='--synthetic')items=syntheticPoints(Number(args[1]));
 else if(args.length===1)items=parseDatabase(await readFile(args[0])).records.map((r,i)=>({id:String(i),latitude:r.latitude,longitude:r.longitude}));
 else throw Error('Usage: benchmark.mjs BIN_PATH | --synthetic COUNT');
 console.log(JSON.stringify(await benchmarkCountries(items)));
}
