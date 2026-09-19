import { test,expect } from '@playwright/test';
import { stubNetwork,openFixture } from './helpers.js';
import { makeFixture } from './helpers.js';
import { createProject } from '../../src/project.js';
test.beforeEach(async({page})=>{await stubNetwork(page);await page.goto('/mivue-trafficcam/');});
test('file open, bounded pagination, keyboard selection and language preference',async({page})=>{
 await openFixture(page,Array.from({length:101},()=>({})));
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
