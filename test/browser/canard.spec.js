import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {stubNetwork,openFixture} from './helpers.js';
import {prepareSnapshot} from '../../src/canard-snapshot.js';
import {normalizeCanardLayers} from '../../src/canard-adapter.js';
import {makeCanardLayers,review} from '../helpers/canard-fixture.js';
async function makeEntry(serial='TEST-1',checkedAt=new Date().toISOString()){
 const layers=makeCanardLayers();layers.PP[0].nrSeryjny=serial;
 return prepareSnapshot({batch:normalizeCanardLayers(layers,{review,retrievedAt:checkedAt}),notices:review.notices,checkedAt,review});
}
async function routes(page,getEntry){
 await stubNetwork(page);let downloads=0;
 await page.route('**/data/canard/manifest.json',async r=>r.fulfill({json:(await getEntry()).manifest}));
 await page.route('**/data/canard/snapshot-*.json',async r=>{downloads++;await r.fulfill({contentType:'application/json',body:Buffer.from((await getEntry()).bytes)});});
 return ()=>downloads;
}
async function importCanard(page){
 await page.getByRole('button',{name:'Import',exact:true}).click();await page.getByRole('button',{name:'Import CANARD snapshot',exact:true}).click();
 await expect(page.locator('.import-dialog')).not.toBeVisible();await expect(page.getByTestId('reference-row')).toHaveCount(3);
 await expect(page.locator('#operation-status')).toHaveText('Ready');
}
test('hosted import opts in, preserves notices, caches across reload and exposes PL/EN coverage',async({page})=>{
 const entry=await makeEntry();const downloads=await routes(page,()=>entry);
 await page.goto('/mivue-trafficcam/');await openFixture(page);
 await expect(page.getByTestId('canard-status')).toContainText('Ready');
 await importCanard(page);await expect(page.getByTestId('reference-row')).toHaveCount(3);
 await expect(page.getByLabel('Synchronize CANARD in this project')).toBeChecked();
 await expect(page.getByTestId('canard-status')).toContainText('Control-point data unavailable');
 await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
 await page.reload();await expect(page.getByTestId('reference-row')).toHaveCount(3);await expect(page.getByTestId('canard-status')).toContainText('Ready');expect(downloads()).toBe(1);
 await page.getByRole('button',{name:'PL',exact:true}).click();await expect(page.getByTestId('canard-status')).toContainText('Dane punktów kontrolnych niedostępne');
});
test('changed snapshot merges after restore, undo stays undone until reapply',async({page})=>{
 let entry=await makeEntry();await routes(page,()=>entry);
 await page.goto('/mivue-trafficcam/');await openFixture(page);await expect(page.getByTestId('canard-status')).toContainText('Ready');await importCanard(page);
 await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
 entry=await makeEntry('NEW-SERIAL');await page.reload();
 await expect(page.getByTestId('import-summary')).toContainText('updated: 1');
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(page.getByRole('button',{name:'Redo',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Reapply CANARD snapshot',exact:true}).click();
 await expect(page.getByRole('button',{name:'Redo',exact:true})).toBeDisabled();
});
test('stale cached dataset and disabled source are disclosed without deleting the project',async({page})=>{
 let entry=await makeEntry('TEST-1',new Date(Date.now()-49*3600000).toISOString());await routes(page,()=>entry);
 await page.goto('/mivue-trafficcam/');await openFixture(page);await expect(page.getByTestId('canard-status')).toContainText('older than 48 hours');await importCanard(page);
 await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
 entry={manifest:{schemaVersion:1,state:'disabled',checkedAt:new Date().toISOString(),reasonCode:'RIGHTS_REVIEW',messagePl:'Weryfikacja',messageEn:'Review'}};
 await page.reload();await expect(page.getByTestId('canard-status')).toContainText('withdrawn');
 await expect(page.getByTestId('reference-row')).toHaveCount(3);
 expect(await page.evaluate(async()=>{const {openStorage}=await import('./web/storage.js');const s=await openStorage();const value=await s.getCanardCache();s.close();return value;})).toBeNull();
});

for(const action of ['draft','replacement'])test(`pending snapshot respects ${action}`,async({page})=>{
 let entry=await makeEntry();await routes(page,()=>entry);
 await page.goto('/mivue-trafficcam/');await openFixture(page);await expect(page.getByTestId('canard-status')).toContainText('Ready');await importCanard(page);
 await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
 entry=await makeEntry('CHANGED');let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/data/canard/snapshot-*.json',async r=>{await gate;await r.fulfill({contentType:'application/json',body:Buffer.from(entry.bytes)});});
 await page.reload();await expect(page.getByTestId('reference-row')).toHaveCount(3);
 if(action==='draft'){
  await page.getByTestId('record-row').getByRole('button').click();await page.getByLabel('Latitude',{exact:true}).fill('37.4');release();
  await expect(page.getByTestId('canard-status')).toContainText('waits for unfinished work');await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37.4');
  await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByTestId('import-summary')).toContainText('updated: 1');
  await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37.4');
 }else{
  await openFixture(page,[{},{}]);await page.getByRole('button',{name:'Replace without backup',exact:true}).click();await expect(page.getByTestId('record-count')).toHaveText('2');release();
  await expect(page.getByTestId('canard-status')).toContainText('Ready');await expect(page.getByTestId('reference-row')).toHaveCount(0);
  await expect(page.getByLabel('Synchronize CANARD in this project')).not.toBeChecked();
 }
});

test('recovery blocks automatic imports and preserves the unread project',async({page})=>{
 const entry=await makeEntry();await routes(page,()=>entry);await page.goto('/mivue-trafficcam/');
 await page.evaluate(async()=>{const {openStorage}=await import('./web/storage.js');const s=await openStorage();await s.putWorking({version:999,projectJson:'unread'});s.close();});
 await page.reload();await expect(page.locator('#recovery')).toBeVisible();await expect(page.getByTestId('canard-status')).toContainText('Ready');
 await expect(page.getByTestId('reference-row')).toHaveCount(0);
 expect(await page.evaluate(async()=>{const {openStorage}=await import('./web/storage.js');const s=await openStorage();const v=await s.getWorking();s.close();return v.projectJson;})).toBe('unread');
});

test('bound CANARD contributions provide companion attribution without changing raw bytes',async({page})=>{
 const entry=await makeEntry();await routes(page,()=>entry);await page.goto('/mivue-trafficcam/');await openFixture(page);
 await expect(page.getByTestId('canard-status')).toContainText('Ready');await importCanard(page);
 const id=await page.getByTestId('record-row').getByRole('button').textContent();
 // PP is a point observation; OPP remains an unbound endpoint reference.
 await page.getByTestId('reference-row').filter({hasText:'\\"PP\\"'}).getByRole('button').click();
 await page.getByLabel('Existing record ID',{exact:true}).fill(id);await page.getByRole('button',{name:'Associate with record',exact:true}).click();
 await page.getByTestId('record-row').getByRole('button').click();await page.locator('#details summary').click();
 await expect(page.getByLabel('Four raw bytes (0–255)',{exact:true})).toHaveValue('50, 0, 0, 1');
 await page.getByRole('button',{name:'Export',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download source notices',exact:true}).click();
 const notices=JSON.parse(await readFile(await (await download).path(),'utf8'));expect(notices).toHaveLength(1);expect(notices[0].attribution).toContain('GITD');
});

test('denied snapshot persistence keeps its warning and permits an in-memory import',async({page})=>{
 await page.addInitScript(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='canard')throw new DOMException('quota','QuotaExceededError');return put.apply(this,args);};});
 const entry=await makeEntry();await routes(page,()=>entry);await page.goto('/mivue-trafficcam/');await openFixture(page);
 await expect(page.getByTestId('canard-status')).toContainText('not be saved');await importCanard(page);
 await expect(page.getByTestId('canard-status')).toContainText('not be saved');
});
