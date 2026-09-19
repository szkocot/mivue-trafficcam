import test from 'node:test';
import assert from 'node:assert/strict';
import { createI18n } from '../web/i18n.js';
import en from '../web/locales/en.js';
import pl from '../web/locales/pl.js';
test('PL/EN parity, language detection, preference and denied storage fallback',()=>{
 assert.deepEqual(Object.keys(en).sort(),Object.keys(pl).sort());
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 const i=createI18n({languages:['pl-PL'],storage});assert.equal(i.language,'pl');
 i.setLanguage('en');assert.equal(i.t('open'),'Open file');
 assert.equal(createI18n({languages:['pl'],storage}).language,'en');
 assert.equal(createI18n({languages:['fr'],storage:{getItem(){throw Error();}}}).language,'en');
});
