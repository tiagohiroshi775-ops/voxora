const {app,BrowserWindow,session,shell}=require('electron');
const origin='https://voxora-zghs.onrender.com';
function trusted(url){try{return new URL(url).origin===origin}catch{return false}}
app.whenReady().then(()=>{
const ses=session.defaultSession;
ses.setPermissionRequestHandler((wc,p,cb,d)=>cb(trusted(d.requestingUrl||wc.getURL())&&['media','display-capture'].includes(p)));
ses.setPermissionCheckHandler((wc,p,o)=>trusted(o)&&['media','display-capture'].includes(p));
const win=new BrowserWindow({width:1280,height:800,minWidth:720,minHeight:500,backgroundColor:'#11131b',title:'Voxora',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});
win.removeMenu();win.webContents.on('will-navigate',(e,url)=>{if(!trusted(url))e.preventDefault()});
win.webContents.setWindowOpenHandler(({url})=>{if(/^https:\/\//i.test(url))shell.openExternal(url).catch(()=>{});return {action:'deny'}});
win.loadURL(origin);
});app.on('window-all-closed',()=>app.quit());