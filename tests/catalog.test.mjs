import assert from 'node:assert/strict';
import{filterCatalog,graphLayout,isMap,readPreferences,sourceOf}from '../scripts/catalog-core.mjs';
const level=src=>({get:()=>({background:{src}}),contents:[{background:{src}}]});
const folder={id:'forest',name:'Первый лес'},art={id:'art',name:'Личные материалы',folder:null};
const scenes=[{id:'a',name:'Старый дом',folder,levels:level('a.png'),flags:{'margora-passages':{tags:['убежище']}},_stats:{modifiedTime:10}},{id:'b',name:'Маяк',folder,levels:level('b.png'),_stats:{modifiedTime:30}},{id:'c',name:'Болото',levels:level('c.png'),_stats:{modifiedTime:20}},{id:'portrait',name:'Портрет',folder:art,levels:level('p.png')}];
const links=[{id:'ab',a:{sceneId:'a'},b:{sceneId:'b'}},{id:'bc',a:{sceneId:'b'},b:{sceneId:'c'}}];
const tests=[];function test(name,fn){fn();tests.push(name);}
test('Search combines words from title, folder and tags',()=>{assert.deepEqual(filterCatalog(scenes,{query:'ЛЕС убежище'}).map(s=>s.id),['a']);assert.deepEqual(filterCatalog(scenes,{query:'  старый    дом '}).map(s=>s.id),['a']);});
test('Tag and recent sort are independent',()=>{assert.equal(filterCatalog(scenes,{tag:'убежище'})[0].id,'a');assert.equal(filterCatalog(scenes,{sort:'recent'})[0].id,'b');});
test('Route sort places busiest maps first',()=>{assert.equal(filterCatalog(scenes,{sort:'routes',routes:links})[0].id,'b');});
test('Nested personal materials stay out of map catalog',()=>{assert(isMap(scenes[0]));assert(!isMap(scenes[3]));assert(!isMap({...scenes[3],folder:{id:'child',name:'НиПы',folder:art}}));assert(!isMap({name:'Token',levels:level(null)}));});
test('Unknown tag shape does not break catalog',()=>{assert.doesNotThrow(()=>filterCatalog([{...scenes[0],flags:{'margora-passages':{tags:{bad:true}}}}]));});
test('Graph layout keeps connected components together without losing isolates',()=>{const layout=graphLayout(scenes,links);assert.equal(Object.keys(layout).length,4);assert.equal(layout.a.y,layout.b.y);assert.equal(layout.b.y,layout.c.y);assert(layout.portrait.y>layout.a.y);assert.equal(new Set(Object.values(layout).map(p=>p.x+','+p.y)).size,4);});
test('Internal and repeated links do not duplicate graph nodes',()=>{const result=graphLayout(scenes,[...links,...links,{a:{sceneId:'a'},b:{sceneId:'a'}}]);assert.equal(Object.keys(result).length,4);});
test('Corrupted preferences recover to safe defaults',()=>{const p=readPreferences({getItem:()=>'{bad'},'x');assert.equal(p.sort,'name');assert.equal(p.density,'grid');assert.deepEqual(p.favorites,[]);const q=readPreferences({getItem:()=>JSON.stringify({sort:'other',density:'list',favorites:['a',3,null]})},'x');assert.deepEqual(q,{sort:'name',density:'list',favorites:['a']});});
test('Missing source documents do not throw',()=>{assert.equal(sourceOf(null),null);assert.equal(sourceOf({levels:[]}),null);});
console.log(JSON.stringify({passed:tests.length,tests},null,2));
