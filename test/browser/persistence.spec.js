import { test,expect } from '@playwright/test';
import { stubNetwork,openFixture,official,makeFixture } from './helpers.js';
test('quota/transaction failures remain editable and offer backup; no false saved state',async({page})=>{
 await stubNetwork(page);await page.addInitScript(()=>{
  const original=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){if(this.name==='working')throw new DOMException('quota','QuotaExceededError');return original.apply(this,args);};
 });
 await page.goto('/mivue-trafficcam/');await openFixture(page);await expect(page.getByTestId('save-status')).toContainText('Local save failed');
 await page.getByTestId('record-row').first().getByRole('button').click();await page.getByLabel('Latitude',{exact:true}).fill('37.1');await page.getByRole('button',{name:'Apply',exact:true}).click();
 await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37.1');await expect(page.getByTestId('save-status')).toContainText('Local save failed');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();await download;
});
test('aborted real IndexedDB transaction reports failure',async({page})=>{
 await stubNetwork(page);await page.addInitScript(()=>{
  const original=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){const result=original.apply(this,args);if(this.name==='working')this.transaction.abort();return result;};
 });
 await page.goto('/mivue-trafficcam/');await openFixture(page);await expect(page.getByTestId('save-status')).toContainText('Local save failed');
});
test('corrupt stored project survives startup and can be recovered before explicit replacement',async({page})=>{
 await stubNetwork(page);await page.goto('/mivue-trafficcam/');
 await page.evaluate(async()=>{const {openStorage}=await import('./web/storage.js');const store=await openStorage();await store.putWorking({version:999,projectJson:'broken'});store.close();});
 await page.reload();await expect(page.getByText('Stored project cannot be opened. Download recovery data before replacing it.',{exact:true})).toBeVisible();
 expect(await page.evaluate(async()=>{const {openStorage}=await import('./web/storage.js');const s=await openStorage();const r=await s.getWorking();s.close();return r.version;})).toBe(999);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download recovery data',exact:true}).click();await download;
 await openFixture(page);await page.getByRole('button',{name:'Replace without backup',exact:true}).click();await expect(page.getByTestId('record-count')).toHaveText('1');
});
test('storage denied still permits local file editing and downloads',async({page})=>{
 await stubNetwork(page);await page.addInitScript(()=>Object.defineProperty(window,'indexedDB',{get(){throw new DOMException('denied','SecurityError');}}));
 await page.goto('/mivue-trafficcam/');await openFixture(page);await expect(page.getByTestId('record-count')).toHaveText('1');await expect(page.getByTestId('save-status')).toContainText('Local save failed');
});
test('failed saved-project read cannot autosave official baseline over unread edits',async({page})=>{
 await stubNetwork(page);await page.goto('/mivue-trafficcam/');await openFixture(page);
 await page.getByTestId('record-row').first().getByRole('button').click();await page.getByLabel('Latitude',{exact:true}).fill('37.2');await page.getByRole('button',{name:'Apply',exact:true}).click();
 await expect(page.locator('#changes')).toHaveText('1');await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
 await page.addInitScript(()=>{
  let failed=false;const get=IDBObjectStore.prototype.get;
  IDBObjectStore.prototype.get=function(...args){const request=get.apply(this,args);if(this.name==='working'&&!failed){failed=true;this.transaction.abort();}return request;};
 });
 await page.route(official,r=>r.fulfill({body:Buffer.from(makeFixture([{}]).bytes),headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.reload();await expect(page.getByTestId('source-status')).toHaveAttribute('data-state','ready');
 await expect(page.locator('#operation-status')).not.toHaveText('Working…');
 await expect(page.locator('#recovery')).toBeVisible();await expect(page.getByTestId('record-count')).toHaveText('0');
 const saved=await page.evaluate(async()=>{const {openStorage}=await import('./web/storage.js');const s=await openStorage();const r=await s.getWorking();s.close();return JSON.parse(r.projectJson);});
 expect(saved.records[0].edits.latitude).toBe(37.2);
});
test('manual file opened before IndexedDB is ready keeps its autosave session',async({page})=>{
 await stubNetwork(page);await page.addInitScript(()=>{
  const open=indexedDB.open.bind(indexedDB);
  indexedDB.open=(...args)=>{const request=open(...args);let success;
   Object.defineProperty(request,'onsuccess',{get:()=>success,set:fn=>{success=fn;}});
   request.addEventListener('success',event=>{window.storageWaiting=true;window.releaseStorage=()=>success(event);});return request;
  };
 });
 await page.goto('/mivue-trafficcam/');await expect.poll(()=>page.evaluate(()=>window.storageWaiting)).toBe(true);
 await openFixture(page);await expect(page.getByTestId('record-count')).toHaveText('1');await page.evaluate(()=>window.releaseStorage());
 await page.getByTestId('record-row').first().getByRole('button').click();await page.getByLabel('Latitude',{exact:true}).fill('37.3');await page.getByRole('button',{name:'Apply',exact:true}).click();
 await expect(page.locator('#changes')).toHaveText('1');await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
 const saved=await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('mivue-trafficcam',1);request.addEventListener('success',()=>{const db=request.result,tx=db.transaction('working'),get=tx.objectStore('working').get('current');tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onabort=()=>reject(tx.error);});}));
 expect(JSON.parse(saved.projectJson).records[0].edits.latitude).toBe(37.3);
});
