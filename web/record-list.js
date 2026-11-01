import {binSpeedLabel,binTypeLabel} from '../src/bin-metadata.js';
import { pageRecords } from '../src/view-filter.js';
export function renderRecordList(element,{records,page,selectedId,onSelect,onPage,t,reference=false}){
 const result=pageRecords(records,page),table=document.createElement('table');
 const head=table.createTHead().insertRow();
 if(!reference)table.createCaption().textContent=t('binFieldsNotice');
 const columns=['ID',t('latitude'),t('longitude')];if(!reference)columns.push(t('binSpeed'),t('binType'));
 for(const text of columns){const th=document.createElement('th');th.textContent=text;head.append(th);}
 const body=table.createTBody();
 for(const r of result.records){
  const row=body.insertRow();row.dataset.testid=reference?'reference-row':'record-row';if(r.id===selectedId)row.className='selected';
  const button=document.createElement('button');button.textContent=r.id;button.onclick=()=>onSelect(r.id);row.insertCell().append(button);
  row.insertCell().textContent=r.latitude??'—';row.insertCell().textContent=r.longitude??'—';
  if(!reference){row.insertCell().textContent=binSpeedLabel(r.rawBytes16To19[0],t);row.insertCell().textContent=binTypeLabel(r.typeRaw,t);}
 }
 const nav=document.createElement('div');nav.className='pagination';
 for(const [key,delta] of [['previous',-1],['next',1]]){
  const b=document.createElement('button');b.textContent=t(reference?`reference_${key}`:key);b.disabled=delta<0?result.page===1:result.page===result.pageCount;
  b.onclick=()=>onPage(result.page+delta);nav.append(b);
 }
 const label=document.createElement('span');label.textContent=t('page',{page:result.page,pages:result.pageCount});nav.insertBefore(label,nav.lastChild);
 element.replaceChildren(table,nav);
}
