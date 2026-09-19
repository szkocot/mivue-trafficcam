import { createI18n } from './i18n.js';
import { createMap } from './map.js';
import { renderRecordList } from './record-list.js';
import { filterView } from '../src/view-filter.js';
import { createWorkerClient } from './worker-client.js';
import { openStorage } from './storage.js';
import { createSourceCache } from './source-cache.js';
import { createAutosave } from './autosave.js';
const $=id=>document.getElementById(id);
let preference;try{preference=localStorage;}catch{}
const i18n=createI18n({storage:preference}),t=(key,params)=>i18n.t(key,params),client=createWorkerClient();
let state=null,selectedId=null,page=1,bounds=null,source=null,sourceInfo=null,sourceStatus='checking',saveStatus='notSaved',operation='ready',intent=0,recovery=null,busy=false;
const unavailable={getCache:async()=>null,getWorking:async()=>null,putCache:async()=>{throw Error('STORAGE_UNAVAILABLE');},putWorking:async()=>{throw Error('STORAGE_UNAVAILABLE');}};
let store=unavailable,autosave=createAutosave({store}),cache;
const map=createMap($('map'),{onSelect:select,onPick:()=>{},onViewport:b=>{bounds=b;if($('viewport').checked)render();},onTileError:()=>{$('tile-status').hidden=false;$('tile-status').textContent=t('tileFailure');}});
function translate(){
 document.documentElement.lang=i18n.language;
 for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
 $('file').setAttribute('aria-label',t('open'));$('map').setAttribute('aria-label',t('map'));
 $('pl').setAttribute('aria-pressed',i18n.language==='pl');$('en').setAttribute('aria-pressed',i18n.language==='en');
 $('tile-status').textContent=t('tileFailure');$('recovery').textContent=t('recovery');render();
}
function filtered(){return state?filterView(state.view,{query:$('search').value,viewport:$('viewport').checked?bounds:null,warningsOnly:$('warnings').checked,changedOnly:$('changed').checked,showDeleted:$('deleted').checked,typeRaw:$('type').value}):[];}
function render(){
 const records=filtered();$('record-count').textContent=state?.view.records.filter(r=>!r.deleted).length??0;
 $('result-count').textContent=records.length;$('changes').textContent=state?.view.records.filter(r=>r.changed).length??0;
 $('warnings-count').textContent=state?.view.diagnostics.length??0;
 $('source-status').textContent=t(sourceStatus==='ready'?'sourceReady':sourceStatus==='failed'?'sourceFailed':sourceStatus);$('source-status').dataset.state=sourceStatus;
 $('save-status').textContent=t(saveStatus);$('operation-status').textContent=t(operation);
 $('empty').hidden=Boolean(state);$('hidden-selection').hidden=!selectedId||records.some(r=>r.id===selectedId);
 $('filename').textContent=state?.view.source.name??'MiVue 955W · EU';$('use-source').disabled=!source||busy;
 $('operation-cancel').hidden=!busy;
 renderRecordList($('record-list'),{records,page,selectedId,onSelect:select,onPage:p=>{page=p;render();},t});
 map.render(records,selectedId);
}
function select(id){
 selectedId=id;const records=filtered(),index=records.findIndex(r=>r.id===id);if(index>=0)page=Math.floor(index/100)+1;
 const record=state.view.records.find(r=>r.id===id);map.center(record);
 const title=document.createElement('h2');title.textContent=t('details');const text=document.createElement('p');text.dataset.testid='selected-id';text.textContent=id;
 const data=document.createElement('pre');data.textContent=JSON.stringify(record,null,2);$('details').replaceChildren(title,text,data);render();
}
function accept(result,{save=true}={}){
 state=result;selectedId=null;page=1;$('details').replaceChildren();
 const p=document.createElement('p');p.textContent=t('select');$('details').append(p);
 if(save)autosave.save({sessionId:client.sessionId,revision:result.revision,projectJson:result.projectJson,sourceInfo}).catch(()=>{});
 render();
}
async function open(kind,payload,{ticket=++intent,save=true,info=null}={}){
 busy=true;operation='busy';render();
 try{
  const result=await client.open(kind,payload);if(ticket!==intent)return;
  sourceInfo=info;autosave.begin(client.sessionId);accept(result,{save});operation='ready';
 }catch(error){if(ticket===intent)operation=error.code==='CANCELLED'?'cancelled':'failed';throw error;}
 finally{if(ticket===intent){busy=false;render();}}
}
async function importFile(file){
 if(!file)return;const ticket=++intent;
 try{
  const payload=file.name.toLowerCase().endsWith('.json')?{text:await file.text()}:{bytes:new Uint8Array(await file.arrayBuffer()),name:file.name};
  if(ticket!==intent)return;await open('text'in payload?'open-project':'open-bin',payload,{ticket});
 }catch{operation='failed';render();}
}
$('file').onchange=e=>importFile(e.target.files[0]);
document.ondragover=e=>e.preventDefault();document.ondrop=e=>{e.preventDefault();importFile(e.dataTransfer.files[0]);};
for(const id of ['search','viewport','warnings','changed','deleted','type'])$(id).oninput=()=>{page=1;render();};
for(const lang of ['pl','en'])$(lang).onclick=()=>{i18n.setLanguage(lang);translate();};
$('fit').onclick=()=>map.fit(state?.view.records.filter(r=>!r.deleted)??[]);
$('list-tab').onclick=()=>{document.body.classList.add('show-list');document.body.classList.remove('list-collapsed');};
$('map-tab').onclick=()=>{document.body.classList.remove('show-list');document.body.classList.toggle('list-collapsed');};
$('operation-cancel').onclick=()=>{intent++;client.cancel();busy=false;operation='cancelled';render();};
async function check(options){if(!cache)return;const result=await cache.check(options);if(result){source=result;$('source-info').textContent=JSON.stringify(result.source,null,2);}render();return result;}
$('check').onclick=()=>check();$('force-source').onclick=()=>check({force:true});$('source-cancel').onclick=()=>cache?.cancel();
$('use-source').onclick=()=>source&&open('open-bin',{bytes:source.bytes,name:'Speedcam_Data_FEU.bin'},{info:source.source}).catch(()=>{});
translate();
async function start(){
 try{store=await openStorage();}catch{saveStatus='saveFailed';}
 autosave=createAutosave({store,onStatus:s=>{saveStatus=s.state==='failed'?'saveFailed':s.state;render();}});
 cache=createSourceCache({store,validateBytes:bytes=>client.validateSource(bytes),onStatus:s=>{sourceStatus=s.state;render();}});
 const ticket=intent;
 try{
  const saved=await store.getWorking();
  if(saved && ticket===intent){
   recovery=saved;
   if(saved.version!==1 || typeof saved.projectJson!=='string')throw Error('INVALID_SAVED_PROJECT');
   await open('open-project',{text:saved.projectJson},{ticket,save:false,info:saved.sourceInfo});recovery=null;saveStatus='saved';
  }
 }catch{$('recovery').hidden=false;$('recover').hidden=false;}
 source=await cache.loadCached();
 if(source && !state && !recovery && ticket===intent)await open('open-bin',{bytes:source.bytes,name:'Speedcam_Data_FEU.bin'},{ticket,info:source.source}).catch(()=>{});
 const newest=await check();
 if(newest && !state && !recovery && ticket===intent && sourceStatus!=='cancelled')await open('open-bin',{bytes:newest.bytes,name:'Speedcam_Data_FEU.bin'},{ticket,info:newest.source}).catch(()=>{});
 render();
}
start();
