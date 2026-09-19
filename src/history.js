import { applyEdit, createProject, hexToBytes } from './project.js';

export function createHistory(project,{limit=50}={}) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid history limit');
  let current=project, revision=0;
  const past=[], future=[];
  return {
    get current(){return current;}, get revision(){return revision;},
    get canUndo(){return past.length>0;}, get canRedo(){return future.length>0;},
    apply(operation){
      const next=applyEdit(current,operation);
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
