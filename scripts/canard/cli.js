import {readFile,writeFile,appendFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {readDataset,writeDataset,fail} from './files.js';
import {createGitAdapter,publishPrepared} from './publish.js';
import {prepareUpdate} from './update.js';
import {fetchCanardPage} from './access.js';
import {inspectCanard} from './prepare.js';
const [command,...args]=process.argv.slice(2);
const output=async(key,value)=>{if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`${key}=${value??''}\n`);else console.log(`${key}=${value??''}`);};
const review=JSON.parse(await readFile(new URL('../../config/canard-review.json',import.meta.url)));
if(command==='resolve'&&!args.length){
 const git=createGitAdapter();const main=await git.head('refs/heads/main');if(!main)fail('CANARD_INVALID_REF');
 await output('main_sha',main);await output('data_sha',await git.head());
}else if(['prepare','candidate'].includes(command)&&args.length===3){
 const [destination,previousDir,cacheFile]=args,previous=previousDir==='-'?null:await readDataset(previousDir);
 let previousAccess=null;try{previousAccess=JSON.parse(await readFile(cacheFile));}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
 let access,prepared;
 if(command==='candidate'){access=await fetchCanardPage({previous:previousAccess});prepared=await inspectCanard({access,review,previous});}
 else{
  if(process.env.CANARD_PUBLICATION_ENABLED!=='true')fail('CANARD_PUBLICATION_DISABLED');
  ({access,prepared}=await prepareUpdate({review,previous,previousAccess}));
 }
 await writeDataset(destination,prepared);await mkdir(dirname(cacheFile),{recursive:true});await writeFile(cacheFile,JSON.stringify(access),{mode:0o600});
 console.log(`Candidate ${prepared.manifest.sha256}; ${prepared.manifest.total} observations. Not published.`);
}else if(command==='withdraw'&&args.length===1){
 await writeDataset(args[0],{manifest:{schemaVersion:1,state:'disabled',checkedAt:new Date().toISOString(),reasonCode:'RIGHTS_REVIEW',messagePl:'Źródło wycofane do czasu ponownej weryfikacji praw.',messageEn:'Source withdrawn pending renewed rights review.'}});
}else if(command==='publish'&&args.length===2){
 const prepared=await readDataset(args[0]);
 if(prepared.manifest.state==='active'&&process.env.CANARD_PUBLICATION_ENABLED!=='true')fail('CANARD_PUBLICATION_DISABLED');
 await output('data_sha',await publishPrepared({prepared,expectedParent:args[1]==='-'?null:args[1],git:createGitAdapter(),review}));
}else fail('Usage: cli.js resolve | candidate/prepare OUTPUT PREVIOUS_OR_DASH CACHE_FILE | withdraw OUTPUT | publish INPUT EXPECTED_PARENT_OR_DASH');
