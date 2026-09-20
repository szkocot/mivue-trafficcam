import { createProject,loadProject,serializeProject } from '../src/project.js';
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
      modified:isProjectModified(history.current),references:referenceView(history.current),projectJson:await serializeProject(history.current)};
    return cached;
  }
  async function execute({kind,payload={},sessionId:id}){
    if(kind==='validate-source')return (await createProject(payload.bytes)).source.sha256;
    if(kind==='open-bin' || kind==='open-project'){
      const p=kind==='open-bin'?await createProject(payload.bytes,{name:payload.name??''}):await loadProject(payload.text);
      history=createHistory(p);sessionId=id;cached=null;return snapshot();
    }
    if(!history || id!==sessionId)throw Object.assign(new Error('No active document'),{code:'NO_DOCUMENT'});
    if(['import','parse-import','import-policy','import-resolve'].includes(kind)){
      if(payload.expectedRevision!==history.revision)throw Object.assign(new Error('Import revision changed'),{code:'STALE_IMPORT'});
      if(kind==='parse-import'){
        const parser=payload.format==='csv'?parseCsv:payload.format==='geojson'?parseGeoJson:null;
        if(!parser)throw Object.assign(new Error('Unsupported import format'),{code:'INVALID_IMPORT'});
        return parser(payload.text,payload.source,payload.retrievedAt);
      }
      if(kind==='import'){
        const result=await reconcile(history.current,payload.batch);history.commit(result.project);
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
    else if(kind==='build')return {revision:history.revision,...await buildProject(history.current)};
    else if(kind==='export'){
      const s=await snapshot(),format=payload.format;
      return {revision:history.revision,text:format==='project'?s.projectJson:exportView(s.view,format),
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
