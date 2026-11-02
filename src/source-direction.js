const display=values=>{
 const unique=[...new Set(values.filter(value=>typeof value==='string'&&value.trim()))];
 if(!unique.length)return null;
 const text=unique.slice(0,6).join(' / ');
 return text.length>240?text.slice(0,240)+'…':text+(unique.length>6?'…':'');
};
const rawDetail=r=>r.originalProperties?.canardDetail?.raw;
const limitRows=raw=>Array.isArray(raw?.limity)?raw.limity:[];
export function sourceChainageLabel(reference){
 const raw=rawDetail(reference);
 return display(limitRows(raw).map(row=>row?.typ?.kierunekPikietazu));
}
export function sourceMastDirectionLabel(reference){
 return display([rawDetail(reference)?.urzadzenie?.masztKierunekPomiaru]);
}
/** Named source directions and road chainage are evidence, not inferred compass bearings. */
export function sourceDirectionLabel(reference,t){
 const raw=rawDetail(reference),named=display([...limitRows(raw).map(row=>row?.typ?.kierunek),raw?.urzadzenie?.nazwaKierunku1,raw?.urzadzenie?.nazwaKierunku2]);
 const bearing=Number.isFinite(reference.direction)&&reference.direction>=0&&reference.direction<360?`${reference.direction}°`:null;
 if(bearing||named)return [bearing,named].filter(Boolean).join(' · ');
 const chainage=sourceChainageLabel(reference);
 if(chainage)return `${t('roadChainage')}: ${chainage}`;
 const mast=sourceMastDirectionLabel(reference);
 return mast?`${t('mastDirection')}: ${mast}`:t('valueUnknown');
}
