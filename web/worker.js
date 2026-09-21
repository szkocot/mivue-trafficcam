import { createWorkerSession } from './worker-session.js';
const session=createWorkerSession();
self.onmessage=async event=>{
 const r=event.data;
 if(r.kind==='country-cancel')self.postMessage({sessionId:r.sessionId,requestId:r.requestId,ok:true,result:{cancelled:session.cancelCountry({sessionId:r.sessionId,generation:r.payload?.generation})}});
 else self.postMessage(await session.handle(r));
};
