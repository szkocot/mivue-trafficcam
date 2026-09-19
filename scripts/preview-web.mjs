import { createServer } from 'node:http';
import { readFile,realpath,stat } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { pathToFileURL } from 'node:url';
export function createPreviewServer({base='/',root=resolve(import.meta.dirname,'../dist')}={}){
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
 return createServer(async(req,res)=>{
  try{
   if(!['GET','HEAD'].includes(req.method))throw Error();
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   if(!pathname.startsWith(base))throw Error();
   const relative=pathname.slice(base.length)||'index.html';
   const candidate=resolve(root,relative),actual=await realpath(candidate),realRoot=await realpath(root);
   if(!actual.startsWith(realRoot+sep) || !(await stat(actual)).isFile())throw Error();
   const bytes=await readFile(actual);
   res.writeHead(200,{'Content-Type':types[extname(actual)]??'text/plain','Content-Length':bytes.length,'X-Content-Type-Options':'nosniff'});
   res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404);res.end('Not found');}
 });
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),value=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
 const port=Number(value('--port','4173')),base=value('--base','/');
 createPreviewServer({base}).listen(port,'127.0.0.1',()=>console.log(`Preview http://127.0.0.1:${port}${base}`));
}
