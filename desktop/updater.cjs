'use strict';
const {autoUpdater}=require('electron-updater');
const {app,dialog}=require('electron');
function initUpdates(win){
 if(!app.isPackaged||process.platform!=='win32')return;
 autoUpdater.autoDownload=false;
 autoUpdater.autoInstallOnAppQuit=false;
 autoUpdater.allowPrerelease=false;
 autoUpdater.allowDowngrade=false;
 // Only accept releases signed by the installed publisher. Until a signing
 // identity is configured, do not download or execute an unsigned update.
 let config;
 try{config=require('node:fs').readFileSync(require('node:path').join(process.resourcesPath,'app-update.yml'),'utf8');}catch{return;}
 if(!/^publisherName:\s*(?:\S|\n\s+-\s+\S)/m.test(config))return;
 let busy=false;
 autoUpdater.on('error',()=>{busy=false;console.warn('Voxora: não foi possível verificar a atualização.');});
 autoUpdater.on('update-not-available',()=>{busy=false;});
 autoUpdater.on('update-available',async info=>{
  if(win.isDestroyed()){busy=false;return;}
  try{
   const result=await dialog.showMessageBox(win,{type:'info',title:'Atualização do Voxora',message:'Uma nova versão está disponível: '+info.version,detail:'O download não interrompe sua chamada. Você escolhe quando instalar.',buttons:['Baixar atualização','Mais tarde'],defaultId:1,cancelId:1});
   if(result.response===0)await autoUpdater.downloadUpdate();else busy=false;
  }catch{busy=false;}
 });
 autoUpdater.on('update-downloaded',async()=>{
  if(win.isDestroyed())return;
  const result=await dialog.showMessageBox(win,{type:'info',title:'Atualização pronta',message:'A nova versão foi baixada.',detail:'Encerre sua chamada antes de reiniciar. O aplicativo não reinicia sozinho.',buttons:['Reiniciar e instalar','Mais tarde'],defaultId:1,cancelId:1});
  if(result.response===0)autoUpdater.quitAndInstall(false,true);
 });
 const check=()=>{if(busy||win.isDestroyed())return;busy=true;autoUpdater.checkForUpdates().catch(()=>{busy=false;});};
 const start=setTimeout(check,10000),timer=setInterval(check,6*60*60*1000);win.once('closed',()=>{clearTimeout(start);clearInterval(timer);});
}
module.exports={initUpdates};
