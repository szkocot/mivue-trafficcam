export function createAutosave({store,onStatus=()=>{}}) {
  let session=null,latest=-1,queue=Promise.resolve(),failure=null;
  return {
    begin(id){session=id;latest=-1;failure=null;},
    save(entry){
      if(entry.sessionId!==session || entry.revision<latest)return Promise.resolve();
      latest=entry.revision;
      const identity=()=>entry.sessionId===session && entry.revision===latest;
      onStatus({state:'saving',sessionId:session,revision:latest});
      const task=queue.catch(()=>{}).then(async()=>{
        if(!identity())return;
        try{
          await store.putWorking({...entry,version:1,savedAt:new Date().toISOString()});
          if(identity()){failure=null;onStatus({state:'saved',sessionId:session,revision:latest});}
        }catch(error){
          if(identity()){failure=error;onStatus({state:'failed',sessionId:session,revision:latest,error});}
          throw error;
        }
      });
      queue=task.catch(()=>{});return task;
    },
    async flush(){await queue;if(failure)throw failure;}
  };
}
