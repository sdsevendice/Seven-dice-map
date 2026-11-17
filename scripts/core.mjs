export const ID='margora-passages';
export const clone=x=>JSON.parse(JSON.stringify(x));
export const ROLES=['a-arrival','b-arrival','a-exit','b-exit'];
export function dims(scene){const d=scene.dimensions;return {x:d.sceneX,y:d.sceneY,w:d.sceneWidth,h:d.sceneHeight};}
export function pixelRect(scene,r){const d=dims(scene);return {type:'rectangle',x:Math.round(d.x+r.x*d.w),y:Math.round(d.y+r.y*d.h),width:Math.max(1,Math.round(r.w*d.w)),height:Math.max(1,Math.round(r.h*d.h)),rotation:0,hole:false};}
export function normalRect(scene,r){const d=dims(scene);return {x:(r.x-d.x)/d.w,y:(r.y-d.y)/d.h,w:r.width/d.w,h:r.height/d.h};}
export function clampRect(r){const w=Math.min(.95,Math.max(.005,r.w)),h=Math.min(.95,Math.max(.005,r.h));return {x:Math.min(1-w,Math.max(0,r.x)),y:Math.min(1-h,Math.max(0,r.y)),w,h};}
export function overlap(a,b,gapX=0,gapY=gapX){return a.x<b.x+b.w+gapX&&a.x+a.w>b.x-gapX&&a.y<b.y+b.h+gapY&&a.y+a.h>b.y-gapY;}
export function defaultEnd(scene,side='south',levelId=null){
  const {w,h}=dims(scene),g=scene.grid.size||100;
  const width=Math.min(.25,g*3/w),height=Math.min(.25,g*3/h),dx=Math.min(.1,g/w),dy=Math.min(.1,g/h);
  let exit,arrival;
  if(side==='north'){exit={x:.5-width/2,y:.005,w:width,h:dy};arrival={x:.5-dx,y:.005+dy*3,w:dx*2,h:dy*2};}
  else if(side==='south'){exit={x:.5-width/2,y:.995-dy,w:width,h:dy};arrival={x:.5-dx,y:.995-dy*5,w:dx*2,h:dy*2};}
  else if(side==='west'){exit={x:.005,y:.5-height/2,w:dx,h:height};arrival={x:.005+dx*3,y:.5-dy,w:dx*2,h:dy*2};}
  else{exit={x:.995-dx,y:.5-height/2,w:dx,h:height};arrival={x:.995-dx*5,y:.5-dy,w:dx*2,h:dy*2};}
  return {sceneId:scene.id,levelId:levelId??scene.levels?.contents?.[0]?.id??null,exit:clampRect(exit),arrival:clampRect(arrival)};
}
export function validate(link,scenes){
  if(link.a.sceneId===link.b.sceneId&&!link.internal)throw Error('Для одной сцены используй «Переход внутри карты».');
  if(link.internal&&link.a.sceneId!==link.b.sceneId)throw Error('Внутренний переход должен оставаться на одной карте.');
  if(!link.name.trim())throw Error('Укажи название связи.');
  for(const end of [link.a,link.b]){
    const s=scenes.get(end.sceneId);if(!s)throw Error('Одна из карт удалена или недоступна.');
    if(end.levelId&&!s.levels?.get(end.levelId))throw Error('Выбранный уровень карты больше не существует. Выбери уровень заново.');
    for(const r of [end.exit,end.arrival]){
      if(![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.w<=0||r.h<=0||r.x<0||r.y<0||r.x+r.w>1.00001||r.y+r.h>1.00001)throw Error('Область должна находиться внутри карты.');
      const p=pixelRect(s,r);if(p.width<16||p.height<16)throw Error('Область слишком маленькая. Увеличь её уголком рамки.');
    }
    const d=dims(s),g=s.grid.size||100;
    if(overlap(end.exit,end.arrival,g*.5/d.w,g*.5/d.h))throw Error(`На карте «${s.name}» появление слишком близко к выходу. Перетащи зелёную область дальше от оранжевой.`);
  }
  if(link.internal)for(const arrival of [link.a,link.b])for(const exit of [link.a,link.b])if(arrival.levelId===exit.levelId){const s=scenes.get(arrival.sceneId),d=dims(s),g=s.grid.size||100;if(overlap(arrival.arrival,exit.exit,g*.5/d.w,g*.5/d.h))throw Error('Появление попадает на лестницу-выход. Отодвинь зелёную рамку, чтобы токен не вернулся сразу назад.');}
}
function raw(doc){return doc.toObject?doc.toObject():clone(doc);}
export class PassageStore{
  constructor({scenes,randomID,isGM=()=>false}){this.scenes=scenes;this.randomID=randomID;this.isGM=isGM;}
  assertGM(){if(!this.isGM())throw Error('Настройка доступна мастеру.');}
  list(){
    const links=new Map(),legacy=new Map();
    for(const scene of this.scenes)for(const r of scene.regions){
      const meta=r.flags?.[ID];
      if(meta?.link?.id){if(!links.has(meta.link.id))links.set(meta.link.id,clone(meta.link));continue;}
      const old=r.flags?.world?.margoraScenePassages;
      if(old?.pair){if(!legacy.has(old.pair))legacy.set(old.pair,[]);legacy.get(old.pair).push({scene,region:r,kind:old.kind});}
    }
    for(const [key,parts]of legacy){
      const sceneIds=[...new Set(parts.map(p=>p.scene.id))];if(sceneIds.length!==2)continue;
      const ends=sceneIds.map(sceneId=>{
        const entries=parts.filter(p=>p.scene.id===sceneId),ex=entries.find(p=>p.kind==='exit'),ar=entries.find(p=>p.kind==='arrival');
        if(!ex||!ar)return null;
        const a=raw(ex.region).shapes?.[0],b=raw(ar.region).shapes?.[0];
        if(a?.type!=='rectangle'||b?.type!=='rectangle'||a.rotation||b.rotation)return null;
        return {sceneId,levelId:[...(ex.region.levels??[])][0]??null,exit:normalRect(ex.scene,a),arrival:normalRect(ar.scene,b),exitId:ex.region.id,arrivalId:ar.region.id};
      });
      if(ends.some(e=>!e))continue;
      const [a,b]=ends,id='legacy-'+key;
      links.set(id,{id,name:this.scenes.get(a.sceneId).name+' ↔ '+this.scenes.get(b.sceneId).name,a,b,enabled:true,legacy:true,ids:{'a-exit':a.exitId,'a-arrival':a.arrivalId,'b-exit':b.exitId,'b-arrival':b.arrivalId}});
    }
    // Read actual region geometry as well as metadata, including edits made with native tools.
    for(const link of links.values())for(const side of ['a','b']){
      const end=link[side],scene=this.scenes.get(end.sceneId);if(!scene)continue;
      for(const kind of ['exit','arrival']){const region=scene.regions.get(link.ids[side+'-'+kind]),shape=region&&raw(region).shapes?.[0];
        if(shape?.type==='rectangle'&&!shape.rotation)end[kind]=normalRect(scene,shape);
      }
    }
    return [...links.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  }
  fresh(a,b,side='south'){
    const opposite={north:'south',south:'north',east:'west',west:'east'};
    const ids=Object.fromEntries(ROLES.map(role=>[role,this.randomID()]));
    const suffix={north:'сверху',south:'снизу',west:'слева',east:'справа'};
    return {id:this.randomID(),name:a.name+' ↔ '+b.name+' · '+suffix[side],nameAuto:true,sideHint:side,enabled:true,a:defaultEnd(a,side),b:defaultEnd(b,opposite[side]),ids};
  }
  freshInternal(scene){const link=this.fresh(scene,scene);link.internal=true;link.name=scene.name+' · Внутренний проход';link.nameAuto=false;link.a.exit={x:.12,y:.6,w:.1,h:.12};link.a.arrival={x:.12,y:.3,w:.1,h:.12};link.b.exit={x:.74,y:.6,w:.1,h:.12};link.b.arrival={x:.74,y:.3,w:.1,h:.12};return link;}
  documents(link){
    return ROLES.map(role=>{
      const side=role[0],other=side==='a'?'b':'a',arrival=role.endsWith('arrival'),end=link[side],scene=this.scenes.get(end.sceneId);
      return {scene,role,data:{_id:link.ids[role],name:(arrival?'Прибытие ← ':'Выход → ')+this.scenes.get(link[other].sceneId).name+' · '+link.name,
        shapes:[pixelRect(scene,arrival?end.arrival:end.exit)],color:arrival?'#54c995':'#e8a34d',levels:end.levelId?[end.levelId]:[],
        visibility:4,hidden:false,locked:false,ownership:{default:0},
        flags:{[ID]:{version:1,role,link:clone(link)}},
        behaviors:arrival?[]:[{_id:this.randomID(),name:link.internal?'Переход внутри карты':'Переход на соседнюю карту',type:'teleportToken',disabled:!link.enabled,
          system:{destinations:[`Scene.${link[other].sceneId}.Region.${link.ids[other+'-arrival']}`],placement:'center',snap:false,choice:false,revealed:false,
            dialog:{revealed:null,unrevealed:null},transition:{type:null,duration:500}}}]
      }};
    });
  }
  async restore(snapshots,created){
    const errors=[];
    for(const {scene,id}of [...created].reverse())try{await scene.deleteEmbeddedDocuments('Region',[id]);}catch(e){errors.push(e.message);}
    for(const {scene,data}of snapshots)try{
      // Replace full behaviors and shapes but preserve unrelated document flags.
      const patch=clone(data);if(!patch.flags?.[ID])patch['flags.-='+ID]=null;
      await scene.updateEmbeddedDocuments('Region',[patch]);
    }catch(e){errors.push(e.message);}
    return errors;
  }
  async save(input){
    this.assertGM();const link=clone(input);validate(link,this.scenes);link.legacy=false;
    const docs=this.documents(link),snapshots=[],created=[];
    for(const {scene,data}of docs){const r=scene.regions.get(data._id);if(r){
      const existing=r.flags?.[ID]?.link?.id===link.id||input.legacy&&r.flags?.world?.margoraScenePassages;
      if(!existing)throw Error('Этот идентификатор области уже используется другим объектом.');
      snapshots.push({scene,data:raw(r)});
    }}
    try{
      for(const {scene,data}of snapshots)if(data.behaviors?.length)await scene.updateEmbeddedDocuments('Region',[{_id:data._id,behaviors:data.behaviors.map(b=>({...b,disabled:true}))}]);
      for(const {scene,data}of docs){
        const current=scene.regions.get(data._id);
        if(current){const patch=clone(data);if(input.legacy)patch['flags.world.-=margoraScenePassages']=null;await scene.updateEmbeddedDocuments('Region',[patch]);}
        else{const result=await scene.createEmbeddedDocuments('Region',[data],{keepId:true});for(const r of result)created.push({scene,id:r.id});}
      }
      return link;
    }catch(error){const failures=await this.restore(snapshots,created);throw Error(error.message+(failures.length?' Не удалось полностью откатить изменения: '+failures.join('; '):' Изменения этой операции отменены.'));}
  }
  async remove(link){
    this.assertGM();const docs=[];
    for(const scene of this.scenes)for(const r of scene.regions){
      if(r.flags?.[ID]?.link?.id===link.id||link.legacy&&Object.values(link.ids).includes(r.id)&&r.flags?.world?.margoraScenePassages)docs.push({scene,data:raw(r)});
    }
    const removed=[];
    try{for(const item of docs){await item.scene.deleteEmbeddedDocuments('Region',[item.data._id]);removed.push(item);}}
    catch(error){const failures=[];for(const item of removed)try{await item.scene.createEmbeddedDocuments('Region',[item.data],{keepId:true});}catch(e){failures.push(e.message);}throw Error(error.message+(failures.length?' Не удалось восстановить часть областей: '+failures.join('; '):' Удаление отменено, области восстановлены.'));}
  }
  diagnose(link){
    const issues=[];for(const role of ROLES){const scene=this.scenes.get(link[role[0]].sceneId),region=scene?.regions.get(link.ids[role]);if(!region){issues.push('Нет области '+role);continue;}
      if(role.endsWith('exit')){const other=role[0]==='a'?'b':'a',expected=`Scene.${link[other].sceneId}.Region.${link.ids[other+'-arrival']}`;
        const b=region.behaviors.find(b=>b.type==='teleportToken');if(!b)issues.push('Нет поведения у '+role);else if(![...(b.system?.destinations??[])].some(d=>d===expected||d.endsWith('.'+link.ids[other+'-arrival'])))issues.push('Проверь назначение '+role);
      }
    }return issues;
  }
}

export class ClientDrafts{
  constructor(storage,key){this.storage=storage;this.key=key;this.memory={};}
  records(){try{const data=this.storage?.getItem(this.key);if(data){const parsed=JSON.parse(data);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))this.memory=parsed;}}catch{}return Object.values(this.memory).filter(r=>r?.link?.id&&r.link.a&&r.link.b).sort((a,b)=>b.updatedAt-a.updatedAt);}
  get(id){return this.records().find(r=>r.link.id===id);}
  put(link,sceneId){const records=this.records();const time=Math.max(Date.now(),...records.map(r=>(r.updatedAt||0)+1));this.memory[link.id]={link:clone(link),sceneId,updatedAt:time};if(!this.storage?.setItem)throw Error('Локальное хранилище недоступно');this.storage.setItem(this.key,JSON.stringify(this.memory));}
  remove(id){this.records();delete this.memory[id];this.storage?.setItem(this.key,JSON.stringify(this.memory));}
}
