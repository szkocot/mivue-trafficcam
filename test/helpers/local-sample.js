import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Pin both inspected private downloads; never infer expectations from the parser.
export function sampleExpectations(bytes){
 const hash=createHash('sha256').update(bytes).digest('hex');
 const samples={
  '2f01485c4d9910c9b9dce7fdc9355c3f8293e396d687526873c8537a4e0317f0':{records:52935,populated:898,links:[
    [909920, 809938], [910032, 809574], [988856, 810470], [1023776, 988922],
    [1062504, 1023898], [1205780, 1235846], [1227652, 1299774], [1227960, 1299578],
    [1228492, 1273570], [1267224, 1285670], [1278484, 1282426], [1312772, 1157548], [1422122, 1466214],
  ]},
  '69759a67d9442bfa1a636c38ccbc16623a2208ef34564e11f68ad0d696becdb1':{records:53338,populated:897,links:[
   [921988,821950],[922100,821586],[1000140,822482],[1034500,1000206],
   [1072780,1034594],[1215972,1246374],[1238068,1310386],[1238376,1310190],
   [1238908,1284546],[1278060,1296450],[1289264,1293122],[1323048,1166928],[1432510,1477554],
  ]},
 };
 assert.ok(Object.hasOwn(samples,hash),'Sample differs from inspected files');
 return samples[hash];
}
