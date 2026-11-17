import assert from 'node:assert/strict';
import{neighborsOf,canPlace,relativePosition,normalizePositions}from '../scripts/manual-graph-core.mjs';
const scenes=new Map(['camp','quarantine','road','bridge','house','lighthouse','tower'].map(id=>[id,{id,name:id}]));
const pairs=[['camp','quarantine'],['camp','road'],['road','bridge'],['bridge','house'],['house','lighthouse'],['tower','tower']];const links=pairs.map(([a,b],i)=>({id:String(i),a:{sceneId:a},b:{sceneId:b}}));const tests=[];function test(name,fn){fn();tests.push(name);}
test('Camp proposes only quarantine and road',()=>assert.deepEqual(neighborsOf('camp',links,scenes).map(n=>n.scene.id),['quarantine','road']));
test('Quarantine is a dead-end branch back to camp',()=>assert.deepEqual(neighborsOf('quarantine',links,scenes).map(n=>n.scene.id),['camp']));
test('Road proposes bridge and camp, not house or lighthouse',()=>assert.deepEqual(neighborsOf('road',links,scenes).map(n=>n.scene.id),['bridge','camp']));
test('Multiple passages to one scene create one suggestion',()=>{const result=neighborsOf('camp',[...links,links[0]],scenes);assert.equal(result.length,2);assert.equal(result.find(n=>n.scene.id==='quarantine').links.length,2);});
test('Internal passage does not propose a duplicate scene',()=>assert.equal(neighborsOf('tower',links,scenes).length,0));
test('Placement and normalization preserve relative distances',()=>{const positions={a:{x:50,y:100},b:relativePosition({x:50,y:100},'left')};assert.equal(canPlace(positions.b,{a:positions.a}),true);const dx=positions.a.x-positions.b.x;normalizePositions(positions);assert.equal(positions.a.x-positions.b.x,dx);assert(Object.values(positions).every(p=>p.x>=60&&p.y>=100));});
test('Overlapping placement is rejected without changing saved links',()=>{const before=JSON.stringify(links);assert.equal(canPlace({x:120,y:120},{a:{x:100,y:100}}),false);neighborsOf('camp',links,scenes);assert.equal(JSON.stringify(links),before);});
console.log(JSON.stringify({passed:tests.length,tests},null,2));
