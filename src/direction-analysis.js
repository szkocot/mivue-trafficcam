import {BIN_METADATA_SCOPE} from './bin-metadata.js';

const normalized=value=>typeof value==='string'?value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' '):'';
const chainage=value=>['ros','rosnacy','pikietaz rosnacy'].includes(normalized(value))?'increasing':['mal','malejacy','pikietaz malejacy'].includes(normalized(value))?'decreasing':'unknown';
const capture=value=>{
 const text=normalized(value);
 if(['najazd','pojazdy zblizajace sie','zblizajace sie'].includes(text))return 'approach';
 if(['odjazd','pojazdy oddalajace sie','oddalajace sie','oddalajace'].includes(text))return 'departure';
 if(['najazd i odjazd','najazd/odjazd','pojazdy zblizajace sie i oddalajace sie'].includes(text))return 'both';
 return 'unknown';
};
const passengerLimit=row=>{
 const text=typeof row?.limitOsobowe==='string'?row.limitOsobowe.trim():'';
 const value=/^\d+(?:\.\d+)?$/.test(text)?Number(text):NaN;
 return Number.isFinite(value)&&value>0?value:null;
};

/** Caller selects associated/selected records; no proximity matching or optical-azimuth inference. */
export function analyzeDirections(reference={}, {records=[]}={}){
 const raw=reference.originalProperties?.canardDetail?.raw,device=raw?.urzadzenie;
 const sourceTravelDirections=(Array.isArray(raw?.limity)?raw.limity:[]).flatMap((row,rowIndex)=>{
  const limitKmh=passengerLimit(row);if(limitKmh===null)return [];
  const label=typeof row.typ?.kierunek==='string'?row.typ.kierunek:'';
  const chainageRaw=typeof row.typ?.kierunekPikietazu==='string'?row.typ.kierunekPikietazu:null;
  return [{rowIndex,label,captureMode:capture(label),limitKmh,chainageRaw,chainage:chainage(chainageRaw)}];
 });
 const modes=new Set(sourceTravelDirections.map(row=>row.captureMode));
 const sourceCaptureMode=!modes.size||modes.has('unknown')?'unknown':modes.size>1||modes.has('both')?'both':[...modes][0];
 const mastRaw=typeof device?.masztKierunekPomiaru==='string'?device.masztKierunekPomiaru:null,mastDirection=chainage(mastRaw);
 const limitDirections=sourceTravelDirections.map(row=>({rowIndex:row.rowIndex,raw:row.chainageRaw,direction:row.chainage}));
 const conflict=mastDirection!=='unknown'&&limitDirections.some(row=>row.direction!=='unknown'&&row.direction!==mastDirection);
 const mioAlertBearings=records.map(record=>{
  const headingRaw=record.rawBytes16To19?.[1]??null,modeRaw=record.rawBytes16To19?.[3]??null;
  const known=!record.deleted&&[1,3,5,964,9128].includes(record.typeRaw)&&modeRaw===1&&Number.isInteger(headingRaw)&&headingRaw>=0&&headingRaw<=179;
  return {recordId:record.id??(Number.isInteger(record.offset)?`source:${record.offset}`:null),headingRaw,modeRaw,typeRaw:record.typeRaw??null,bearingDegrees:known?2*headingRaw:null,scope:BIN_METADATA_SCOPE};
 });
 // A road-axis estimate is not the actual optical axis of a roadside camera.
 const roadAxisAimEstimates=['approach','departure'].includes(sourceCaptureMode)?mioAlertBearings.filter(row=>row.bearingDegrees!==null).map(row=>({recordId:row.recordId,bearingDegrees:(row.bearingDegrees+(sourceCaptureMode==='approach'?180:0))%360,captureMode:sourceCaptureMode,basis:'road-axis-derived'})):[];
 const issues=['PHYSICAL_AIM_UNKNOWN'];
 if(conflict)issues.push('ROW_MAST_CHAINAGE_CONFLICT');
 if(sourceCaptureMode==='unknown')issues.push('CAR_CAPTURE_MODE_UNKNOWN');
 if(mioAlertBearings.some(row=>row.bearingDegrees===null))issues.push('MIO_ALERT_UNCLASSIFIED');
 if(roadAxisAimEstimates.length)issues.push('ROAD_AXIS_ESTIMATE_ONLY');
 return {sourceTravelDirections,sourceCaptureMode,sourceNamedDirections:[...new Set([device?.nazwaKierunku1,device?.nazwaKierunku2].filter(value=>typeof value==='string'&&value.trim()))],
  sourceChainage:{mastRaw,mastDirection,limitDirections,conflict},mioAlertBearings,physicalAim:{status:'unknown',bearingDegrees:null},roadAxisAimEstimates,issues};
}
