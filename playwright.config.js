import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./test/browser',timeout:30000,workers:2,
 use:{baseURL:'http://127.0.0.1:4173',locale:'en-GB',trace:'retain-on-failure'},
 webServer:{command:'npm run build:web && npm run preview:web -- --port 4173 --base /mivue-trafficcam/',url:'http://127.0.0.1:4173/mivue-trafficcam/',reuseExistingServer:false}});
