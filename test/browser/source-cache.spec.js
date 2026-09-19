import { test,expect } from '@playwright/test';
import { official,makeFixture,openFixture,stubNetwork } from './helpers.js';
test('startup GET once, unchanged HEAD, edited project survives new source and offline reload',async({page})=>{
 await stubNetwork(page);let version=1,downloads=0,offline=false,bad=false;
 await page.route(official,async route=>{
  expect(route.request().postData()).toBeNull();if(offline)return route.abort();
  const bytes=makeFixture(version===1?[{}]:[{},{}]).bytes;
  const headers={'Access-Control-Allow-Origin':'*','Last-Modified':version===1?'Thu, 16 Jul 2026 07:39:32 GMT':'Fri, 17 Jul 2026 07:39:32 GMT','Content-Length':String(bytes.length)};
  if(route.request().method()==='HEAD')return route.fulfill({status:200,headers});
  downloads++;await route.fulfill({status:200,headers,body:bad?Buffer.from('bad'):Buffer.from(bytes)});
 });
 await page.goto('/mivue-trafficcam/');await expect(page.getByTestId('record-count')).toHaveText('1');expect(downloads).toBe(1);
 await expect(page.getByTestId('save-status')).toHaveText('Saved locally');await page.reload();
 await expect(page.getByTestId('source-status')).toHaveAttribute('data-state','unchanged');expect(downloads).toBe(1);
 await page.getByTestId('record-row').first().getByRole('button').click();await page.getByLabel('Latitude',{exact:true}).fill('37.1');await page.getByRole('button',{name:'Apply',exact:true}).click();
 version=2;bad=true;await page.getByRole('button',{name:'Check for updates',exact:true}).click();await expect(page.getByTestId('source-status')).toHaveAttribute('data-state','check-unavailable');
 bad=false;await page.getByRole('button',{name:'Check for updates',exact:true}).click();await expect(page.getByTestId('source-status')).toHaveAttribute('data-state','ready');
 await expect(page.getByTestId('record-count')).toHaveText('1');await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37.1');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Discard changes',exact:true}).click();await expect(page.getByLabel('Latitude',{exact:true})).toHaveValue('37');
 await expect(page.getByTestId('save-status')).toHaveText('Saved locally');offline=true;await page.reload();await expect(page.getByTestId('record-count')).toHaveText('1');
 await expect(page.getByTestId('source-status')).toHaveAttribute('data-state','check-unavailable');
});
test('late startup download does not replace a manually opened file; cancelling retains working data',async({page})=>{
 await stubNetwork(page);let release,arrived;const requested=new Promise(r=>{arrived=r;});
 await page.route(official,async route=>{arrived();await new Promise(r=>{release=r;});await route.fulfill({body:Buffer.from(makeFixture([{},{}]).bytes),headers:{'Access-Control-Allow-Origin':'*'}}).catch(()=>{});});
 await page.goto('/mivue-trafficcam/');await requested;await openFixture(page);await expect(page.getByTestId('record-count')).toHaveText('1');
 release();await expect(page.getByTestId('source-status')).toHaveAttribute('data-state','ready');await expect(page.getByTestId('record-count')).toHaveText('1');
 await page.getByRole('button',{name:'Check for updates',exact:true}).click();await expect(page.getByTestId('source-status')).toHaveAttribute('data-state','checking');
 await page.locator('#source-cancel').click();release();await expect(page.getByTestId('source-status')).toHaveAttribute('data-state','cancelled');await expect(page.getByTestId('record-count')).toHaveText('1');
});
test('nonexposed ETag without usable dates cannot claim unchanged',async({page})=>{
 await stubNetwork(page);let gets=0;
 await page.route(official,r=>{if(r.request().method()!=='HEAD')gets++;return r.fulfill({body:r.request().method()==='HEAD'?'':Buffer.from(makeFixture([{}]).bytes),headers:{'Access-Control-Allow-Origin':'*',ETag:'not-exposed'}});});
 await page.goto('/mivue-trafficcam/');await expect(page.getByTestId('record-count')).toHaveText('1');await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
 await page.reload();await expect(page.getByTestId('source-status')).toHaveAttribute('data-state','check-unavailable');expect(gets).toBe(1);
});
test('manual file wins while startup worker is still decoding official data',async({page})=>{
 await stubNetwork(page);
 await page.addInitScript(()=>{
  const post=Worker.prototype.postMessage;
  Worker.prototype.postMessage=function(message,...rest){
   if(message.kind==='open-bin'&&message.payload.name==='Speedcam_Data_FEU.bin'){
    window.startupWaiting=true;window.releaseStartup=()=>post.call(this,message,...rest);return;
   }return post.call(this,message,...rest);
  };
 });
 await page.route(official,r=>r.fulfill({body:Buffer.from(makeFixture([{},{}]).bytes),headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.goto('/mivue-trafficcam/');await expect.poll(()=>page.evaluate(()=>window.startupWaiting)).toBe(true);
 await openFixture(page);await expect(page.getByTestId('record-count')).toHaveText('1');
});
