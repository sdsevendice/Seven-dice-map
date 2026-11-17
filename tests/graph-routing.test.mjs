import assert from 'node:assert/strict';
import{routeEdge,crossesRect}from '../scripts/graph-routing.mjs';
const tests=[];function test(name,fn){fn();tests.push(name);}
const nodes=[{id:'road',x:65,y:105},{id:'bridge',x:350,y:105},{id:'camp',x:635,y:105},{id:'house',x:920,y:105},{id:'quarantine',x:65,y:280},{id:'lighthouse',x:350,y:280}];
const rect=n=>({left:n.x,right:n.x+220,top:n.y,bottom:n.y+88});
function check(route,a,b,all){assert(route);for(const n of all.filter(n=>n.id!==a.id&&n.id!==b.id))for(let i=1;i<route.points.length;i++)assert(!crossesRect(route.points[i-1],route.points[i],rect(n)),'Crossed unrelated node '+n.id);}
test('Bridge to house never crosses the intervening camp',()=>check(routeEdge(nodes[1],nodes[3],nodes),nodes[1],nodes[3],nodes));
test('Road to camp never crosses bridge',()=>check(routeEdge(nodes[0],nodes[2],nodes),nodes[0],nodes[2],nodes));
test('House to lighthouse avoids camp and bridge',()=>check(routeEdge(nodes[3],nodes[5],nodes),nodes[3],nodes[5],nodes));
test('Endpoints touch intended node boundaries rather than centers',()=>{const r=routeEdge(nodes[1],nodes[3],nodes);for(const[p,n]of[[r.points[0],nodes[1]],[r.points.at(-1),nodes[3]]])assert(p.x===n.x||p.x===n.x+220||p.y===n.y||p.y===n.y+88);});
test('Parallel connections have different ports and paths',()=>{const a=routeEdge(nodes[0],nodes[1],nodes,0),b=routeEdge(nodes[0],nodes[1],nodes,1);assert.notEqual(a.path,b.path);check(a,nodes[0],nodes[1],nodes);check(b,nodes[0],nodes[1],nodes);});
test('Close nodes can use top or bottom ports',()=>{const all=[{id:'a',x:80,y:100},{id:'b',x:310,y:100},{id:'c',x:560,y:100}];check(routeEdge(all[0],all[2],all),all[0],all[2],all);});
console.log(JSON.stringify({passed:tests.length,tests},null,2));
