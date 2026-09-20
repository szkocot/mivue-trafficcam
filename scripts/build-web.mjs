import { mkdir,copyFile,readdir,unlink } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..'),dist=resolve(root,'dist');
const core=['parser','spatial','project','encoder','sources','project-view','history','view-filter','ingestion-state','import-normalize'];
const web=['app','map','record-list','i18n','storage','source-cache','autosave','worker','worker-session','worker-client','details','downloads','export-dialog','location'];
const files=[['web/index.html','index.html'],['web/styles.css','web/styles.css'],
 ...core.map(n=>[`src/${n}.js`,`src/${n}.js`]),...web.map(n=>[`web/${n}.js`,`web/${n}.js`]),
 ...['en','pl'].map(n=>[`web/locales/${n}.js`,`web/locales/${n}.js`]),
 ...['leaflet.js','leaflet.css','images/layers.png','images/layers-2x.png','images/marker-icon.png','images/marker-icon-2x.png','images/marker-shadow.png'].map(n=>[`node_modules/leaflet/dist/${n}`,`vendor/${n}`]),
 ['node_modules/leaflet/LICENSE','vendor/Leaflet-LICENSE']];
await mkdir(dist,{recursive:true});
const allowed=new Set(files.map(([,target])=>target));
for(const entry of await readdir(dist,{recursive:true,withFileTypes:true})){
 if(!entry.isDirectory()){
  const absolute=resolve(entry.parentPath,entry.name),relative=absolute.slice(dist.length+1);
  if(!allowed.has(relative))await unlink(absolute);
 }
}
for(const [source,target] of files){await mkdir(dirname(resolve(dist,target)),{recursive:true});await copyFile(resolve(root,source),resolve(dist,target));}
console.log(`Built ${files.length} allowlisted assets in dist/`);
