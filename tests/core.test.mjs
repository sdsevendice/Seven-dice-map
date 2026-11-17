import assert from 'node:assert/strict';
import {PassageStore,ClientDrafts,ID,clone,defaultEnd,pixelRect,normalRect,validate} from '../scripts/core.mjs';
const results=[];
class Collection extends Map{get contents(){return [...this.values()];}[Symbol.iterator](){return this.values();}find(fn){return this.contents.find(fn);}}
function merge(target,patch){for(const [key,value]of Object.entries(patch)){
  if(key.includes('.-=')){const [prefix,leaf]=key.split('.-=');let p=target;for(const k of prefix.split('.'))p=p[k]??={};delete p[leaf];}
  else if(value&&typeof value==='object'&&!Array.isArray(value)){target[key]??={};merge(target[key],value);}else target[key]=clone(value);
}return target;}
function doc(data){const d=clone(data);return {...d,id:d._id,toObject(){const {id,toObject,...r}=this;return clone(r);}};}
function fixture(){
  let serial=0,writes=0,failAt=0;const scenes=new Collection();
  for(let i=0;i<3;i++){
    const scene={id:'scene'+i,name:'Карта '+i,grid:{size:100},dimensions:{sceneX:400,sceneY:200,sceneWidth:2400,sceneHeight:1600},levels:new Collection([['level'+i,{id:'level'+i}]]),regions:new Collection(),
      async createEmbeddedDocuments(type,data){assert.equal(type,'Region');if(++writes===failAt)throw Error('Fail create');for(const d of data){assert(!this.regions.has(d._id));this.regions.set(d._id,doc(d));}return data.map(d=>this.regions.get(d._id));},
      async updateEmbeddedDocuments(type,data){assert.equal(type,'Region');if(++writes===failAt)throw Error('Fail update');for(const d of data){const current=this.regions.get(d._id);assert(current);const next=merge(current.toObject(),d);this.regions.set(d._id,doc(next));}return data.map(d=>this.regions.get(d._id));},
      async deleteEmbeddedDocuments(type,ids){assert.equal(type,'Region');if(++writes===failAt)throw Error('Fail delete');for(const id of ids)this.regions.delete(id);}
    };scenes.set(scene.id,scene);
  }
  const store=new PassageStore({scenes,randomID:()=>String(++serial).padStart(16,'0'),isGM:()=>true});
  const [a,b,c]=scenes.contents;
  return {store,scenes,a,b,c,setFailure:n=>{writes=0;failAt=n;},count:()=>scenes.contents.reduce((n,s)=>n+s.regions.size,0),snapshot:()=>JSON.stringify(scenes.contents.map(s=>s.regions.contents.map(d=>d.toObject()).sort((a,b)=>a._id.localeCompare(b._id))))};
}
async function test(name,fn){await fn();results.push({name,passed:true});}
await test('Создание четырёх областей и обратных назначений',async()=>{const f=fixture();const link=await f.store.save(f.store.fresh(f.a,f.b));assert.equal(f.count(),4);assert.equal(f.store.list().length,1);assert.deepEqual(f.store.diagnose(link),[]);for(const s of [f.a,f.b]){const r=s.regions.contents.find(d=>d.behaviors.length);assert.equal(r.behaviors[0].system.choice,false);assert.equal(r.behaviors[0].disabled,false);}});
await test('Несколько выходов между одной парой карт',async()=>{const f=fixture();await f.store.save(f.store.fresh(f.a,f.b,'north'));await f.store.save(f.store.fresh(f.a,f.b,'east'));await f.store.save(f.store.fresh(f.a,f.c,'west'));assert.equal(f.count(),12);assert.equal(f.store.list().length,3);});
await test('Редактирование без дубликатов и отключение обоих выходов',async()=>{const f=fixture();let link=await f.store.save(f.store.fresh(f.a,f.b));link.a.exit.x=.2;link.enabled=false;link.name='Изменённая связь';link=await f.store.save(link);assert.equal(f.count(),4);assert.equal(f.store.list()[0].name,'Изменённая связь');for(const r of f.scenes.contents.flatMap(s=>s.regions.contents).filter(r=>r.behaviors.length))assert.equal(r.behaviors[0].disabled,true);});
await test('Сохраняется при новом открытии хранилища',async()=>{const f=fixture();await f.store.save(f.store.fresh(f.a,f.b));const next=new PassageStore({scenes:f.scenes,randomID:()=>'',isGM:()=>true});assert.equal(next.list().length,1);});
await test('Удаление одной связи сохраняет остальные регионы и связи',async()=>{const f=fixture();const a=await f.store.save(f.store.fresh(f.a,f.b));const b=await f.store.save(f.store.fresh(f.a,f.c));f.a.regions.set('foreign',doc({_id:'foreign',flags:{other:{yes:true}},behaviors:[]}));await f.store.remove(a);assert.equal(f.count(),5);assert(f.a.regions.has('foreign'));assert.deepEqual(f.store.diagnose(b),[]);});
for(let n=1;n<=4;n++)await test('Откат нового создания при сбое '+n,async()=>{const f=fixture();f.setFailure(n);await assert.rejects(f.store.save(f.store.fresh(f.a,f.b)));assert.equal(f.count(),0);});
for(let n=1;n<=6;n++)await test('Откат редактирования при сбое '+n,async()=>{const f=fixture();const link=await f.store.save(f.store.fresh(f.a,f.b));const before=f.snapshot();link.name='Другая';f.setFailure(n);await assert.rejects(f.store.save(link));assert.equal(f.snapshot(),before);});
for(let n=1;n<=4;n++)await test('Восстановление при сбое удаления '+n,async()=>{const f=fixture();const link=await f.store.save(f.store.fresh(f.a,f.b));const before=f.snapshot();f.setFailure(n);await assert.rejects(f.store.remove(link));assert.equal(f.snapshot(),before);});
await test('Масштаб координат учитывает поля сцены',()=>{const f=fixture(),r={x:.25,y:.125,w:.3,h:.25};const p=pixelRect(f.a,r);assert.equal(p.x,1000);assert.equal(p.y,400);assert.deepEqual(normalRect(f.a,p),r);});
await test('Защита от пересечения появления с выходом',()=>{const f=fixture(),link=f.store.fresh(f.a,f.b);link.a.arrival=clone(link.a.exit);assert.throws(()=>validate(link,f.scenes));});
await test('Все четыре стороны имеют раздельные выходы и прибытия',()=>{const f=fixture();for(const side of ['north','south','west','east'])validate(f.store.fresh(f.a,f.b,side),f.scenes);});
await test('Повреждённая связь видна диагностике и восстанавливается сохранением',async()=>{const f=fixture(),link=await f.store.save(f.store.fresh(f.a,f.b));f.b.regions.delete(link.ids['b-arrival']);assert.equal(f.store.diagnose(link).length,1);await f.store.save(link);assert.deepEqual(f.store.diagnose(link),[]);});
await test('Не мастер не может сохранять и удалять',async()=>{const f=fixture();f.store.isGM=()=>false;await assert.rejects(f.store.save(f.store.fresh(f.a,f.b)));await assert.rejects(f.store.remove({}));assert.equal(f.count(),0);});
await test('Импорт связей старого макроса без дублирования',async()=>{const f=fixture(),ids={},endpoints={a:defaultEnd(f.a,'south'),b:defaultEnd(f.b,'north')};for(const side of ['a','b'])for(const kind of ['exit','arrival']){
  const scene=side==='a'?f.a:f.b,id='old-'+side+'-'+kind;ids[side+'-'+kind]=id;scene.regions.set(id,doc({_id:id,name:'Старый переход',shapes:[pixelRect(scene,endpoints[side][kind])],levels:[endpoints[side].levelId],flags:{world:{margoraScenePassages:{pair:'old',kind}}},behaviors:kind==='exit'?[{_id:'beh',type:'teleportToken',system:{destinations:[]}}]:[]}));
}const links=f.store.list();assert.equal(links.length,1);assert(links[0].legacy);await f.store.save(links[0]);assert.equal(f.count(),4);assert.equal(f.store.list().length,1);assert(f.store.list()[0].legacy===false);for(const r of f.scenes.contents.flatMap(s=>s.regions.contents)){assert(!r.flags.world?.margoraScenePassages);assert(r.flags[ID]);}});
await test('Открытие использует фактически сохранённые области сцены',async()=>{const f=fixture(),link=await f.store.save(f.store.fresh(f.a,f.b));const r=f.a.regions.get(link.ids['a-exit']);r.shapes[0].x=1000;assert.equal(f.store.list()[0].a.exit.x,.25);});
await test('Черновики переживают новый экземпляр редактора и удаляются отдельно',()=>{const f=fixture(),data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},a=f.store.fresh(f.a,f.b),b=f.store.fresh(f.a,f.c);const d=new ClientDrafts(storage,'test');a.a.exit.x=.123;d.put(a,f.a.id);d.put(b,f.a.id);const next=new ClientDrafts(storage,'test');assert.equal(next.get(a.id).link.a.exit.x,.123);assert.equal(next.records()[0].link.id,b.id);next.remove(b.id);assert.equal(next.records().length,1);assert(next.get(a.id));});
await test('Повреждённое локальное хранилище не ломает открытие',()=>{const d=new ClientDrafts({getItem:()=>'{oops'},'test');assert.deepEqual(d.records(),[]);const n=new ClientDrafts({getItem:()=>'null'},'test');assert.deepEqual(n.records(),[]);});
await test('Внутренний переход создаёт четыре области одной сцены и два обратных назначения',async()=>{const f=fixture(),link=await f.store.save(f.store.freshInternal(f.a));assert.equal(f.a.regions.size,4);assert.equal(f.b.regions.size,0);assert.equal(f.store.list()[0].internal,true);assert.deepEqual(f.store.diagnose(link),[]);for(const role of ['a-exit','b-exit'])assert(f.a.regions.get(link.ids[role]).behaviors[0].system.destinations[0].startsWith('Scene.'+f.a.id+'.Region.'));await f.store.remove(link);assert.equal(f.count(),0);});
await test('Внутренний проход не допускает появления в любой из своих лестниц',()=>{const f=fixture(),link=f.store.freshInternal(f.a);link.a.arrival=clone(link.b.exit);assert.throws(()=>validate(link,f.scenes));});
await test('Обычный режим по-прежнему не допускает одинаковые сцены',()=>{const f=fixture();assert.throws(()=>validate(f.store.fresh(f.a,f.a),f.scenes));});
console.log(JSON.stringify({passed:results.length,tests:results},null,2));
