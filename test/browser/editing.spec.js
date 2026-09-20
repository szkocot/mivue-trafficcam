import { test,expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { stubNetwork,openFixture,makeFixture } from './helpers.js';
test.beforeEach(async({page})=>{await stubNetwork(page);await page.goto('/mivue-trafficcam/');});
const selectFirst=page=>page.getByTestId('record-row').first().getByRole('button').click();
test('decimal comma Apply autosaves; undo/redo persist, discard restores baseline',async({page})=>{
 await openFixture(page);await selectFirst(page);
 await page.getByLabel('Latitude',{exact:true}).fill('37,1');await page.getByRole('button',{name:'Apply',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37');
 await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37.1');
 await expect(page.getByTestId('save-status')).toHaveText('Saved locally');await page.reload();await selectFirst(page);
 await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37.1');await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Discard changes',exact:true}).click();
 await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37');await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
});
test('draft selection guard, strict coordinate validation, clone delete restore',async({page})=>{
 await openFixture(page,[{},{}]);await selectFirst(page);
 await page.getByLabel('Latitude',{exact:true}).fill('37junk');await page.getByRole('button',{name:'Apply',exact:true}).click();
 await expect(page.getByText('Enter a valid coordinate using a decimal point or comma.',{exact:true})).toBeVisible();
 await page.getByTestId('record-row').nth(1).getByRole('button').click();
 await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Discard draft',exact:true}).click();
 await page.getByRole('button',{name:'Clone selected template',exact:true}).click();await expect(page.getByTestId('record-count')).toHaveText('3');
 await page.getByRole('button',{name:'Delete record',exact:true}).click();await expect(page.getByTestId('record-count')).toHaveText('2');
 await page.getByRole('button',{name:'Restore record',exact:true}).click();await expect(page.getByTestId('record-count')).toHaveText('3');
});
test('project save/reopen and unchanged binary download use real bytes',async({page})=>{
 await openFixture(page);await expect(page.getByTestId('record-count')).toHaveText('1');
 let event=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();
 const project=await event;const projectBytes=await readFile(await project.path());expect(JSON.parse(projectBytes).projectVersion).toBe(3);
 await page.getByRole('button',{name:'Export',exact:true}).click();await page.getByRole('button',{name:'Prepare binary',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download validated binary',exact:true})).toBeEnabled();
 event=page.waitForEvent('download');await page.getByRole('button',{name:'Download validated binary',exact:true}).click();
 expect(await readFile(await (await event).path())).toEqual(Buffer.from(makeFixture([{}]).bytes));
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByLabel('Open file',{exact:true}).setInputFiles({name:'saved.json',mimeType:'application/json',buffer:projectBytes});
 await expect(page.getByTestId('record-count')).toHaveText('1');
});
test('deleted link target blocks binary but not project/data exports; report localizes',async({page})=>{
 await openFixture(page,[{typeRaw:964,linkTo:1},{typeRaw:9128}]);
 await page.getByTestId('record-row').nth(1).getByRole('button').click();await page.getByRole('button',{name:'Delete record',exact:true}).click();
 await page.getByRole('button',{name:'Export',exact:true}).click();await page.getByRole('button',{name:'Prepare binary',exact:true}).click();
 await expect(page.getByTestId('export-error')).toBeVisible();await expect(page.getByRole('button',{name:'Download validated binary',exact:true})).toBeDisabled();
 for(const label of ['Project JSON','Data JSON','GeoJSON','CSV']){const event=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();expect((await event).suggestedFilename()).toBeTruthy();}
 await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'PL',exact:true}).click();
 await page.getByRole('button',{name:'Eksportuj',exact:true}).click();await expect(page.getByText('Zgodność z urządzeniem: niesprawdzona. Używasz na własne ryzyko.',{exact:true})).toBeVisible();
});
test('map-picked draft is tentative; raw bytes validate and reports expire on edit',async({page})=>{
 await openFixture(page);await selectFirst(page);
 await page.getByRole('button',{name:'Pick on map',exact:true}).click();
 await page.locator('#map').click({position:{x:100,y:100}});
 await expect(page.getByLabel('Latitude',{exact:true})).not.toHaveValue('37');
 await page.getByRole('button',{name:'Cancel',exact:true}).last().click();await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37');
 await page.locator('#details summary').click();await page.getByLabel('Four raw bytes (0–255)',{exact:true}).fill('1, 2, 3, 999');
 await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByText('Enter exactly four integers between 0 and 255.',{exact:true})).toBeVisible();
 await page.getByLabel('Four raw bytes (0–255)',{exact:true}).fill('1, 2, 3, 4');await page.getByRole('button',{name:'Apply',exact:true}).click();
 await page.getByRole('button',{name:'Export',exact:true}).click();await page.getByRole('button',{name:'Prepare binary',exact:true}).click();
 await expect(page.getByRole('button',{name:'Download validated binary',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Export',exact:true}).click();await expect(page.getByRole('button',{name:'Download validated binary',exact:true})).toBeDisabled();
});
test('explicit link resolution persists reason and downloaded Blob URLs are released',async({page})=>{
 await page.evaluate(()=>{window.urls=new Set();const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=b=>{const u=create(b);window.urls.add(u);return u;};URL.revokeObjectURL=u=>{window.urls.delete(u);revoke(u);};});
 await openFixture(page,[{typeRaw:964,linkRaw:123},{typeRaw:9128}]);
 const target=await page.getByTestId('record-row').nth(1).getByRole('button').textContent();await selectFirst(page);
 await page.locator('#details summary').click();await page.getByLabel('Target record ID (raw type 9128)',{exact:true}).fill(target);
 await page.getByLabel('Reason for resolving link',{exact:true}).fill('manual location check');await page.getByRole('button',{name:'Resolve candidate link',exact:true}).click();
 await expect(page.getByTestId('save-status')).toHaveText('Saved locally');const event=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();
 const data=JSON.parse(await readFile(await (await event).path(),'utf8'));expect(data.records[0].edits.linkResolution.reason).toBe('manual location check');
 await expect.poll(()=>page.evaluate(()=>window.urls.size)).toBe(0);
});
test('link resolution and coordinate drafts commit atomically and undo together',async({page})=>{
 await openFixture(page,[{typeRaw:964,linkRaw:123},{typeRaw:9128}]);
 const target=await page.getByTestId('record-row').nth(1).getByRole('button').textContent();await selectFirst(page);
 await page.getByLabel('Latitude',{exact:true}).fill('37.1');await page.locator('#details summary').click();
 await page.getByLabel('Target record ID (raw type 9128)',{exact:true}).fill(target);await page.getByLabel('Reason for resolving link',{exact:true}).fill('first reason');
 await page.getByRole('button',{name:'Resolve candidate link',exact:true}).click();
 await expect(page.locator('#operation-status')).toHaveText('Ready');
 await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37.1');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37');
 await page.locator('#details summary').click();await expect(page.getByLabel('Target record ID (raw type 9128)',{exact:true})).toHaveValue('');
 await page.getByLabel('Target record ID (raw type 9128)',{exact:true}).fill(target);await page.getByLabel('Reason for resolving link',{exact:true}).fill('navigation reason');
 await page.getByTestId('record-row').nth(1).getByRole('button').click();await page.getByRole('dialog').getByRole('button',{name:'Apply',exact:true}).click();
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();
 expect(JSON.parse(await readFile(await (await event).path(),'utf8')).records[0].edits.linkResolution.reason).toBe('navigation reason');
});
test('blocked binary issue links select the affected record',async({page})=>{
 await openFixture(page,[{typeRaw:964,linkTo:1},{typeRaw:9128}]);
 const source=await page.getByTestId('record-row').first().getByRole('button').textContent();
 await page.getByTestId('record-row').nth(1).getByRole('button').click();await page.getByRole('button',{name:'Delete record',exact:true}).click();
 await page.getByRole('button',{name:'Export',exact:true}).click();await page.getByRole('button',{name:'Prepare binary',exact:true}).click();
 await page.getByTestId('export-error').getByRole('button',{name:source,exact:true}).click();await expect(page.getByTestId('selected-id')).toHaveText(source);
});
