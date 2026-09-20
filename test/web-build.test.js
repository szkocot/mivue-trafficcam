import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { createPreviewServer } from '../scripts/preview-web.mjs';
test('allowlisted build and subpath preview never expose repo or traversal',async()=>{
 execFileSync(process.execPath,['scripts/build-web.mjs']);
 const files=await readdir('dist',{recursive:true});
 assert.equal(files.some(f=>f.endsWith('.bin') || f.startsWith('test/') || f.includes('.git')),false);
 const server=createPreviewServer({base:'/mivue-trafficcam/'});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const root=`http://127.0.0.1:${server.address().port}`;
  for(const p of ['/mivue-trafficcam/','/mivue-trafficcam/web/worker.js','/mivue-trafficcam/web/canard-cache.js','/mivue-trafficcam/web/canard-sync.js','/mivue-trafficcam/src/canard-snapshot.js','/mivue-trafficcam/src/source-notices.js'])assert.equal((await fetch(root+p)).status,200);
  for(const p of ['/README.md','/mivue-trafficcam/Speedcam_Data_FEU.bin','/mivue-trafficcam/.git/config','/mivue-trafficcam/%2e%2e%2fREADME.md'])assert.equal((await fetch(root+p)).status,404);
 }finally{await new Promise(r=>server.close(r));}
});
