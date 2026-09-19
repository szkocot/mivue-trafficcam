import { hasPosition } from './project-view.js';

export function filterView(view,filters={}) {
  const query=(filters.query??'').trim().toLocaleLowerCase();
  return view.records.filter(r=>{
    if(!filters.showDeleted && r.deleted) return false;
    if(filters.changedOnly && !r.changed) return false;
    if(filters.warningsOnly && !r.diagnostics.length) return false;
    if(filters.typeRaw != null && filters.typeRaw !== '' && r.typeRaw !== Number(filters.typeRaw)) return false;
    if(query && !`${r.id} ${JSON.stringify(r.provenance)}`.toLocaleLowerCase().includes(query)) return false;
    const b=filters.viewport;
    if(b && (!hasPosition(r) || r.latitude<b.south || r.latitude>b.north
      || !(b.west<=b.east ? r.longitude>=b.west && r.longitude<=b.east : r.longitude>=b.west || r.longitude<=b.east))) return false;
    return true;
  });
}
export function pageRecords(records,page,pageSize=100) {
  const pageCount=Math.max(1,Math.ceil(records.length/pageSize));
  page=Math.max(1,Math.min(pageCount,Math.floor(page)||1));
  return {records:records.slice((page-1)*pageSize,page*pageSize),page,pageCount,total:records.length};
}
export function aggregatePoints(points,cellSize=40) {
  const groups=new Map();
  for(const p of points){
    const key=`${Math.floor(p.x/cellSize)}:${Math.floor(p.y/cellSize)}`;
    const g=groups.get(key)??{x:0,y:0,ids:[]};
    g.x+=p.x;g.y+=p.y;g.ids.push(p.id);groups.set(key,g);
  }
  return [...groups.values()].map(g=>({...g,x:g.x/g.ids.length,y:g.y/g.ids.length}));
}
