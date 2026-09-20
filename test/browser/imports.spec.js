import {test,expect} from '@playwright/test';
import {makeFixture} from '../helpers/fixture.js';
import {readFile} from 'node:fs/promises';
const saved=page=>page.evaluate(async()=>{const {openStorage}=await import('./web/storage.js');const s=await openStorage();const value=await s.getWorking();s.close();return value;});
async function setup(page){
 await page.route('https://**',r=>r.abort());await page.goto('/mivue-trafficcam/');await page.getByRole('button',{name:'EN',exact:true}).click();
 await page.getByLabel('Open file',{exact:true}).setInputFiles({name:'fixture.bin',mimeType:'application/octet-stream',buffer:Buffer.from(makeFixture([{}]).bytes)});
 await expect(page.getByTestId('record-count')).toHaveText('1');
}
async function importCsv(page,text){
 await page.getByRole('button',{name:'Import',exact:true}).click();
 await page.getByLabel('Source namespace',{exact:true}).fill('example');await page.getByLabel('Attribution',{exact:true}).fill('Example owner');
 await page.getByLabel('Import file',{exact:true}).setInputFiles({name:'cameras.csv',mimeType:'text/csv',buffer:Buffer.from(text)});
 await expect(page.locator('.import-dialog')).not.toBeVisible();
 await expect(page.getByTestId('import-summary')).toContainText('reference');
}
test('local import shows safe attributed metadata, translated independent preferences and restores references',async({page})=>{
 await setup(page);
 await importCsv(page,'id,latitude,longitude,kind,status,speed,speed_unit,name\na,52,19,camera,active,50,mph,<img src=x onerror=alert(1)>');
 await page.getByTestId('reference-row').getByRole('button').click();
 await expect.soft(page.locator('#operation-status')).toHaveText('Ready');await expect.soft(page.locator('#hidden-selection')).toBeHidden();
 await expect(page.locator('#details')).toContainText('80.47 km/h');await expect(page.locator('#details')).toContainText('50 mph');
 await expect(page.locator('#details')).toContainText('Example owner');await expect(page.locator('#details img')).toHaveCount(0);
 await expect(page.locator('#details').getByRole('button',{name:'Apply',exact:true})).toHaveCount(0);
 await page.getByLabel('Show speed limits',{exact:true}).check();await expect(page.getByLabel('Show metadata',{exact:true})).not.toBeChecked();
 await page.getByRole('button',{name:'PL',exact:true}).click();await expect(page.getByLabel('Pokaż ograniczenia prędkości',{exact:true})).toBeChecked();
 await page.reload();await expect(page.getByTestId('reference-row')).toHaveCount(1);await expect(page.getByLabel('Pokaż ograniczenia prędkości',{exact:true})).toBeChecked();
 await page.getByRole('button',{name:'EN',exact:true}).click();
 await page.getByTestId('record-row').getByRole('button').click();await expect(page.locator('#details')).toContainText('Speed limit unknown');
});
test('section source geometry is reference-only and imports undo in one step',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Import',exact:true}).click();
 await page.getByLabel('Source namespace',{exact:true}).fill('sections');await page.getByLabel('Attribution',{exact:true}).fill('Owner');
 await page.getByLabel('Import format',{exact:true}).selectOption('geojson');
 await page.getByLabel('Import file',{exact:true}).setInputFiles({name:'sections.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',id:'s',properties:{kind:'section',status:'active'},geometry:{type:'LineString',coordinates:[[19,52],[20,53]]}}]}))});
 await expect(page.getByTestId('reference-row')).toHaveCount(1);await page.getByTestId('reference-row').getByRole('button').click();
 await expect(page.locator('#details')).toContainText('Section');await expect(page.getByTestId('record-count')).toHaveText('1');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByTestId('reference-row')).toHaveCount(0);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(page.getByTestId('reference-row')).toHaveCount(1);
});
test('template imports preserve raw bytes, repeated imports do not save, manual edits and deletions win after reload',async({page})=>{
 await page.addInitScript(()=>{window.workingWrites=0;const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='working')window.workingWrites++;return put.apply(this,args);};});
 await setup(page);const id=await page.getByTestId('record-row').getByRole('button').textContent();
 await page.getByRole('button',{name:'Import',exact:true}).click();await page.getByLabel('Source namespace',{exact:true}).fill('example');await page.getByLabel('Attribution',{exact:true}).fill('Example owner');
 await page.getByLabel('Original template record ID (optional)',{exact:true}).fill(id);await page.getByLabel('I accept that the template raw fields are copied unchanged and unverified.',{exact:true}).check();
 const csv='id,latitude,longitude,kind,status,speed,speed_unit\na,37,-6,camera,active,80,km/h';
 await page.getByLabel('Import file',{exact:true}).setInputFiles({name:'c.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
 await expect(page.getByTestId('record-count')).toHaveText('2');await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
 let p=JSON.parse((await saved(page)).projectJson);expect(p.records[1].edits).toEqual({latitude:37,longitude:-6});
 await page.getByTestId('record-row').nth(1).getByRole('button').click();await page.locator('#details summary').click();await expect(page.getByLabel('Four raw bytes (0–255)',{exact:true})).toHaveValue('50, 0, 0, 1');
 const writes=await page.evaluate(()=>window.workingWrites),revision=(await saved(page)).revision;
 await importCsv(page,csv);expect((await saved(page)).revision).toBe(revision);expect(await page.evaluate(()=>window.workingWrites)).toBe(writes);
 // Deliberately applying the same coordinate still establishes manual ownership.
 await page.getByLabel('Latitude',{exact:true}).fill('37.1');await page.getByLabel('Latitude',{exact:true}).fill('37');await page.getByRole('button',{name:'Apply',exact:true}).click();
 await expect.poll(async()=>JSON.parse((await saved(page)).projectJson).ingestion.ownership.find(o=>o.recordId==='new:1')?.coordinates).toBe('manual');await page.reload();
 await importCsv(page,csv.replace('a,37,-6','a,38,-5'));await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
 p=JSON.parse((await saved(page)).projectJson);expect(p.records[1].edits).toEqual({latitude:37,longitude:-6});
 await page.getByTestId('record-row').nth(1).getByRole('button').click();await page.getByRole('button',{name:'Delete record',exact:true}).click();
 await importCsv(page,csv.replace('a,37,-6','a,39,-4'));await expect(page.getByTestId('record-count')).toHaveText('1');await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
 expect(JSON.parse((await saved(page)).projectJson).records[1].deleted).toBe(true);
});
test('duplicate resolution, draft guard, invalid rollback and separate reference export',async({page})=>{
 await setup(page);await page.getByTestId('record-row').getByRole('button').click();await page.getByLabel('Latitude',{exact:true}).fill('37.2');
 await page.getByRole('button',{name:'Import',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Unapplied');await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37.2');await page.getByRole('button',{name:'Import',exact:true}).click();await page.getByRole('button',{name:'Discard draft',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 await importCsv(page,'id,latitude,longitude,kind,status\na,37,-7,camera,active');await expect(page.getByTestId('import-summary')).toContainText('Possible duplicate');
 await page.getByTestId('reference-row').getByRole('button').click();const id=await page.getByTestId('record-row').getByRole('button').textContent();
 await page.getByLabel('Existing record ID',{exact:true}).fill(id);await page.getByRole('button',{name:'Associate with record',exact:true}).click();await expect(page.getByTestId('reference-row')).toHaveCount(0);
 await page.getByTestId('record-row').getByRole('button').click();await expect(page.locator('#details')).toContainText('Example owner');
 await expect(page.getByTestId('save-status')).toHaveText('Saved locally');const before=(await saved(page)).projectJson;
 await page.getByRole('button',{name:'Import',exact:true}).click();await page.getByLabel('Import file',{exact:true}).setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('id,latitude,longitude,kind\nb,999,19,camera')});await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Import failed');
 await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();expect((await saved(page)).projectJson).toBe(before);
 await page.getByRole('button',{name:'Export',exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Reference GeoJSON',exact:true}).click();
 const refs=JSON.parse(await readFile(await (await pending).path(),'utf8'));expect(refs.features[0].properties.attribution).toBe('Example owner');expect(refs.features[0].properties.encoded).toBe(true);
});
test('cancelled file read cannot import into a replacement document',async({page})=>{
 await setup(page);await page.evaluate(()=>{const text=File.prototype.text;File.prototype.text=function(){if(this.name==='slow.csv')return new Promise(resolve=>{window.releaseImport=()=>text.call(this).then(resolve);});return text.call(this);};});
 await page.getByRole('button',{name:'Import',exact:true}).click();await page.getByLabel('Source namespace',{exact:true}).fill('example');await page.getByLabel('Attribution',{exact:true}).fill('Owner');
 await page.getByLabel('Import file',{exact:true}).setInputFiles({name:'slow.csv',mimeType:'text/csv',buffer:Buffer.from('id,latitude,longitude,kind\na,52,19,camera')});
 await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByLabel('Open file',{exact:true}).setInputFiles({name:'new.bin',mimeType:'application/octet-stream',buffer:Buffer.from(makeFixture([{},{}]).bytes)});
 await expect(page.getByTestId('record-count')).toHaveText('2');await page.evaluate(()=>window.releaseImport());await expect(page.getByTestId('reference-row')).toHaveCount(0);
});
test('import survives denied persistence and local display preferences',async({page})=>{
 await page.addInitScript(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='working')throw new DOMException('quota','QuotaExceededError');return put.apply(this,args);};Object.defineProperty(window,'localStorage',{get(){throw new DOMException('denied','SecurityError');}});});
 await setup(page);await importCsv(page,'id,latitude,longitude,kind\na,52,19,camera');await expect(page.getByTestId('save-status')).toContainText('Local save failed');
 await page.getByLabel('Show metadata',{exact:true}).check();await expect(page.getByLabel('Show metadata',{exact:true})).toBeChecked();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();const p=JSON.parse(await readFile(await (await pending).path(),'utf8'));expect(p.ingestion.observations).toHaveLength(1);
});
test('reference canvas and mobile table remain bounded for a large synthetic import',async({page},testInfo)=>{
 test.setTimeout(120000);await setup(page);await page.getByRole('button',{name:'Import',exact:true}).click();await page.getByLabel('Source namespace',{exact:true}).fill('large');await page.getByLabel('Attribution',{exact:true}).fill('Synthetic');
 const text='id,latitude,longitude,kind,speed,speed_unit\n'+Array.from({length:100000},(_,i)=>`${i},${50+(i%1000)/1000},${18+Math.floor(i/1000)/100},camera,50,km/h`).join('\n');
 const start=Date.now();await page.getByLabel('Import file',{exact:true}).setInputFiles({name:'large.csv',mimeType:'text/csv',buffer:Buffer.from(text)});
 await expect(page.getByTestId('reference-row')).toHaveCount(100,{timeout:60000});const importMs=Date.now()-start;
 await page.getByTestId('reference-row').first().getByRole('button').click();await page.getByLabel('Show speed limits',{exact:true}).check();await page.getByLabel('Show metadata',{exact:true}).check();
 expect(Number(await page.locator('canvas.points').getAttribute('data-label-count'))).toBeLessThanOrEqual(200);expect(await page.locator('.leaflet-marker-icon').count()).toBe(0);
 await page.screenshot({path:'.superpowers/sdd/2026-09-20-source-ingestion/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'List',exact:true}).click();
 await expect(page.getByTestId('reference-row')).toHaveCount(100);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:'.superpowers/sdd/2026-09-20-source-ingestion/mobile.png',fullPage:true});
 console.log(`Synthetic 100k import: ${importMs} ms; reference rows: 100; labels capped at 200; zero per-point DOM markers.`);
 await testInfo.attach('import-timing',{body:JSON.stringify({importMs}),contentType:'application/json'});
});
