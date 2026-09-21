import {countryFail} from './country-data.js';
import {createCountryClassifier} from './country-classifier.js';
import {selectCountries} from './country-selection.js';
import {projectView,exportView,hasPosition} from './project-view.js';
import {referenceView} from './import-view.js';
import {projectNotices} from './source-notices.js';
import {buildProject,BuildError} from './encoder.js';
const checkSignal=signal=>{if(signal?.aborted)countryFail('COUNTRY_CANCELLED');};
function describeReview(preview,ctx){
 const records=new Map(ctx.view.records.map(r=>[r.id,r])),references=new Map(ctx.references.map(r=>[r.id,r]));
 const componentById=new Map();for(const c of preview.components)if(c.recordIds.length>1)for(const id of c.recordIds)componentById.set(id,c.recordIds);
 const ids=new Set([...preview.reviewItems,...preview.linkedExtras].map(r=>r.id));
 preview.reviewContext=[...ids].map(id=>{
  const record=records.get(id),reference=references.get(id),section=reference?.geometry?.type==='LineString';
  const xy=reference?.geometry?.coordinates,positions=record?[[record.longitude,record.latitude]]:section?[xy[0],xy.at(-1)]:[xy??[]];
  return {id,name:reference?.name??null,componentIds:componentById.get(id)??[],positions:positions.map(([longitude,latitude],index)=>({longitude,latitude,
   classification:ctx.classifications.get(section?`${id}:${index?'end':'start'}`:id)??null}))};
 });return preview;
}
export async function exportCountrySelection({project,preview,format}){
 if(!preview.ready)countryFail(preview.records.unresolvedIds.length+preview.references.unresolvedIds.length?'COUNTRY_REVIEW_REQUIRED':'COUNTRY_EXTRAS_ACK_REQUIRED');
 if(!['bin','json','geojson','csv','references'].includes(format))countryFail('COUNTRY_DECISION_INVALID');
 const notices=projectNotices(project),selectionReport={...structuredClone(preview),sourceNotices:notices};
 const ids=new Set(preview.records.keptIds),refIds=new Set(preview.references.keptIds);
 const suffix=preview.options.countryIds.map(s=>s.replace(/[^a-zA-Z0-9_-]/g,'_')).join('-').slice(0,160);
 const result={selectionReport,notices};
 if(format==='bin'){
  if(!ids.size)countryFail('COUNTRY_EMPTY_BIN');
  const view=await projectView(project);for(const r of view.records)if(ids.has(r.id)&&!hasPosition(r))throw new BuildError('INVALID_COORDINATE','Resolve invalid coordinates before a country BIN export',r.id);
  const clone=structuredClone(project);for(const r of clone.records)if(!ids.has(r.id))r.deleted=true;
  return {...result,...await buildProject(clone),mime:'application/octet-stream',filename:'Speedcam_Data_FEU.bin'};
 }
 let text;
 if(format==='references')text=JSON.stringify({type:'FeatureCollection',schema:'mivue-source-observations',version:1,sourceNotices:notices,exportSelection:selectionReport,
  features:referenceView(project).filter(r=>refIds.has(r.id)).map(({id,geometry,...properties})=>({type:'Feature',id,geometry,properties}))},null,2)+'\n';
 else{
  const view=await projectView(project);view.records=view.records.filter(r=>ids.has(r.id));view.diagnostics=view.diagnostics.filter(d=>ids.has(d.recordId));
  text=exportView(view,format);if(format!=='csv')text=JSON.stringify({...JSON.parse(text),sourceNotices:notices,exportSelection:selectionReport},null,2)+'\n';
 }
 return {...result,text,mime:format==='csv'?'text/csv;charset=utf-8':format==='geojson'||format==='references'?'application/geo+json':'application/json',filename:`mivue-${format==='references'?'references':'records'}-${suffix}.${format==='references'?'geojson':format}`};
}
export function createCountryExportController({loadData}){
 let classifier=null,data=null,cached=null,current=null,epoch=0;
 const cancel=()=>{epoch++;current=null;};
 const invalidate=()=>{cancel();cached=null;};
 async function context(args){
  const {project,sessionId,revision,signal}=args,start=epoch;checkSignal(signal);
  if(!data){const loaded=await loadData({signal});checkSignal(signal);if(start!==epoch)countryFail('COUNTRY_PREVIEW_STALE');data=loaded;classifier=createCountryClassifier(data);}
  if(!cached||cached.sessionId!==sessionId||cached.revision!==revision){
   const view=await projectView(project),references=referenceView(project),items=view.records.filter(r=>!r.deleted).map(r=>({id:r.id,latitude:r.latitude,longitude:r.longitude}));
   for(const r of references)if(!r.recordId){
    if(r.geometry?.type==='LineString')for(const [label,xy]of [['start',r.geometry.coordinates[0]],['end',r.geometry.coordinates.at(-1)]])items.push({id:`${r.id}:${label}`,longitude:xy?.[0],latitude:xy?.[1]});
    else items.push({id:r.id,longitude:r.geometry?.coordinates?.[0],latitude:r.geometry?.coordinates?.[1]});
   }
   const classifications=await classifier.classifyMany(items,{signal});checkSignal(signal);if(start!==epoch)countryFail('COUNTRY_PREVIEW_STALE');
   cached={sessionId,revision,view,references,classifications,boundary:classifier.boundary,countryIds:classifier.countries.map(c=>c.id)};
  }return cached;
 }
 return {invalidate,cancel,
  async preview(args){
   current=null;const start=epoch,ctx=await context(args);checkSignal(args.signal);if(start!==epoch)countryFail('COUNTRY_PREVIEW_STALE');
   const preview=describeReview(selectCountries({...ctx,options:args.options}),ctx);preview.boundaryNotice=structuredClone(data.notice);preview.sourceNotices=projectNotices(args.project);
   const token=crypto.randomUUID();current={sessionId:args.sessionId,revision:args.revision,generation:args.generation,token,options:structuredClone(args.options)};
   return {revision:args.revision,generation:args.generation,token,preview};
  },
  async export(args){
   const matches=()=>current&&['sessionId','revision','generation','token'].every(k=>current[k]===args[k]);
   if(!matches())countryFail('COUNTRY_PREVIEW_STALE');const start=epoch,ctx=await context(args);checkSignal(args.signal);if(start!==epoch||!matches())countryFail('COUNTRY_PREVIEW_STALE');
   const preview=describeReview(selectCountries({...ctx,options:current.options}),ctx);preview.boundaryNotice=structuredClone(data.notice);
   const result=await exportCountrySelection({project:args.project,preview,format:args.format});checkSignal(args.signal);if(start!==epoch||!matches())countryFail('COUNTRY_PREVIEW_STALE');
   return {...result,revision:args.revision,generation:args.generation,token:args.token};
  }};
}
