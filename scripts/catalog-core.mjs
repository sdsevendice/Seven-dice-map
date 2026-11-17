export function sourceOf(scene,levelId){return scene?.levels?.get?.(levelId)?.background?.src||scene?.levels?.contents?.find(l=>l.background?.src)?.background?.src||scene?.background?.src||null;}
export function ancestors(scene){const list=[];for(let f=scene.folder;f&&list.length<40;f=f.folder)list.unshift(f);return list;}
export function isMap(scene){return !!sourceOf(scene)&&!ancestors(scene).some(f=>/личн.*материал|иллюстрац|портрет|раздат|изображени/i.test(f.name));}
export function filterCatalog(scenes,{query='',tag='',sort='name',routes=[],favorites=[]}={}){
  const terms=query.trim().toLocaleLowerCase('ru').split(/\s+/).filter(Boolean),count=id=>routes.filter(l=>l.a.sceneId===id||l.b.sceneId===id).length;
  return scenes.filter(s=>{const savedTags=s.flags?.['margora-passages']?.tags,tags=Array.isArray(savedTags)?savedTags:[],text=[s.name,...ancestors(s).map(f=>f.name),...tags].join(' ').toLocaleLowerCase('ru');return(!tag||tags.includes(tag))&&terms.every(t=>text.includes(t));}).sort((a,b)=>sort==='recent'?((b._stats?.modifiedTime??0)-(a._stats?.modifiedTime??0)||a.name.localeCompare(b.name,'ru')):sort==='routes'?(count(b.id)-count(a.id)||a.name.localeCompare(b.name,'ru')):a.name.localeCompare(b.name,'ru'));
}
export function graphLayout(scenes,links){
  const ids=new Set(scenes.map(s=>s.id)),adj=new Map(scenes.map(s=>[s.id,new Set()]));for(const l of links)if(ids.has(l.a.sceneId)&&ids.has(l.b.sceneId)&&l.a.sceneId!==l.b.sceneId){adj.get(l.a.sceneId).add(l.b.sceneId);adj.get(l.b.sceneId).add(l.a.sceneId);}
  const visited=new Set(),positions={};let row=0;
  for(const scene of [...scenes].sort((a,b)=>adj.get(b.id).size-adj.get(a.id).size||a.name.localeCompare(b.name,'ru'))){if(visited.has(scene.id))continue;const queue=[scene.id],component=[];visited.add(scene.id);while(queue.length){const id=queue.shift();component.push(id);for(const next of adj.get(id))if(!visited.has(next)){visited.add(next);queue.push(next);}}component.forEach((id,i)=>positions[id]={x:65+(i%4)*285,y:105+(row+Math.floor(i/4))*175});row+=Math.ceil(component.length/4);}
  return positions;
}
export function readPreferences(storage,key){try{const p=JSON.parse(storage.getItem(key)||'{}');return{sort:['name','recent','routes'].includes(p.sort)?p.sort:'name',density:p.density==='list'?'list':'grid',favorites:Array.isArray(p.favorites)?p.favorites.filter(x=>typeof x==='string'):[]};}catch{return{sort:'name',density:'grid',favorites:[]};}}
