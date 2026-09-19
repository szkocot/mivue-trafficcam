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
