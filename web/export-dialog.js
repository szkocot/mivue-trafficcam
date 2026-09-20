import { downloadBlob } from './downloads.js';
export function createExportDialog(element,{client,getIdentity,t,onSelect=()=>{},onBusy=()=>{}}){
 let prepared=null,token=0;
 const same=(a,b)=>a.sessionId===b.sessionId&&a.revision===b.revision;
 const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 function render(){
  const generation=++token;prepared=null;element.replaceChildren();element.append(el('h2',t('exports')),el('p',t('exportScope')),el('p',t('untested')));
  const error=el('div');error.dataset.testid='export-error';error.hidden=true;
  const report=el('div');report.dataset.testid='build-report';
  const add=(key,fn)=>{const b=el('button',t(key));b.onclick=fn;element.append(b);return b;};
  for(const [key,format] of [['project','project'],['dataJson','json'],['geojson','geojson'],['csv','csv']])add(key,async()=>{
   const identity=getIdentity();try{const result=await client.request('export',{format});if(same(identity,getIdentity()))downloadBlob({bytes:result.text,mime:result.mime,filename:result.filename});}catch(e){showError(e);}
  });
  add('referenceExport',async()=>{const identity=getIdentity();try{const result=await client.request('export-references');if(same(identity,getIdentity()))downloadBlob({bytes:result.text,mime:result.mime,filename:result.filename});}catch(e){showError(e);}});
  function showError(e){error.hidden=false;error.replaceChildren(el('p',t(e.code??'failed')));const details=el('details');details.append(el('summary',t('technical')),el('pre',e.message??''));error.append(details);
   const recordIds=new Set([e.recordId,...(e.issues??[]).map(issue=>issue.recordId)].filter(Boolean));
   for(const id of recordIds){const b=el('button',id);b.onclick=()=>{element.close();onSelect(id);};error.append(b);}}
  const build=add('build',async()=>{
   const identity=getIdentity();build.disabled=true;download.disabled=true;error.hidden=true;report.replaceChildren(el('p',t('busy')));onBusy(true);
   try{const result=await client.request('build');if(generation!==token||!same(identity,getIdentity()))return;
    prepared={...result,...identity};report.replaceChildren(el('h3',t('report')),el('p',`${t('active')}: ${result.report.recordCount} · ${t('bytes')}: ${result.report.byteLength}`),
     el('p',`${t('layout')}: ${t(result.report.layoutChanged?'yes':'no')}`));
    for(const w of [...(result.report.warnings??[]),...(result.report.diagnostics??[])])report.append(el('p',t(w.code??'diagnostic',{code:w.code??'UNKNOWN'})));
    download.disabled=false;
   }catch(e){if(generation===token){report.replaceChildren();showError(e);}}
   finally{if(generation===token)build.disabled=false;onBusy(false);}
  });
  const download=add('downloadBin',()=>{if(prepared&&same(prepared,getIdentity()))downloadBlob({bytes:prepared.bytes,mime:'application/octet-stream',filename:'Speedcam_Data_FEU.bin'});else download.disabled=true;});download.disabled=true;
  add('close',()=>element.close());element.append(error,report);
 }
 return {open(){render();element.showModal();},invalidate(){prepared=null;token++;if(element.open)element.close();}};
}
