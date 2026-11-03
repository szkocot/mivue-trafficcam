const R=6371000,rad=n=>n*Math.PI/180;
const distance=(a,b)=>2*R*Math.asin(Math.min(1,Math.sqrt(Math.sin(rad(b[1]-a[1])/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(rad(b[0]-a[0])/2)**2)));
const bearing=(a,b)=>(Math.atan2(Math.sin(rad(b[0]-a[0]))*Math.cos(rad(b[1])),Math.cos(rad(a[1]))*Math.sin(rad(b[1]))-Math.sin(rad(a[1]))*Math.cos(rad(b[1]))*Math.cos(rad(b[0]-a[0])))*180/Math.PI+360)%360;
const angle=(a,b)=>Math.abs(((a-b+540)%360)-180);
const text=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/Ł/g,'L').trim().toLowerCase().replace(/\s+/g,' ');
const aliases=new Map([['warszawy','warszawa'],['poznania','poznan'],['katowic','katowice'],['wroclawia','wroclaw'],['krakowa','krakow'],['lodzi','lodz'],['gdanska','gdansk'],['szczecina','szczecin'],['lublina','lublin'],['bydgoszczy','bydgoszcz'],['bialegostoku','bialystok'],['rzeszowa','rzeszow']]);
for(const [form,name] of [["gliwic", "gliwice"], ["czestochowy", "czestochowa"], ["minska mazowieckiego", "minsk mazowiecki"], ["dobronia", "dobron"], ["petrykoz", "petrykozy"], ["kielc", "kielce"], ["radomia", "radom"], ["nowego sacza", "nowy sacz"], ["zielonej gory", "zielona gora"], ["swinoujscia", "swinoujscie"], ["belchatowa", "belchatow"], ["bytomia", "bytom"], ["glogowka", "glogowek"], ["glubczyc", "glubczyce"], ["koszalina", "koszalin"], ["nidzicy", "nidzica"], ["obornik", "oborniki"], ["ostrody", "ostroda"], ["pabianic", "pabianice"], ["piotrkowa trybunalskiego", "piotrkow trybunalski"], ["pszczyny", "pszczyna"], ["rybnika", "rybnik"], ["siedlec", "siedlce"], ["strzelec opolskich", "strzelce opolskie"], ["terespola", "terespol"], ["tych", "tychy"], ["wielunia", "wielun"], ["barwinka", "barwinek"], ["brwinowa", "brwinow"], ["gdyni", "gdynia"], ["grudziadza", "grudziadz"], ["grojca", "grojec"], ["gory kalwarii", "gora kalwaria"], ["inowroclawia", "inowroclaw"], ["ilawy", "ilawa"], ["koscierzyny", "koscierzyna"], ["miejsca piastowego", "miejsce piastowe"], ["mragowa", "mragowo"], ["olsztyna", "olsztyn"], ["pruszkowa", "pruszkow"], ["pucka", "puck"], ["redy", "reda"], ["rozog", "rozogi"], ["skierniewic", "skierniewice"], ["sochaczewa", "sochaczew"], ["wlodawy", "wlodawa"], ["lowicza", "lowicz"], ["lecznej", "leczna"], ["swiecka", "swiecko"], ["zukowa", "zukowo"], ["zyrardowa", "zyrardow"], ["elblaga", "elblag"], ["wyszkowa", "wyszkow"], ["olsztynka", "olsztynek"], ["torunia", "torun"], ["wisly", "wisla"], ["zgorzelca", "zgorzelec"], ["zor", "zory"], ["barlinka", "barlinek"], ["bialobrzegow", "bialobrzegi"], ["bilgoraja", "bilgoraj"], ["chelma", "chelm"], ["deblina", "deblin"], ["gorzowa wielkopolskiego", "gorzow wielkopolski"], ["glogowa", "glogow"], ["kartuz", "kartuzy"], ["legnicy", "legnica"], ["marek", "marki"], ["nosowki", "nosowka"], ["opatowa", "opatow"], ["przeworska", "przeworsk"], ["pulaw", "pulawy"], ["rawy mazowieckiej", "rawa mazowiecka"], ["stalowej woli", "stalowa wola"], ["sulechowa", "sulechow"], ["tarnobrzega", "tarnobrzeg"], ["tarnowa", "tarnow"], ["witnicy", "witnica"], ["wolsztyna", "wolsztyn"], ["wschowy", "wschowa"], ["wysokiego mazowieckiego", "wysokie mazowieckie"], ["skomielnej bialej", "skomielna biala"]])aliases.set(form,name);
const destination=v=>{const s=text(v).replace(/^tunel[^,]*,.*?(?:(?:w strone|kier\.|k\.)\s+)/,'').replace(/^(?:w kierunku|w strone|w kier\.?|do)\s+/,'').replace(/[.!]$/,'');return aliases.get(s)??s;};
const roadRef=v=>String(v??'').toUpperCase().replace(/\s+/g,'').replace(/^(?:DK|DW)(?=\d)/,'');
const refs=v=>String(v??'').split(';').map(roadRef).filter(Boolean);
const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
const fail=()=>{throw new Error('Invalid road context');};
const cell=p=>[Math.floor(p[0]*100),Math.floor(p[1]*100)];
const key=(x,y)=>`${x}:${y}`;
const uniqueBearings=values=>values.reduce((out,n)=>{if(!out.some(v=>angle(v,n)<20))out.push(n);return out;},[]);
function projection(p,a,b){
 const c=Math.cos(rad(p[1])),x=(b[0]-a[0])*c,y=b[1]-a[1],den=x*x+y*y;
 const f=den?Math.max(0,Math.min(1,((p[0]-a[0])*c*x+(p[1]-a[1])*y)/den)):0;
 const q=[a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])];return {f,metres:distance(p,q)};
}
class Heap{
 constructor(){this.items=[];}
 push(item){const a=this.items;let i=a.length;a.push(item);while(i&&a[(i-1)>>1][0]>item[0]){a[i]=a[(i-1)>>1];i=(i-1)>>1;}a[i]=item;}
 pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1][0]<a[c][0])c++;if(a[c][0]>=last[0])break;a[i]=a[c];i=c;}a[i]=last;}return first;}
}
const claimsFor=reference=>{
 const raw=reference.originalProperties?.canardDetail?.raw,device=raw?.urzadzenie??{},rows=Array.isArray(raw?.limity)?raw.limity:[];
 const names=rows.filter(r=>typeof r.limitOsobowe==='string'&&/^\d+(?:\.\d+)?$/.test(r.limitOsobowe.trim())&&Number.isFinite(Number(r.limitOsobowe))&&Number(r.limitOsobowe)>0).map(r=>r.typ?.kierunek).filter(v=>typeof v==='string'&&v.trim());
 return {device,names:names.length?names:[device.nazwaKierunku1,device.nazwaKierunku2].filter(v=>typeof v==='string'&&v.trim())};
};
/** Relevant immutable evidence only; annotations and retrieval dates cannot validate themselves. */
export function roadDirectionInputKey(reference){
 const {device,names}=claimsFor(reference),g=reference.geometry;
 return JSON.stringify({sourceId:reference.sourceId??null,geometry:g?{type:g.type,coordinates:g.coordinates}:null,roadRef:device.lokalizacjaNrDrogi??null,eligiblePassengerNamedClaims:names,sectionLengthsMetres:[device.dlugoscOdcinka1??null,device.dlugoscOdcinka2??null],deviceNames:[device.nazwaKierunku1??null,device.nazwaKierunku2??null]});
}
/** One immutable local road context; graph/city-distance caches are reused across observations. */
export function createRoadResolver(context){
 if(context?.schemaVersion!==1||!context.source||typeof context.source.url!=='string'||typeof context.source.attribution!=='string'||typeof context.source.licenceUrl!=='string'||!Number.isFinite(Date.parse(context.source.dataTimestamp))||!/^[a-f0-9]{64}$/.test(context.source.sha256??'')||typeof context.source.complete!=='boolean'||!Array.isArray(context.ways)||!Array.isArray(context.places)||context.ways.length>2000000||context.places.length>300000)fail();
 const source=structuredClone(context.source),nodes=[],byId=new Map(),segments=[],grid=new Map(),places=new Map(),uses=new Map(),ways=[];let gridEntries=0,geometryPoints=0,chainId=0;
 // Shared vertices and way ends route the graph; intervening geometry still controls local tangents.
 for(const way of context.ways){
  if(!way||!Array.isArray(way.nodeIds)||!Array.isArray(way.coordinates)||way.nodeIds.length!==way.coordinates.length||way.nodeIds.length<2||!way.coordinates.every(point))fail();
  geometryPoints+=way.nodeIds.length;if(geometryPoints>5000000)fail();
  const tags={...(way.tags??{})};if(!tags.highway||['no','private'].includes(tags.access)||['no','private'].includes(tags.motor_vehicle)||['no','private'].includes(tags.motorcar)||['footway','path','cycleway','pedestrian','steps','construction','proposed'].includes(tags.highway))continue;
  const ow=String(tags['oneway:motorcar']??tags['oneway:motor_vehicle']??tags.oneway??(tags.junction==='roundabout'?'yes':'no')).toLowerCase();if(['reversible','alternating'].includes(ow))continue;
  ways.push({way,tags,forward:ow!=='-1',backward:!['yes','1','true'].includes(ow)});
  for(const id of way.nodeIds){if(!['number','string'].includes(typeof id)||!String(id))fail();const k=String(id);uses.set(k,(uses.get(k)??0)+1);}
 }
 const addNode=(id,p)=>{const k=String(id);if(byId.has(k)){const i=byId.get(k);if(nodes[i].p[0]!==p[0]||nodes[i].p[1]!==p[1])fail();return i;}if(nodes.length>=500000)fail();const i=nodes.length;byId.set(k,i);nodes.push({p:[...p],reverse:[]});return i;};
 for(const {way,tags,forward,backward}of ways){
  let first=0;
  for(let last=1;last<way.nodeIds.length;last++){
   if(last!==way.nodeIds.length-1&&uses.get(String(way.nodeIds[last]))===1)continue;
   const a=addNode(way.nodeIds[first],way.coordinates[first]),b=addNode(way.nodeIds[last],way.coordinates[last]);let len=0;
   for(let j=first+1;j<=last;j++)len+=distance(way.coordinates[j-1],way.coordinates[j]);
   if(!len){first=last;continue;}if(forward)nodes[b].reverse.push([a,len]);if(backward)nodes[a].reverse.push([b,len]);
   const chain=chainId++;let offset=0;
   for(let j=first+1;j<=last;j++){
    const from=way.coordinates[j-1],to=way.coordinates[j],segmentLen=distance(from,to);if(!segmentLen)continue;
    const segment={a,b,len,offset,segmentLen,from,to,chain,wayId:String(way.id),tags,forward,backward},i=segments.push(segment)-1;offset+=segmentLen;
    const [x1,y1]=cell(from),[x2,y2]=cell(to);if((Math.abs(x2-x1)+1)*(Math.abs(y2-y1)+1)>10000)fail();
    for(let x=Math.min(x1,x2);x<=Math.max(x1,x2);x++)for(let y=Math.min(y1,y2);y<=Math.max(y1,y2);y++){const k=key(x,y);if(!grid.has(k))grid.set(k,[]);if(++gridEntries>20000000)fail();grid.get(k).push(i);}
   }
   first=last;
  }
 }
 uses.clear();ways.length=0;
 for(const p of context.places){if(!point(p.coordinates))fail();for(const field of ['name','name:pl','alt_name','official_name','loc_name'])for(const name of String(p.tags?.[field]??'').split(';')){const d=destination(name);if(!d)continue;if(!places.has(d))places.set(d,new Map());places.get(d).set(String(p.id),{id:String(p.id),coordinates:[...p.coordinates],placeClass:p.tags?.place});}}
 const nearby=(index,p,radius)=>{const [x,y]=cell(p),out=new Set();for(let a=x-radius;a<=x+radius;a++)for(let b=y-radius;b<=y+radius;b++)for(const i of index.get(key(a,b))??[])out.add(i);return out;};
 function snaps(p,road){
  const options=[];for(const i of nearby(grid,p,1)){const s=segments[i];if(road&&!refs(s.tags.ref).includes(road))continue;const projected=projection(p,s.from,s.to);if(projected.metres<=120)options.push({s,metres:projected.metres,f:(s.offset+projected.f*s.segmentLen)/s.len});}
  const min=options.reduce((min,o)=>Math.min(min,o.metres),Infinity);return options.filter(o=>o.metres<=min+35);
 }
 const cache=new Map();
 function distances(seeds){
  const d=new Float64Array(nodes.length);d.fill(Infinity);const heap=new Heap();for(const [id,cost]of seeds)if(cost<d[id]){d[id]=cost;heap.push([cost,id]);}
  let visited=0;while(heap.items.length){const [cost,id]=heap.pop();if(cost!==d[id])continue;if(++visited>500000)break;if(cost>400000)continue;for(const [other,len]of nodes[id].reverse){const n=cost+len;if(n<d[other]&&n<=400000){d[other]=n;heap.push([n,other]);}}}return d;
 }
 const endpointCache=new Map();
 function endpointDistances(exit){const k=`${exit.s.chain}:${exit.direction}:${exit.f}`;if(endpointCache.has(k))return endpointCache.get(k);const d=distances([[exit.direction===1?exit.s.a:exit.s.b,(exit.direction===1?exit.f:1-exit.f)*exit.s.len]]);endpointCache.set(k,d);if(endpointCache.size>4)endpointCache.delete(endpointCache.keys().next().value);return d;}
 const snapSeeds=options=>options.flatMap(({s,f,metres=0})=>[...(s.forward?[[s.a,f*s.len+metres]]:[]),...(s.backward?[[s.b,(1-f)*s.len+metres]]:[]),...(f<1e-10?[[s.a,metres]]:[]),...(f>1-1e-10?[[s.b,metres]]:[])]);
 function cityDistances(place){
  if(cache.has(place.id)){const d=cache.get(place.id);cache.delete(place.id);cache.set(place.id,d);return d;}
  const anchors=[];for(const i of nearby(grid,place.coordinates,8)){const s=segments[i],p=projection(place.coordinates,s.from,s.to);if(p.metres<=5000)anchors.push({s,metres:p.metres,f:(s.offset+p.f*s.segmentLen)/s.len});}
  if(!anchors.length)return null;const min=anchors.reduce((n,a)=>Math.min(n,a.metres),Infinity);const selected=anchors.filter(a=>a.metres<=min+100),result={d:distances(snapSeeds(selected)),anchors:selected};cache.set(place.id,result);if(cache.size>4)cache.delete(cache.keys().next().value);return result;
 }
 const options=(matches,d)=>matches.flatMap(({s,f,metres})=>[
  ...(s.forward&&Number.isFinite(d[s.b])?[{s,f,direction:1,bearing:bearing(s.from,s.to),cost:(1-f)*s.len+d[s.b],wayId:s.wayId,snapMetres:metres}]:[]),
  ...(s.backward&&Number.isFinite(d[s.a])?[{s,f,direction:-1,bearing:bearing(s.to,s.from),cost:f*s.len+d[s.a],wayId:s.wayId,snapMetres:metres}]:[])]);
 const tagged=(matches,dest)=>matches.flatMap(({s,f,metres})=>{
  const matchesTag=v=>String(v??'').split(';').some(v=>destination(v)===dest),out=[];
  if(s.forward&&(['destination:forward','destination:ref:forward'].some(k=>matchesTag(s.tags[k]))||!s.backward&&['destination','destination:ref'].some(k=>matchesTag(s.tags[k]))))out.push({s,f,direction:1,bearing:bearing(s.from,s.to),cost:0,wayId:s.wayId,snapMetres:metres});
  if(s.backward&&(['destination:backward','destination:ref:backward'].some(k=>matchesTag(s.tags[k]))||!s.forward&&['destination','destination:ref'].some(k=>matchesTag(s.tags[k]))))out.push({s,f,direction:-1,bearing:bearing(s.to,s.from),cost:0,wayId:s.wayId,snapMetres:metres});return out;
 });
 function through(entryMatches,exit){
  const d=endpointDistances(exit),out=options(entryMatches,d);
  for(const match of entryMatches)if(match.s.chain===exit.s.chain&&((exit.direction===1&&match.s.forward&&match.f<=exit.f)||(exit.direction===-1&&match.s.backward&&match.f>=exit.f)))out.push({s:match.s,f:match.f,direction:exit.direction,bearing:exit.direction===1?bearing(match.s.from,match.s.to):bearing(match.s.to,match.s.from),cost:Math.abs(exit.f-match.f)*match.s.len,wayId:match.s.wayId,snapMetres:match.metres});
  return out;
 }
 function cityOptions(matches,route){
  const out=options(matches,route.d);
  for(const anchor of route.anchors)for(const match of matches)if(match.s.chain===anchor.s.chain){
   const direction=anchor.f>=match.f?1:-1;if(direction===1&&!match.s.forward||direction===-1&&!match.s.backward)continue;
   out.push({s:match.s,f:match.f,direction,bearing:direction===1?bearing(match.s.from,match.s.to):bearing(match.s.to,match.s.from),cost:Math.abs(anchor.f-match.f)*match.s.len+anchor.metres,wayId:match.s.wayId,snapMetres:match.metres});
  }return out;
 }
 function sectionCandidates(matched,exitOptions,entry,exit,maxSectionMetres,localTags=null){
  const out=[];for(const exitOption of exitOptions)for(const o of through(matched[entry],exitOption)){
   if(o.cost>maxSectionMetres)continue;
   if(localTags&&!localTags.some(tag=>tag.s.chain===o.s.chain&&angle(tag.bearing,o.bearing)<20))continue;
   out.push({...o,cost:o.cost+exitOption.cost,exitWayId:exitOption.wayId,sectionRouteMetres:o.cost,endpointOrientation:entry===0?'forward':'reverse',entryEndpointIndex:entry,exitEndpointIndex:exit,endpointBearings:entry===0?[o.bearing,exitOption.bearing]:[exitOption.bearing,o.bearing]});
  }return out;
 }
 function resolve(reference){
  const {device,names}=claimsFor(reference);
  const geometry=reference.geometry,positions=geometry?.type==='Point'?[geometry.coordinates]:geometry?.type==='LineString'?[geometry.coordinates[0],geometry.coordinates.at(-1)]:[];
  const straight=positions.length===2?distance(...positions):0,lengths=[device.dlugoscOdcinka1,device.dlugoscOdcinka2].filter(n=>Number.isFinite(n)&&n>0&&n>=straight*.9&&n<=straight*5);
  const maxSectionMetres=lengths.length?Math.max(...lengths)*1.2+200:Math.max(straight*1.5,straight+500);
  const road=roadRef(device.lokalizacjaNrDrogi),matched=positions.every(point)?positions.map(p=>snaps(p,road)):[];
  const claims=[...new Set(names)].map(rawName=>{
   const excluded=/^brak pomiaru\b/.test(text(rawName)),dest=destination(text(rawName).replace(/^brak pomiaru\s*/,'')).replace(/[.!]$/,'');
   const claim={raw:rawName,destination:dest,excluded,status:'unresolved',bearings:[],evidence:{wayIds:[],placeId:null,method:null,snapMetres:null},reason:'ROAD_NOT_MATCHED'};
   if(!matched.length||matched.some(o=>!o.length))return claim;
   let candidates=[],method='destination-tag';
   if(positions.length===1)candidates=tagged(matched[0],dest);
   else {const zeros=new Float64Array(nodes.length);for(const [entry,exit]of [[0,1],[1,0]]){const local=tagged(matched[entry],dest);const outgoing=tagged(matched[exit],dest);if(outgoing.length)candidates.push(...sectionCandidates(matched,outgoing,entry,exit,maxSectionMetres));if(local.length)candidates.push(...sectionCandidates(matched,options(matched[exit],zeros).map(o=>({...o,cost:0})),entry,exit,maxSectionMetres,local));}}
   let city=[...(places.get(dest)?.values()??[])],placeSelection=null;
   // A unique city is the motorway/expressway destination estimate; other road classes retain namesake ambiguity.
   if(city.length>1&&/^[AS]\d/.test(road)&&matched.every(list=>list.every(o=>['motorway','trunk'].includes(o.s.tags.highway)))){const cities=city.filter(p=>p.placeClass==='city');if(cities.length===1){city=cities;placeSelection='unique-city-on-motorway-or-expressway';}}
   if(!candidates.length){
    if(source.complete!==true)return {...claim,reason:'INCOMPLETE_CONTEXT'};
    if(city.length!==1)return {...claim,status:city.length>1?'ambiguous':'unresolved',reason:city.length>1?'PLACE_AMBIGUOUS':'PLACE_NOT_FOUND'};
    const route=cityDistances(city[0]);if(!route)return {...claim,reason:'PLACE_NOT_CONNECTED'};method='graph-route';
    if(positions.length===1)candidates=cityOptions(matched[0],route);
    else for(const [entry,exit]of [[0,1],[1,0]]){
     const exitOptions=cityOptions(matched[exit],route);if(!exitOptions.length)continue;const tail=Math.min(...exitOptions.map(o=>o.cost));
     candidates.push(...sectionCandidates(matched,exitOptions.filter(o=>o.cost<=tail+200),entry,exit,maxSectionMetres));
    }
   }
   if(!candidates.length)return {...claim,reason:'NO_DIRECTED_ROUTE'};
   candidates.sort((a,b)=>a.cost-b.cost);const near=candidates.filter(c=>c.cost<=candidates[0].cost+(method==='graph-route'?200:0)),bearings=uniqueBearings(near.map(o=>o.endpointBearings?.[0]??o.bearing));
   const orientations=new Set(near.map(o=>o.endpointOrientation).filter(Boolean)),ambiguous=bearings.length!==1||orientations.size>1||(positions.length===2&&uniqueBearings(near.map(o=>o.endpointBearings[1])).length>1);
   return {...claim,status:ambiguous?'ambiguous':'resolved',bearings,evidence:{wayIds:[...new Set(near.flatMap(o=>[o.wayId,o.exitWayId].filter(Boolean)))].slice(0,4),placeId:method==='graph-route'?city[0].id:null,method,...(placeSelection?{placeSelection}:{}),snapMetres:Math.min(...near.map(o=>o.snapMetres)),routeMetres:method==='graph-route'?near[0].cost:null,...(near[0].endpointOrientation?{sectionRouteMetres:near[0].sectionRouteMetres,sectionRouteLimitMetres:maxSectionMetres,endpointOrientation:near[0].endpointOrientation,entryEndpointIndex:near[0].entryEndpointIndex,exitEndpointIndex:near[0].exitEndpointIndex,endpointBearings:near[0].endpointBearings}:{})},reason:ambiguous?'COMPETING_DIRECTIONS':null};
  });
  const status=claims.length&&claims.every(c=>c.status==='resolved')?'resolved':claims.some(c=>c.status==='ambiguous')?'ambiguous':'unresolved';
  return {schemaVersion:1,inputKey:roadDirectionInputKey(reference),status,travelBearings:uniqueBearings(claims.filter(c=>c.status==='resolved'&&!c.excluded).flatMap(c=>c.bearings)),excludedBearings:uniqueBearings(claims.filter(c=>c.status==='resolved'&&c.excluded).flatMap(c=>c.bearings)),confidence:status!=='resolved'?'none':claims.every(c=>c.evidence.method==='destination-tag')?'high':'medium',claims,source:structuredClone(source),physicalAim:null};
 }
 return {resolve,resolveBatch:references=>references.map(resolve)};
}
