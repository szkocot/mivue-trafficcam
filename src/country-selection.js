import {countryFail} from './country-data.js';
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const sorted=a=>[...a].sort();
const partition=()=>({keptIds:[],excludedIds:[],unresolvedIds:[]});
export function selectCountries({view,references,classifications,boundary,options,countryIds}){
 if(!object(options)||Object.keys(options).sort().join(',')!=='acknowledgeExtras,componentDecisions,countryIds,decisions'||!Array.isArray(options.countryIds)||!object(options.decisions)||!object(options.componentDecisions)||typeof options.acknowledgeExtras!=='boolean')countryFail('COUNTRY_DECISION_INVALID');
 if(!options.countryIds.length)countryFail('COUNTRY_SELECTION_EMPTY');
 const selected=new Set(options.countryIds);if(selected.size!==options.countryIds.length)countryFail('COUNTRY_DECISION_INVALID');
 if(options.countryIds.some(id=>!countryIds.includes(id)))countryFail('COUNTRY_ID_UNKNOWN');
 const records=view.records.filter(r=>!r.deleted),byId=new Map(view.records.map(r=>[r.id,r])),parent=new Map(records.map(r=>[r.id,r.id]));
 const find=id=>{let root=id;while(parent.get(root)!==root)root=parent.get(root);while(id!==root){const next=parent.get(id);parent.set(id,root);id=next;}return root;};
 const diagnostics=[];
 for(const r of records){
  if(r.typeRaw!==964&&!r.linkResolution)continue;
  const target=byId.get(r.linkResolution?.targetId??r.linkTargetId);
  const code=!target?'LINK_TARGET_MISSING':target.deleted?'LINK_TARGET_DELETED':target.typeRaw!==9128?'LINK_TARGET_TYPE':null;
  if(code){diagnostics.push({code,recordId:r.id});continue;}
  const a=find(r.id),b=find(target.id);if(a!==b)parent.set(a<b?b:a,a<b?a:b);
 }
 const groups=new Map();for(const r of records){const id=find(r.id);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(r.id);}
 const components=[...groups].map(([id,recordIds])=>({id,recordIds:recordIds.sort()})).sort((a,b)=>a.id<b.id?-1:1);
 const recordPart=partition(),refPart=partition(),reviewItems=[],linkedExtras=[],used=new Set();
 const get=id=>{const c=classifications.get(id);if(!c||!['assigned','border','invalid','unassigned'].includes(c.status)||!Array.isArray(c.countryIds))countryFail('COUNTRY_DATA_INVALID');return c;};
 const decision=id=>{if(!Object.hasOwn(options.decisions,id))return null;used.add(id);const d=options.decisions[id];if(!['keep','exclude'].includes(d))countryFail('COUNTRY_DECISION_INVALID');return d;};
 const initial=id=>{const c=get(id),d=decision(id);if(c.status==='assigned'){if(d)countryFail('COUNTRY_DECISION_INVALID');return selected.has(c.countryIds[0])?'keep':'exclude';}return d??'review';};
 for(const [id,d]of Object.entries(options.componentDecisions))if(!groups.has(id)||groups.get(id).length<2||!['keep','exclude'].includes(d))countryFail('COUNTRY_DECISION_INVALID');
 for(const component of components){
  const states=component.recordIds.map(id=>({id,state:initial(id)})),override=options.componentDecisions[component.id];
  const triggers=states.filter(x=>x.state==='keep').map(x=>x.id),conflict=triggers.length&&states.some(x=>options.decisions[x.id]==='exclude');
  const state=override??(conflict?'review':triggers.length?'keep':states.some(x=>x.state==='review')?'review':'exclude');
  recordPart[state==='keep'?'keptIds':state==='exclude'?'excludedIds':'unresolvedIds'].push(...component.recordIds);
  if(state==='review')for(const id of component.recordIds)reviewItems.push({id,kind:'record',classification:get(id),componentId:component.recordIds.length>1?component.id:null});
  if(state==='keep')for(const item of states)if(item.state!=='keep')linkedExtras.push({id:item.id,triggerIds:triggers,reason:get(item.id).status==='assigned'?'LINKED_OUTSIDE':'LINKED_UNCERTAIN'});
 }
 const kept=new Set(recordPart.keptIds),unresolved=new Set(recordPart.unresolvedIds);
 for(const r of references){
  let state;
  if(r.recordId)state=kept.has(r.recordId)?'keep':unresolved.has(r.recordId)?'review':'exclude';
  else if(r.geometry?.type==='LineString'){
   const a=get(`${r.id}:start`),b=get(`${r.id}:end`),d=decision(r.id);
   const included=c=>c.status==='assigned'&&selected.has(c.countryIds[0]);
   if(d&&!['border','unassigned','invalid'].includes(a.status)&&!['border','unassigned','invalid'].includes(b.status))countryFail('COUNTRY_DECISION_INVALID');
   state=d??(included(a)||included(b)?'keep':a.status!=='assigned'||b.status!=='assigned'?'review':'exclude');
   if(state==='keep'&&(!included(a)||!included(b)))linkedExtras.push({id:r.id,triggerIds:[r.id],reason:a.status==='assigned'&&b.status==='assigned'?'SECTION_OUTSIDE':'SECTION_UNCERTAIN'});
   if(state==='review')reviewItems.push({id:r.id,kind:'reference',classification:{status:'border',countryIds:sorted(new Set([...a.countryIds,...b.countryIds]))},componentId:null});
  }else{state=initial(r.id);if(state==='review')reviewItems.push({id:r.id,kind:'reference',classification:get(r.id),componentId:null});}
  refPart[state==='keep'?'keptIds':state==='exclude'?'excludedIds':'unresolvedIds'].push(r.id);
 }
 if(Object.keys(options.decisions).some(id=>!used.has(id)))countryFail('COUNTRY_DECISION_INVALID');
 for(const part of [recordPart,refPart])for(const values of Object.values(part))values.sort();
 linkedExtras.sort((a,b)=>a.id<b.id?-1:1);reviewItems.sort((a,b)=>a.id<b.id?-1:1);diagnostics.sort((a,b)=>a.recordId<b.recordId?-1:1);
 return {boundary:structuredClone(boundary),options:structuredClone({...options,countryIds:sorted(selected)}),records:recordPart,references:refPart,components,linkedExtras,reviewItems,diagnostics,
  ready:recordPart.unresolvedIds.length+refPart.unresolvedIds.length===0&&(!linkedExtras.length||options.acknowledgeExtras)};
}
