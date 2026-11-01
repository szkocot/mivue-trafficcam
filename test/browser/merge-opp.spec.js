import{test,expect}from'@playwright/test';import{openFixture,stubNetwork}from'./helpers.js';
test('points and complete OPPs merge together, show kierunek and blue endpoints/connectors, and undo/reload safely',async({page})=>{
 await page.addInitScript(()=>{const p=CanvasRenderingContext2D.prototype,stroke=p.stroke;p.stroke=function(...args){if(this.canvas.classList.contains('points')&&this.strokeStyle==='#365b9b')this.canvas.blueConnector=true;return stroke.apply(this,args);};});
 await stubNetwork(page);await page.goto('/mivue-trafficcam/');await page.getByRole('button',{name:'EN',exact:true}).click();
 await openFixture(page,[{},{},{typeRaw:964,latitudeRaw:3800,longitudeRaw:-600,linkTo:3},{typeRaw:9128,latitudeRaw:3806,longitudeRaw:-600}]);
 await page.getByRole('button',{name:'Import',exact:true}).click();await page.getByLabel('Source namespace',{exact:true}).fill('merge-ui');await page.getByLabel('Attribution',{exact:true}).fill('Synthetic source');await page.getByLabel('Import format',{exact:true}).selectOption('geojson');
 const features=[{type:'Feature',id:'camera-group',geometry:{type:'Point',coordinates:[-7,37]},properties:{kind:'camera'}},{type:'Feature',id:'opp-section',geometry:{type:'LineString',coordinates:[[-6,38],[-6,38.1]]},properties:{kind:'section',canardDetail:{raw:{limity:[{typ:{kierunek:'w stronę Warszawy'}}],urzadzenie:{nazwaKierunku1:'Warszawa',nazwaKierunku2:'Kraków'}}}}}];
 await page.getByLabel('Import file',{exact:true}).setInputFiles({name:'merge.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify({type:'FeatureCollection',features}))});await expect(page.getByTestId('reference-row')).toHaveCount(2);
 await page.getByRole('button',{name:'Merge matching observations',exact:true}).click();const dialog=page.locator('.merge-dialog');await expect(dialog).toBeVisible();
 const point=dialog.getByTestId('merge-row').filter({hasText:'camera-group'}),opp=dialog.getByTestId('merge-row').filter({hasText:'opp-section'});
 await expect(point.getByRole('checkbox')).toHaveCount(2);await expect(opp.getByRole('checkbox')).toHaveCount(1);await expect(opp.getByRole('checkbox')).toBeChecked();
 await expect(opp).toContainText('w stronę Warszawy / Warszawa / Kraków');
 for(const b of await point.getByRole('checkbox').all())await b.check();await expect(dialog.getByTestId('apply-merges')).toContainText('(2)');await dialog.getByTestId('apply-merges').click();await expect(dialog).not.toBeVisible();await expect(page.getByTestId('reference-row')).toHaveCount(0);
 await page.getByRole('button',{name:'Fit all records',exact:true}).click();await expect(page.locator('.legend')).toContainText('Merged with source (blue): 4');await expect.poll(()=>page.locator('canvas.points').evaluate(c=>c.blueConnector===true)).toBe(true);
 await page.getByTestId('record-row').nth(2).getByRole('button').click();await expect(page.locator('#details')).toContainText('w stronę Warszawy / Warszawa / Kraków');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByTestId('reference-row')).toHaveCount(2);await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(page.getByTestId('reference-row')).toHaveCount(0);
 await expect(page.getByTestId('save-status')).toHaveText('Saved locally');await page.reload();await expect(page.getByTestId('record-count')).toHaveText('4');await page.getByRole('button',{name:'Fit all records',exact:true}).click();await expect(page.locator('.legend')).toContainText('Merged with source (blue): 4');
 const project=await page.evaluate(async()=>{const{openStorage}=await import('./web/storage.js');const s=await openStorage();const v=await s.getWorking();s.close();return JSON.parse(v.projectJson);});expect(project.ingestion.bindings.map(b=>b.recordIds.length)).toEqual([2,2]);expect(project.records.every(r=>Object.keys(r.edits).length===0)).toBe(true);
 await page.getByRole('button',{name:'PL',exact:true}).click();await page.getByRole('button',{name:'Połącz pasujące obserwacje',exact:true}).click();await expect(dialog).toContainText('już powiązane: 2');await expect(dialog).toContainText('w stronę Warszawy');await expect(dialog.getByTestId('apply-merges')).toBeDisabled();
});
test('review retains an entire existing OPP binding when another candidate shares only its target',async({page})=>{
 await stubNetwork(page);await page.goto('/mivue-trafficcam/');
 await page.evaluate(async()=>{
  const{createMergeDialog}=await import('./web/merge-dialog.js');const row={id:'section-ref',namespace:'test',sourceId:'existing-opp',kind:'section',geometry:{type:'LineString',coordinates:[[19,52],[20,53]]},direction:null,sourceSpeedKmh:null,boundRecordIds:['a','b'],candidates:[{recordIds:['c','b'],records:[],endpointMetres:[0,0]}],status:'bound',bulkSafe:false};
  const dialog=createMergeDialog({client:{request:async()=>({rows:[row],summary:{total:1,unique:0,ambiguous:0,unmatched:0,bound:1}})},getIdentity:()=>({sessionId:'test',revision:1}),getReferences:()=>[],onBusy:()=>{},t:(key,p={})=>key==='mergeApply'?`Apply merges (${p.count})`:key,onApply:r=>{window.merged=r;}});await dialog.open();
 });
 const dialog=page.locator('.merge-dialog[open]');await expect(dialog.getByTestId('apply-merges')).toBeDisabled();const existing=dialog.getByLabel('a + b · mergeExisting',{exact:true});await expect(existing).toBeChecked();
 await existing.uncheck();await dialog.getByLabel('c + b · 0.0 m / 0.0 m',{exact:true}).check();await dialog.getByTestId('apply-merges').click();expect(await page.evaluate(()=>window.merged)).toEqual([{namespace:'test',sourceId:'existing-opp',action:'bind',recordIds:['c','b']}]);
});
