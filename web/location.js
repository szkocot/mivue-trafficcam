/** One-shot browser location. No persistence, tracking, or project mutations. */
export function createLocation({geolocation,secureContext,onState,onPosition,onClear}) {
  let token=0,pending=false,destroyed=false;
  const state=code=>onState({code});
  const invalidate=()=>{token++;pending=false;};
  return {
    locate(){
      if(destroyed||pending)return;
      if(!secureContext){state('insecure');return;}
      if(typeof geolocation?.getCurrentPosition!=='function'){state('unsupported');return;}
      const request=++token;pending=true;state('pending');
      const current=()=>!destroyed&&pending&&request===token;
      const fail=error=>{
        if(!current())return;
        pending=false;
        state(({1:'denied',2:'unavailable',3:'timeout'})[error?.code]??'unavailable');
      };
      try {
        geolocation.getCurrentPosition(position=>{
          if(!current())return;
          const {latitude,longitude,accuracy}=position?.coords??{},timestamp=position?.timestamp;
          if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180
            ||!Number.isFinite(accuracy)||accuracy<0||!Number.isFinite(timestamp)||!Number.isFinite(new Date(timestamp).getTime())){
            fail({code:2});return;
          }
          pending=false;onPosition({latitude,longitude,accuracy,timestamp});state('located');
        },fail,{enableHighAccuracy:true,maximumAge:0,timeout:15000});
      }catch{fail({code:2});}
    },
    cancel(){if(destroyed)return;invalidate();state('idle');},
    clear(){if(destroyed)return;invalidate();onClear();state('idle');},
    destroy(){if(destroyed)return;invalidate();destroyed=true;onClear();}
  };
}
