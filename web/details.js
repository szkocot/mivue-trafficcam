export function parseCoordinate(text,limit){
 const value=text.trim();if(!/^[+-]?\d+(?:[.,]\d+)?$/.test(value))throw Error('invalidCoordinate');
 const n=Number(value.replace(',','.'));if(!Number.isFinite(n)||Math.abs(n)>limit)throw Error('invalidCoordinate');return n;
}
export function parseRawBytes(text){
 if(!/^\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*$/.test(text))throw Error('invalidBytes');
 const bytes=text.split(',').map(Number);if(bytes.some(n=>!Number.isInteger(n)||n<0||n>255))throw Error('invalidBytes');return bytes;
}
export function createDetails(element,{onApply,onOperation,onPick,t}){
 let record=null,dirty=false,fields={},error;
 const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 function input(parent,key,value){const label=el('label',t(key)),field=el('input');field.value=value??'';field.oninput=()=>{dirty=true;};label.append(field);parent.append(label);fields[key]=field;return field;}
 function button(parent,key,action){const b=el('button',t(key));b.onclick=action;parent.append(b);return b;}
 async function apply(){
  if(!record)return false;
  try{
   const changes={};
   for(const [key,limit] of [['latitude',90],['longitude',180]])if(fields[key].value!==String(record[key]??''))changes[key]=parseCoordinate(fields[key].value,limit);
   if(fields.rawBytes.value!==record.rawBytes16To19.join(', '))changes.rawBytes16To19=parseRawBytes(fields.rawBytes.value);
   const ok=await onApply({kind:'update',id:record.id,changes});if(ok)dirty=false;return ok;
  }catch(e){error.textContent=t(e.message);return false;}
 }
 function render(values){
  element.replaceChildren();fields={};if(!record){element.append(el('p',t('select')));return;}
  element.append(el('h2',t('details')));const id=el('p',record.id);id.dataset.testid='selected-id';element.append(id);
  input(element,'latitude',record.latitude);input(element,'longitude',record.longitude);
  button(element,'apply',apply).id='apply';button(element,'cancel',()=>{dirty=false;render();onPick(false);});button(element,'pick',()=>onPick(true));
  error=el('p');error.className='error';error.setAttribute('role','alert');element.append(error);
  button(element,record.deleted?'restore':'delete',()=>onOperation({kind:record.deleted?'restore':'delete',id:record.id}));
  const clone=button(element,'clone',()=>onOperation({kind:'clone',templateId:record.id,latitude:record.latitude,longitude:record.longitude}));
  clone.disabled=record.originalSourceOffset===null||![1,3,5].includes(record.typeRaw)||record.originalLinkRaw!==0||record.latitude===null||record.longitude===null;
  if(clone.disabled)element.append(el('p',t('cloneUnavailable')));
  const advanced=el('details');advanced.append(el('summary',t('advanced')),el('p',t('unknown')));input(advanced,'rawBytes',record.rawBytes16To19.join(', '));
  if(record.typeRaw===964){
   input(advanced,'target',record.linkTargetId??'');input(advanced,'reason','');
   button(advanced,'resolve',async()=>{
    if(!fields.target.value.trim()||!fields.reason.value.trim()){error.textContent=t('reason');return;}
    const ok=await onApply({kind:'resolve-link',id:record.id,targetId:fields.target.value.trim(),reason:fields.reason.value.trim()});if(ok)dirty=false;
   });
  }
  for(const d of record.diagnostics)element.append(el('p',`${t(d.scope)}: ${t(d.code)}`));
  advanced.append(el('pre',JSON.stringify(record,null,2)));element.append(advanced);
  if(values)for(const [key,value] of Object.entries(values))if(fields[key])fields[key].value=value;
 }
 return {select(r){record=r;dirty=false;render();},hasDraft:()=>dirty,apply,discardDraft(){dirty=false;render();onPick(false);},
  setPickedLocation(lat,lon){if(record){fields.latitude.value=lat.toFixed(7);fields.longitude.value=lon.toFixed(7);dirty=true;}},
  setLanguage(){const values=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value]));render(values);},
  setBusy(v){for(const e of element.querySelectorAll('input,button')){if(v){e.dataset.wasDisabled=String(e.disabled);e.disabled=true;}else if('wasDisabled'in e.dataset){e.disabled=e.dataset.wasDisabled==='true';delete e.dataset.wasDisabled;}}}
 };
}
