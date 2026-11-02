import {directionRows,speedLabel} from '../src/source-metadata.js';
import {sourceDirectionLabel} from '../src/source-direction.js';
const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
export function createMergeDialog({client,getIdentity,getReferences,onApply,onBusy,onClose,t}){
 const dialog=document.createElement('dialog');dialog.className='merge-dialog';document.body.append(dialog);
 let preview=null,identity=null,page=0,rows=[],choices=new Map(),selected=new Map(),committing=false;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 function close(){if(committing)return;dialog.close();preview=null;onClose?.();}
 dialog.oncancel=e=>{e.preventDefault();close();};
 const ids=row=>[...new Set(choices.get(row.id).filter(c=>selected.get(row.id).has(c.key)).flatMap(c=>c.recordIds))];
 const changes=()=>rows.flatMap(row=>{const recordIds=ids(row);return same(recordIds,row.boundRecordIds)?[]:[{namespace:row.namespace,sourceId:row.sourceId,action:recordIds.length?'bind':'reference',...(recordIds.length?{recordIds}:{})}];});
 function render(){
  dialog.replaceChildren(el('h2',t('mergeSources')),el('p',t('mergeHelp')),el('p',t('mergeCounts',preview.summary)));
  const refs=new Map(getReferences().map(r=>[r.id,r]));
  const selectUnique=el('button',t('mergeSelectUnique'));selectUnique.onclick=()=>{for(const row of rows)if(!row.boundRecordIds.length)selected.set(row.id,new Set(row.bulkSafe?[choices.get(row.id)[0].key]:[]));render();};dialog.append(selectUnique);
  const list=el('div');list.dataset.testid='merge-candidates';
  for(const row of rows.slice(page*50,(page+1)*50)){
   const section=el('fieldset');section.dataset.testid='merge-row';section.append(el('legend',row.sourceId),el('p',`${t(`kind_${row.kind}`)} · ${t(`merge_${row.status}`)} · ${sourceDirectionLabel(refs.get(row.id)??row,t)}`));
   section.append(el('p',`${t('speedLimit')}: ${speedLabel([refs.get(row.id)??{speedKmh:row.sourceSpeedKmh,attribution:''}],t)}`));
   if(!row.candidates.length&&!row.boundRecordIds.length)section.append(el('p',t('mergeNoCandidate')));
   for(const c of choices.get(row.id)){
    const label=el('label'),input=el('input');input.type='checkbox';input.checked=selected.get(row.id).has(c.key);
    const distances=c.endpointMetres??(Number.isFinite(c.metres)?[c.metres]:[]);
    const speed=(c.records??[]).map(r=>r.decodedSpeed?.speedKmh==null?`${t('speedUnknown')} (BIN ${r.rawSpeed})`:`${r.decodedSpeed.speedKmh} km/h`).join(' / ');
    label.append(input,document.createTextNode(`${c.recordIds.join(' + ')}${distances.length?' · '+distances.map(n=>n.toFixed(1)+' m').join(' / '):''}${speed?' · '+speed:''}${c.existing?' · '+t('mergeExisting'):''}`));
    if(refs.get(row.id)?.originalProperties?.canardDetail)for(const[key,value]of directionRows(refs.get(row.id),t,c.records??[]))label.append(el('small',` · ${key}: ${value}`));
    input.onchange=()=>{if(input.checked)selected.get(row.id).add(c.key);else selected.get(row.id).delete(c.key);updateApply();};
    label.style.display='block';section.append(label);
   }
   list.append(section);
  }
  dialog.append(list);
  const nav=el('div');for(const [key,delta]of[['previous',-1],['next',1]]){const b=el('button',t(key));b.disabled=delta<0?page===0:(page+1)*50>=rows.length;b.onclick=()=>{page+=delta;render();};nav.append(b);}dialog.append(nav);
  const apply=el('button');apply.dataset.testid='apply-merges';apply.onclick=async()=>{
   committing=true;for(const c of dialog.querySelectorAll('button,input'))c.disabled=true;
   try{await onApply(changes(),identity);committing=false;close();}
   catch{committing=false;render();const error=el('p',t('mergeFailed'));error.setAttribute('role','alert');dialog.append(error);}
  };dialog.append(apply);const cancel=el('button',t('cancel'));cancel.onclick=close;dialog.append(cancel);updateApply();
 }
 function updateApply(){const n=changes().length,b=dialog.querySelector('[data-testid=apply-merges]');if(b){b.textContent=t('mergeApply',{count:n});b.disabled=!n;}}
 return {async open(){
  identity=getIdentity();onBusy(true);let result;
  try{result=await client.request('import-matches',{expectedRevision:identity.revision});}finally{onBusy(false);}
  const now=getIdentity();if(now.sessionId!==identity.sessionId||now.revision!==identity.revision)return;
  preview=result;rows=result.rows;page=0;choices=new Map();selected=new Map();
  for(const row of rows){
   const candidates=row.candidates.map(c=>({...c,key:c.recordIds.join('\0')})),covered=new Set(candidates.flatMap(c=>c.recordIds)),missing=row.boundRecordIds.filter(id=>!covered.has(id));
   if(missing.length)candidates.push({recordIds:[...row.boundRecordIds],key:'existing',existing:true});
   choices.set(row.id,candidates);selected.set(row.id,new Set(candidates.filter(c=>missing.length?c.existing:c.recordIds.every(id=>row.boundRecordIds.includes(id))||row.bulkSafe).map(c=>c.key)));
  }
  render();dialog.showModal();
 },invalidate(){if(dialog.open)close();}};
}
