import {readFileSync} from 'node:fs';
import lz from 'lz-string';
export const review=JSON.parse(readFileSync(new URL('../../config/canard-review.json',import.meta.url)));
export const retrievedAt='2026-09-20T10:22:00.000Z';
export function makeCanardLayers(){
 const point={id:1,lon:21,lat:52,rodzajPomiaru:'PP',nrSeryjny:'TEST-1',lok2PktDlugosc:null,lok2PktSzerokosc:null};
 return {PP:[{...point}],OPP:[{...point,rodzajPomiaru:'PO',lok2PktDlugosc:21.1,lok2PktSzerokosc:52.1}],RL:[{...point,rodzajPomiaru:'PC'}],PK:null};
}
export function makeCanardHtml(layers=makeCanardLayers()){
 const names={PP:'fotoradaryPP',OPP:'fotoradaryOPP',RL:'fotoradaryRL',PK:'punktyKontrolne'};
 return `<script>const map={${Object.entries(layers).map(([key,value])=>`${names[key]}:${JSON.stringify(value===null?'[{}]':lz.compressToBase64(JSON.stringify(value)))}`).join(',')}};</script>`;
}
