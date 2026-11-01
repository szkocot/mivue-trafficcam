#!/usr/bin/env node
import {readFile,lstat,mkdir,writeFile,realpath} from 'node:fs/promises';
import {resolve,basename,join,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readDataset} from './canard/files.js';
import {validateSnapshot,sha256,CANARD_NAMESPACE,canonical} from '../src/canard-snapshot.js';
import {createProject,loadProject,validateProject} from '../src/project.js';
import {buildProject,BuildError} from '../src/encoder.js';
import {projectView} from '../src/project-view.js';
import {referenceView} from '../src/import-view.js';
import {validateCountryData} from '../src/country-data.js';
import {createCountryClassifier} from '../src/country-classifier.js';
import {compareCanardMio} from '../src/source-comparison.js';
import {verifyHostedImport} from './verification/import-check.js';
import {comparisonHtml,comparisonCsv,comparisonGeoJson,speedInventoryCsv,speedCounts} from './verification/report.js';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
async function destination(path){try{return await realpath(path);}catch(error){if(error.code!=='ENOENT')throw error;return join(await destination(dirname(path)),basename(path));}}
const usage='Usage: node scripts/compare-sources.mjs --mio <original.bin|project.json> --canard-dir <accepted-data-directory> --output <new-directory>';
async function bounded(path,max){const stat=await lstat(path);if(!stat.isFile()||stat.size>max)throw Error('Invalid or oversized input: '+basename(path));const b=await readFile(path);if(b.length>max)throw Error('Input grew past its size limit');return b;}
try{
 const args=process.argv.slice(2);if(args.length!==6||args[0]!=='--mio'||args[2]!=='--canard-dir'||args[4]!=='--output')throw Error(usage);
 const [input,canardDir,requestedOutput]=[args[1],args[3],args[5]].map(p=>resolve(p));
 const output=await destination(requestedOutput),canardRoot=await realpath(canardDir);
 if(output===canardRoot||output.startsWith(canardRoot+sep))throw Error('Report output must not be inside the CANARD input directory');
 const file=await bounded(input,80*1024*1024);
 const project=input.toLowerCase().endsWith('.json')?await loadProject(file.toString('utf8')):await createProject(file,{name:basename(input)});
 const {bytes,baseline}=await validateProject(project),view=await projectView(project);
 const prepared=await readDataset(canardDir);if(prepared.manifest.state!=='active')throw Error('CANARD source is disabled; comparison cannot proceed');
 const hosted=await validateSnapshot(prepared.bytes,prepared.manifest),countryDir=join(root,'data/countries');
 const countryBytes=await bounded(join(countryDir,'countries.json'),20*1024*1024),countryManifest=JSON.parse(await bounded(join(countryDir,'manifest.json'),65536)),noticeBytes=await bounded(join(countryDir,'NOTICE.json'),65536);
 const countries=await validateCountryData(countryBytes,countryManifest,noticeBytes),classifier=createCountryClassifier(countries);
 const poland=countries.dataset.countries.find(c=>c.iso2==='PL');if(!poland)throw Error('Pinned boundary data has no reviewed PL code');
 const report=compareCanardMio({database:{...baseline,records:view.records},batch:hosted.batch,classifier,countryId:poland.id});
 report.inputs={mio:{name:basename(input),sha256:project.source.sha256,byteLength:bytes.length,recordCount:baseline.summary.recordCount,retrievedAt:null,retrievalNote:'Upstream retrieval time is not encoded in a local BIN/project; hash and header identify this input.',version:baseline.header.versionCandidate,cellDimensions:baseline.header.cellDimensions},
  projectFileSha256:await sha256(file),canard:prepared.manifest,boundaries:{release:countryManifest.release,sha256:countryManifest.sha256}};
 report.sourceNotices=[hosted.notices];report.boundaryNotice=countries.notice;
 report.importVerification=await verifyHostedImport(bytes,prepared);
 const observations=new Map(hosted.batch.observations.map(o=>[o.sourceId,o])),records=new Map(view.records.map(r=>[r.id,r]));
 const ownership=new Map(project.ingestion.ownership.map(o=>[o.recordId,o.coordinates]));
 report.projectBindings=referenceView(project).filter(o=>o.namespace===CANARD_NAMESPACE&&o.recordId).map(o=>{
  const record=records.get(o.recordId),current=observations.get(o.sourceId);
  return {sourceId:o.sourceId,recordId:o.recordId,deleted:Boolean(record?.deleted),recordPresent:Boolean(record),kind:o.kind,
   latestGeometry:current?.geometry??null,storedSourceGeometry:o.geometry,binCoordinates:record?[record.longitude,record.latitude]:null,
   storedSourceSpeedKmh:o.speedKmh,latestSourceSpeedKmh:current?.speedKmh??null,rawBinSpeed:record?.rawBytes16To19[0]??null,rawBinType:record?.typeRaw??null,
   storedObservationRetrievedAt:o.retrievedAt,snapshotRetrievedAt:hosted.batch.retrievedAt,
   geometryMatchesLatest:Boolean(current&&canonical(current.geometry)===canonical(o.geometry)),
   metadataDifferences:current?Object.keys(current).filter(field=>canonical(current[field])!==canonical(o[field])):[],
   manuallyOwnedCoordinates:ownership.get(o.recordId)==='manual',generatedRecord:record?.originalSourceOffset===null,templateId:record?.templateId??null,sourceOnlySinceUpdate:!current,
   status:!record?'invalid-target':record.deleted?'protected-deletion':o.kind==='section'?'unsupported-section-binding':'identity-review-required'};
 });
 if(input.toLowerCase().endsWith('.json')){
  try{const built=await buildProject(project);report.currentProjectBuild={passed:true,sha256:await sha256(built.bytes),...built.report};}
  catch(error){if(!(error instanceof BuildError))throw error;report.currentProjectBuild={passed:false,code:error.code,message:error.message,deviceAcceptance:'untested'};}
 }else report.currentProjectBuild={passed:true,originalByteIdentical:true,deviceAcceptance:'untested'};
 const files={'NOTICE.json':JSON.stringify({sourceNotices:report.sourceNotices,boundaryNotice:report.boundaryNotice,inputs:report.inputs,containsLocallyDerivedMioData:true},null,2)+'\n','comparison.json':JSON.stringify(report,null,2)+'\n','comparison.csv':comparisonCsv(report),'bin-speed-inventory.csv':speedInventoryCsv(view.records),'comparison.geojson':comparisonGeoJson(report),'index.html':comparisonHtml(report,poland)};
 // Every input and all report content are validated before a fresh destination is created.
 await mkdir(dirname(output),{recursive:true});await mkdir(output);for(const [name,text]of Object.entries(files))await writeFile(join(output,name),text,{flag:'wx'});
 process.stdout.write(JSON.stringify({output,inputs:report.inputs,scope:report.scope,counts:report.counts,speed:speedCounts(report.speed),speedCompliance:report.speedCompliance,importVerification:report.importVerification,currentProjectBuild:report.currentProjectBuild},null,2)+'\n');
}catch(error){process.stderr.write(`${error.code??'COMPARISON_FAILED'}: ${error.message}\n`);process.exitCode=1;}
