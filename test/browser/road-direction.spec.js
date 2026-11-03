import {test,expect} from '@playwright/test';
import {stubNetwork,makeFixture} from './helpers.js';
import {createProject,serializeProject} from '../../src/project.js';
import {reconcile} from '../../src/reconcile.js';
import {normalizeCanardLayers} from '../../src/canard-adapter.js';
import {enrichCanardBatch} from '../../src/canard-details.js';
import {createRoadResolver} from '../../src/road-directions.js';
import {applyRoadDirectionData,getRoadDirection} from '../../src/road-direction-data.js';
import {makeCanardLayers,review,retrievedAt} from '../helpers/canard-fixture.js';
import {makeCanardDetail,detailRow} from '../helpers/canard-detail-fixture.js';

async function projectFixture(stale=false){
 const layers=makeCanardLayers();layers.PP[0].lon=19;layers.PP[0].lat=52.01;
 let batch=normalizeCanardLayers(layers,{review,retrievedAt});batch.observations=batch.observations.filter(o=>o.kind==='camera');
 const detail=makeCanardDetail('PP',1,[detailRow('50',null,{kierunek:'w kierunku Warszawy'})]);detail.urzadzenie.lokalizacjaNrDrogi='94';
 batch=enrichCanardBatch(batch,{[batch.observations[0].sourceId]:{raw:detail,retrievedAt,sourceUrl:'https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen',responseSha256:'b'.repeat(64)}});
 const source={url:'https://example.org/synthetic-road-context.json',dataTimestamp:retrievedAt,sha256:'a'.repeat(64),attribution:'Synthetic OpenStreetMap road context',licenceUrl:'https://opendatacommons.org/licenses/odbl/1-0/',complete:true};
 const context={schemaVersion:1,source,ways:[{id:'way',nodeIds:[1,2,3],coordinates:[[19,52],[19,52.02],[20,52.02]],tags:{highway:'primary',ref:'94'}}],places:[{id:'city',coordinates:[20,52.02],tags:{place:'city',name:'Warszawa'}}]};
 const observation=batch.observations[0],resolution=createRoadResolver(context).resolve(observation);expect(resolution.status).toBe('resolved');
 batch=applyRoadDirectionData(batch,{schema:'mivue-canard-road-directions',version:1,source,resolutions:{[observation.sourceId]:resolution}});expect(getRoadDirection(batch.observations[0])).not.toBeNull();
 if(stale)batch.observations[0].originalProperties.canardDetail.raw.limity[0].typ.kierunek='w kierunku Poznania';
 const p=(await reconcile(await createProject(makeFixture([{}]).bytes),batch)).project;
 return serializeProject(p);
}
async function openProject(page,text){await page.getByLabel('Open file',{exact:true}).setInputFiles({name:'directions.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.getByTestId('reference-row')).toHaveCount(1);await page.getByTestId('reference-row').getByRole('button').click();}

test('annotated CANARD road evidence has a purple travel arrow, separate physical aim and persistent EN/PL metadata',async({page})=>{
 await stubNetwork(page);await page.goto('/mivue-trafficcam/');await page.getByRole('button',{name:'EN',exact:true}).click();await openProject(page,await projectFixture());
 const details=page.locator('#details'),canvas=page.locator('canvas.points');
 await expect(details).toContainText('Estimated vehicle travel bearing (CANARD + roads)');await expect(details).toContainText('0°');await expect(details).toContainText('Synthetic OpenStreetMap road context');await expect(details).toContainText('Road-derived estimate, not physical camera aim');await expect(details).toContainText('Unknown: CANARD does not supply a physical camera azimuth');
 await expect(canvas).toHaveAttribute('data-road-travel-bearings','[0]');await expect(canvas).toHaveAttribute('data-alert-heading','');await expect(page.locator('.legend')).toContainText('Purple arrows: estimated CANARD travel direction.');await expect(page.locator('#changes')).toHaveText('0');
 await expect(page.getByTestId('save-status')).toHaveText('Saved locally');await page.reload();await expect(page.getByTestId('reference-row')).toHaveCount(1);await page.getByTestId('reference-row').getByRole('button').click();await expect(canvas).toHaveAttribute('data-road-travel-bearings','[0]');
 await page.getByRole('button',{name:'PL',exact:true}).click();await expect(details).toContainText('Szacowany kierunek jazdy (CANARD + drogi)');await expect(details).toContainText('Synthetic OpenStreetMap road context');await expect(canvas).toHaveAttribute('data-road-travel-bearings','[0]');
 const project=await page.evaluate(async()=>{const {openStorage}=await import('./web/storage.js');const storage=await openStorage();const value=await storage.getWorking();storage.close();return JSON.parse(value.projectJson);});expect(project.records.every(r=>Object.keys(r.edits).length===0)).toBe(true);expect(project.ingestion.observations[0].originalProperties.canardRoadDirection.physicalAim).toBeNull();
});

test('changed source direction labels invalidate saved road evidence and suppress the travel arrow',async({page})=>{
 await stubNetwork(page);await page.goto('/mivue-trafficcam/');await page.getByRole('button',{name:'EN',exact:true}).click();await openProject(page,await projectFixture(true));
 await expect(page.locator('#details')).toContainText('w kierunku Poznania');await expect(page.locator('#details').getByText('Estimated vehicle travel bearing (CANARD + roads)',{exact:true})).toHaveCount(0);await expect(page.locator('canvas.points')).toHaveAttribute('data-road-travel-bearings','[]');await expect(page.locator('#changes')).toHaveText('0');
 await page.getByRole('button',{name:'PL',exact:true}).click();await expect(page.locator('canvas.points')).toHaveAttribute('data-road-travel-bearings','[]');
});
