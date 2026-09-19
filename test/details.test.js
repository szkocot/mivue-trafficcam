import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCoordinate,parseRawBytes } from '../web/details.js';
test('coordinates accept decimal commas but reject partial numbers and out of range',()=>{
 assert.equal(parseCoordinate(' -52,123 ',90),-52.123);
 for(const text of ['', '1e2','37junk','90.1','1,2.3','1 000'])assert.throws(()=>parseCoordinate(text,90));
 assert.deepEqual(parseRawBytes('0, 255, 1, 2'),[0,255,1,2]);
 for(const text of ['1,2,3','1,2,3,256','1,2,3,4.5','1,,2,3,4'])assert.throws(()=>parseRawBytes(text));
});
