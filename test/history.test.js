import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFixture } from './helpers/fixture.js';
import { createProject } from '../src/project.js';
import { createHistory } from '../src/history.js';

test('history shares source, undo/redo advances revisions, new edit removes redo',async()=>{
 const p=await createProject(makeFixture([{}]).bytes), h=createHistory(p), id=p.records[0].id;
 h.apply({kind:'update',id,changes:{latitude:37.1}});
 assert.strictEqual(h.current.source,p.source);
 h.undo(); assert.strictEqual(h.current,p);
 h.redo(); assert.equal(h.current.records[0].edits.latitude,37.1); assert.equal(h.revision,3);
 h.undo(); h.apply({kind:'delete',id}); assert.equal(h.canRedo,false);
 const revision=h.revision;
 assert.throws(()=>h.apply({kind:'update',id,changes:{latitude:100}}));
 assert.equal(h.revision,revision);
});
test('50 undo states retained; reset removes clones and all history using embedded baseline',async()=>{
 const p=await createProject(makeFixture([{}]).bytes), h=createHistory(p), id=p.records[0].id;
 for(let n=0;n<55;n++) h.apply({kind:'update',id,changes:{latitude:37+n/1000}});
 for(let n=0;n<50;n++) h.undo();
 assert.equal(h.canUndo,false); assert.equal(h.current.records[0].edits.latitude,37.004);
 h.apply({kind:'clone',templateId:id,latitude:38,longitude:-7});
 await h.reset(); assert.deepEqual(h.current,p); assert.equal(h.canUndo,false); assert.equal(h.canRedo,false);
});
