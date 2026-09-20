import {listImportSources} from './import-sources.js';
export function createImportDialog({onImport,onCancel,t,storage}){
 const dialog=document.createElement('dialog');dialog.className='import-dialog';document.body.append(dialog);
 let token=0,snapshot=null,fields={},committing=false,remembered={namespace:'',attribution:''};
 try{const saved=JSON.parse(storage?.getItem('mivue-import-source')??'null');if(saved&&typeof saved.namespace==='string'&&typeof saved.attribution==='string')remembered=saved;}catch{}
 const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const cancel=()=>{if(committing)return;token++;dialog.close();onCancel?.();};dialog.oncancel=e=>{e.preventDefault();cancel();};
 function render(){
  ++token;committing=false;dialog.replaceChildren(el('h2',t('import')),el('p',t('importHelp')),el('p',t('importSafety')));fields={};
  for(const source of listImportSources().filter(s=>!s.available))dialog.append(el('p',t(source.reasonCode)));
  function field(key,type='text'){const label=el('label',t(key)),input=el('input');input.type=type;label.append(input);dialog.append(label);fields[key]=input;return input;}
  field('namespace').value=remembered.namespace;field('attribution').value=remembered.attribution;
  function select(key,choices){const label=el('label',t(key)),input=el('select');input.setAttribute('aria-label',t(key));for(const [value,name] of choices){const option=el('option',t(name));option.value=value;input.append(option);}label.append(input);dialog.append(label);fields[key]=input;return input;}
  select('importFormat',[['csv','importCsv'],['geojson','importGeojson']]);
  field('templateId');select('templateKind',[['camera','kind_camera'],['red-light','kind_red-light']]);field('templateAck','checkbox');dialog.append(el('p',t('templateHint')));
  const file=field('importFile','file');file.accept='.csv,.geojson,.json';
  const error=el('p');error.setAttribute('role','alert');dialog.append(error);
  const button=el('button',t('cancel'));button.onclick=cancel;dialog.append(button);
  file.onchange=async()=>{
   const selected=file.files[0];if(!selected)return;const current=++token;error.textContent='';
   const source={namespace:fields.namespace.value,attribution:fields.attribution.value,url:null},templateId=fields.templateId.value.trim();
   const policies=[];
   if(templateId){const record=snapshot?.view.records.find(r=>r.id===templateId);
    if(!fields.templateAck.checked||!record||record.originalSourceOffset===null||![1,3,5].includes(record.typeRaw)||record.originalLinkRaw!==0){error.textContent=t('templateRequiredAck');file.value='';return;}
    policies.push({namespace:source.namespace,kind:fields.templateKind.value,templateId});
   }
   if(selected.size>20*1024*1024){error.textContent=t('importFailed')+' '+t('importHelp');file.value='';return;}
   const format=fields.importFormat.value;for(const input of Object.values(fields))input.disabled=true;
   try{
    const text=await selected.text();if(current!==token)return;
    await onImport({text,format,source,retrievedAt:new Date().toISOString(),policies},()=>current===token,()=>{committing=true;button.disabled=true;});
    if(current!==token)return;remembered={namespace:source.namespace,attribution:source.attribution};try{storage?.setItem('mivue-import-source',JSON.stringify(remembered));}catch{}
    dialog.close();
   }catch(e){if(current===token){error.textContent=t(e.code==='STALE_IMPORT'?'STALE_IMPORT':'importFailed');for(const issue of (e.issues??[]).slice(0,10))error.textContent+=' '+t('importIssue',{row:issue.index+1,field:issue.field,code:issue.code});}}
   finally{if(current===token){committing=false;for(const input of Object.values(fields))input.disabled=false;file.value='';button.disabled=false;}}
  };
 }
 return {open(s){snapshot=s;render();dialog.showModal();},sync(s){snapshot=s;},destroy(){token++;dialog.remove();}};
}
