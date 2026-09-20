import {test,expect} from '@playwright/test';
import {makeFixture} from '../helpers/fixture.js';
async function setup(page){
 await page.route('https://**',r=>r.abort());await page.goto('/mivue-trafficcam/');await page.getByRole('button',{name:'EN',exact:true}).click();
 await page.getByLabel('Open file',{exact:true}).setInputFiles({name:'fixture.bin',mimeType:'application/octet-stream',buffer:Buffer.from(makeFixture([{}]).bytes)});
 await expect(page.getByTestId('record-count')).toHaveText('1');
}
async function importCsv(page,text){
 await page.getByRole('button',{name:'Import',exact:true}).click();
 await page.getByLabel('Source namespace',{exact:true}).fill('example');await page.getByLabel('Attribution',{exact:true}).fill('Example owner');
 await page.getByLabel('Import file',{exact:true}).setInputFiles({name:'cameras.csv',mimeType:'text/csv',buffer:Buffer.from(text)});
 await expect(page.getByTestId('import-summary')).toContainText('reference');
}
test('local import shows safe attributed metadata, translated independent preferences and restores references',async({page})=>{
 await setup(page);
 await importCsv(page,'id,latitude,longitude,kind,status,speed,speed_unit,name\na,52,19,camera,active,50,mph,<img src=x onerror=alert(1)>');
 await page.getByTestId('reference-row').getByRole('button').click();
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
