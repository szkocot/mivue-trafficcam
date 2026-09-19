import { test,expect } from '@playwright/test';
import { official } from './helpers.js';
test('opt-in live browser official-source CORS and unchanged check',async({page},testInfo)=>{
 test.skip(process.env.MIVUE_LIVE_SOURCE!=='1','Enable MIVUE_LIVE_SOURCE=1 for live endpoint verification');test.setTimeout(60000);
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());let gets=0,heads=0;
 page.on('request',r=>{if(r.url()===official){if(r.method()==='GET')gets++;if(r.method()==='HEAD')heads++;}});
 await page.goto('/mivue-trafficcam/');await expect(page.getByTestId('source-status')).toHaveAttribute('data-state','ready',{timeout:40000});
 await expect(page.getByTestId('record-count')).not.toHaveText('0');await expect(page.getByTestId('save-status')).toHaveText('Saved locally');
 const metadata=await page.locator('#source-info').textContent();await page.reload();
 await expect(page.getByTestId('source-status')).toHaveAttribute('data-state','unchanged',{timeout:15000});
 expect(gets).toBe(1);expect(heads).toBe(1);
 await testInfo.attach('live-metadata',{body:metadata,contentType:'application/json'});console.log(`Live source metadata: ${metadata}; GET=${gets}, HEAD=${heads}`);
});
