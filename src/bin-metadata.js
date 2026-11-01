// Read-only evidence scope: docs/binary-reader-followup-2026-11-01.md.
export const BIN_METADATA_SCOPE = 'MiVue 955W VF538.10.20.BE1AD.18';
const speeds = new Set([10,15,20,25,30,32,35,40,48,50,60,64,70,80,90,97,100,110,113,120,130,140]);
const types = new Map([[1,'camera'],[3,'red-light'],[5,'mobile'],[964,'linked-section'],[9128,'linked-section']]);

export function decodeBinSpeed(raw) {
 const known=speeds.has(raw);
 return {raw,status:raw===0?'unspecified':known?'known':'unclassified',speedKmh:known?raw:null};
}
export function decodeBinType(raw) {
 return {raw,kind:types.get(raw)??'unclassified'};
}
export function binSpeedLabel(raw,t) {
 const speed=decodeBinSpeed(raw);
 return `${speed.status==='known'?`${speed.speedKmh} km/h`:t(`binSpeed_${speed.status}`)} · BIN ${raw}`;
}
export function binTypeLabel(raw,t) {
 return `${t(`binKind_${decodeBinType(raw).kind}`)} · BIN ${raw}`;
}
