import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBinSpeed, decodeBinType, binSpeedLabel, binTypeLabel, BIN_METADATA_SCOPE } from '../src/bin-metadata.js';
import { createI18n } from '../web/i18n.js';

test('all 256 raw speed values follow the reviewed finite announcement whitelist',()=>{
 const known=[10,15,20,25,30,32,35,40,48,50,60,64,70,80,90,97,100,110,113,120,130,140];
 for(let raw=0;raw<256;raw++) assert.deepEqual(decodeBinSpeed(raw),{raw,status:raw===0?'unspecified':known.includes(raw)?'known':'unclassified',speedKmh:known.includes(raw)?raw:null});
 assert.match(BIN_METADATA_SCOPE,/955W.*VF538/);
});
test('types map whole raw codes and retain distinct endpoint codes without roles',()=>{
 for(const [raw,kind] of [[1,'camera'],[3,'red-light'],[5,'mobile'],[964,'linked-section'],[9128,'linked-section'],[0,'unclassified'],[2,'unclassified'],[4,'unclassified'],[4294967295,'unclassified']])assert.deepEqual(decodeBinType(raw),{raw,kind});
});
test('PL/EN labels retain raw values and separate unspecified from unclassified speed',()=>{
 const i=createI18n({languages:['en'],storage:null});
 for(const language of ['en','pl']){
  i.setLanguage(language);const t=i.t;
  assert.equal(binSpeedLabel(50,t),'50 km/h · BIN 50');
  assert.match(binSpeedLabel(0,t),language==='en'?/Not specified.*BIN 0/:/Nie podano.*BIN 0/);
  for(const raw of [5,139,255])assert.match(binSpeedLabel(raw,t),new RegExp(`BIN ${raw}$`));
  assert.match(binTypeLabel(3,t),language==='en'?/Red-light.*BIN 3/:/Czerwone światło.*BIN 3/);
  assert.match(binTypeLabel(5,t),language==='en'?/Mobile.*BIN 5/:/Mobilna.*BIN 5/);
  assert.match(binTypeLabel(964,t),/BIN 964$/);assert.match(binTypeLabel(9128,t),/BIN 9128$/);
 }
});

for(const [name,path,expected] of [
 ['official',new URL('../Speedcam_Data_FEU.bin',import.meta.url),{known:49977,unspecified:3361,unclassified:0}],
 ['firmware',process.env.MIVUE_FIRMWARE_DATABASE,{known:48721,unspecified:3067,unclassified:2}],
])test(`private ${name} file retains all bytes while classifying researched counts`,async t=>{
 if(!path)return t.skip('Private firmware path not configured');
 const {readFile}=await import('node:fs/promises');let bytes;
 try{bytes=await readFile(path);}catch(e){if(e.code==='ENOENT')return t.skip('Private sample absent');throw e;}
 const {parseDatabase}=await import('../src/parser.js'),{reconstructDatabase}=await import('../src/encoder.js');
 const {createHash}=await import('node:crypto');
 const hash=createHash('sha256').update(bytes).digest('hex');
 if(name==='official'&&hash==='2f01485c4d9910c9b9dce7fdc9355c3f8293e396d687526873c8537a4e0317f0')return t.skip('Historical July sample; counts above pin the September official download');
 assert.equal(hash,name==='official'?'69759a67d9442bfa1a636c38ccbc16623a2208ef34564e11f68ad0d696becdb1':'8f6930c3bbf7be5c9d51e8fadad93e300b6eea8b6b9f1c9dff4d046accaa13ca');
 const parsed=parseDatabase(bytes),before=structuredClone(parsed),counts={known:0,unspecified:0,unclassified:0},unknown=[];
 for(const record of parsed.records){const speed=decodeBinSpeed(record.rawBytes16To19[0]);counts[speed.status]++;if(speed.status==='unclassified')unknown.push(speed.raw);decodeBinType(record.typeRaw);}
 assert.deepEqual(counts,expected);assert.deepEqual(unknown,name==='firmware'?[139,139]:[]);
 assert.deepEqual(parsed,before);assert.deepEqual(Buffer.from(reconstructDatabase(parsed)),bytes);
});
