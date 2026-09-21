import {countryFail} from './country-data.js';
const RAD=Math.PI/180,R=6371008.8,BAND=1000/R;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=a=>Math.hypot(...a),unit=a=>{const n=length(a);return n?a.map(x=>x/n):a;};
const vector=([lon,lat])=>{const c=Math.cos(lat*RAD);return [c*Math.cos(lon*RAD),c*Math.sin(lon*RAD),Math.sin(lat*RAD)];};
const angle=(a,b)=>Math.atan2(length(cross(a,b)),dot(a,b));
const bucket=lat=>Math.max(0,Math.min(179,Math.floor(lat+90)));
const shift=(lon,mid)=>lon+360*Math.round((mid-lon)/360);
function ringIndex(raw){
 const points=[raw[0].slice()];
 for(const p of raw.slice(1))points.push([shift(p[0],points.at(-1)[0]),p[1]]);
 if(Math.abs(points.at(-1)[0]-points[0][0])>180){
  const pole=raw.reduce((s,p)=>s+p[1],0)/raw.length<0?-90:90;
  points.push([points.at(-1)[0],pole],[points[0][0],pole],points[0]);
 }
 let west=Infinity,east=-Infinity,south=90,north=-90;const rows=Array.from({length:180},()=>[]);
 for(const p of points){west=Math.min(west,p[0]);east=Math.max(east,p[0]);south=Math.min(south,p[1]);north=Math.max(north,p[1]);}
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];for(let j=bucket(Math.min(a[1],b[1]));j<=bucket(Math.max(a[1],b[1]));j++)rows[j].push([a,b]);}
 return {west,east,south,north,rows};
}
function contains(r,lon,lat){
 if(lat<r.south||lat>r.north)return false;const x=shift(lon,(r.west+r.east)/2);if(x<r.west||x>r.east)return false;
 let inside=false;for(const [a,b]of r.rows[bucket(lat)])if((a[1]>lat)!==(b[1]>lat)&&x<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 return inside;
}
function closeToSegment(p,s){
 if(length(s.normal)<1e-12)return angle(p,s.a)<=BAND;
 const crossTrack=dot(p,s.normal);if(Math.abs(crossTrack)>Math.sin(BAND))return false;
 const q=unit(p.map((x,i)=>x-crossTrack*s.normal[i]));
 if(length(q)&&dot(cross(s.a,q),s.normal)>=-1e-14&&dot(cross(q,s.b),s.normal)>=-1e-14)return true;
 return Math.min(angle(p,s.a),angle(p,s.b))<=BAND;
}
/** Planar unwrapped membership; spherical 1km ring review. No survey accuracy claim. */
export function createCountryClassifier({dataset,manifest}){
 const polygons=Array.from({length:180},()=>[]),segments=Array.from({length:180},()=>[]);
 for(const c of dataset.countries)for(const p of c.geometry.type==='Polygon'?[c.geometry.coordinates]:c.geometry.coordinates){
  const rings=p.map(ringIndex),outer=rings[0];
  for(let j=bucket(outer.south);j<=bucket(outer.north);j++)polygons[j].push({id:c.id,rings});
  for(const ring of p)for(let i=1;i<ring.length;i++){
   const a=vector(ring[i-1]),b=vector(ring[i]),arc=angle(a,b),normal=unit(cross(a,b));
   // Angular arc length bounds latitude excursion; longitude needs a polar guard.
   const pad=(arc+BAND)/RAD,low=Math.min(ring[i-1][1],ring[i][1])-pad,high=Math.max(ring[i-1][1],ring[i][1])+pad;
   const x=ring[i-1][0],y=shift(ring[i][0],x),cos=Math.cos(Math.min(90,Math.max(Math.abs(low),Math.abs(high)))*RAD);
   const lonPad=cos<1e-6?360:Math.min(360,pad/cos);
   const s={id:c.id,a,b,normal,west:Math.min(x,y)-lonPad,east:Math.max(x,y)+lonPad};
   for(let j=bucket(low);j<=bucket(high);j++)segments[j].push(s);
  }
 }
 function classify({latitude:lat,longitude:lon}){
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return {status:'invalid',countryIds:[]};
  const inside=new Set(),near=new Set(),row=bucket(lat),v=vector([lon,lat]);
  for(const p of polygons[row])if(contains(p.rings[0],lon,lat)&&!p.rings.slice(1).some(r=>contains(r,lon,lat)))inside.add(p.id);
  for(const s of segments[row]){const x=shift(lon,(s.west+s.east)/2);if(x>=s.west&&x<=s.east&&closeToSegment(v,s))near.add(s.id);}
  const countryIds=[...new Set([...inside,...near])].sort();
  return {status:near.size||inside.size>1?'border':inside.size===1?'assigned':'unassigned',countryIds};
 }
 return {countries:dataset.countries.map(({id,iso2,names})=>({id,iso2,names})),boundary:{release:manifest.release,sha256:manifest.sha256},classify,
  async classifyMany(items,{signal,yieldControl=()=>new Promise(r=>setTimeout(r,0))}={}){
   const out=new Map();for(let i=0;i<items.length;i++){
    if(signal?.aborted)countryFail('COUNTRY_CANCELLED');
    if(typeof items[i].id!=='string'||out.has(items[i].id))countryFail('COUNTRY_DATA_INVALID');
    out.set(items[i].id,classify(items[i]));
    if((i+1)%256===0){await yieldControl();if(signal?.aborted)countryFail('COUNTRY_CANCELLED');}
   }if(signal?.aborted)countryFail('COUNTRY_CANCELLED');return out;
  }};
}
