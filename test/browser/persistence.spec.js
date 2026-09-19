import { test,expect } from '@playwright/test';
import { stubNetwork,openFixture } from './helpers.js';
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
