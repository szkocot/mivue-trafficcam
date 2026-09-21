import {downloadBlob} from './downloads.js';
import {createCountryExportControls} from './country-export-controls.js';
export function createExportDialog(element,{client,getIdentity,getNotices=()=>[],t,onSelect=()=>{},onBusy=()=>{}}){
 let prepared=null,token=0,controls=null,download=null,companion=null,selectionReport=null;
 const same=(a,b)=>a.sessionId===b.sessionId&&a.revision===b.revision;
 const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 function clear(){prepared=null;selectionReport=null;token++;if(download)download.disabled=true;if(companion)companion.disabled=true;}
 function render(){
  controls?.destroy();clear();element.replaceChildren();element.append(el('h2',t('exports')),el('p',t('exportScope')),el('p',t('untested')));
  const countryElement=el('section');element.append(countryElement);
  controls=createCountryExportControls(countryElement,{client,getIdentity,t,onInvalidate:clear,onPreview:p=>{selectionReport=p;companion.disabled=false;}});
  const error=el('div');error.dataset.testid='export-error';error.hidden=true;const report=el('div');report.dataset.testid='build-report';
  const add=(key,fn)=>{const b=el('button',t(key));b.onclick=fn;element.append(b);return b;};
  const noticeIdentity=getIdentity(),notices=getNotices();
  if(notices.length){element.append(el('p',t('sourceNoticeReminder')));add('sourceNoticeDownload',()=>{if(same(noticeIdentity,getIdentity()))downloadBlob({bytes:JSON.stringify(notices,null,2)+'\n',mime:'application/json',filename:'Speedcam_Data_FEU-NOTICE.json'});});}
  companion=add('countryReportDownload',()=>{if(selectionReport)downloadBlob({bytes:JSON.stringify(selectionReport,null,2)+'\n',mime:'application/json',filename:'mivue-country-selection-NOTICE.json'});});companion.disabled=true;
  function showError(e){error.hidden=false;error.replaceChildren(el('p',t(e.code??'failed')));const details=el('details');details.append(el('summary',t('technical')),el('pre',e.message??''));error.append(details);
   for(const id of new Set([e.recordId,...(e.issues??[]).map(i=>i.recordId)].filter(Boolean))){const b=el('button',id);b.onclick=()=>{element.close();onSelect(id);};error.append(b);}}
  async function request(format){
   const scope=format==='project'?null:controls.getPreparedScope();
   return scope?client.request('country-export',{expectedRevision:scope.revision,generation:scope.generation,token:scope.token,format}):client.request(format==='bin'?'build':format==='references'?'export-references':'export',format==='bin'||format==='references'?{}:{format});
  }
  for(const [key,format]of [['countryFullBackup','project'],['dataJson','json'],['geojson','geojson'],['csv','csv'],['referenceExport','references']])add(key,async()=>{
   const identity=getIdentity(),ticket=token;try{const result=await request(format);if(ticket!==token||!same(identity,getIdentity())||!element.open)return;
    if(result.selectionReport){selectionReport=result.selectionReport;companion.disabled=false;}downloadBlob({bytes:result.text,mime:result.mime,filename:result.filename});
   }catch(e){if(ticket===token)showError(e);}
  });
  const build=add('build',async()=>{
   const identity=getIdentity(),ticket=token;build.disabled=true;download.disabled=true;error.hidden=true;report.replaceChildren(el('p',t('busy')));onBusy(true);
   try{const result=await request('bin');if(ticket!==token||!same(identity,getIdentity())||!element.open)return;
    prepared={...result,...identity,ticket};if(result.selectionReport){selectionReport=result.selectionReport;companion.disabled=false;}
    report.replaceChildren(el('h3',t('report')),el('p',`${t('active')}: ${result.report.recordCount} · ${t('bytes')}: ${result.report.byteLength}`),el('p',`${t('layout')}: ${t(result.report.layoutChanged?'yes':'no')}`));
    for(const w of [...(result.report.warnings??[]),...(result.report.diagnostics??[])])report.append(el('p',t(w.code??'diagnostic',{code:w.code??'UNKNOWN'})));download.disabled=false;
   }catch(e){if(ticket===token){report.replaceChildren();showError(e);}}
   finally{build.disabled=false;onBusy(false);}
  });
  download=add('downloadBin',()=>{if(prepared&&prepared.ticket===token&&same(prepared,getIdentity()))downloadBlob({bytes:prepared.bytes,mime:'application/octet-stream',filename:'Speedcam_Data_FEU.bin'});else download.disabled=true;});download.disabled=true;
  add('close',()=>element.close());element.append(error,report);
 }
 element.addEventListener('close',()=>{controls?.destroy();controls=null;clear();});
 return {open(){render();element.showModal();},invalidate(){controls?.cancel();clear();if(element.open)element.close();}};
}
