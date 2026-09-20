// LZString bitstream algorithm adapted from pieroxy/lz-string 1.5.0 (MIT).
// Copyright (c) 2013 pieroxy. See ../LICENSES/lz-string-MIT.txt.
// Deliberately bounded before growing output/dictionary, unlike upstream decode.
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export function decodeBase64Bounded(input,maxOutputBytes=20*1024*1024){
 if(!Number.isSafeInteger(maxOutputBytes)||maxOutputBytes<1||maxOutputBytes>20*1024*1024)fail('CANARD_DECODE_LIMIT');
 if(typeof input!=='string'||input.length>20*1024*1024)fail('CANARD_DECODE_LIMIT');
 if(!input.length||input.length%4||!/^[A-Za-z0-9+/]+={0,3}$/.test(input))fail('CANARD_INVALID_COMPRESSION');
 const stream=input.replace(/=+$/,'');let bit=0;
 function read(n){
  if(n>25||bit+n>stream.length*6)fail('CANARD_INVALID_COMPRESSION');
  let value=0;
  for(let i=0;i<n;i++,bit++)value+=((alphabet.indexOf(stream[Math.floor(bit/6)])>>(5-bit%6))&1)*2**i;
  return value;
 }
 const dictionary=[];let dictionaryUnits=0;
 function add(value){
  if(dictionary.length>maxOutputBytes||dictionaryUnits+value.length>maxOutputBytes*2)fail('CANARD_DECODE_LIMIT');
  dictionaryUnits+=value.length;dictionary.push(value);
 }
 let first=read(2);
 if(first===2)return '';
 if(first>1)fail('CANARD_INVALID_COMPRESSION');
 let w=String.fromCharCode(read(first===0?8:16));
 dictionary.length=3;add(w);
 const out=[w];let units=w.length,width=3,remaining=4;
 while(true){
  let code=read(width);
  if(code===2){
   const value=out.join('');
   if(!value.isWellFormed())fail('CANARD_INVALID_COMPRESSION');
   if(new TextEncoder().encode(value).length>maxOutputBytes)fail('CANARD_DECODE_LIMIT');
   return value;
  }
  if(code===0||code===1){add(String.fromCharCode(read(code===0?8:16)));code=dictionary.length-1;remaining--;}
  if(remaining===0){remaining=2**width;width++;}
  let entry=dictionary[code];
  if(entry===undefined){if(code!==dictionary.length)fail('CANARD_INVALID_COMPRESSION');entry=w+w[0];}
  if(typeof entry!=='string'||units+entry.length>maxOutputBytes)fail('CANARD_DECODE_LIMIT');
  units+=entry.length;out.push(entry);add(w+entry[0]);remaining--;w=entry;
  if(remaining===0){remaining=2**width;width++;}
 }
}
