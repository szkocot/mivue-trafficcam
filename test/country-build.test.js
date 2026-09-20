import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildWeb} from '../scripts/build-web.mjs';
import {boxCountry,packCountryData} from './helpers/country-fixture.js';
test('build validates boundary bundle before changing output and rejects symlinks',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'mivue-country-build-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const e=await packCountryData([boxCountry('AA',0,0,1,1)]),countriesDir=join(dir,'source');
 const {mkdir}=await import('node:fs/promises');await mkdir(countriesDir);
 for(const [p,b]of [['manifest.json',JSON.stringify(e.manifest)],['countries.json',e.bytes],['NOTICE.json',e.noticeBytes]])await writeFile(join(countriesDir,p),b);
 const outputDir=join(dir,'output');await buildWeb({outputDir,countriesDir});
 assert.deepEqual(await readFile(join(outputDir,'data/countries/countries.json')),Buffer.from(e.bytes));
 await writeFile(join(countriesDir,'countries.json'),'broken');await assert.rejects(buildWeb({outputDir,countriesDir}));
 assert.deepEqual(await readFile(join(outputDir,'data/countries/countries.json')),Buffer.from(e.bytes));
 await rm(join(countriesDir,'countries.json'));await symlink(join(outputDir,'data/countries/countries.json'),join(countriesDir,'countries.json'));
 await assert.rejects(buildWeb({outputDir,countriesDir}));
});
