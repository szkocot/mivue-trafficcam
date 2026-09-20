export function makeImportBatch(overrides={}) {
 return structuredClone({source:{namespace:'example',attribution:'Example owner',url:null},retrievedAt:'2026-09-20T12:00:00.000Z',
  observations:[{sourceId:'a',kind:'camera',status:'active',geometry:{type:'Point',coordinates:[19,52]},name:null,
   speedKmh:50,originalSpeed:{value:50,unit:'km/h'},direction:null,url:null,originalProperties:{speed:50}}],...overrides});
}
