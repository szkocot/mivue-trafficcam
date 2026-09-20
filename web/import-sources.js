// Live connectors must pass the documented access gate before being enabled.
export function listImportSources(){
 return [
  {id:'csv',labelKey:'importCsv',available:true,reasonCode:null,attribution:null,url:null},
  {id:'geojson',labelKey:'importGeojson',available:true,reasonCode:null,attribution:null,url:null},
  {id:'canard',labelKey:'importCanard',available:false,reasonCode:'CORS_BLOCKED',
   attribution:'GITD / CANARD',url:'https://www.canard.gitd.gov.pl/cms/en/mapa-urzadzen'},
 ];
}
export async function fetchImportSource(id,{signal}={}){
 signal?.throwIfAborted();
 const source=listImportSources().find(s=>s.id===id);
 throw Object.assign(new Error('Live source is unavailable'),{code:'SOURCE_UNAVAILABLE',reasonCode:source?.reasonCode??'NO_LIVE_CONNECTOR'});
}
