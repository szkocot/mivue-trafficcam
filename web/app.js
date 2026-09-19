import { createI18n } from './i18n.js';
import { createMap } from './map.js';
import { renderRecordList } from './record-list.js';
import { filterView } from '../src/view-filter.js';
import { createWorkerClient } from './worker-client.js';
import { openStorage } from './storage.js';
import { createSourceCache } from './source-cache.js';
import { createAutosave } from './autosave.js';
import { createDetails } from './details.js';
import { createExportDialog } from './export-dialog.js';
import { downloadBlob,releaseDownloads } from './downloads.js';
import { createLocation } from './location.js';
const $=id=>document.getElementById(id);
let preference;try{preference=localStorage;}catch{}
const i18n=createI18n({storage:preference}),t=(key,params)=>i18n.t(key,params),client=createWorkerClient();
let state=null,selectedId=null,page=1,bounds=null,source=null,sourceInfo=null,sourceStatus='checking',saveStatus='notSaved',operation='ready',intent=0,recovery=null,recoveryBlocked=false,busy=false;
const unavailable={getCache:async()=>null,getWorking:async()=>null,putCache:async()=>{throw Error('STORAGE_UNAVAILABLE');},putWorking:async()=>{throw Error('STORAGE_UNAVAILABLE');}};
let store=unavailable,cache,resolveStorage;
const storageReady=new Promise(resolve=>{resolveStorage=resolve;});
// One queue/session owner for the entire page, including documents opened before IDB.
const autosave=createAutosave({store:{async putWorking(entry){await storageReady;return store.putWorking(entry);}},
 onStatus:s=>{saveStatus=s.state==='failed'?'saveFailed':s.state;render();}});
const map=createMap($('map'),{onSelect:select,onPick:(lat,lon)=>details.setPickedLocation(lat,lon),onViewport:b=>{bounds=b;if($('viewport').checked)render();},onTileError:()=>{$('tile-status').hidden=false;$('tile-status').textContent=t('tileFailure');}});
let locationState='idle',locationFix=null;
const locationController=createLocation({geolocation:navigator.geolocation,secureContext:window.isSecureContext,
 onState:({code})=>{locationState=code;renderLocation();},
 onPosition:position=>{locationFix=position;map.showLocation(position);},
 onClear:()=>{locationFix=null;map.clearLocation();renderLocation();}});
