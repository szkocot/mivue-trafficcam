import en from './locales/en.js';
import pl from './locales/pl.js';
export function createI18n({languages=globalThis.navigator?.languages??['en'],storage}={}){
 let language=languages[0]?.toLowerCase().startsWith('pl')?'pl':'en';
 try{const saved=storage?.getItem('mivue-language');if(['pl','en'].includes(saved))language=saved;}catch{}
 return {get language(){return language;},setLanguage(next){if(!['pl','en'].includes(next))return;language=next;try{storage?.setItem('mivue-language',next);}catch{}},
  t(key,params={}){const dict=language==='pl'?pl:en;return (dict[key]??dict.diagnostic.replace('{code}',key)).replace(/\{(\w+)\}/g,(_,k)=>params[k]??`{${k}}`);}};
}
