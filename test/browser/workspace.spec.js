import {readFile} from 'node:fs/promises';
import { test,expect } from '@playwright/test';
import { stubNetwork,openFixture } from './helpers.js';
import { makeFixture } from './helpers.js';
import { createProject } from '../../src/project.js';
test.beforeEach(async({page})=>{await stubNetwork(page);await page.goto('/mivue-trafficcam/');});
test('file open, bounded pagination, keyboard selection and language preference',async({page})=>{
 const chooser=page.waitForEvent('filechooser');await page.locator('.file-button').click();
 await (await chooser).setFiles({name:'fixture.bin',mimeType:'application/octet-stream',buffer:Buffer.from(makeFixture(Array.from({length:101},()=>({}))).bytes)});
 await expect(page.getByTestId('record-count')).toHaveText('101');
 await expect(page.getByTestId('record-row')).toHaveCount(100);
 await page.getByTestId('record-row').first().getByRole('button').focus();await page.keyboard.press('Enter');
 await expect(page.getByTestId('selected-id')).toContainText('source:');
 await page.getByRole('button',{name:'Next page',exact:true}).click();await expect(page.getByTestId('record-row')).toHaveCount(1);
 await page.getByRole('button',{name:'PL',exact:true}).click();await expect(page.getByLabel('Otwórz plik',{exact:true})).toBeAttached();
 await expect(page.getByRole('button',{name:'Powiększ',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByLabel('Otwórz plik',{exact:true})).toBeAttached();
});
test('narrow layout retains table and invalid points; tile errors are nonfatal',async({page})=>{
 await page.setViewportSize({width:390,height:844});await openFixture(page,[{latitudeRaw:NaN},{}]);
 await page.getByRole('button',{name:'List',exact:true}).click();
 await expect(page.getByTestId('record-row')).toHaveCount(2);
 await page.getByTestId('record-row').first().getByRole('button').click();
 await expect(page.getByTestId('selected-id')).toContainText('source:');
 await expect(page.getByTestId('tile-status')).toBeVisible();
});
test('untrusted provenance is text; filters retain selected identity',async({page})=>{
 const project=await createProject(makeFixture([{},{}]).bytes);
 project.records[0].provenance=[{note:'<img src=x onerror="window.injected=1">'}];
 await page.getByLabel('Open file',{exact:true}).setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await page.getByTestId('record-row').first().getByRole('button').click();
 await expect(page.getByTestId('selected-id')).toHaveText(project.records[0].id);
 expect(await page.evaluate(()=>window.injected)).toBeUndefined();
 await page.getByLabel('Search ID or provenance',{exact:true}).fill(project.records[1].id);
 await expect(page.getByTestId('record-row')).toHaveCount(1);
 await expect(page.getByText('Selected record is hidden by filters.',{exact:true})).toBeVisible();
 await expect(page.getByTestId('selected-id')).toHaveText(project.records[0].id);
});
test('aggregate clicks zoom without selecting an arbitrary camera; single point selects its row',async({page})=>{
 await openFixture(page,[{},{}]);await expect(page.getByTestId('record-count')).toHaveText('2');
 await page.getByRole('button',{name:'Fit all records',exact:true}).click();
 const box=await page.locator('#map').boundingBox(),center={x:box.width/2,y:box.height/2};
 const settle=async()=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await expect(page.locator('.leaflet-zoom-anim')).toHaveCount(0);};
 await settle();
 for(let n=0;n<3;n++){await page.locator('#map').click({position:center});await settle();}
 await expect(page.getByTestId('selected-id')).toHaveCount(0);
 await expect(page.locator('.leaflet-control-zoom-in')).toHaveAttribute('aria-disabled','true');
 await openFixture(page,[{}]);await expect(page.getByTestId('record-count')).toHaveText('1');
 await page.locator('#map').click({position:center});await expect(page.getByTestId('selected-id')).toContainText('source:');
 await expect(page.locator('tr.selected')).toHaveCount(1);
});
test('BIN table and details show stored speed and type in PL/EN without changing the file',async({page})=>{
 const records=[{rawBytes16To19:[50,90,0,1],typeRaw:1},{rawBytes16To19:[0,0,0,1],typeRaw:964,linkTo:2},{rawBytes16To19:[255,179,0,1],typeRaw:9128},{typeRaw:4294967295},{rawBytes16To19:[0,0,0,1],typeRaw:3},{rawBytes16To19:[139,0,0,1],typeRaw:5}];
 await openFixture(page,records);const rows=page.getByTestId('record-row');
 await expect(page.locator('#record-list')).toContainText('Speed (BIN value)');await expect(page.locator('#record-list')).toContainText('Type (BIN code)');
 for(const [index,speed,type] of [[0,'50 km/h · BIN 50','Speed camera · BIN 1'],[1,'Not specified · BIN 0','Linked-section endpoint · BIN 964'],[2,'Unclassified · BIN 255','Linked-section endpoint · BIN 9128'],[3,'50 km/h · BIN 50','Unclassified · BIN 4294967295'],[4,'Not specified · BIN 0','Red-light · BIN 3'],[5,'Unclassified · BIN 139','Mobile · BIN 5']]){
  await expect(rows.nth(index).locator('td').nth(3)).toHaveText(speed);await expect(rows.nth(index).locator('td').nth(4)).toHaveText(type);
 }
 await rows.first().getByRole('button').click();await expect(page.locator('#details')).toContainText('Speed (BIN value): 50 km/h · BIN 50');await expect(page.locator('#details')).toContainText('Type (BIN code): Speed camera · BIN 1');
 await expect(page.locator('#details')).toContainText('Interpretation from inspected MiVue 955W firmware');
 await page.getByRole('button',{name:'PL',exact:true}).click();await expect(page.locator('#record-list')).toContainText('Prędkość (wartość BIN)');await expect(page.locator('#details')).toContainText('Prędkość (wartość BIN): 50 km/h · BIN 50');await expect(page.locator('#details')).toContainText('Typ (kod BIN): Kamera prędkości · BIN 1');
 await rows.nth(4).getByRole('button').click();await expect(page.locator('#details')).toContainText('Czerwone światło · BIN 3');await expect(page.locator('#details')).toContainText('Nie podano · BIN 0');
 await rows.nth(5).getByRole('button').click();await expect(page.locator('#details')).toContainText('Mobilna · BIN 5');await expect(page.locator('#details')).toContainText('Niesklasyfikowana · BIN 139');
 await expect(page.locator('#changes')).toHaveText('0');
 await page.getByRole('button',{name:'EN',exact:true}).click();await page.getByRole('button',{name:'Export',exact:true}).click();
 await page.getByRole('button',{name:'Prepare binary',exact:true}).click();
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download validated binary',exact:true}).click();
 expect(await readFile(await (await pending).path())).toEqual(Buffer.from(makeFixture(records).bytes));
});
test('view switches wait for file loading to finish before accepting clicks',async({page})=>{
 await page.addInitScript(()=>{const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(message,...rest){if(message.kind==='open-bin'&&message.payload.name==='fixture.bin'){window.releaseFile=()=>post.call(this,message,...rest);return;}return post.call(this,message,...rest);};});
 await page.setViewportSize({width:390,height:844});await page.reload();await openFixture(page);
 const list=page.getByRole('button',{name:'List',exact:true}),map=page.getByRole('button',{name:'Map',exact:true});
 await expect(list).toBeDisabled();await expect(map).toBeDisabled();
 await page.evaluate(()=>window.releaseFile());await expect(page.getByTestId('record-count')).toHaveText('1');
 await expect(list).toBeEnabled();await expect(map).toBeEnabled();await list.click();
 await expect(page.getByTestId('record-row').first().getByRole('button')).toBeVisible();
});
