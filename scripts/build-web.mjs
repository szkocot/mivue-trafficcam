import { mkdir,copyFile,readdir,unlink,writeFile,lstat,readFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import {pathToFileURL} from 'node:url';
import {readDataset,preparedFiles} from './canard/files.js';
import {validateCountryData,COUNTRY_MAX_BYTES} from '../src/country-data.js';
const root=resolve(import.meta.dirname,'..'),dist=resolve(root,'dist');
const core=['parser','spatial','project','encoder','sources','project-view','history','view-filter','ingestion-state','import-normalize','import-view','import-csv','import-geojson','import-spatial','reconcile','source-metadata','canard-snapshot','source-notices'];
const web=['app','map','record-list','i18n','storage','source-cache','autosave','worker','worker-session','worker-client','details','downloads','export-dialog','location','import-dialog','import-results','import-sources','metadata-options','canard-cache','canard-sync'];
const files=[['web/index.html','index.html'],['web/styles.css','web/styles.css'],
 ['src/country-data.js','src/country-data.js'],
 ...core.map(n=>[`src/${n}.js`,`src/${n}.js`]),...web.map(n=>[`web/${n}.js`,`web/${n}.js`]),
 ...['en','pl'].map(n=>[`web/locales/${n}.js`,`web/locales/${n}.js`]),
 ...['leaflet.js','leaflet.css','images/layers.png','images/layers-2x.png','images/marker-icon.png','images/marker-icon-2x.png','images/marker-shadow.png'].map(n=>[`node_modules/leaflet/dist/${n}`,`vendor/${n}`]),
 ['node_modules/leaflet/LICENSE','vendor/Leaflet-LICENSE']];
export async function buildWeb({outputDir=dist,canardDir=null,countriesDir=resolve(root,'data/countries')}={}){
const dist=resolve(outputDir),dataset=canardDir?await preparedFiles(await readDataset(canardDir)):{};
if(!(await lstat(countriesDir)).isDirectory())throw Error('Country asset input must be a real directory');
const countries={};
for(const name of ['manifest.json','countries.json','NOTICE.json']){
 const path=resolve(countriesDir,name),stat=await lstat(path),max=name==='countries.json'?COUNTRY_MAX_BYTES:65536;
 if(!stat.isFile()||stat.size>max)throw Error('Invalid country asset');
 const bytes=await readFile(path);if(bytes.length>max)throw Error('Oversized country asset');
 countries[`data/countries/${name}`]=bytes;
}
await validateCountryData(countries['data/countries/countries.json'],JSON.parse(countries['data/countries/manifest.json']),countries['data/countries/NOTICE.json']);
Object.assign(dataset,countries);
await mkdir(dist,{recursive:true});
if(!(await lstat(dist)).isDirectory())throw Error('Build output must be a real directory');
const allowed=new Set(files.map(([,target])=>target));
for(const path of Object.keys(dataset))allowed.add(path);
for(const entry of await readdir(dist,{recursive:true,withFileTypes:true})){
 if(!entry.isDirectory()){
  const absolute=resolve(entry.parentPath,entry.name),relative=absolute.slice(dist.length+1);
  if(entry.isSymbolicLink()||!allowed.has(relative))await unlink(absolute);
 }
}
for(const [source,target] of files){await mkdir(dirname(resolve(dist,target)),{recursive:true});await copyFile(resolve(root,source),resolve(dist,target));}
for(const [target,bytes] of Object.entries(dataset)){await mkdir(dirname(resolve(dist,target)),{recursive:true});await writeFile(resolve(dist,target),bytes);}
console.log(`Built ${files.length} allowlisted assets, 3 country files and ${Object.keys(dataset).length-3} CANARD files`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--canard-dir'))throw Error('Usage: build-web.mjs [--canard-dir CHECKOUT]');
 await buildWeb({canardDir:args[1]??null});
}