function renderLocation(){
 const pending=locationState==='pending';$('locate').disabled=pending;
 $('location-cancel').hidden=!pending;$('location-clear').hidden=!pending&&!locationFix;
 let message=t(`location_${locationState}`);
 if(locationFix){
  const accuracy=new Intl.NumberFormat(i18n.language,{maximumFractionDigits:1}).format(locationFix.accuracy);
  const time=new Date(locationFix.timestamp).toLocaleString(i18n.language);
  message+=` ${t(locationState==='located'?'locationFix':'locationPrevious',{accuracy,time})}`;
 }
 $('location-status').textContent=message;
}
const details=createDetails($('details'),{onApply:operation=>mutate('apply',{operation}),onOperation:async operation=>{if(await guardDraft())await mutate('apply',{operation});},onPick:value=>map.setPickMode(value),t});
const exportElement=document.createElement('dialog');document.body.append(exportElement);
const exportsUI=createExportDialog(exportElement,{client,getIdentity:()=>({sessionId:client.sessionId,revision:state?.revision}),t,onSelect:select,onBusy:setBusy});
function setBusy(value){busy=value;operation=value?'busy':'ready';details.setBusy(value);render();}
function choice(message,options){
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog'),p=document.createElement('p');p.textContent=t(message);dialog.append(p);
  const finish=value=>{dialog.close();dialog.remove();resolve(value);};
  for(const key of options){const b=document.createElement('button');b.textContent=t(key);b.onclick=()=>finish(key);dialog.append(b);}
  dialog.oncancel=e=>{e.preventDefault();finish('cancel');};document.body.append(dialog);dialog.showModal();
 });
}
async function guardDraft(){
 if(!details.hasDraft())return true;
 const selected=await choice('draft',['apply','discardDraft','cancel']);
 if(selected==='apply')return details.apply();
 if(selected==='discardDraft'){details.discardDraft();return true;}return false;
}
function saveProject(){if(state)downloadBlob({bytes:state.projectJson,mime:'application/json',filename:'mivue-project.json'});}
async function guardReplace(){
 if(busy && !state){intent++;client.cancel();busy=false;}
 if(busy)return false;if(!await guardDraft())return false;
 if(!state?.modified && !recovery && !recoveryBlocked)return true;
 const answer=await choice(recoveryBlocked&&!recovery?'workingReadFailed':'replace',recoveryBlocked&&!recovery?['replaceNow','cancel']:['backupReplace','replaceNow','cancel']);
 if(answer==='cancel')return false;
 if(answer==='backupReplace'){if(recovery)recover();else saveProject();}
 return true;
}
function recover(){if(recovery)downloadBlob({bytes:JSON.stringify(recovery,null,2),mime:'application/json',filename:'mivue-recovery.json'});}
function translate(){
 document.documentElement.lang=i18n.language;
 map.setLanguage(t);
 for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
 $('file').setAttribute('aria-label',t('open'));$('map').setAttribute('aria-label',t('map'));
 $('pl').setAttribute('aria-pressed',i18n.language==='pl');$('en').setAttribute('aria-pressed',i18n.language==='en');
 $('tile-status').textContent=t('tileFailure');$('recovery').textContent=t(recoveryBlocked&&!recovery?'workingReadFailed':'recovery');details.setLanguage();renderLocation();render();
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
 $('save').disabled=!state;$('exports').disabled=!state||busy;
 $('undo').disabled=!state?.canUndo||busy;$('redo').disabled=!state?.canRedo||busy;$('discard').disabled=!state||busy;
 renderRecordList($('record-list'),{records,page,selectedId,onSelect:select,onPage:p=>{page=p;render();},t});
 map.render(records,selectedId);
}
async function select(id){
 if(busy || !await guardDraft())return;
 selectedId=id;const records=filtered(),index=records.findIndex(r=>r.id===id);if(index>=0)page=Math.floor(index/100)+1;
 const record=state.view.records.find(r=>r.id===id);map.center(record);
 details.select(record);render();
}
function accept(result,{save=true,preserveSelection=false}={}){
 state=result;if(!preserveSelection){selectedId=null;page=1;}exportsUI.invalidate();map.setPickMode(false);
 details.select(result.view.records.find(r=>r.id===selectedId)??null);
 if(save)autosave.save({sessionId:client.sessionId,revision:result.revision,projectJson:result.projectJson,sourceInfo}).catch(()=>{});
 render();
}
async function open(kind,payload,{ticket=++intent,save=true,info=null}={}){
 locationController.clear();
 const previous=state;setBusy(true);autosave.begin(`opening:${ticket}`);
 try{
  const result=await client.open(kind,payload);if(ticket!==intent)return;
  sourceInfo=info;autosave.begin(client.sessionId);accept(result,{save});recovery=null;recoveryBlocked=false;$('recovery').hidden=true;$('recover').hidden=true;operation='ready';
 }catch(error){
  if(ticket===intent){
   if(previous){await client.open('open-project',{text:previous.projectJson});autosave.begin(client.sessionId);state={...previous,revision:0,canUndo:false,canRedo:false};}
   operation=error.code==='CANCELLED'?'cancelled':'failed';
  }throw error;
 }finally{if(ticket===intent){busy=false;details.setBusy(false);render();}}
}
async function mutate(kind,payload={}){
 if(busy)return false;const ticket=intent;setBusy(true);exportsUI.invalidate();
 try{const result=await client.request(kind,payload);if(ticket!==intent)return false;accept(result,{preserveSelection:true});operation='ready';return true;}
 catch(error){if(ticket===intent)operation=error.code==='CANCELLED'?'cancelled':'failed';return false;}
 finally{if(ticket===intent){busy=false;details.setBusy(false);render();}}
}
async function importFile(file){
 if(!file||!await guardReplace())return;const ticket=++intent;
 locationController.clear();
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
$('locate').onclick=()=>locationController.locate();
$('location-cancel').onclick=()=>locationController.cancel();
$('location-clear').onclick=()=>locationController.clear();
$('list-tab').onclick=()=>{document.body.classList.add('show-list');document.body.classList.remove('list-collapsed');};
$('map-tab').onclick=()=>{document.body.classList.remove('show-list');document.body.classList.toggle('list-collapsed');};
$('operation-cancel').onclick=async()=>{
 const ticket=++intent;client.cancel();exportsUI.invalidate();
 if(state){const restored=await client.open('open-project',{text:state.projectJson});if(ticket!==intent)return;autosave.begin(client.sessionId);accept(restored,{preserveSelection:true});}
 busy=false;details.setBusy(false);operation='cancelled';render();
};
async function check(options){if(!cache)return;const result=await cache.check(options);if(result){source=result;$('source-info').textContent=JSON.stringify(result.source,null,2);}render();return result;}
$('check').onclick=()=>check();$('force-source').onclick=()=>check({force:true});$('source-cancel').onclick=()=>cache?.cancel();
$('use-source').onclick=async()=>{if(source&&await guardReplace())await open('open-bin',{bytes:source.bytes,name:'Speedcam_Data_FEU.bin'},{info:source.source}).catch(()=>{});};
$('save').onclick=saveProject;$('exports').onclick=()=>exportsUI.open();$('recover').onclick=recover;
for(const kind of ['undo','redo'])$(kind).onclick=async()=>{if(await guardDraft())await mutate(kind);};
$('discard').onclick=async()=>{if(!busy&&confirm(t('discardConfirm')))await mutate('reset');};
window.addEventListener('beforeunload',event=>{if(details.hasDraft()||['saving','saveFailed'].includes(saveStatus)){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',releaseDownloads);
window.addEventListener('pagehide',event=>{if(event.persisted)locationController.clear();else locationController.destroy();});
translate();
async function start(){
 const ticket=intent;
 try{store=await openStorage();}catch{saveStatus='saveFailed';}
 cache=createSourceCache({store,validateBytes:bytes=>client.validateSource(bytes),onStatus:s=>{sourceStatus=s.state;render();}});
 try{
  const saved=await store.getWorking();
  if(saved && ticket===intent){
   recovery=saved;
   if(saved.version!==1 || typeof saved.projectJson!=='string')throw Error('INVALID_SAVED_PROJECT');
   await open('open-project',{text:saved.projectJson},{ticket,save:false,info:saved.sourceInfo});recovery=null;saveStatus='saved';
  }
 }catch{if(ticket===intent){recoveryBlocked=true;$('recovery').textContent=t(recovery?'recovery':'workingReadFailed');$('recovery').hidden=false;$('recover').hidden=!recovery;}}
 finally{resolveStorage();}
 source=await cache.loadCached();
 if(source && !state && !recovery && !recoveryBlocked && ticket===intent)await open('open-bin',{bytes:source.bytes,name:'Speedcam_Data_FEU.bin'},{ticket,info:source.source}).catch(()=>{});
 const newest=await check();
 if(newest && !state && !recovery && !recoveryBlocked && ticket===intent && sourceStatus!=='cancelled')await open('open-bin',{bytes:newest.bytes,name:'Speedcam_Data_FEU.bin'},{ticket,info:newest.source}).catch(()=>{});
 render();
}
start();
