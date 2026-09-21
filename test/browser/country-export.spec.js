import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {stubNetwork,openFixture} from './helpers.js';
import {packCountryData,boxCountry} from '../helpers/country-fixture.js';
import {parseDatabase} from '../../src/parser.js';
async function start(page,records=[{}, {longitudeRaw:-654}],countries=[boxCountry('AA',-7.2,36.8,-6.95,37.3),boxCountry('BB',-6.94,36.8,-6.7,37.3)]){
 await stubNetwork(page);const e=await packCountryData(countries);let requests=0;
 await page.route('**/data/countries/manifest.json',r=>r.fulfill({json:e.manifest}));
 await page.route('**/data/countries/countries.json',r=>{requests++;return r.fulfill({contentType:'application/json',body:Buffer.from(e.bytes)});});
 await page.route('**/data/countries/NOTICE.json',r=>r.fulfill({contentType:'application/json',body:Buffer.from(e.noticeBytes)}));
 await page.goto('/mivue-trafficcam/');await openFixture(page,records);await expect(page.getByTestId('record-count')).toHaveText(String(records.length));return ()=>requests;
}
async function download(page,label){const p=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();return readFile(await (await p).path());}
async function select(page,ids=['AA']){await page.getByLabel('Export scope',{exact:true}).selectOption('countries');await page.getByLabel('Countries',{exact:true}).selectOption(ids);await page.getByRole('button',{name:'Preview selection',exact:true}).click();await expect(page.getByTestId('country-preview')).toContainText('Included');}
test('scoped downloads preserve full backup, use lazy boundaries and reparse reduced BIN',async({page})=>{
 const requests=await start(page);expect(requests()).toBe(0);
 await page.getByRole('button',{name:'Export',exact:true}).click();const before=await download(page,'Full project backup — not country-filtered');
 await select(page);await page.getByRole('button',{name:'Prepare binary',exact:true}).click();
 const bytes=await download(page,'Download validated binary');expect(parseDatabase(bytes).records).toHaveLength(1);
 expect(await download(page,'Full project backup — not country-filtered')).toEqual(before);
 const geo=JSON.parse((await download(page,'GeoJSON')).toString());expect(geo.features).toHaveLength(1);expect(geo.exportSelection.boundaryNotice.licence).toBe('Public domain');
 const report=JSON.parse((await download(page,'Download selection report / notices')).toString());expect(report.records.keptIds).toHaveLength(1);
 await page.getByLabel('Countries',{exact:true}).selectOption(['BB']);await expect(page.getByRole('button',{name:'Download validated binary',exact:true})).toBeDisabled();expect(requests()).toBe(1);
});
test('cancelled boundary loading offers retry and cannot publish an old preview',async({page})=>{
 await start(page);let release;const gate=new Promise(resolve=>{release=resolve;});let entered=false;
 await page.route('**/data/countries/manifest.json',async route=>{entered=true;await gate;await route.fallback();});
 await page.getByRole('button',{name:'Export',exact:true}).click();await page.getByLabel('Export scope',{exact:true}).selectOption('countries');
 await expect.poll(()=>entered).toBe(true);await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
 try{await expect(page.getByRole('button',{name:'Retry boundaries',exact:true})).toBeVisible();}finally{release();}
 await page.getByRole('button',{name:'Retry boundaries',exact:true}).click();await page.getByLabel('Countries',{exact:true}).selectOption('AA');
 await page.getByRole('button',{name:'Preview selection',exact:true}).click();await expect(page.getByTestId('country-preview')).toContainText('Included: 1');
});
test('corrupt boundaries fail closed and retry recovers',async({page})=>{
 await start(page);let corrupt=true;await page.route('**/data/countries/countries.json',r=>corrupt?r.fulfill({contentType:'application/json',body:'{}'}):r.fallback());
 await page.getByRole('button',{name:'Export',exact:true}).click();await page.getByLabel('Export scope',{exact:true}).selectOption('countries');
 await expect(page.getByRole('button',{name:'Retry boundaries',exact:true})).toBeVisible();await page.getByRole('button',{name:'GeoJSON',exact:true}).click();await expect(page.getByTestId('export-error')).toBeVisible();
 corrupt=false;await page.getByRole('button',{name:'Retry boundaries',exact:true}).click();await page.getByLabel('Countries',{exact:true}).selectOption('AA');await page.getByRole('button',{name:'Preview selection',exact:true}).click();
 await expect(page.getByTestId('country-preview')).toContainText('Included: 1');expect(JSON.parse((await download(page,'GeoJSON')).toString()).features).toHaveLength(1);
});
test('narrow keyboard selection paginates and Polish reopening clears prepared download',async({page})=>{
 await page.setViewportSize({width:390,height:844});await start(page,Array.from({length:105},()=>({})));
 await page.getByRole('button',{name:'Export',exact:true}).click();await page.getByLabel('Export scope',{exact:true}).focus();await page.keyboard.press('s');await page.keyboard.press('Enter');await page.keyboard.press('Tab');
 const countries=page.getByLabel('Countries',{exact:true});await expect(countries.locator('option')).toHaveCount(2);await countries.focus();await page.keyboard.press('Home');
 await page.getByRole('button',{name:'Preview selection',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByTestId('country-preview')).toContainText('Included: 105');
 await page.getByLabel('Preview group',{exact:true}).selectOption('kept');await expect(page.getByTestId('country-preview-row')).toHaveCount(100);await page.getByRole('button',{name:'Next preview page',exact:true}).click();await expect(page.getByTestId('country-preview-row')).toHaveCount(5);
 await page.getByRole('button',{name:'Prepare binary',exact:true}).click();await expect(page.getByRole('button',{name:'Download validated binary',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'PL',exact:true}).click();await page.getByRole('button',{name:'Eksportuj',exact:true}).click();
 await expect(page.getByRole('button',{name:'Pobierz zweryfikowany plik binarny',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Pełna kopia projektu — bez filtrowania krajów',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('border review blocks scoped export until explicit decision; full backup remains usable',async({page})=>{
 await start(page,[{}],[boxCountry('AA',-7,36,-6,38)]);await page.getByRole('button',{name:'Export',exact:true}).click();await select(page);
 await page.getByRole('button',{name:'GeoJSON',exact:true}).click();await expect(page.getByTestId('export-error')).toContainText('Review');
 await page.getByRole('button',{name:'Keep',exact:true}).click();await expect(page.getByTestId('country-preview')).toContainText('Unresolved: 0');
 expect(JSON.parse((await download(page,'GeoJSON')).toString()).features).toHaveLength(1);
});
test('linked outside endpoint needs acknowledgement; opaque links still block BIN only',async({page})=>{
 await start(page,[{typeRaw:964,linkTo:1},{typeRaw:9128,longitudeRaw:-654}]);await page.getByRole('button',{name:'Export',exact:true}).click();await select(page,['BB']);
 await expect(page.getByTestId('country-preview')).toContainText('Linked extras: 1');await page.getByLabel('I accept the listed outside-country or uncertain linked endpoints').check();
 expect(JSON.parse((await download(page,'GeoJSON')).toString()).features).toHaveLength(2);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await openFixture(page,[{typeRaw:964,linkRaw:123},{longitudeRaw:-654}]);await page.getByRole('button',{name:'Export',exact:true}).click();await select(page);
 await page.getByRole('button',{name:'Prepare binary',exact:true}).click();await expect(page.getByTestId('export-error')).toBeVisible();
 await expect(page.getByRole('button',{name:'Download validated binary',exact:true})).toBeDisabled();expect(JSON.parse((await download(page,'GeoJSON')).toString()).features).toHaveLength(1);
});
test('A to B to A previews retain only the latest scope and edit/undo clears downloads',async({page})=>{
 await start(page);await page.getByRole('button',{name:'Export',exact:true}).click();await select(page);
 const countries=page.getByLabel('Countries',{exact:true});
 await countries.selectOption('BB');await page.getByRole('button',{name:'Preview selection',exact:true}).click();await countries.selectOption('AA');await page.getByRole('button',{name:'Preview selection',exact:true}).click();
 await expect(page.getByTestId('country-preview')).toContainText('BIN country scope: AA');const geo=JSON.parse((await download(page,'GeoJSON')).toString());expect(geo.features[0].geometry.coordinates[0]).toBe(-7);
 await page.getByRole('button',{name:'Prepare binary',exact:true}).click();await expect(page.getByRole('button',{name:'Download validated binary',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByTestId('record-row').first().getByRole('button').click();await page.getByLabel('Latitude',{exact:true}).fill('37.1');await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37.1');await page.getByRole('button',{name:'Undo',exact:true}).click();
 await page.getByRole('button',{name:'Export',exact:true}).click();await expect(page.getByRole('button',{name:'Download validated binary',exact:true})).toBeDisabled();
});
test('both linked-section directions require the outside endpoint acknowledgement',async({page})=>{
 await start(page,[{typeRaw:964,linkTo:1},{typeRaw:9128,longitudeRaw:-654}]);await page.getByRole('button',{name:'Export',exact:true}).click();await select(page,['AA']);
 await expect(page.getByTestId('country-preview')).toContainText('Linked extras: 1');await page.getByLabel('I accept the listed outside-country or uncertain linked endpoints').check();
 expect(JSON.parse((await download(page,'GeoJSON')).toString()).features).toHaveLength(2);
});
test('late real-worker preview and build replies cannot revive cancelled or reopened downloads',async({page})=>{
 await page.addInitScript(()=>{
  const NativeWorker=window.Worker;window.heldReplies=[];window.holdKind=null;window.releaseReplies=()=>{window.holdKind=null;for(const deliver of window.heldReplies.splice(0))deliver();};
  window.Worker=class extends NativeWorker{
   kinds=new Map();postMessage(message,...rest){this.kinds.set(message.requestId,message.kind);super.postMessage(message,...rest);}
   set onmessage(handler){super.onmessage=event=>{const deliver=()=>handler(event);if(this.kinds.get(event.data.requestId)===window.holdKind)window.heldReplies.push(deliver);else deliver();};}
  };
 });
 await start(page);await page.getByRole('button',{name:'Export',exact:true}).click();await select(page);
 await page.evaluate(()=>{window.holdKind='country-preview';});await page.getByRole('button',{name:'Preview selection',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.heldReplies.length)).toBe(1);
 await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();await page.evaluate(()=>window.releaseReplies());
 await expect(page.getByRole('button',{name:'Preview selection',exact:true})).toBeEnabled();await page.getByRole('button',{name:'GeoJSON',exact:true}).click();await expect(page.getByTestId('export-error')).toContainText('Review');
 await page.getByRole('button',{name:'Preview selection',exact:true}).click();await expect(page.getByRole('button',{name:'Download selection report / notices',exact:true})).toBeEnabled();
 await page.evaluate(()=>{window.holdKind='country-export';});await page.getByRole('button',{name:'Prepare binary',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.heldReplies.length)).toBe(1);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'PL',exact:true}).click();await page.evaluate(()=>window.releaseReplies());await page.getByRole('button',{name:'Eksportuj',exact:true}).click();
 await expect(page.getByRole('button',{name:'Pobierz zweryfikowany plik binarny',exact:true})).toBeDisabled();
});
