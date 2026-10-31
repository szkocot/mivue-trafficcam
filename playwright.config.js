import { defineConfig } from '@playwright/test';
const port=Number(process.env.MIVUE_BROWSER_PORT??4173);
export default defineConfig({testDir:'./test/browser',timeout:30000,workers:2,
 projects:['chromium','firefox','webkit'].map(name=>({name,use:{browserName:name}})),
 use:{baseURL:`http://127.0.0.1:${port}`,locale:'en-GB',trace:'retain-on-failure'},
 webServer:{command:`npm run build:web && npm run preview:web -- --port ${port} --base /mivue-trafficcam/`,url:`http://127.0.0.1:${port}/mivue-trafficcam/`,reuseExistingServer:false}});
