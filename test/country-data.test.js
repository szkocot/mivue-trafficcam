import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCountryData,normalizeCountries} from '../src/country-data.js';
import {boxCountry,packCountryData} from './helpers/country-fixture.js';
import {prepareCountries} from '../scripts/countries/prepare.mjs';
import {countryHash} from '../src/country-data.js';
const validate=e=>validateCountryData(e.bytes,e.manifest,e.noticeBytes);
test('valid boundary bundle retains polygon holes and source notices',async()=>{
 const c=boxCountry('AA',0,0,2,2);c.geometry.coordinates.push([[.5,.5],[1,.5],[1,1],[.5,.5]]);
 const result=await validate(await packCountryData([c]));assert.deepEqual(result.dataset.countries,[c]);assert.equal(result.notice.licence,'Public domain');
});
test('rejects corrupted bodies, notices and false counts',async()=>{
 const e=await packCountryData([boxCountry('AA',0,0,1,1)]),bad=e.bytes.slice();bad[0]^=1;
 await assert.rejects(validate({...e,bytes:bad}),{code:'COUNTRY_DATA_HASH'});
 await assert.rejects(validate({...e,noticeBytes:new Uint8Array([1])}),{code:'COUNTRY_DATA_HASH'});
 for(const patch of [{featureCount:2},{positionCount:1},{path:'../private'},{sourceUrl:'javascript:alert(1)'},{sha256:'bad'},{extra:true}])await assert.rejects(validate({...e,manifest:{...e.manifest,...patch}}));
});
test('rejects duplicate IDs, sentinel ISO and malformed geometry',async()=>{
 const c=boxCountry('AA',0,0,1,1);await assert.rejects(validate(await packCountryData([c,c])),{code:'COUNTRY_DATA_INVALID'});
 for(const alter of [x=>x.iso2='-99',x=>x.geometry.coordinates[0].pop(),x=>x.geometry.coordinates[0][0]=[181,0],x=>x.geometry.coordinates[0][0]=[null,0],x=>x.geometry.coordinates[0][0]=[0,0,3],x=>x.geometry.extra=true,x=>x.names.en='',x=>x.names.extra='bad']){
  const d=structuredClone(c);alter(d);await assert.rejects(validate(await packCountryData([d])),{code:'COUNTRY_DATA_INVALID'});
 }
 const sameIso={...structuredClone(c),id:'other'};await assert.rejects(validate(await packCountryData([c,sameIso])));
});
test('resource limits are checked before parsing excessive bodies or nested coordinates',async()=>{
 const e=await packCountryData([boxCountry('AA',0,0,1,1)]);
 await assert.rejects(validate({...e,bytes:new Uint8Array(20*1024*1024+1)}),{code:'COUNTRY_DATA_LIMIT'});
 for(const patch of [{positionCount:2000001},{featureCount:1001},{byteLength:20*1024*1024+1}])await assert.rejects(validate({...e,manifest:{...e.manifest,...patch}}),{code:'COUNTRY_DATA_LIMIT'});
 const d=boxCountry('AA',0,0,1,1);d.geometry.coordinates=[[]];await assert.rejects(validate(await packCountryData([d])));
});
test('normalization preserves geometry and requires reviewed ISO exceptions',()=>{
 const geometry=boxCountry('AA',0,0,1,1).geometry;
 const source={type:'FeatureCollection',features:[{type:'Feature',geometry,properties:{NE_ID:1,ISO_A2:'-99',NAME_EN:'Example',NAME_PL:'Przykład'}}]};
 assert.throws(()=>normalizeCountries(source,{nullIsoIds:[]}),{code:'COUNTRY_DATA_INVALID'});
 const result=normalizeCountries(source,{nullIsoIds:['ne:1']});
 assert.equal(result.countries[0].iso2,null);assert.deepEqual(result.countries[0].geometry,geometry);assert.equal(result.countries[0].names.pl,'Przykład');
 assert.equal(source.features[0].properties.ISO_A2,'-99');
});
test('converter pins input bytes and produces deterministic validated output',async()=>{
 const input=new TextEncoder().encode(JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{NE_ID:1,ISO_A2:'AA',NAME_EN:'A',NAME_PL:'A'},geometry:boxCountry('AA',0,0,1,1).geometry}]}));
 const e=await packCountryData([boxCountry('AA',0,0,1,1)]);
 const review={release:'5.1.1',sourceUrl:e.manifest.sourceUrl,sourceCommit:e.manifest.sourceCommit,sourceArchiveSha256:e.manifest.sourceArchiveSha256,sourceGeoJsonSha256:await countryHash(input),nullIsoIds:[],notice:JSON.parse(new TextDecoder().decode(e.noticeBytes))};
 const a=await prepareCountries(input,review),b=await prepareCountries(input,review);assert.deepEqual(a,b);assert.equal((await validate(a)).dataset.countries[0].id,'ne:1');
 await assert.rejects(prepareCountries(input,{...review,sourceGeoJsonSha256:'0'.repeat(64)}),{code:'COUNTRY_DATA_HASH'});
});
