import { makeFixture } from '../helpers/fixture.js';
export { makeFixture };
export const official='https://dl-mio.akamaized.net/dvr/MiVue8xx/Speedcam_Data_FEU.bin';
export async function stubNetwork(page){
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route(official,r=>r.abort());
}
export async function openFixture(page,records=[{}]){
 await page.getByLabel('Open file',{exact:true}).setInputFiles({name:'fixture.bin',mimeType:'application/octet-stream',buffer:Buffer.from(makeFixture(records).bytes)});
}
