import assert from 'node:assert/strict';
import {PassageStore,overlap,dims,clone}from '../scripts/core.mjs';
import {isPlaced,setupIssues,adjacentArrival,pointName}from '../scripts/ux-core.mjs';
const scene={id:'tower',name:'Tower',grid:{size:100},dimensions:{sceneX:400,sceneY:300,sceneWidth:1536,sceneHeight:1024},levels:new Map([['level',{id:'level'}]])};scene.levels.contents=[...scene.levels.values()];
const scenes=new Map([[scene.id,scene]]);let n=0;const store=new PassageStore({scenes,randomID:()=>String(++n).padStart(16,'0')});
const tests=[];function test(name,fn){fn();tests.push(name);}
test('Unchanged starter zones are visibly incomplete',()=>{const link=store.freshInternal(scene);assert.equal(isPlaced(link,'a',scenes),false);assert.equal(isPlaced(link,'b',scenes),false);assert.equal(setupIssues(link,scenes).length,2);});
test('Native pixel rounding does not mark starter zones as placed',()=>{const link=store.freshInternal(scene);link.a.exit.x+=.4/1536;assert.equal(isPlaced(link,'a',scenes),false);});
test('Previously edited links are recognized without new flags',()=>{const link=store.freshInternal(scene);link.a.exit.x=.3;link.b.exit.x=.5;assert.equal(setupIssues(link,scenes).length,0);});
test('Automatic arrival stays in map, outside both exits, at all edges',()=>{for(const[x,y]of [[0,0],[.88,0],[0,.85],[.88,.85],[.3,.4]]){const link=store.freshInternal(scene);link.a.exit={x,y,w:.1,h:.1};const a=adjacentArrival(link,'a',scene),d=dims(scene);assert(a.x>=0&&a.y>=0&&a.x+a.w<=1&&a.y+a.h<=1);assert(!overlap(a,link.a.exit,50/d.w,50/d.h));assert(!overlap(a,link.b.exit,50/d.w,50/d.h));}});
test('Endpoint names have readable defaults and trim user labels',()=>{const link=store.freshInternal(scene);assert.equal(pointName(link,'a'),'Этаж 1');link.a.label=' Подвал ';assert.equal(pointName(link,'a'),'Подвал');link.a.label=' ';assert.equal(pointName(link,'a'),'Этаж 1');});
test('Arrival suggestions do not mutate the link before acceptance',()=>{const link=store.freshInternal(scene),before=clone(link);adjacentArrival(link,'a',scene);assert.deepEqual(link,before);});
console.log(JSON.stringify({passed:tests.length,tests},null,2));
