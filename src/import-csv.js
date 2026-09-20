import { checkText,requireImport,fromProperties,normalizeBatch,numeric } from './import-normalize.js';

function rows(text){
 const result=[];let row=[],cell='',quoted=false,closed=false,started=false;
 const pushCell=()=>{row.push(cell);cell='';closed=false;started=false;};
 const pushRow=()=>{pushCell();result.push(row);row=[];requireImport(result.length<=100001,'rows',result.length,'COUNT_LIMIT');};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c===','){pushCell();continue;}
  if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;pushRow();continue;}
  requireImport(!closed,'csv',result.length,'CSV_QUOTE');
  if(c==='"'){requireImport(!started,'csv',result.length,'CSV_QUOTE');quoted=true;started=true;}
  else {cell+=c;started=true;}
 }
 requireImport(!quoted,'csv',result.length,'CSV_QUOTE');
 if(started||closed||row.length)pushRow();
 return result;
}
export function parseCsv(text,source,retrievedAt){
 checkText(text);const parsed=rows(text.replace(/^\ufeff/,'')),header=parsed.shift();
 requireImport(header&&new Set(header).size===header.length&&header.every(v=>v.length>0)
  &&['id','latitude','longitude','kind'].every(k=>header.includes(k)),'header');
 const observations=parsed.map((row,index)=>{
  requireImport(row.length===header.length,'columns',index);
  const p=Object.fromEntries(header.map((key,i)=>[key,row[i]]));
  const geometry={type:'Point',coordinates:[numeric(p.longitude,'longitude',index,{strings:true}),numeric(p.latitude,'latitude',index,{strings:true})]};
  return fromProperties(p,p.id,geometry,index,true);
 });
 return normalizeBatch({source,retrievedAt,observations});
}
