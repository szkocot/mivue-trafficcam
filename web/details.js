import {metadataRows,speedLabel,safeSourceUrl} from '../src/source-metadata.js';
export function parseCoordinate(text,limit){
 const value=text.trim();if(!/^[+-]?\d+(?:[.,]\d+)?$/.test(value))throw Error('invalidCoordinate');
 const n=Number(value.replace(',','.'));if(!Number.isFinite(n)||Math.abs(n)>limit)throw Error('invalidCoordinate');return n;
}
export function parseRawBytes(text){
 if(!/^\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*$/.test(text))throw Error('invalidBytes');
 const bytes=text.split(',').map(Number);if(bytes.some(n=>!Number.isInteger(n)||n<0||n>255))throw Error('invalidBytes');return bytes;
}
export function createDetails(element,{onApply,onOperation,onPick,onResolve,t}){
 let record=null,dirty=false,fields={},error,touched=new Set();
 const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 function input(parent,key,value){const label=el('label',t(key)),field=el('input');field.value=value??'';field.oninput=()=>{dirty=true;touched.add(key);};label.append(field);parent.append(label);fields[key]=field;return field;}
 function button(parent,key,action){const b=el('button',t(key));b.onclick=action;parent.append(b);return b;}
 async function apply(){
  if(!record)return false;
  try{
   const changes={};
   for(const [key,limit] of [['latitude',90],['longitude',180]])if(touched.has(key)||fields[key].value!==String(record[key]??''))changes[key]=parseCoordinate(fields[key].value,limit);
   if(fields.rawBytes.value!==record.rawBytes16To19.join(', '))changes.rawBytes16To19=parseRawBytes(fields.rawBytes.value);
   const operations=[];
   if(Object.keys(changes).length)operations.push({kind:'update',id:record.id,changes});
   if(fields.target && (fields.target.value.trim()!==(record.linkTargetId??'') || fields.reason.value.trim()!==(record.linkResolution?.reason??''))){
    if(!fields.target.value.trim()||!fields.reason.value.trim())throw Error('reason');
    operations.push({kind:'resolve-link',id:record.id,targetId:fields.target.value.trim(),reason:fields.reason.value.trim()});
   }
   const ok=operations.length?await onApply(operations):true;if(ok){dirty=false;touched.clear();}return ok;
  }catch(e){error.textContent=t(e.message);return false;}
 }
 function render(values){
  element.replaceChildren();fields={};if(!record){element.append(el('p',t('select')));return;}
  element.append(el('h2',t('details')));const id=el('p',record.id);id.dataset.testid='selected-id';element.append(id);
  const refs=record.reference?[record]:record.sourceObservations??[];
  element.append(el('p',speedLabel(refs,t)));
  for(const ref of refs){
   const section=el('section');section.className='source-metadata';
   for(const [label,value] of metadataRows(ref,t)){section.append(el('strong',label),el('pre',value));}
   for(const url of new Set([ref.url,ref.sourceUrl].map(safeSourceUrl).filter(Boolean))){const link=el('a',t('sourceLink'));link.href=url;link.target='_blank';link.rel='noopener noreferrer';section.append(link);}
   element.append(section);
  }
  if(record.reference){
   for(const code of record.codes??[])element.append(el('p',t(code)));
   if(!record.recordId&&onResolve){
    const resolution=action=>({namespace:record.namespace,sourceId:record.sourceId,action});
    button(element,'keepReference',()=>onResolve(resolution('reference')));
    if(record.geometry.type==='Point'&&['camera','red-light'].includes(record.kind)){
     const label=el('label',t('bindRecord')),target=el('input');label.append(target);element.append(label);
     button(element,'bindReference',()=>onResolve({...resolution('bind'),recordId:target.value.trim()}));
     button(element,'distinctReference',()=>onResolve(resolution('add-distinct')));
    }
   }
   return;
  }
  input(element,'latitude',record.latitude);input(element,'longitude',record.longitude);
  button(element,'apply',apply).id='apply';button(element,'cancel',()=>{dirty=false;touched.clear();render();onPick(false);});button(element,'pick',()=>onPick(true));
  error=el('p');error.className='error';error.setAttribute('role','alert');element.append(error);
  button(element,record.deleted?'restore':'delete',()=>onOperation({kind:record.deleted?'restore':'delete',id:record.id}));
  const clone=button(element,'clone',()=>onOperation({kind:'clone',templateId:record.id,latitude:record.latitude,longitude:record.longitude}));
  clone.disabled=record.originalSourceOffset===null||![1,3,5].includes(record.typeRaw)||record.originalLinkRaw!==0||record.latitude===null||record.longitude===null;
  if(clone.disabled)element.append(el('p',t('cloneUnavailable')));
  const advanced=el('details');advanced.append(el('summary',t('advanced')),el('p',t('unknown')));input(advanced,'rawBytes',record.rawBytes16To19.join(', '));
  if(record.typeRaw===964){
   input(advanced,'target',record.linkTargetId??'');input(advanced,'reason',record.linkResolution?.reason??'');
   button(advanced,'resolve',apply);
  }
  for(const d of record.diagnostics)element.append(el('p',`${t(d.scope)}: ${t(d.code)}`));
  advanced.append(el('pre',JSON.stringify(record,null,2)));element.append(advanced);
  if(values)for(const [key,value] of Object.entries(values))if(fields[key])fields[key].value=value;
 }
 return {select(r){record=r;dirty=false;touched.clear();render();},hasDraft:()=>dirty,apply,discardDraft(){dirty=false;touched.clear();render();onPick(false);},
  setPickedLocation(lat,lon){if(record&&!record.reference){fields.latitude.value=lat.toFixed(7);fields.longitude.value=lon.toFixed(7);dirty=true;touched.add('latitude');touched.add('longitude');}},
  setLanguage(){const values=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value]));render(values);},
  setBusy(v){for(const e of element.querySelectorAll('input,button')){if(v){e.dataset.wasDisabled=String(e.disabled);e.disabled=true;}else if('wasDisabled'in e.dataset){e.disabled=e.dataset.wasDisabled==='true';delete e.dataset.wasDisabled;}}}
 };
}
