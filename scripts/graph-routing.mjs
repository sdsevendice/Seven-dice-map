const inside=(p,r)=>p.x>r.left&&p.x<r.right&&p.y>r.top&&p.y<r.bottom;
export function crossesRect(a,b,r){
  if(a.x===b.x)return a.x>r.left&&a.x<r.right&&Math.max(a.y,b.y)>r.top&&Math.min(a.y,b.y)<r.bottom;
  if(a.y===b.y)return a.y>r.top&&a.y<r.bottom&&Math.max(a.x,b.x)>r.left&&Math.min(a.x,b.x)<r.right;
  return true;
}
function simplify(points){const unique=points.filter((p,i)=>!i||p.x!==points[i-1].x||p.y!==points[i-1].y);return unique.filter((p,i)=>!i||i===unique.length-1||!((unique[i-1].x===p.x&&p.x===unique[i+1].x)||(unique[i-1].y===p.y&&p.y===unique[i+1].y)));}
function port(node,side,offset,distance=24){const w=node.width??220,h=node.height??88;let point,out;const ox=Math.max(-w/2+16,Math.min(w/2-16,offset)),oy=Math.max(-h/2+12,Math.min(h/2-12,offset));if(side==='right'){point={x:node.x+w,y:node.y+h/2+oy};out={x:point.x+distance,y:point.y};}else if(side==='left'){point={x:node.x,y:node.y+h/2+oy};out={x:point.x-distance,y:point.y};}else if(side==='top'){point={x:node.x+w/2+ox,y:node.y};out={x:point.x,y:point.y-distance};}else{point={x:node.x+w/2+ox,y:node.y+h};out={x:point.x,y:point.y+distance};}return{point,out};}
// Orthogonal paths stop at node borders and avoid every unrelated node. An
// unroutable edge is reported rather than painted through a misleading node.
export function routeEdge(a,b,nodes,parallel=0,lane=0){
  const rects=nodes.map(n=>({id:n.id,left:n.x-12,right:n.x+(n.width??220)+12,top:n.y-12,bottom:n.y+(n.height??88)+12}));
  const dx=b.x-a.x,dy=b.y-a.y,horizontal=Math.abs(dx)>=Math.abs(dy),preferredA=horizontal?(dx>=0?'right':'left'):(dy>=0?'bottom':'top'),preferredB=horizontal?(dx>=0?'left':'right'):(dy>=0?'top':'bottom');const sides=['right','left','top','bottom'],offset=parallel?Math.ceil(parallel/2)*14*(parallel%2?1:-1):0;let best=null;
  const clear=(points,obstacles=rects)=>points.every(p=>p.x>=1&&p.y>=1&&!obstacles.some(r=>inside(p,r)))&&points.slice(1).every((p,i)=>!obstacles.some(r=>crossesRect(points[i],p,r)));
  const straightA=port(a,preferredA,offset).point,straightB=port(b,preferredB,offset).point;if(((horizontal&&straightA.y===straightB.y&&Math.sign(straightB.x-straightA.x)===Math.sign(dx))||(!horizontal&&straightA.x===straightB.x&&Math.sign(straightB.y-straightA.y)===Math.sign(dy)))&&clear([straightA,straightB],rects.filter(r=>r.id!==a.id&&r.id!==b.id)))return{points:[straightA,straightB],label:{x:(straightA.x+straightB.x)/2,y:(straightA.y+straightB.y)/2},path:'M '+straightA.x+' '+straightA.y+' L '+straightB.x+' '+straightB.y,score:0};for(const sa of sides)for(const sb of sides){const p=port(a,sa,offset,24+(lane%8)*9),q=port(b,sb,offset,24+(lane%8)*9);if(!clear([p.point,p.out],rects.filter(r=>r.id!==a.id))||!clear([q.out,q.point],rects.filter(r=>r.id!==b.id)))continue;
    const xs=[p.out.x,q.out.x,...rects.flatMap(r=>[r.left-2-parallel*3-lane*5,r.right+2+parallel*3+lane*5])],ys=[p.out.y,q.out.y,...rects.flatMap(r=>[r.top-2-parallel*3-lane*5,r.bottom+2+parallel*3+lane*5])];const candidates=[[p.out,{x:q.out.x,y:p.out.y},q.out],[p.out,{x:p.out.x,y:q.out.y},q.out],...ys.map(y=>[p.out,{x:p.out.x,y},{x:q.out.x,y},q.out]),...xs.map(x=>[p.out,{x,y:p.out.y},{x,y:q.out.y},q.out])];
    for(const points of candidates){if(!clear(points))continue;const full=simplify([p.point,...points,q.point]);const distance=full.slice(1).reduce((sum,v,i)=>sum+Math.abs(v.x-full[i].x)+Math.abs(v.y-full[i].y),0),score=distance+full.length*6+(sa===preferredA?0:18)+(sb===preferredB?0:18);if(best&&best.score<=score)continue;let longest=0,label=full[0];for(let i=1;i<full.length;i++){const u=full[i-1],v=full[i],length=Math.abs(v.x-u.x)+Math.abs(v.y-u.y);if(length>longest){longest=length;label={x:(u.x+v.x)/2,y:(u.y+v.y)/2};}}best={points:full,label,score};}
  }
  return best?{...best,path:best.points.map((p,i)=>(i?'L ':'M ')+p.x+' '+p.y).join(' ')}:null;
}
