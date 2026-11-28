const {app,BrowserWindow,session,shell,dialog}=require('electron');
const path=require('node:path');
const {initUpdates}=require('./updater.cjs');
const origin='https://voxora-zghs.onrender.com';
function trusted(url){try{return new URL(url).origin===origin}catch{return false}}
app.whenReady().then(()=>{
const ses=session.defaultSession;
ses.setPermissionRequestHandler((wc,p,cb,d)=>cb(trusted(d.requestingUrl||wc.getURL())&&['media','display-capture'].includes(p)));
ses.setPermissionCheckHandler((wc,p,o)=>trusted(o)&&['media','display-capture'].includes(p));
const splash=new BrowserWindow({width:380,height:280,frame:false,resizable:false,center:true,show:false,backgroundColor:'#11131b',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
splash.removeMenu();splash.webContents.on('will-navigate',e=>e.preventDefault());splash.webContents.setWindowOpenHandler(()=>({action:'deny'}));splash.once('ready-to-show',()=>{if(!splash.isDestroyed())splash.show();});splash.loadFile(path.join(__dirname,'splash.html')).catch(()=>{if(!splash.isDestroyed())splash.destroy();});
const win=new BrowserWindow({show:false,width:1280,height:800,minWidth:720,minHeight:500,backgroundColor:'#11131b',title:'Voxora',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
win.removeMenu();win.webContents.on('will-navigate',(e,url)=>{if(!trusted(url))e.preventDefault()});
win.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//i.test(url))shell.openExternal(url).catch(()=>{});return {action:'deny'}});
let loaded=false;
const closeSplash=()=>{if(!splash.isDestroyed())splash.destroy();};
const timeout=setTimeout(()=>{if(!loaded&&!win.isDestroyed()){closeSplash();dialog.showErrorBox('Voxora','Não foi possível conectar ao servidor. Verifique sua internet e abra o aplicativo novamente.');win.destroy();}},30000);
win.once('closed',()=>{clearTimeout(timeout);closeSplash();});
win.loadURL(origin).then(()=>{if(win.isDestroyed())return;loaded=true;clearTimeout(timeout);closeSplash();win.show();initUpdates(win);}).catch(()=>{if(win.isDestroyed())return;clearTimeout(timeout);closeSplash();dialog.showErrorBox('Voxora','Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.');win.destroy();});
});app.on('window-all-closed',()=>app.quit());