import {dims,overlap,clampRect,validate} from './core.mjs';
export const pointName=(link,side)=>link[side].label?.trim()||(side==='a'?'Этаж 1':'Этаж 2');
export function isPlaced(link,side,scenes){
  if(!link.internal||link[side].placed)return true;
  const r=link[side].exit,d=dims(scenes.get(link[side].sceneId)),x=side==='a'?.12:.74;
  return Math.abs(r.x-x)*d.w>2||Math.abs(r.y-.6)*d.h>2||Math.abs(r.w-.1)*d.w>2||Math.abs(r.h-.12)*d.h>2;
}
export function setupIssues(link,scenes){
  const issues=[];
  if(link.internal)for(const side of ['a','b'])if(!isPlaced(link,side,scenes))issues.push('Укажи лестницу: '+pointName(link,side)+'.');
  try{validate(link,scenes);}catch(e){issues.push(e.message);}
  return issues;
}
export function adjacentArrival(link,side,scene){
  const end=link[side],r=end.exit,d=dims(scene),g=scene.grid.size||100;
  const w=Math.min(.2,Math.max(g*1.5/d.w,r.w)),h=Math.min(.2,Math.max(g*1.5/d.h,r.h));
  const x=r.x+r.w/2-w/2,y=r.y+r.h/2-h/2;
  const candidates=[{x:r.x-w-g*.65/d.w,y},{x,y:r.y-h-g*.65/d.h},{x:r.x+r.w+g*.65/d.w,y},{x,y:r.y+r.h+g*.65/d.h}];
  for(const pos of candidates){const a=clampRect({...pos,w,h});if([link.a,link.b].every(e=>e.levelId!==end.levelId||!overlap(a,e.exit,g*.5/d.w,g*.5/d.h)))return a;}
  return end.arrival;
}
