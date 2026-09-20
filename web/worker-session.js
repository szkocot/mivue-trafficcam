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

export function createWorkerSession(){
  let history=null,sessionId=null,queue=Promise.resolve(),cached=null;
  async function snapshot(){
    if(cached?.revision===history.revision)return cached;
    const view=await projectView(history.current);
    cached={revision:history.revision,view,canUndo:history.canUndo,canRedo:history.canRedo,
      modified:isProjectModified(history.current),references:referenceView(history.current),importPolicies:structuredClone(history.current.ingestion.policies),
      sourceSync:history.current.ingestion.sources.filter(s=>s.namespace===CANARD_NAMESPACE&&s.notices).map(s=>({namespace:s.namespace,enabled:s.syncEnabled===true})),
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
  return {handle(request){
    const result=queue.then(async()=>{
      const identity={sessionId:request.sessionId,requestId:request.requestId};
      try{return {...identity,ok:true,result:await execute(request)};}
      catch(e){return {...identity,ok:false,error:{code:e.code??'OPERATION_FAILED',message:e.message,recordId:e.recordId,issues:e.issues}};}
    });
    queue=result.catch(()=>{});return result;
  }};
}
