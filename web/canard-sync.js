/** One candidate, session-scoped undo suppression, no automatic failure loops. */
export function createCanardSync({getContext,importSnapshot,onStatus=()=>{}}){
 let candidate=null,enabled=true,disposed=false,running=false,lastSession=null;
 const handled=new Set(),failed=new Set();
 function session(){const c=getContext();if(c.sessionId!==lastSession){handled.clear();failed.clear();lastSession=c.sessionId;}return c;}
 return {
  offer(entry,{reapply=false}={}){session();candidate=entry;if(reapply){handled.delete(entry.manifest.sha256);failed.delete(entry.manifest.sha256);}},
  markHandled(hash){session();handled.add(hash);},
  setEnabled(value){enabled=value;if(!value)candidate=null;},
  dispose(){disposed=true;candidate=null;},
  async flush(){
   const c=session(),entry=candidate,hash=entry?.manifest.sha256;
   if(disposed||!enabled||running||!entry||handled.has(hash)||failed.has(hash))return;
   if(!c.ready||c.dirty||c.busy||!c.enabled){if(c.ready&&c.enabled)onStatus('pending');return;}
   running=true;
   try{
    await importSnapshot(entry,{sessionId:c.sessionId,expectedRevision:c.revision});
    if(!disposed&&enabled&&getContext().sessionId===c.sessionId){handled.add(hash);onStatus('applied');}
   }catch(error){if(!disposed&&getContext().sessionId===c.sessionId){failed.add(hash);onStatus('failed',error);}}
   finally{running=false;}
  }
 };
}
