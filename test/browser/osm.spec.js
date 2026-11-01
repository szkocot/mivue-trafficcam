import {test,expect} from '@playwright/test';
import {stubNetwork,openFixture} from './helpers.js';

for(const language of ['EN','PL'])test(`local OSM ${language} import retains attribution, rejects unsupported relations and restores references`,async({page})=>{
 await stubNetwork(page);await page.goto('/mivue-trafficcam/');await openFixture(page);
 await page.getByRole('button',{name:language,exact:true}).click();
 await page.getByRole('button',{name:language==='EN'?'Import':'Importuj',exact:true}).click();
 const dialog=page.locator('.import-dialog');
 await dialog.getByLabel(language==='EN'?'Import format':'Format importu',{exact:true}).selectOption('osm');
 await expect(dialog.getByLabel(language==='EN'?'Source namespace':'Identyfikator źródła',{exact:true})).toHaveValue('openstreetmap');
 await expect(dialog.getByLabel(language==='EN'?'Attribution':'Autor / pochodzenie',{exact:true})).toBeDisabled();
 const file=dialog.locator('input[type=file]');
 const upload=elements=>file.setInputFiles({name:'osm.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({elements}))});
 await upload([{type:'relation',id:9,tags:{type:'enforcement',enforcement:'maxspeed'},members:[]}]);
 await expect(dialog.getByRole('alert')).toContainText(language==='EN'?'Unsupported enforcement geometry':'Nieobsługiwana geometria kontroli');
 await expect(page.getByTestId('reference-row')).toHaveCount(0);await expect(page.getByTestId('record-count')).toHaveText('1');
 await upload([{type:'node',id:123,lat:52,lon:21,tags:{highway:'speed_camera',maxspeed:'30 mph',direction:'90',name:'OSM fixture'}}]);
 await expect(dialog).not.toBeVisible();await expect(page.getByTestId('reference-row')).toHaveCount(1);
 await page.getByTestId('reference-row').getByRole('button').click();
 await expect(page.locator('#details')).toContainText('OSM fixture');await expect(page.locator('#details')).toContainText('30 mph');
 await expect(page.locator('#details')).toContainText('OpenStreetMap contributors');await expect(page.locator('#details')).toContainText('ODbL 1.0');
 await expect(page.getByTestId('save-status')).toHaveText(language==='EN'?'Saved locally':'Zapisano lokalnie');
 await page.reload();await expect(page.getByTestId('reference-row')).toHaveCount(1);
 await page.getByTestId('reference-row').getByRole('button').click();await expect(page.locator('#details')).toContainText('OpenStreetMap contributors');
 await expect(page.getByTestId('record-count')).toHaveText('1');
});

for(const language of ['EN','PL'])test(`local OSM ${language} explicit average-speed endpoints remain references after reload`,async({page})=>{
 await stubNetwork(page);await page.goto('/mivue-trafficcam/');await openFixture(page);
 await page.getByRole('button',{name:language,exact:true}).click();
 await page.getByRole('button',{name:language==='EN'?'Import':'Importuj',exact:true}).click();
 const dialog=page.locator('.import-dialog');
 await dialog.getByLabel(language==='EN'?'Import format':'Format importu',{exact:true}).selectOption('osm');
 const elements=[{type:'relation',id:8,tags:{type:'enforcement',enforcement:'average_speed',maxspeed:'50 mph',name:'Endpoint section'},members:[{type:'node',ref:10,role:'from'},{type:'node',ref:11,role:'to'}]},
 {type:'node',id:10,lat:52,lon:21},{type:'node',id:11,lat:53,lon:22}];
 await dialog.locator('input[type=file]').setInputFiles({name:'section.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({elements}))});
 await expect(dialog).not.toBeVisible();await expect(page.getByTestId('reference-row')).toHaveCount(1);
 await page.getByTestId('reference-row').getByRole('button').click();
 await expect(page.locator('#details')).toContainText('relation/8');await expect(page.locator('#details')).toContainText('50 mph');
 await expect(page.locator('#details')).toContainText('endpoints-not-road-route');
 await expect(page.getByTestId('record-count')).toHaveText('1');
 await expect(page.getByTestId('save-status')).toHaveText(language==='EN'?'Saved locally':'Zapisano lokalnie');
 await page.reload();await expect(page.getByTestId('reference-row')).toHaveCount(1);
 await page.getByTestId('reference-row').getByRole('button').click();await expect(page.locator('#details')).toContainText('relation/8');
});
