import {test,expect} from '@playwright/test';
import {compareCanardMio} from '../../src/source-comparison.js';
import {comparisonHtml} from '../../scripts/verification/report.js';
import {boxCountry} from '../helpers/country-fixture.js';
test('offline audit report safely shows both datasets and links map evidence to review rows',async({page})=>{
 const unsafe='<img src=x onerror="window.hacked=true"><script>window.hacked=true</script>';
 const report=compareCanardMio({database:{records:[{offset:1,latitude:52,longitude:21,typeRaw:1,linkRaw:0,rawBytes16To19:[50,0,0,1]},{offset:2,latitude:51.5,longitude:21.5,typeRaw:3,linkRaw:0,rawBytes16To19:[0,0,0,1]}]},
  batch:{observations:[{sourceId:unsafe,kind:'camera',geometry:{type:'Point',coordinates:[21,52]},speedKmh:null,originalSpeed:null,originalProperties:{sourceCategory:'PP'}}]},
  classifier:{classify:()=>({status:'assigned',countryIds:['PL']})},countryId:'PL'});
 report.inputs={test:true};report.importVerification={passed:true};report.sourceNotices=[{attribution:unsafe}];report.boundaryNotice={attribution:'Synthetic test boundaries'};
 await page.setContent(comparisonHtml(report,boxCountry('PL',20,51,22,53)));
 await expect(page.locator('script,img')).toHaveCount(0);expect(await page.evaluate(()=>window.hacked)).toBeUndefined();
 await expect(page.locator('#observation-0')).toContainText(unsafe);await expect(page.locator('#observation-0')).toContainText('50');
 await expect(page.locator('svg .mio-candidate')).toHaveCount(1);
 await page.locator('svg a.spatial-candidate').first().click();await expect(page.locator('#observation-0')).toBeInViewport();
 await page.locator('svg a[href="#mio-only-0"]').click();await expect(page.locator('#mio-only-0')).toBeInViewport();await expect(page.locator('#mio-only-0')).toContainText('source:2');
});
