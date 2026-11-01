import {decodeBinSpeed,decodeBinType,BIN_METADATA_SCOPE} from '../../src/bin-metadata.js';
const escape=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const rounded=n=>Number.isFinite(n)?Math.round(n*1000)/1000:null;
const rows=report=>[...report.points,...report.sections];
const speedText=e=>`${e.rawSpeed} (${e.decodedSpeed.status==='known'?e.decodedSpeed.speedKmh+' km/h':e.decodedSpeed.status==='unspecified'?'Not specified':'unclassified'})`;
const typeText=e=>`${e.rawType} (${e.decodedType.kind})`;
const csvCell=value=>{let s=value==null?'':typeof value==='object'?JSON.stringify(value):String(value);if(typeof value==='string'&&/^[\s\x00-\x1f]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};

export function speedInventoryCsv(records){
 const header=['id','typeRaw','storedSpeedValue','latitude','longitude','rawDirectionByte','rawModeByte','speedStatus','speedKmh','decodedType','firmwareScope'];
 const values=records.filter(r=>!r.deleted).map(r=>[r.id??`source:${r.offset}`,r.typeRaw,r.rawBytes16To19[0],r.latitude,r.longitude,r.rawBytes16To19[1],r.rawBytes16To19[3],decodeBinSpeed(r.rawBytes16To19[0]).status,decodeBinSpeed(r.rawBytes16To19[0]).speedKmh,decodeBinType(r.typeRaw).kind,BIN_METADATA_SCOPE]);
 return [header,...values].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}

export function speedCounts(speed){
 const {rawZeroIds,global,...result}=speed;
 if(global){const {rawZeroIds:ids,...rest}=global;result.global=rest;}
 return result;
}

export function comparisonCsv(report){
 const fields=['sourceId','category','status','sourceSpeedKmh','candidateIds','rawSpeeds','rawTypes','endpointMetres','spanMetres','spanDifferencesMetres','rangeReview','source','decodedSpeedStatus','decodedSpeedKmh','decodedType','firmwareScope'];
 const values=rows(report).map(r=>[r.sourceId,r.category,r.status,r.sourceSpeedKmh,r.candidates.map(c=>c.id),
  r.candidates.map(c=>c.endpoints?c.endpoints.map(e=>e.rawSpeed):c.rawSpeed),r.candidates.map(c=>c.endpoints?c.endpoints.map(e=>e.rawType):c.rawType),
  r.candidates.map(c=>c.endpointMetres?.map(rounded)??rounded(c.metres)),rounded(r.spanMetres),r.candidates.map(c=>rounded(c.spanDifferenceMetres)),r.status==='range-review','CANARD',r.candidates.map(c=>(c.endpoints??[c]).map(e=>e.decodedSpeed.status)),r.candidates.map(c=>(c.endpoints??[c]).map(e=>e.decodedSpeed.speedKmh)),r.candidates.map(c=>(c.endpoints??[c]).map(e=>e.decodedType.kind)),BIN_METADATA_SCOPE]);
 for(const r of report.mioOnly)values.push([r.id,'Mio-record','mio-only',null,[r.id],[r.rawSpeed],[r.rawType],[],null,[],false,'Mio',r.decodedSpeed.status,r.decodedSpeed.speedKmh,r.decodedType.kind,BIN_METADATA_SCOPE]);
 for(const r of report.mioOnlySections)values.push([r.id,'Mio-pair','mio-only-section',null,[r.id],[r.endpoints.map(e=>e.rawSpeed)],[r.endpoints.map(e=>e.rawType)],[],rounded(r.spanMetres),[],false,'Mio',r.endpoints.map(e=>e.decodedSpeed.status),r.endpoints.map(e=>e.decodedSpeed.speedKmh),r.endpoints.map(e=>e.decodedType.kind),BIN_METADATA_SCOPE]);
 return [fields,...values].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}

export function comparisonGeoJson(report){
 const features=rows(report).map(r=>({type:'Feature',id:`canard:${r.sourceId}`,geometry:r.geometry,properties:{...r,source:'CANARD'}}));
 const candidates=new Map();
 for(const r of rows(report))for(const c of r.candidates){
  for(const e of c.endpoints??[c])candidates.set(e.id,{type:'Feature',id:e.id,geometry:{type:'Point',coordinates:e.coordinates},properties:{...e,source:'Mio candidate',identityVerified:false}});
  if(c.endpoints)candidates.set('pair:'+c.id,{type:'Feature',id:'pair:'+c.id,geometry:{type:'LineString',coordinates:c.endpoints.map(e=>e.coordinates)},properties:{...c,source:'Mio candidate',identityVerified:false,routeVerified:false}});
 }
 features.push(...candidates.values());
 for(const r of report.mioOnly)features.push({type:'Feature',id:r.id,geometry:{type:'Point',coordinates:r.coordinates},properties:{...r,source:'Mio',status:'mio-only'}});
 for(const r of report.mioOnlySections)features.push({type:'Feature',id:`pair:${r.id}`,geometry:{type:'LineString',coordinates:r.endpoints.map(e=>e.coordinates)},properties:{...r,source:'Mio',status:'mio-only-section',routeVerified:false}});
 for(const feature of features){
  const {id,status,...p}=feature.properties;
  feature.properties={...p,mioRecordId:id??null,comparisonStatus:p.comparisonStatus??status??'candidate',status:'unknown',
   kind:feature.geometry.type==='LineString'?'section':p.source==='CANARD'?({PP:'camera',RL:'red-light'}[p.category]??'unknown'):'unknown',
   speed:p.source==='CANARD'?p.originalSpeed?.value??null:null,speed_unit:p.source==='CANARD'?p.originalSpeed?.unit??null:null,
   direction:p.sourceDirection??null,name:`${p.source} ${p.sourceId??id??feature.id}`};
 }
 return JSON.stringify({type:'FeatureCollection',schema:report.schema,binMetadataScope:BIN_METADATA_SCOPE,inputs:report.inputs,sourceNotices:report.sourceNotices,boundaryNotice:report.boundaryNotice,scope:report.scope,linkProblems:report.linkProblems,invalidRecords:report.invalidRecords,features},null,2)+'\n';
}

export function comparisonHtml(report,country){
 const items=rows(report),positions=[];
 function collect(array){if(array.length===2&&array.every(Number.isFinite))positions.push(array);else for(const a of array)collect(a);}
 collect(country.geometry.coordinates);for(const r of items)collect(r.geometry.coordinates);for(const r of report.mioOnlySections)for(const e of r.endpoints)collect(e.coordinates);
 let west=180,east=-180,south=90,north=-90;for(const [lon,lat]of positions){west=Math.min(west,lon);east=Math.max(east,lon);south=Math.min(south,lat);north=Math.max(north,lat);}
 const cos=Math.cos((south+north)*Math.PI/360),scale=Math.min(960/Math.max(.001,(east-west)*cos),660/Math.max(.001,north-south));
 const xy=p=>[20+(p[0]-west)*cos*scale,20+(north-p[1])*scale].map(rounded);
 const line=coordinates=>coordinates.map(p=>xy(p).join(',')).join(' ');
 const polygons=country.geometry.type==='Polygon'?[country.geometry.coordinates]:country.geometry.coordinates;
 const boundary=polygons.map(p=>'<path class="boundary" d="'+p.map(r=>'M'+r.map(x=>xy(x).join(' ')).join(' L')+' Z').join(' ')+'"/>').join('');
 const dots=report.mioOnly.map((r,i)=>{const [x,y]=xy(r.coordinates);return `<a href="#mio-only-${i}" aria-label="${escape(r.id)}"><circle class="mio-only" cx="${x}" cy="${y}" r="2"><title>${escape(r.id)}</title></circle></a>`;}).join('');
 const candidateShapes=new Map();
 for(const r of items)for(const c of r.candidates){
  for(const e of c.endpoints??[c]){const [x,y]=xy(e.coordinates);candidateShapes.set(e.id,`<circle class="mio-candidate" cx="${x}" cy="${y}" r="6"><title>${escape(e.id+' · BIN '+e.rawSpeed+' / type '+e.rawType)}</title></circle>`);}
  if(c.endpoints)candidateShapes.set('pair:'+c.id,`<polyline class="mio-candidate" points="${line(c.endpoints.map(e=>e.coordinates))}"><title>${escape(c.id)}</title></polyline>`);
 }
 const shapes=items.map((r,i)=>{
  const source=r.geometry.type==='Point'?`<circle cx="${xy(r.geometry.coordinates)[0]}" cy="${xy(r.geometry.coordinates)[1]}" r="4"/>`:`<polyline points="${line(r.geometry.coordinates)}"/>`;
  return `<a href="#observation-${i}" class="${r.status}" aria-label="${escape(r.category+' '+r.sourceId+' '+r.status)}"><title>${escape(r.sourceId+' · '+r.status)}</title>${source}</a>`;
 }).join('');
 const table=items.map((r,i)=>`<tr id="observation-${i}"><td>${escape(r.category)}</td><td>${escape(r.sourceId)}</td><td>${escape(JSON.stringify(r.geometry.coordinates))}</td><td>${escape(r.status)}</td><td>${escape(r.sourceSpeedKmh??'Unknown')}</td><td>${r.candidates.map(c=>escape(c.id)+': '+escape((c.endpoints??[c]).map(speedText).join(' / '))).join('<br>')||'—'}</td><td>${r.candidates.map(c=>escape((c.endpoints??[c]).map(typeText).join(' / '))).join('<br>')||'—'}</td><td>${r.candidates.map(c=>escape((c.endpointMetres??[c.metres]).map(rounded).join(' / '))).join('<br>')||'—'}</td><td>${r.candidates.map(c=>c.endpoints?escape(`${c.orientation}; span Δ ${rounded(c.spanDifferenceMetres)} m; ratio ${rounded(c.lengthRatio)}; ${c.oneSided?'one-sided; ':''}${c.connectorOverlap?'connector overlap; ':''}${c.storedSpeedsAgree?'stored endpoint speeds agree':'stored endpoint speeds differ'}`):escape((c.decodedType?.kind??'unclassified')+'; speed '+(c.decodedSpeed?.status??'unclassified'))).join('<br>')}</td></tr>`).join('');
 const mioTable=report.mioOnly.map((r,i)=>`<tr id="mio-only-${i}"><td>${escape(r.id)}</td><td>${escape(typeText(r))}</td><td>${escape(speedText(r))}</td><td>${escape(JSON.stringify(r.coordinates))}</td></tr>`).join('');
 const mioSections=report.mioOnlySections.map((r,i)=>`<tr id="mio-section-${i}"><td>${escape(r.id)}</td><td>${escape(r.endpoints.map(e=>e.id).join(' / '))}</td><td>${escape(r.endpoints.map(speedText).join(' / '))}</td><td>${escape(JSON.stringify(r.endpoints.map(e=>e.coordinates)))}</td><td>${rounded(r.spanMetres)}</td></tr>`).join('');
 const mioLines=report.mioOnlySections.map((r,i)=>`<a href="#mio-section-${i}" aria-label="${escape(r.id)}"><polyline class="mio-only" points="${line(r.endpoints.map(e=>e.coordinates))}"><title>${escape(r.id)}</title></polyline></a>`).join('');
 const bindings=(report.projectBindings??[]).map(b=>`<tr><td>${escape(b.sourceId)}</td><td>${escape(b.recordId)}</td><td>${escape(b.status)}</td><td>${b.manuallyOwnedCoordinates?'Manual coordinates protected':'Source-owned / unclaimed'}</td><td>${escape(JSON.stringify(b.binCoordinates))}</td><td>${escape(b.geometryMatchesLatest?'Source geometry current':'Source geometry changed / absent')}</td><td>${escape((b.metadataDifferences??[]).join(', '))}</td></tr>`).join('');
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>CANARD–Mio comparison</title><style>body{font:15px system-ui;margin:24px;color:#172c3c}h1{font-size:26px}p{max-width:95ch;line-height:1.5}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow:auto}svg{width:100%;max-height:700px;border:1px solid #bbb;background:#f6fafc}.boundary{fill:#e6edef;stroke:#c4d2d9;fill-rule:evenodd}circle{stroke:white;stroke-width:.5}polyline{fill:none;stroke-width:2;stroke-dasharray:5 3}.mio-only{fill:#71818b}polyline.mio-only{fill:none;stroke:#71818b}.mio-candidate{fill:none;stroke:#365b9b;stroke-width:1;stroke-dasharray:none}.spatial-candidate{fill:#087f77;stroke:#087f77}.ambiguous{fill:#ad6800;stroke:#ad6800}.range-review{fill:#7351a2;stroke:#7351a2}.canard-only{fill:#bf3027;stroke:#bf3027}.table{overflow:auto}table{border-collapse:collapse;font-size:12px;min-width:900px;width:100%}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}tr:target{background:#fff0b5}a:focus{outline:3px solid #ad6800}</style><h1>CANARD–Mio comparison</h1><p><strong>Private review report. Spatial candidates are not verified identities.</strong> Mio-only and CANARD-only coverage is legitimate. Source speeds and stored BIN values are separate; Reviewed BIN metadata is scoped to ${escape(BIN_METADATA_SCOPE)}. Known limits use km/h; zero means unavailable, and unclassified values remain raw. Type labels describe whole raw categories; linked endpoints have no inferred start/end role. OPP lines show endpoint connectors, not verified road routes.</p><p>Candidate radius: ${report.tolerance.endpointMetres} m. Range tolerance: both endpoints within that radius and span difference at most the greater of ${report.tolerance.spanMetresMinimum} m or ${report.tolerance.spanFraction*100}%; uncertain orientation stays under review. Road, direction and vehicle/time-specific limits need independent evidence.</p><h2>Inputs and import checks</h2><pre>${escape(JSON.stringify({inputs:report.inputs,importVerification:report.importVerification,currentProjectBuild:report.currentProjectBuild,scope:report.scope,counts:report.counts,speed:speedCounts(report.speed)},null,2))}</pre><h2>Geometric evidence map</h2><p>For detailed pan/zoom, open comparison.geojson through the existing application’s GeoJSON import with a separate audit namespace and the accompanying attribution. It imports as reference-only analysis evidence; comparison statuses are not operational statuses. Keep NOTICE.json with derived exports.</p><p>Green: unique spatial candidate; orange: ambiguous; purple: range review; red: CANARD-only; grey: in-scope Mio records with no candidate; blue: candidate Mio points/endpoint pairs. Click a CANARD marker/connector to reach its row. Full JSON/GeoJSON files retain candidate evidence and broken links; the CSV review table includes Mio-only coverage. bin-speed-inventory.csv covers every active BIN record, including foreign points outside the CANARD comparison scope.</p><svg viewBox="0 0 1000 700" role="img" aria-label="Geometric candidate map; OPP connectors are not road routes">${boundary}${mioLines}${dots}${[...candidateShapes.values()].join('')}${shapes}</svg><h2>CANARD observations</h2><div class="table"><table><thead><tr>${['Category','Source ID','Source coordinates','Candidate status','Source speed (km/h)','Candidate / stored BIN speed','BIN type code','Endpoint distance (m)','Range evidence'].map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${table}</tbody></table></div><h2>Mio-only coverage</h2><p>No spatial/range candidate under the stated tolerances; these are not automatic source or importer failures. Border uncertainty remains explicit in the JSON scope evidence.</p><div class="table"><table><thead><tr><th>Record ID</th><th>BIN type code</th><th>Stored BIN speed</th><th>Coordinates</th></tr></thead><tbody>${mioTable}</tbody></table><table><thead><tr><th>Pair ID</th><th>Endpoint IDs</th><th>Stored BIN speeds</th><th>Endpoint coordinates</th><th>Connector span (m)</th></tr></thead><tbody>${mioSections}</tbody></table></div><h2>Existing project bindings</h2><p>Manual coordinates and deletions remain protected. A fresh BIN has no bindings; this section audits bindings present in a supplied project. Geometric consistency is not identity proof.</p><div class="table"><table><thead><tr><th>Source ID</th><th>Record ID</th><th>Status</th><th>Ownership</th><th>BIN coordinates</th><th>Source geometry</th><th>Metadata differences</th></tr></thead><tbody>${bindings}</tbody></table></div><h2>Attribution</h2><pre>${escape(JSON.stringify({sourceNotices:report.sourceNotices,boundaryNotice:report.boundaryNotice},null,2))}</pre></html>\n`;
}
