import { applyEdit, createProject, hexToBytes,inspectProject } from './project.js';

export function createHistory(project,{limit=50}={}) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid history limit');
  let current=project, revision=0;
  const past=[], future=[];
  return {
    get current(){return current;}, get revision(){return revision;},
    get canUndo(){return past.length>0;}, get canRedo(){return future.length>0;},
    commit(next){
      if(next===current)return current;
      if(next.source.name!==current.source.name||next.source.sha256!==current.source.sha256||next.source.bytesHex!==current.source.bytesHex)throw new Error('Import changed project baseline');
      inspectProject(next);past.push(current);if(past.length>limit)past.shift();
      current=next.source===current.source?next:{...next,source:current.source};future.length=0;revision++;return current;
    },
    apply(operation){
      // Build a candidate first: a failed compound form never commits a partial edit.
      const operations=Array.isArray(operation)?operation:[operation];
      if(!operations.length)return current;
      const next=operations.reduce((candidate,op)=>applyEdit(candidate,op),current);
      past.push(current); if(past.length>limit) past.shift();
      current=next; future.length=0; revision++; return current;
    },
    undo(){if(past.length){future.push(current);current=past.pop();revision++;} return current;},
    redo(){if(future.length){past.push(current);current=future.pop();revision++;} return current;},
    async reset(){
      const next=await createProject(hexToBytes(current.source.bytesHex),{name:current.source.name});
      current=next; past.length=0; future.length=0; revision++; return current;
    }
  };
}
