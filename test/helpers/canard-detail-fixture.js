// Synthetic public-detail schema; no downloaded certificates or device records.
export function makeCanardDetail(category='PP',id=1,limits=[]){
 return {id,rodzaj:'URZADZENIE',lon:21,lat:52,urzadzenie:{id,rodzajPomiaru:{PP:'PP',OPP:'PO',RL:'PC'}[category],lokalizacjaAdresMiejscowosc:'Example'},limity:limits,
  swiadectwaLegalizacji:[],jestStatystyka:false,jestLimit:limits.length>0,brdW1DaneZOkresu:[]};
}
export const detailRow=(passenger,truck='20',conditions={})=>({limitOsobowe:passenger,limitCiezarowe:truck,typ:{kierunek:'',godziny:'',kierunekPikietazu:'NIEOKRESLONY',...conditions}});
