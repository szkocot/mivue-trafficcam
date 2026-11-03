import {test,expect} from '@playwright/test';
import {stubNetwork} from './helpers.js';
for(const language of ['en','pl'])test(`direction review selects only recommended IDs and permits explicit overrides (${language})`,async({page})=>{
 await stubNetwork(page);await page.goto('/mivue-trafficcam/');
 await page.evaluate(async language=>{
  const {createMergeDialog}=await import('./web/merge-dialog.js'),{createI18n}=await import('./web/i18n.js');const i18n=createI18n({languages:[language],storage:null});
  const candidate=(id,status,bearing)=>({recordIds:[id],metres:1,records:[],directionComparison:{status,mioBearingDegrees:bearing,travelBearings:[90],excludedBearings:[270],deltaDegrees:status==='agree'?0:180,confidence:'high',basis:'road-derived'}});
  const row={id:'direction-row',namespace:'test',sourceId:'direction-observation',kind:'camera',direction:null,sourceSpeedKmh:50,boundRecordIds:[],recommendedRecordIds:['agree'],candidates:[candidate('opposite','opposite',270),candidate('agree','agree',90),candidate('excluded','excluded',270)],status:'unique',bulkSafe:true};
  const ui=createMergeDialog({client:{request:async()=>({rows:[row],summary:{total:1,unique:1,ambiguous:0,unmatched:0,bound:0}})},getIdentity:()=>({sessionId:'test',revision:1}),getReferences:()=>[],onBusy:()=>{},t:i18n.t,onApply:r=>{window.directionMerges=r;}});await ui.open();
 },language);
 const dialog=page.locator('.merge-dialog[open]'),candidates=dialog.getByTestId('merge-candidate'),agree=candidates.filter({hasText:/^agree/}),opposite=candidates.filter({hasText:/^opposite/}),excluded=candidates.filter({hasText:/^excluded/});
 await expect(agree.getByRole('checkbox')).toBeChecked();await expect(opposite.getByRole('checkbox')).not.toBeChecked();await expect(excluded.getByRole('checkbox')).not.toBeChecked();
 await expect(agree).toContainText(language==='pl'?'Zgodny z niezależnie ustalonym kierunkiem drogi':'Agrees with the independently resolved road direction');
 await expect(opposite).toContainText(language==='pl'?'Przeciwny':'Opposite');await expect(excluded).toContainText(language==='pl'?'Wykluczony':'Excluded');await expect(agree).toContainText('90°');await expect(agree).toContainText('0°');
 await dialog.getByRole('button',{name:language==='pl'?'Zaznacz jednoznaczne dopasowania':'Select unique matches',exact:true}).click();await expect(agree.getByRole('checkbox')).toBeChecked();await expect(opposite.getByRole('checkbox')).not.toBeChecked();await expect(excluded.getByRole('checkbox')).not.toBeChecked();
 await opposite.getByRole('checkbox').check();await dialog.getByTestId('apply-merges').click();expect(await page.evaluate(()=>window.directionMerges)).toEqual([{namespace:'test',sourceId:'direction-observation',action:'bind',recordIds:['opposite','agree']}]);
});
