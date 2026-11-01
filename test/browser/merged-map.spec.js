import {test,expect} from '@playwright/test';
import {openFixture,stubNetwork} from './helpers.js';

test('only explicit source bindings turn BIN points blue, including mixed clusters and undo/reload',async({page})=>{
 await page.addInitScript(()=>{
  const proto=CanvasRenderingContext2D.prototype;
  for(const name of ['scale','arc','fill','stroke']){const original=proto[name];proto[name]=function(...args){
   if(this.canvas.classList.contains('points')){
    if(name==='scale')this.canvas.drawn=[];
    if(name==='arc')this.canvas.lastArc={x:args[0],y:args[1],radius:args[2]};
    if(name==='fill'||name==='stroke')this.canvas.drawn.push({...this.canvas.lastArc,operation:name,color:name==='fill'?this.fillStyle:this.strokeStyle});
   }return original.apply(this,args);
  };}
 });
 await stubNetwork(page);await page.goto('/mivue-trafficcam/');await page.getByRole('button',{name:'EN',exact:true}).click();
 await openFixture(page,[{},{}]);await expect(page.getByTestId('record-count')).toHaveText('2');
 const id=await page.getByTestId('record-row').first().getByRole('button').textContent();
 const colors=()=>page.locator('canvas.points').evaluate(c=>(c.drawn??[]).filter(x=>x.operation==='fill').map(x=>x.color));
 await page.getByRole('button',{name:'Import',exact:true}).click();
 await page.getByLabel('Source namespace',{exact:true}).fill('color-test');await page.getByLabel('Attribution',{exact:true}).fill('Color test');
 await page.getByLabel('Import file',{exact:true}).setInputFiles({name:'color.csv',mimeType:'text/csv',buffer:Buffer.from('id,latitude,longitude,kind\na,37,-7,camera')});
 await expect(page.locator('.import-dialog')).not.toBeVisible();await expect(page.getByTestId('reference-row')).toHaveCount(1);
 await page.getByRole('button',{name:'Fit all records',exact:true}).click();
 await expect.poll(colors).toContain('#087f77');await expect.poll(colors).toContain('#7351a2');expect(await colors()).not.toContain('#365b9b');
 await page.getByTestId('reference-row').getByRole('button').click();await page.getByLabel('Existing record ID',{exact:true}).fill(id);
 await page.getByRole('button',{name:'Associate with record',exact:true}).click();await expect(page.getByTestId('reference-row')).toHaveCount(0);
 await expect.poll(colors).toContain('#365b9b');await expect.poll(colors).toContain('#087f77');
 await expect(page.locator('.legend')).toContainText('Merged with source (blue): 1');
 await page.getByTestId('record-row').first().getByRole('button').click();
 await expect.poll(()=>page.locator('canvas.points').evaluate(c=>(c.drawn??[]).some(x=>x.operation==='stroke'&&x.color==='#e59a13'))).toBe(true);
 await expect.poll(colors).toContain('#365b9b');
 const positions=await page.locator('canvas.points').evaluate(c=>c.drawn.filter(x=>x.operation==='fill'&&['#087f77','#365b9b'].includes(x.color)).map(x=>[x.x,x.y]));expect(positions).toHaveLength(2);expect(positions[0]).not.toEqual(positions[1]);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByTestId('reference-row')).toHaveCount(1);await expect.poll(async()=>!(await colors()).includes('#365b9b')).toBe(true);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await expect(page.getByTestId('reference-row')).toHaveCount(0);await expect.poll(colors).toContain('#365b9b');
 await expect(page.getByTestId('save-status')).toHaveText('Saved locally');await page.reload();await expect(page.getByTestId('record-count')).toHaveText('2');await page.getByRole('button',{name:'Fit all records',exact:true}).click();await expect.poll(colors).toContain('#365b9b');
 await page.getByRole('button',{name:'PL',exact:true}).click();await expect(page.locator('.legend')).toContainText('Powiązane ze źródłem (niebieskie): 1');
 const stored=await page.evaluate(async()=>{const{openStorage}=await import('./web/storage.js');const s=await openStorage();const value=await s.getWorking();s.close();return JSON.parse(value.projectJson);});
 expect(stored.records.every(r=>Object.keys(r.edits).length===0)).toBe(true);expect(stored.ingestion.bindings).toHaveLength(1);
 await expect(page.locator('canvas.points')).toHaveCount(1);await expect(page.locator('.leaflet-marker-icon')).toHaveCount(0);
});
