import {clampRect,dims}from './core.mjs';
import {adjacentArrival,pointName,isPlaced,setupIssues}from './ux-core.mjs';
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const btn=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.onclick=fn;return b;};
export function internalBoard(editor,links){
  const link=editor.draft,scene=game.scenes.get(link.a.sceneId),d=dims(scene),root=el('section','mp-internal-layout'),board=el('section','mp-board mp-internal-map'),settings=el('aside','mp-point-settings');
  let selection=editor.internalSelection??{side:'a',kind:'exit'},view=editor.views.a,drag=null;
  const toolbar=el('div','mp-internal-mapbar');toolbar.append(el('strong','','Все этажи на одной карте'),btn('−',()=>zoom(1/1.25)),btn('+',()=>zoom(1.25)),btn('Вся карта',()=>{view.x=view.y=0;view.z=1;draw();}));board.append(toolbar);
  const viewport=el('div','mp-viewport');viewport.style.aspectRatio=d.w+'/'+d.h;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('role','img');svg.setAttribute('aria-label','Лестницы и места появления: '+scene.name);viewport.append(svg);board.append(viewport);
  const hint=el('p','mp-canvas-hint','Перетащи рамки на лестницы. Уголок меняет размер. Зелёные рамки — места появления рядом с лестницами.');board.append(hint);
  settings.append(el('h3','','Лестницы и прибытие'),el('p','mp-muted','Выбери этаж. Цветной вход ведёт к зелёной рамке другого этажа.'));const tabs=el('div','mp-point-tabs');const tabButtons=[];for(const side of ['a','b']){const b=btn(pointName(link,side),()=>select(side,'exit'));b.dataset.side=side;tabButtons.push(b);tabs.append(b);}settings.append(tabs);
  const choices=[];
  for(const side of ['a','b']){
    const card=el('section','mp-point-card '+side);card.dataset.pointSide=side;const heading=el('div','mp-point-heading'),number=el('b','mp-point-number',side==='a'?'1':'2'),name=el('input','mp-point-name');name.value=pointName(link,side);name.setAttribute('aria-label',side==='a'?'Название первой точки':'Название второй точки');
    name.oninput=()=>{link[side].label=name.value;editor.changed();draw();};heading.append(number,name);card.append(heading);
    for(const [kind,text,small]of [['exit','Лестница / вход','При входе сюда токен уйдёт на другой этаж.'],['arrival','Место появления','Сюда придёт токен с другого этажа.']]){const b=btn(text,()=>select(side,kind),'mp-point-tool');b.dataset.side=side;b.dataset.kind=kind;b.append(el('small','',small));choices.push(b);card.append(b);}
    const levels=el('select','mp-internal-level');levels.setAttribute('aria-label','Уровень для '+pointName(link,side));for(const l of scene.levels){const o=el('option','',l.name);o.value=l.id;o.selected=l.id===link[side].levelId;levels.append(o);}levels.onchange=()=>{link[side].levelId=levels.value;editor.changed();select(side,'exit');};if(scene.levels.size>1)card.append(levels);
    card.append(btn('Поставить появление рядом',()=>{link[side].arrival=adjacentArrival(link,side,scene);link[side].arrivalEdited=true;editor.changed();select(side,'arrival');},'mp-auto-arrival'));settings.append(card);
  }
  const flow=el('div','mp-route-flow'),checks=el('div','mp-setup-checks');settings.append(flow,checks);root.append(board,settings);
  function select(side,kind){selection={side,kind};editor.internalSelection=selection;draw();}
  function draw(){
    svg.replaceChildren();svg.setAttribute('viewBox',`${view.x} ${view.y} ${1/view.z} ${1/view.z}`);
    const levelId=link[selection.side].levelId,background=document.createElementNS(ns,'image');background.setAttribute('href',scene.levels.get(levelId)?.background?.src??'');for(const[k,v]of Object.entries({width:1,height:1,preserveAspectRatio:'none'}))background.setAttribute(k,v);svg.append(background);
    for(const other of links)if(other.id!==link.id)for(const end of[other.a,other.b])if(end.sceneId===scene.id&&end.levelId===levelId){const rect=document.createElementNS(ns,'rect');for(const[k,v]of Object.entries({x:end.exit.x,y:end.exit.y,width:end.exit.w,height:end.exit.h}))rect.setAttribute(k,v);rect.setAttribute('class','mp-internal-ghost');const title=document.createElementNS(ns,'title');title.textContent=other.name;rect.append(title);svg.append(rect);}
    for(const side of ['a','b'])if(link[side].levelId===levelId)for(const kind of ['exit','arrival']){
      const r=link[side][kind],group=document.createElementNS(ns,'g');group.dataset.side=side;group.dataset.kind=kind;group.setAttribute('class','mp-shape '+kind+' point-'+side+(selection.side===side&&selection.kind===kind?' selected':'')+(!isPlaced(link,side,game.scenes)&&kind==='exit'?' unplaced':''));
      const rect=document.createElementNS(ns,'rect');for(const[k,v]of Object.entries({x:r.x,y:r.y,width:r.w,height:r.h}))rect.setAttribute(k,v);group.append(rect);
      const label=document.createElementNS(ns,'text');label.setAttribute('x',r.x);label.setAttribute('y',Math.max(.02/view.z,r.y-.009/view.z));label.setAttribute('class','mp-zone-label');label.setAttribute('font-size',.018/view.z);label.textContent=(side==='a'?'1':'2')+' · '+(kind==='exit'?'Вход → '+pointName(link,side==='a'?'b':'a'):'Прибытие');group.append(label);
      const handle=document.createElementNS(ns,'rect'),size=.014/view.z;for(const[k,v]of Object.entries({x:r.x+r.w-size/2,y:r.y+r.h-size/2,width:size,height:size}))handle.setAttribute(k,v);handle.setAttribute('class','mp-handle');handle.dataset.resize='1';group.append(handle);svg.append(group);
    }
    for(const card of settings.querySelectorAll('[data-point-side]'))card.classList.toggle('editing',card.dataset.pointSide===selection.side);for(const b of tabButtons){b.classList.toggle('active',b.dataset.side===selection.side);b.textContent=(b.dataset.side==='a'?'1 · ':'2 · ')+pointName(link,b.dataset.side);b.title=b.textContent;}for(const b of choices)b.classList.toggle('active',b.dataset.side===selection.side&&b.dataset.kind===selection.kind);
    flow.textContent=pointName(link,'a')+' ↔ '+pointName(link,'b');checks.replaceChildren();const issues=setupIssues(link,game.scenes);for(const text of issues.length?issues:[editor.dirty?'Оба входа настроены. Сохрани переход.':link.enabled?'Переход сохранён в мире.':'Переход сохранён, но выключен.'])checks.append(el('p',issues.length?'pending':'ready',text));
  }
  const point=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());};
  svg.onpointerdown=e=>{if(editor.busy||![0,1].includes(e.button))return;e.preventDefault();const p=point(e);svg.setPointerCapture(e.pointerId);editor.historyGesture=foundry.utils.randomID();if(e.button===1){drag={type:'pan',p,clientX:e.clientX,clientY:e.clientY,view:{...view}};return;}const shape=e.target.closest('[data-side][data-kind]');if(shape)selection={side:shape.dataset.side,kind:shape.dataset.kind};editor.internalSelection=selection;const end=link[selection.side];drag={type:shape?(e.target.dataset.resize?'resize':'move'):'draw',p,original:{...end[selection.kind]},wasPlaced:isPlaced(link,selection.side,game.scenes),arrival:{...end.arrival}};draw();};
  svg.onpointermove=e=>{if(!drag)return;const p=point(e);if(drag.type==='pan'){view.x=drag.view.x-(e.clientX-drag.clientX)/svg.getBoundingClientRect().width/drag.view.z;view.y=drag.view.y-(e.clientY-drag.clientY)/svg.getBoundingClientRect().height/drag.view.z;draw();return;}const end=link[selection.side],a=drag;
    if(a.type==='move')end[selection.kind]=clampRect({...a.original,x:a.original.x+p.x-a.p.x,y:a.original.y+p.y-a.p.y});
    else if(a.type==='resize')end[selection.kind]=clampRect({...a.original,w:Math.max(.01,a.original.w+p.x-a.p.x),h:Math.max(.01,a.original.h+p.y-a.p.y)});
    else end[selection.kind]=clampRect({x:Math.min(p.x,a.p.x),y:Math.min(p.y,a.p.y),w:Math.abs(p.x-a.p.x),h:Math.abs(p.y-a.p.y)});
    if(selection.kind==='exit'){end.placed=true;if(!a.wasPlaced&&!end.arrivalEdited)end.arrival=adjacentArrival(link,selection.side,scene);}else end.arrivalEdited=true;
    editor.changed();draw();
  };
  svg.onpointerup=e=>{drag=null;editor.historyGesture=null;editor.flushDraft();if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);};
  svg.onpointercancel=e=>{if(drag&&drag.type!=='pan'){const end=link[selection.side];end[selection.kind]=drag.original;end.arrival=drag.arrival;end.placed=drag.wasPlaced;editor.changed();}drag=null;editor.historyGesture=null;editor.flushDraft();draw();if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);};
  function zoom(factor,p={x:view.x+.5/view.z,y:view.y+.5/view.z}){const previous=view.z;view.z=Math.max(1,Math.min(10,view.z*factor));view.x=p.x-(p.x-view.x)*previous/view.z;view.y=p.y-(p.y-view.y)*previous/view.z;if(view.z===1)view.x=view.y=0;draw();}
  svg.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY<0?1.2:1/1.2,point(e));},{passive:false});
  draw();return root;
}
