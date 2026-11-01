import assert from 'node:assert/strict';
import {createWorkerSession} from '../../web/worker-session.js';
import {loadProject,serializeProject} from '../../src/project.js';
import {buildProject} from '../../src/encoder.js';
import {referenceView,exportReferences} from '../../src/import-view.js';
import {projectNotices} from '../../src/source-notices.js';
import {CANARD_NAMESPACE,canonical,validateSnapshot} from '../../src/canard-snapshot.js';

/** Exercise the real hosted-import path on a fresh baseline; never mutate the user's project. */
export async function verifyHostedImport(bytes,prepared){
 const hosted=await validateSnapshot(prepared.bytes,prepared.manifest),worker=createWorkerSession();let id=0;
 async function request(kind,payload){const r=await worker.handle({sessionId:'audit',requestId:++id,kind,payload});assert.equal(r.ok,true,JSON.stringify(r.error));return r.result;}
 await request('open-bin',{bytes,name:'audit-baseline.bin'});
 const imported=await request('import-canard',{bytes:prepared.bytes,manifest:prepared.manifest,expectedRevision:0,enableSync:false});
 const project=await loadProject(imported.snapshot.projectJson),saved=await serializeProject(project),loaded=await loadProject(saved);
 assert.equal(await serializeProject(loaded),saved);
 const refs=referenceView(loaded).filter(o=>o.namespace===CANARD_NAMESPACE),byId=new Map(refs.map(o=>[o.sourceId,o]));
 assert.equal(refs.length,hosted.batch.observations.length);assert.equal(byId.size,refs.length);
 for(const observation of hosted.batch.observations)for(const [field,value] of Object.entries(observation))assert.equal(canonical(byId.get(observation.sourceId)?.[field]),canonical(value),`${observation.sourceId}: ${field}`);
 assert.ok(projectNotices(loaded).some(n=>canonical(n)===canonical(hosted.notices)));
 assert.equal(exportReferences(project),exportReferences(loaded));
 const exported=JSON.parse(exportReferences(loaded));
 for(const o of hosted.batch.observations){const feature=exported.features.find(f=>f.properties.sourceId===o.sourceId);assert.deepEqual(feature.geometry,o.geometry);for(const [field,value]of Object.entries(o))if(field!=='geometry')assert.deepEqual(feature.properties[field],value);}
 const repeated=await request('import-canard',{bytes:prepared.bytes,manifest:prepared.manifest,expectedRevision:imported.snapshot.revision,enableSync:false});
 assert.equal(repeated.snapshot.projectJson,imported.snapshot.projectJson);
 const built=await buildProject(loaded);assert.deepEqual(Buffer.from(built.bytes),Buffer.from(bytes));
 return {passed:true,observations:refs.length,referenceOnly:refs.filter(r=>!r.encoded).length,encodedBindings:refs.filter(r=>r.encoded).length,exactObservationFields:true,projectRoundTrip:true,referenceExport:true,repeatImportUnchanged:true,noticesPreserved:true,baselineBinByteIdentical:true};
}
