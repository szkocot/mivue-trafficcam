import { createWorkerSession } from './worker-session.js';
const session=createWorkerSession();
self.onmessage=async event=>self.postMessage(await session.handle(event.data));
