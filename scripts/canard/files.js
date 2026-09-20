import {lstat,readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {canonical,validateManifest,validateSnapshot} from '../../src/canard-snapshot.js';
export const fail=code=>{throw Object.assign(new Error(code),{code});};
const check=ok=>{if(!ok)fail('CANARD_INVALID_FILES');};
const json=value=>Buffer.from(canonical(value)+'\n');
export async function preparedFiles(prepared){
 check(prepared&&Object.keys(prepared).every(k=>['manifest','bytes','noticeBytes','changed'].includes(k)));
 const manifest=validateManifest(prepared.manifest),files={'data/canard/manifest.json':json(manifest)};
 if(manifest.state==='active'){
  const snapshot=await validateSnapshot(prepared.bytes,manifest);
  check(prepared.noticeBytes instanceof Uint8Array&&Buffer.from(prepared.noticeBytes).equals(json(snapshot.notices)));
  files[manifest.path]=Buffer.from(prepared.bytes);files[manifest.noticePath]=Buffer.from(prepared.noticeBytes);
 }else check(prepared.bytes===undefined&&prepared.noticeBytes===undefined);
 return files;
}
/** Validate the whole checkout, not just the paths named by its manifest. */
export async function readDataset(directory){
 const root=resolve(directory);check((await lstat(root)).isDirectory());const found=[];
 async function walk(relative=''){
  for(const entry of await readdir(resolve(root,relative),{withFileTypes:true})){
   const path=relative?`${relative}/${entry.name}`:entry.name;
   if(path==='.git'){check(!entry.isSymbolicLink());continue;}
   check(!entry.isSymbolicLink());
   if(entry.isDirectory()){check(['data','data/canard'].includes(path));await walk(path);}
   else{check(entry.isFile());found.push(path);}
  }
 }
 await walk();check(found.includes('data/canard/manifest.json'));
 async function bounded(path,max){const absolute=resolve(root,path);check((await lstat(absolute)).size<=max);const bytes=await readFile(absolute);check(bytes.length<=max);return bytes;}
 const manifest=validateManifest(JSON.parse(await bounded('data/canard/manifest.json',65536)));
 const expected=manifest.state==='active'?['data/canard/manifest.json',manifest.path,manifest.noticePath]:['data/canard/manifest.json'];
 check(found.length===expected.length&&found.every(p=>expected.includes(p)));
 const prepared={manifest};if(manifest.state==='active'){prepared.bytes=await bounded(manifest.path,20*1024*1024);prepared.noticeBytes=await bounded(manifest.noticePath,65536);}
 await preparedFiles(prepared);return prepared;
}
/** Destination must be fresh: never overwrite user files or follow existing links. */
export async function writeDataset(directory,prepared){
 const files=await preparedFiles(prepared),root=resolve(directory);await mkdir(root,{recursive:true});
 check((await lstat(root)).isDirectory()&&(await readdir(root)).length===0);
 for(const [path,bytes] of Object.entries(files)){await mkdir(dirname(resolve(root,path)),{recursive:true});await writeFile(resolve(root,path),bytes,{flag:'wx'});}
}
