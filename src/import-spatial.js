const earth=6371008.8,rad=Math.PI/180;
function xyz([lon,lat]){const c=Math.cos(lat*rad);return [earth*c*Math.cos(lon*rad),earth*c*Math.sin(lon*rad),earth*Math.sin(lat*rad)];}
/** 100m cube index on the sphere: handles poles and the dateline without special cases. */
export function createProximityIndex(){
 const cells=new Map();
 const grid=p=>p.map(v=>Math.floor(v/100));
 return {
  add(coordinates,key){if(!coordinates.every(Number.isFinite))return;const p=xyz(coordinates),cell=grid(p).join(',');if(!cells.has(cell))cells.set(cell,[]);cells.get(cell).push({p,key});},
  hasNearby(coordinates,ownKey){const p=xyz(coordinates),g=grid(p);
   for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
    for(const candidate of cells.get([g[0]+x,g[1]+y,g[2]+z].join(','))??[]){
     if(candidate.key===ownKey)continue;
     const chord=Math.hypot(...p.map((v,i)=>v-candidate.p[i]));
     if(2*earth*Math.asin(Math.min(1,chord/(2*earth)))<=100)return true;
    }
   }return false;
  }
 };
}
