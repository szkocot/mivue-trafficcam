import {CountryError} from '../src/country-data.js';
let nextGeneration=0;
export function createCountryExportControls(element,{client,getIdentity,t,onInvalidate,onPreview}){
 let generation=++nextGeneration,alive=true,prepared=null,data=null,decisions={},componentDecisions={},acknowledgeExtras=false,page=0,selected=[];
 const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const label=(key,input)=>{const l=el('label',t(key));input.setAttribute('aria-label',t(key));l.append(input);return l;};
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=fn;return b;};
 const scope=el('select');for(const [value,key]of [['full','countryFull'],['countries','countrySelected']]){const o=el('option',t(key));o.value=value;scope.append(o);}
 element.className='country-export-controls';element.append(label('countryScope',scope));
 const content=el('div'),status=el('p'),search=el('input'),countries=el('select');search.type='search';countries.multiple=true;countries.size=6;
 const preview=el('div');preview.dataset.testid='country-preview';preview.setAttribute('aria-live','polite');
 const previewButton=button(t('countryPreview'),()=>runPreview()),retry=button(t('countryRetry'),()=>load());
 const cancelButton=button(t('cancel'),()=>{invalidate();previewButton.disabled=!data;retry.hidden=!!data;status.textContent=t('COUNTRY_CANCELLED');});
 content.append(el('p',t('countryCaveat')),status,label('countrySearch',search),label('countryCountries',countries),previewButton,retry,cancelButton,preview);content.hidden=true;element.append(content);
 function invalidate(){const old=generation;generation=++nextGeneration;prepared=null;onInvalidate();client.request('country-cancel',{generation:old}).catch(()=>{});}
 const matches=(g,id)=>alive&&g===generation&&id.sessionId===getIdentity().sessionId&&id.revision===getIdentity().revision;
 function fillCountries(){
  countries.replaceChildren();const lang=document.documentElement.lang==='pl'?'pl':'en';
  for(const c of [...data.countries].sort((a,b)=>a.names[lang].localeCompare(b.names[lang],lang))){const o=el('option',`${c.names[lang]} (${c.iso2??c.id})`);o.value=c.id;o.selected=selected.includes(c.id);countries.append(o);}
  search.oninput=()=>{for(const o of countries.options)o.hidden=!o.textContent.toLocaleLowerCase().includes(search.value.toLocaleLowerCase());};
 }
 async function load(){
  invalidate();const g=generation,id=getIdentity();status.textContent=t('busy');previewButton.disabled=true;retry.hidden=true;
  try{const result=await client.request('country-list',{generation:g});if(!matches(g,id))return;data=result;fillCountries();status.textContent=`${t('countryBoundaries')}: Natural Earth ${data.boundary.release} · ${data.notice.attribution}`;previewButton.disabled=false;}
  catch(e){if(matches(g,id)){status.textContent=t(e.code??'COUNTRY_DATA_UNAVAILABLE');retry.hidden=false;}}
 }
 const options=()=>({countryIds:selected,decisions,componentDecisions,acknowledgeExtras});
 async function runPreview(){
  invalidate();const g=generation,id=getIdentity();status.textContent=t('busy');previewButton.disabled=true;
  try{const result=await client.request('country-preview',{expectedRevision:id.revision,generation:g,options:options()});if(!matches(g,id))return;prepared=result;status.textContent=t('countryPreviewReady');renderPreview();onPreview(result.preview);}
  catch(e){if(matches(g,id)){preview.replaceChildren();status.textContent=t(e.code??'failed');}}
  finally{if(matches(g,id))previewButton.disabled=false;}
 }
 function decide(items,value){for(const item of items){if(item.componentId)componentDecisions[item.componentId]=value;else decisions[item.id]=value;}acknowledgeExtras=false;runPreview();}
 function renderPreview(){
  const contexts=new Map(prepared.preview.reviewContext.map(r=>[r.id,r])),countryById=new Map(data.countries.map(c=>[c.id,c]));
  const lang=document.documentElement.lang==='pl'?'pl':'en';
  const countryName=id=>{const c=countryById.get(id);return c?`${c.names[lang]} (${c.iso2??c.id})`:id;};
  const p=prepared.preview;preview.replaceChildren(el('p',t('countryCounts',{included:p.records.keptIds.length,excluded:p.records.excludedIds.length,unresolved:p.records.unresolvedIds.length,extras:p.linkedExtras.length})),el('p',t('countryReferenceCounts',{included:p.references.keptIds.length,excluded:p.references.excludedIds.length,unresolved:p.references.unresolvedIds.length})),el('p',`${t('countryBinScope')}: ${selected.join(',')} · Speedcam_Data_FEU.bin`));
  if(p.linkedExtras.length){const input=el('input');input.type='checkbox';input.checked=acknowledgeExtras;input.onchange=()=>{acknowledgeExtras=input.checked;runPreview();};preview.append(label('countryAcceptExtras',input));}
  for(const category of ['border','unassigned','invalid','assigned']){const items=p.reviewItems.filter(r=>r.classification.status===category);if(!items.length)continue;for(const value of ['keep','exclude'])preview.append(button(t('countryBulk',{action:t(`country_${value}`),category:t(`country_${category}`),count:items.length}),()=>decide(items,value)));}
  const group=el('select');for(const [value,key]of [['review','countryReview'],['kept','countryIncluded'],['excluded','countryExcluded'],['extras','countryExtras']]){const o=el('option',t(key));o.value=value;group.append(o);}preview.append(label('countryGroup',group));
  const rows=el('div');rows.className='country-preview-rows';preview.append(rows);
  const navigation=el('div'),position=el('span');navigation.className='pagination';const prev=button(t('countryPrevious'),()=>{page--;draw();}),next=button(t('countryNext'),()=>{page++;draw();});navigation.append(prev,position,next);preview.append(navigation);
  function draw(){
   const list=group.value==='review'?p.reviewItems:group.value==='extras'?p.linkedExtras:[...(group.value==='kept'?p.records.keptIds:p.records.excludedIds),...(group.value==='kept'?p.references.keptIds:p.references.excludedIds)].map(id=>({id}));
   page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(list.length/100)-1)));rows.replaceChildren();
   for(const item of list.slice(page*100,page*100+100)){const row=el('div');row.dataset.testid='country-preview-row';row.append(el('span',item.id));if(item.reason)row.append(el('p',t(item.reason)));
    const context=contexts.get(item.id);
    if(context){if(context.name)row.append(el('p',context.name));for(const pos of context.positions){
     row.append(el('p',`${t('countryPosition')}: ${Number.isFinite(pos.latitude)?pos.latitude:'?'}, ${Number.isFinite(pos.longitude)?pos.longitude:'?'}`));
     row.append(el('p',`${t('countryCandidates')}: ${pos.classification?.countryIds.map(countryName).join(', ')||t('countryNoMatch')}`));
    }if(context.componentIds.length)row.append(el('p',`${t('countryComponent')}: ${context.componentIds.join(', ')}`));}
    if(item.triggerIds?.length)row.append(el('p',`${t('countryTriggers')}: ${item.triggerIds.join(', ')}`));
    if(item.classification){row.append(el('span',` · ${t(`country_${item.classification.status}`)}`));for(const value of ['keep','exclude'])row.append(button(t(item.componentId?`country_component_${value}`:`country_${value}`),()=>decide([item],value)));}rows.append(row);
   }position.textContent=`${page+1} / ${Math.max(1,Math.ceil(list.length/100))}`;prev.disabled=page===0;next.disabled=(page+1)*100>=list.length;
  }group.onchange=()=>{page=0;draw();};draw();
 }
 countries.onchange=()=>{selected=[...countries.selectedOptions].map(o=>o.value);decisions={};componentDecisions={};acknowledgeExtras=false;page=0;invalidate();preview.replaceChildren();previewButton.disabled=!data;};
 scope.onchange=()=>{content.hidden=scope.value==='full';selected=[];decisions={};componentDecisions={};acknowledgeExtras=false;preview.replaceChildren();if(scope.value==='countries')load();else invalidate();};
 return {getPreparedScope(){if(scope.value==='full')return null;if(!prepared?.preview.ready)throw new CountryError('COUNTRY_REVIEW_REQUIRED');return {generation,token:prepared.token,revision:prepared.revision};},cancel:invalidate,destroy(){alive=false;invalidate();}};
}
