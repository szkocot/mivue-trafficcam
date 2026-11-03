import {readFile,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readDataset} from '../canard/files.js';
import {validateSnapshot} from '../../src/canard-snapshot.js';
import {createRoadResolver} from '../../src/road-directions.js';
import {applyRoadDirectionData} from '../../src/road-direction-data.js';
import {writeRoadData} from './files.js';
export async function resolveRoadData({canardDir,contextPath,outputDir}){
 const dataset=await readDataset(canardDir);if(dataset.manifest.state!=='active')throw Error('CANARD dataset is unavailable');
 const {batch}=await validateSnapshot(dataset.bytes,dataset.manifest),stat=await lstat(contextPath);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>512*1024*1024)throw Error('Invalid or oversized road context');
 const bytes=await readFile(contextPath);if(bytes.length>512*1024*1024)throw Error('Oversized road context');
 const context=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),resolver=createRoadResolver(context),resolutions=resolver.resolveBatch(batch.observations);
 const data={schema:'mivue-canard-road-directions',version:1,source:context.source,resolutions:Object.fromEntries(batch.observations.map((o,i)=>[o.sourceId,resolutions[i]]))};
 applyRoadDirectionData(batch,data);
 const manifest=await writeRoadData(outputDir,data),counts={};for(const r of resolutions)counts[r.status]=(counts[r.status]??0)+1;
 return {manifest,counts};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);if(args.length!==3){console.error('Usage: resolve.mjs CANARD_DIR CONTEXT_JSON FRESH_OUTPUT_DIR');process.exitCode=1;}
 else try{console.log(JSON.stringify(await resolveRoadData({canardDir:args[0],contextPath:args[1],outputDir:args[2]})));}catch(error){console.error(error.message);process.exitCode=1;}
}
