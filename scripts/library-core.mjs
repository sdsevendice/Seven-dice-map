import {ID} from './core.mjs';
export function imageType(file){const ext=String(file.name??'').split('.').pop().toLowerCase();const allowed={png:'png',jpg:'jpg',jpeg:'jpg',webp:'webp',avif:'avif',gif:'gif'};if(!allowed[ext])throw Error('Выбери PNG, JPG, WEBP, AVIF или GIF.');return allowed[ext];}
export function cleanName(name){return String(name).replace(/\.[^.]+$/,'').replace(/[_]+/g,' ').trim()||'Новая карта';}
export function sceneFolders(game){const result=new Map();for(const f of game.folders??[])if(f.type==='Scene')result.set(f.id,f);for(const scene of game.scenes){let f=scene.folder;for(let i=0;f&&i<40;i++,f=f.folder)result.set(f.id,f);}return [...result.values()].map(folder=>{const names=[];let f=folder;for(let i=0;f&&i<40;i++,f=f.folder)names.unshift(f.name);return {folder,id:folder.id,name:folder.name,path:names.join(' / ')};}).sort((a,b)=>a.path.localeCompare(b.path,'ru'));}
export class MapLibrary{
  constructor({game,Scene,Folder,FilePicker,randomID,FileClass=globalThis.File}){Object.assign(this,{game,Scene,Folder,FilePicker,randomID,FileClass});}
  gm(){if(!this.game.user.isGM)throw Error('Карты и папки добавляет мастер.');}
  folder(id){if(!id)return null;const found=sceneFolders(this.game).find(f=>f.id===id);if(!found)throw Error('Папка сцен больше не существует. Выбери другую.');return found.folder;}
  async newFolder(name,parentId=null){this.gm();name=String(name).trim();if(!name)throw Error('Укажи название папки.');this.folder(parentId);return this.Folder.create({name,type:'Scene',folder:parentId||null,sorting:'a',color:'#526c82'});}
  async move(sceneIds,folderId=null){this.gm();this.folder(folderId);const ids=[...new Set(sceneIds)];if(!ids.length)throw Error('Выбери карты для переноса.');for(const id of ids)if(!this.game.scenes.has(id))throw Error('Одна из выбранных карт больше не существует.');return this.Scene.updateDocuments(ids.map(_id=>({_id,folder:folderId||null})));}
  async display(sceneIds,{globalLight,tokenVision}){this.gm();if(typeof globalLight!=='boolean'||typeof tokenVision!=='boolean')throw Error('Настройки света и зрения должны быть включены или выключены.');const ids=[...new Set(sceneIds)];for(const id of ids)if(!this.game.scenes.has(id))throw Error('Карта больше не существует.');return this.Scene.updateDocuments(ids.map(_id=>({_id,'environment.globalLight.enabled':globalLight,tokenVision})));}
  async ensureDirectory(){
    if(this.directory)return this.directory;const worldId=this.game.world?.id;if(!worldId||!/^[\w-]+$/.test(worldId))throw Error('Не удалось определить папку текущего мира.');
    let dir='worlds/'+worldId;for(const component of ['assets','margora-passages','maps']){dir+='/'+component;try{await this.FilePicker.browse('data',dir);}catch(first){try{await this.FilePicker.createDirectory('data',dir);}catch(error){try{await this.FilePicker.browse('data',dir);}catch{throw error;}}}}
    this.directory=dir;return dir;
  }
  sceneData(entry,{folderId=null,gridSize=100,gridVisible=false,globalLight=false,tokenVision=true,darknessLevel=0}={}){
    this.folder(folderId);const w=Math.round(entry.width),h=Math.round(entry.height);if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1)throw Error('Размер изображения неизвестен.');
    gridSize=Number(gridSize);if(!Number.isInteger(gridSize)||gridSize<50||gridSize>1000)throw Error('Размер клетки должен быть целым числом от 50 до 1000 пикселей.');
    const name=String(entry.name??'').trim();if(!name)throw Error('Укажи название карты.');if(!entry.uploadPath)throw Error('Изображение ещё не загружено.');
    const levelId=entry.levelId??=this.randomID();return {_id:entry.id,name,folder:folderId||null,width:w,height:h,padding:.1,active:false,navigation:false,initialLevel:levelId,
      grid:{type:1,size:gridSize,alpha:gridVisible ? 0.2 : 0,distance:this.game.system?.grid?.distance??5,units:this.game.system?.grid?.units??'ft'},
      environment:{globalLight:{enabled:!!globalLight},darknessLevel},tokenVision:!!tokenVision,
      levels:[{_id:levelId,name:'Карта',background:{src:entry.uploadPath},textures:{fit:'fill'}}],ownership:{default:0},flags:{[ID]:{importId:entry.id,originalName:entry.file?.name??null}}};
  }
  async import(entry,options={}){
    this.gm();if(!entry.id)entry.id=this.randomID();if(!Number.isFinite(entry.width)||!Number.isFinite(entry.height)||entry.width<1||entry.height<1)throw Error('Сначала дождись предпросмотра изображения.');
    this.folder(options.folderId);if(!String(entry.name??'').trim())throw Error('Укажи название карты.');const size=Number(options.gridSize??100);if(!Number.isInteger(size)||size<50||size>1000)throw Error('Размер клетки должен быть целым числом от 50 до 1000 пикселей.');
    const existing=this.game.scenes.get(entry.id);if(existing){if(existing.flags?.[ID]?.importId===entry.id)return existing;throw Error('Идентификатор сцены занят другой картой.');}
    if(!entry.uploadPath){if(!entry.file)throw Error('Файл не выбран.');const ext=imageType(entry.file),directory=await this.ensureDirectory();const file=new this.FileClass([entry.file],'map-'+entry.id+'.'+ext,{type:entry.file.type});const result=await this.FilePicker.upload('data',directory,file,{}, {notify:false});if(!result?.path)throw Error('Foundry не принял файл. Проверь доступ к загрузке файлов.');entry.uploadPath=result.path;}
    const data=this.sceneData(entry,options);const scene=await this.Scene.create(data,{keepId:true,renderSheet:false});if(!scene)throw Error('Не удалось создать сцену. Изображение загружено; можно повторить создание без новой загрузки.');entry.sceneId=scene.id;
    try{if(scene.createThumbnail){const thumb=await scene.createThumbnail();if(thumb?.thumb)await scene.update({thumb:thumb.thumb});}}catch(error){console.warn(ID,'Карта создана, миниатюра будет доступна из исходного изображения.',error);}
    return scene;
  }
}
