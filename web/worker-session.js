import { createProject,loadProject,serializeProject,applyImportTransaction } from '../src/project.js';
import {validateSnapshot,CANARD_NAMESPACE,canonical} from '../src/canard-snapshot.js';
import {projectNotices} from '../src/source-notices.js';
import { createHistory } from '../src/history.js';
import { projectView,exportView } from '../src/project-view.js';
import { buildProject } from '../src/encoder.js';
import { isProjectModified } from '../src/ingestion-state.js';
import { referenceView,exportReferences } from '../src/import-view.js';
import { reconcile,setImportPolicy,resolveImport } from '../src/reconcile.js';
import { parseCsv } from '../src/import-csv.js';
import { parseGeoJson } from '../src/import-geojson.js';
import {createCountryExportController} from '../src/country-export.js';
import {createCountryCache} from './country-cache.js';
import {countryFail} from '../src/country-data.js';

export function createWorkerSession({loadCountryData}={}){
  let history=null,sessionId=null,queue=Promise.resolve(),cached=null;
  const countryCache=createCountryCache({baseUrl:new URL('../',import.meta.url)}),loadCountries=loadCountryData??(opts=>countryCache.load(opts));
  const countries=createCountryExportController({loadData:loadCountries});let activeCountry=null,cancelledThrough=-1;
  function cancelCountry({sessionId:id,generation}){
    if(id!==sessionId||!Number.isSafeInteger(generation)||generation<0)return false;
    cancelledThrough=Math.max(cancelledThrough,generation);
    if(activeCountry&&activeCountry.generation<=generation)activeCountry.controller.abort();countries.cancel();return true;
  }
  async function snapshot(){
    if(cached?.revision===history.revision)return cached;
    const view=await projectView(history.current);
    cached={revision:history.revision,view,canUndo:history.canUndo,canRedo:history.canRedo,
      modified:isProjectModified(history.current),references:referenceView(history.current),importPolicies:structuredClone(history.current.ingestion.policies),
      sourceSync:history.current.ingestion.sources.filter(s=>s.namespace===CANARD_NAMESPACE&&s.notices).map(s=>({namespace:s.namespace,enabled:s.syncEnabled===true})),
      sourceNotices:projectNotices(history.current,{encodedOnly:true}),
      projectJson:await serializeProject(history.current)};
    return cached;
  }
  async function execute({kind,payload={},sessionId:id}){
    if(kind==='validate-source')return (await createProject(payload.bytes)).source.sha256;
    if(kind==='open-bin' || kind==='open-project'){
      const p=kind==='open-bin'?await createProject(payload.bytes,{name:payload.name??''}):await loadProject(payload.text);
      history=createHistory(p);sessionId=id;cached=null;return snapshot();
    }
    if(!history || id!==sessionId)throw Object.assign(new Error('No active document'),{code:'NO_DOCUMENT'});
    if(['country-list','country-preview','country-export'].includes(kind)){
      const allowed=kind==='country-list'?['generation']:kind==='country-preview'?['expectedRevision','generation','options']:['expectedRevision','generation','token','format'];
      if(!payload||typeof payload!=='object'||Object.keys(payload).length!==allowed.length||!allowed.every(k=>Object.hasOwn(payload,k))||!Number.isSafeInteger(payload.generation)||payload.generation<0)countryFail('COUNTRY_DECISION_INVALID');
      if(kind!=='country-list'&&payload.expectedRevision!==history.revision)countryFail('COUNTRY_PREVIEW_STALE');
      if(payload.generation<=cancelledThrough)countryFail('COUNTRY_CANCELLED');
      const controller=new AbortController();activeCountry={controller,generation:payload.generation};
      try{
        if(kind==='country-list'){
          const data=await loadCountries({signal:controller.signal});if(controller.signal.aborted)countryFail('COUNTRY_CANCELLED');
          return {generation:payload.generation,countries:data.dataset.countries.map(({id,iso2,names})=>({id,iso2,names})),boundary:{release:data.manifest.release,sha256:data.manifest.sha256},notice:data.notice};
        }
        const args={project:history.current,sessionId,revision:history.revision,generation:payload.generation,signal:controller.signal};
        return kind==='country-preview'?await countries.preview({...args,options:payload.options}):await countries.export({...args,token:payload.token,format:payload.format});
      }finally{activeCountry=null;}
    }
    if(['export','export-references','build'].includes(kind)){
      const allowed=kind==='export'?['format']:[];
      if(Object.keys(payload).some(k=>!allowed.includes(k)))countryFail('COUNTRY_DECISION_INVALID');
    }
    if(['import-canard','source-sync'].includes(kind)){
      if(payload.expectedRevision!==history.revision)throw Object.assign(new Error('Import revision changed'),{code:'STALE_IMPORT'});
      let candidate=history.current,summary;
      if(kind==='import-canard'){
        if(payload.enableSync!==undefined&&typeof payload.enableSync!=='boolean')throw Object.assign(new Error('Invalid sync setting'),{code:'INVALID_IMPORT'});
        const hosted=await validateSnapshot(payload.bytes,payload.manifest);
        const result=await reconcile(candidate,hosted.batch);candidate=result.project;summary=result.summary;
        const sources=candidate.ingestion.sources.map(s=>s.namespace===CANARD_NAMESPACE?{...s,notices:hosted.notices,syncEnabled:payload.enableSync??s.syncEnabled??false}:s);
        if(canonical(sources)!==canonical(candidate.ingestion.sources))candidate=applyImportTransaction(candidate,{ingestion:{...candidate.ingestion,sources}});
      }else{
        const source=candidate.ingestion.sources.find(s=>s.namespace===payload.namespace);
        if(payload.namespace!==CANARD_NAMESPACE||!source?.notices||typeof payload.enabled!=='boolean')throw Object.assign(new Error('Invalid sync source'),{code:'INVALID_IMPORT'});
        if(source.syncEnabled!==payload.enabled)candidate=applyImportTransaction(candidate,{ingestion:{...candidate.ingestion,sources:candidate.ingestion.sources.map(s=>s===source?{...s,syncEnabled:payload.enabled}:s)}});
      }
      history.commit(candidate);
      return kind==='import-canard'?{snapshot:await snapshot(),summary}:snapshot();
    }
    if(['import','parse-import','import-policy','import-resolve'].includes(kind)){
      if(payload.expectedRevision!==history.revision)throw Object.assign(new Error('Import revision changed'),{code:'STALE_IMPORT'});
      if(kind==='parse-import'){
        const parser=payload.format==='csv'?parseCsv:payload.format==='geojson'?parseGeoJson:null;
        if(!parser)throw Object.assign(new Error('Unsupported import format'),{code:'INVALID_IMPORT'});
        return parser(payload.text,payload.source,payload.retrievedAt);
      }
      if(kind==='import'){
        if(payload.batch?.source?.namespace===CANARD_NAMESPACE)throw Object.assign(new Error('Use verified hosted import for this namespace'),{code:'RESERVED_SOURCE'});
        let candidate=history.current;
        if(payload.policies?.length){
          if(!Array.isArray(payload.policies)||payload.policies.length>2)throw Object.assign(new Error('Invalid policies'),{code:'INVALID_IMPORT'});
          if(!candidate.ingestion.sources.some(s=>s.namespace===payload.batch.source.namespace))candidate=(await reconcile(candidate,{...payload.batch,observations:[]})).project;
          for(const policy of payload.policies){
            if(policy.namespace!==payload.batch.source.namespace)throw Object.assign(new Error('Policy namespace mismatch'),{code:'INVALID_IMPORT'});
            candidate=setImportPolicy(candidate,policy);
          }
        }
        const result=await reconcile(candidate,payload.batch);history.commit(result.project);
        return {snapshot:await snapshot(),summary:result.summary};
      }
      history.commit(kind==='import-policy'?setImportPolicy(history.current,payload.policy):await resolveImport(history.current,payload.resolution));
      return snapshot();
    }
    if(kind==='export-references')return {revision:history.revision,text:exportReferences(history.current),mime:'application/geo+json',filename:'mivue-references.geojson'};
    if(kind==='apply')history.apply(payload.operation);
    else if(kind==='undo')history.undo();
    else if(kind==='redo')history.redo();
    else if(kind==='reset')await history.reset();
    else if(kind==='build')return {revision:history.revision,...await buildProject(history.current),notices:projectNotices(history.current,{encodedOnly:true})};
    else if(kind==='export'){
      const s=await snapshot(),format=payload.format;
      const notices=projectNotices(history.current,{encodedOnly:true});
      let text=format==='project'?s.projectJson:exportView(s.view,format);
      if(['json','geojson'].includes(format)&&notices.length){const value=JSON.parse(text);text=JSON.stringify(Array.isArray(value)?{records:value,sourceNotices:notices}:{...value,sourceNotices:notices},null,2)+'\n';}
      return {revision:history.revision,text,notices,
        mime:format==='csv'?'text/csv;charset=utf-8':'application/json',filename:format==='project'?'mivue-project.json':`mivue-records.${format}`};
    }else if(kind!=='snapshot')throw Object.assign(new Error('Unknown worker request'),{code:'INVALID_REQUEST'});
    return snapshot();
  }
  return {cancelCountry,handle(request){
    const result=queue.then(async()=>{
      const identity={sessionId:request.sessionId,requestId:request.requestId};
      try{
        const oldHistory=history,oldRevision=history?.revision,result=await execute(request);
        if(history!==oldHistory||history?.revision!==oldRevision){countries.invalidate();if(history!==oldHistory)cancelledThrough=-1;}
        return {...identity,ok:true,result};
      }
      catch(e){return {...identity,ok:false,error:{code:e.code??'OPERATION_FAILED',message:e.message,recordId:e.recordId,issues:e.issues}};}
    });
    queue=result.catch(()=>{});return result;
  }};
}
