import { test,expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { stubNetwork,openFixture } from './helpers.js';

async function fakeLocation(page,mode='pending') {
  await page.addInitScript(mode=>{
    window.locationRequests=[];
    const provider={getCurrentPosition(ok,fail,options){window.locationRequests.push({ok,fail,options});}};
    Object.defineProperty(navigator,'geolocation',{configurable:true,value:mode==='unsupported'?undefined:provider});
    if(mode==='insecure')Object.defineProperty(window,'isSecureContext',{value:false});
    window.resolveLocation=()=>window.locationRequests.at(-1).ok({coords:{latitude:52.2297,longitude:21.0122,accuracy:20,altitude:null,altitudeAccuracy:null,heading:null,speed:null},timestamp:1790000000000});
    window.storageWrites=0;const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args){window.storageWrites++;return put.apply(this,args);};
  },mode);
}
const locate=page=>page.getByRole('button',{name:'Locate me',exact:true});
const status=page=>page.getByTestId('location-status');
const marker=page=>page.locator('.location-marker');

test('opt-in location works without a database, displays accuracy, clears and never restores on reload',async({page,context})=>{
  await stubNetwork(page);await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:52.2297,longitude:21.0122,accuracy:20});
  await page.goto('/mivue-trafficcam/');
  await expect(page.getByTestId('location-privacy')).toContainText('tiles');
  await expect(marker(page)).toHaveCount(0);await locate(page).click();
  await expect(status(page)).toContainText('20 m');await expect(status(page)).toContainText('Fix time');
  await expect(marker(page)).toHaveCount(1);await expect(page.locator('.location-accuracy')).toHaveCount(1);
  // A centered marker is near the actual map centre, not merely drawn somewhere.
  const m=await marker(page).boundingBox(),b=await page.locator('#map').boundingBox();
  expect(Math.abs(m.x+m.width/2-b.x-b.width/2)).toBeLessThan(3);
  expect(Math.abs(m.y+m.height/2-b.y-b.height/2)).toBeLessThan(3);
  await page.getByRole('button',{name:'PL',exact:true}).click();
  await expect(page.getByRole('button',{name:'Moja lokalizacja',exact:true})).toBeVisible();
  await expect(status(page)).toContainText('Dokładność');
  await page.getByRole('button',{name:'Wyczyść lokalizację',exact:true}).click();await expect(marker(page)).toHaveCount(0);
  await page.getByRole('button',{name:'Moja lokalizacja',exact:true}).click();await expect(marker(page)).toHaveCount(1);
  await page.reload();await expect(page.getByRole('button',{name:'Moja lokalizacja',exact:true})).toBeVisible();
  await expect(marker(page)).toHaveCount(0);await expect(status(page)).not.toContainText('20 m');
});

test('no startup request; cancelled and superseded callbacks do not recenter or show a marker',async({page})=>{
  await stubNetwork(page);await fakeLocation(page);await page.goto('/mivue-trafficcam/');
  await expect(locate(page)).toBeVisible();expect(await page.evaluate(()=>locationRequests.length)).toBe(0);
  await locate(page).click();await expect(locate(page)).toBeDisabled();
  await page.getByRole('button',{name:'Cancel location request',exact:true}).click();
  await page.evaluate(()=>resolveLocation());await expect(marker(page)).toHaveCount(0);
  await locate(page).click();await page.evaluate(()=>locationRequests[0].fail({code:1}));
  await expect(status(page)).toContainText('Waiting');
  await page.evaluate(()=>resolveLocation());await expect(marker(page)).toHaveCount(1);
  expect(await page.evaluate(()=>locationRequests.length)).toBe(2);
});

for(const [code,message] of [[1,'permission'],[2,'unavailable'],[3,'timed out']]){
  test(`location error ${code} offers explicit retry and keeps a previous fix labelled`,async({page})=>{
    await stubNetwork(page);await fakeLocation(page);await page.goto('/mivue-trafficcam/');
    await locate(page).click();await page.evaluate(()=>resolveLocation());
    await locate(page).click();await page.evaluate(code=>locationRequests.at(-1).fail({code}),code);
    await expect(status(page)).toContainText(message);await expect(status(page)).toContainText('Previous fix');
    await expect(marker(page)).toHaveCount(1);await expect(locate(page)).toBeEnabled();
    expect(await page.evaluate(()=>locationRequests.length)).toBe(2);
    await page.getByRole('button',{name:'Clear location',exact:true}).click();await expect(marker(page)).toHaveCount(0);
  });
}
for(const [mode,message] of [['unsupported','not supported'],['insecure','HTTPS']]) {
  test(`${mode} location leaves map usable`,async({page})=>{
    await stubNetwork(page);await fakeLocation(page,mode);await page.goto('/mivue-trafficcam/');
    await locate(page).click();await expect(status(page)).toContainText(message);
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(marker(page)).toHaveCount(0);
  });
}

test('opening a file clears location and invalidates a pending fix',async({page})=>{
  await stubNetwork(page);await fakeLocation(page);await page.goto('/mivue-trafficcam/');
  await locate(page).click();await page.evaluate(()=>resolveLocation());await expect(marker(page)).toHaveCount(1);
  await locate(page).click();await openFixture(page);await expect(page.getByTestId('record-count')).toHaveText('1');
  await page.evaluate(()=>resolveLocation());await expect(marker(page)).toHaveCount(0);await expect(status(page)).not.toContainText('20 m');
});

test('location changes neither saved project nor exports and creates no application network request',async({page})=>{
  await stubNetwork(page);await fakeLocation(page);await page.goto('/mivue-trafficcam/');await openFixture(page);
  await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
  const saved=()=>page.evaluate(async()=>{const {openStorage}=await import('./web/storage.js');const s=await openStorage();const p=await s.getWorking();s.close();return p;});
  const before=await saved(),writes=await page.evaluate(()=>storageWrites),requests=[];
  page.on('request',r=>requests.push(r.url()));
  await locate(page).click();await page.evaluate(()=>resolveLocation());await expect(marker(page)).toHaveCount(1);
  await expect(page.locator('#changes')).toHaveText('0');await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled();
  expect(await saved()).toEqual(before);expect(await page.evaluate(()=>storageWrites)).toBe(writes);
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Save project',exact:true}).click();
  expect(await readFile(await (await downloaded).path(),'utf8')).toBe(before.projectJson);
  expect(requests.filter(url=>!url.startsWith('https://tile.openstreetmap.org/'))).toEqual([]);
  expect(page.url()).not.toContain('52.2297');
});

test('narrow layout and pagehide clear location without disturbing form drafts',async({page})=>{
  await stubNetwork(page);await fakeLocation(page);await page.setViewportSize({width:390,height:844});
  await page.goto('/mivue-trafficcam/');await openFixture(page);
  await page.getByRole('button',{name:'List',exact:true}).click();await page.getByTestId('record-row').first().getByRole('button').click();
  await page.getByLabel('Latitude',{exact:true}).fill('37.3');await page.getByRole('button',{name:'Map',exact:true}).click();
  await locate(page).click();await page.evaluate(()=>resolveLocation());await expect(marker(page)).toHaveCount(1);
  await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37.3');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  await expect(marker(page)).toHaveCount(0);await locate(page).click();await page.evaluate(()=>resolveLocation());await expect(marker(page)).toHaveCount(1);
});
