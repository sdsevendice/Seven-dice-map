export function attachGraphPan(graph,viewport,svg){
  if(!viewport||!svg)return()=>{};
  graph.panStates??={};let drag=null;
  const state=()=>graph.panStates[graph.mode]??={x:0,y:0};
  const apply=()=>{const p=state();svg.style.transformOrigin='0 0';svg.style.transform=`translate(${p.x}px, ${p.y}px)`;};
  const down=e=>{if(![0,1].includes(e.button))return;if(e.button===0&&e.target.closest?.('.mp-graph-node,.mp-graph-edge,.mp-graph-edge-number,button,input,select'))return;e.preventDefault();const p=state();drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:p.x,py:p.y};viewport.setPointerCapture(e.pointerId);viewport.classList.add('panning');};
  const move=e=>{if(!drag)return;e.preventDefault();const p=state();p.x=drag.px+e.clientX-drag.x;p.y=drag.py+e.clientY-drag.y;apply();};
  const finish=e=>{if(!drag)return;const id=drag.id;drag=null;viewport.classList.remove('panning');if(viewport.hasPointerCapture(id))viewport.releasePointerCapture(id);};
  viewport.addEventListener('pointerdown',down);viewport.addEventListener('pointermove',move);viewport.addEventListener('pointerup',finish);viewport.addEventListener('pointercancel',finish);viewport.addEventListener('lostpointercapture',finish);apply();graph.applyPan=apply;
  return()=>{viewport.removeEventListener('pointerdown',down);viewport.removeEventListener('pointermove',move);viewport.removeEventListener('pointerup',finish);viewport.removeEventListener('pointercancel',finish);viewport.removeEventListener('lostpointercapture',finish);finish();};
}
