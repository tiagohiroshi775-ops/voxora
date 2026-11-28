'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const totp=require('./security/totp.cjs');
const twoFactorKey=()=>{const value=process.env.VOXORA_TOTP_KEY||'';if(!/^[a-f0-9]{64}$/i.test(value))fail(503,'Autenticação em dois fatores indisponível.');return Buffer.from(value,'hex');};
const pendingTotp=new Map();setInterval(()=>{for(const [uid,p] of pendingTotp)if(p.exp<Date.now())pendingTotp.delete(uid);},60000).unref();
function requireSecond(u,code){if(!u.totp)return;const value=typeof code==='string'?code.trim():'';const recovery=crypto.createHash('sha256').update(value.toUpperCase()).digest('hex');const idx=(u.totp.recovery||[]).indexOf(recovery);if(idx>=0){u.totp.recovery.splice(idx,1);return;}const step=totp.verify(totp.unseal(u.totp.secret,twoFactorKey()),value,{lastStep:u.totp.lastStep});if(step===null)fail(401,'Código de autenticação inválido ou já utilizado.');u.totp.lastStep=step;}
async function requirePassword(u,pass){if(typeof pass!=='string'||!pass||pass.length>128||!crypto.timingSafeEqual(await scrypt(pass,u.salt,64),Buffer.from(u.digest,'hex')))fail(401,'Senha atual incorreta.');}
function revokeOthers(uid,key){for(const k of Object.keys(db.sessions))if(k!==key&&db.sessions[k].user===uid)delete db.sessions[k];for(const c of [...online.values()])if(c.uid===uid&&c.session!==key){remove(c);c.res.end();}}
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const ROOT = path.join(__dirname,'public');
const DATA = process.env.DATA_DIR || path.join(__dirname,'data');
fs.mkdirSync(DATA,{recursive:true});
const FILE = path.join(DATA,'db.json');
const SESSION_TTL=30*24*60*60*1000;
let db={users:[],groups:[],sessions:{}},pool=null,revision=0,writeQueue=Promise.resolve(),storageBroken=false;
const usernameOf=v=>typeof v==='string'?v.trim().toLowerCase():'';
const validUsername=v=>/^[a-z0-9][a-z0-9_.-]{2,23}$/.test(v);
function migrate(){
  const used=new Set(db.users.filter(u=>u.username).map(u=>u.username));
  for(const u of db.users){
    if(!u.username){let base=(u.email?.split('@')[0]||u.name||'usuario').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_.-]/g,'').replace(/^[^a-z0-9]+/,'').slice(0,18);if(base.length<3)base='usuario';let name=base,n=1;while(used.has(name))name=base+'-'+n++;u.username=name;used.add(name);}
    if(u.avatar&&!u.avatarData){const f=path.join(DATA,u.id+'.jpg');if(fs.existsSync(f))u.avatarData=fs.readFileSync(f).toString('base64');else u.avatar=null;}
  }
  for(const [k,v] of Object.entries(db.sessions)){if(v.exp&&v.exp<=Date.now())delete db.sessions[k];else if(!v.exp)v.exp=Date.now()+SESSION_TTL;}
}
async function initStorage(){
  if(process.env.RENDER==='true'&&!process.env.DATABASE_URL)throw Error('Configure DATABASE_URL antes de publicar.');
  if(fs.existsSync(FILE))db=JSON.parse(fs.readFileSync(FILE,'utf8'));
  if(process.env.DATABASE_URL){
    const {Pool}=require('pg');pool=new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:10000});
    pool.on('error',()=>{storageBroken=true;console.error('Conexão com banco indisponível.');});
    await pool.query('CREATE TABLE IF NOT EXISTS voxora_state (id integer PRIMARY KEY CHECK (id=1), payload jsonb NOT NULL, revision bigint NOT NULL DEFAULT 0)');
    await pool.query('INSERT INTO voxora_state (id,payload) VALUES (1,$1::jsonb) ON CONFLICT (id) DO NOTHING',[JSON.stringify(db)]);
    const r=await pool.query('SELECT payload,revision FROM voxora_state WHERE id=1');db=r.rows[0].payload;revision=Number(r.rows[0].revision);
  }
  migrate();await save();
}
const online = new Map();
const id = () => crypto.randomUUID();
const code = () => { let c; do {c=crypto.randomBytes(5).toString('hex').toUpperCase()} while(db.groups.some(g=>g.code===c||g.channels.some(r=>r.code===c))); return c; };
const hash = t => crypto.createHash('sha256').update(t).digest('hex');
const clean = (v,n=60) => typeof v==='string'?v.trim().slice(0,n):'';
async function save(){
  if(storageBroken)fail(503,'Banco indisponível. Tente novamente mais tarde.');
  const payload=JSON.stringify(db);
  if(!pool){fs.writeFileSync(FILE+'.tmp',payload,{mode:0o600});fs.renameSync(FILE+'.tmp',FILE);return;}
  const work=writeQueue.then(async()=>{if(storageBroken)throw Error('Banco indisponível');const r=await pool.query('UPDATE voxora_state SET payload=$1::jsonb,revision=revision+1 WHERE id=1 AND revision=$2 RETURNING revision',[payload,revision]);if(r.rowCount!==1)throw Error('Conflito de persistência');revision=Number(r.rows[0].revision);});
  writeQueue=work.catch(()=>{storageBroken=true;});try{await work;}catch{storageBroken=true;fail(503,'Não foi possível salvar. Tente novamente mais tarde.');}
}
function fail(status,msg){throw Object.assign(new Error(msg),{status});}
function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
function session(req){const token=(req.headers.cookie||'').match(/(?:^|;\s*)voxora=([a-f0-9]+)/)?.[1]; const key=token&&hash(token);const s=key&&db.sessions[key];return s&&s.exp>Date.now()?{user:db.users.find(u=>u.id===s.user),key,token}:null;}
function cookie(req,res,token){res.setHeader('Set-Cookie',`voxora=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.RENDER==='true'||req.socket.encrypted||req.headers['x-forwarded-proto']==='https'?'; Secure':''}`);}
async function setSession(req,res,u){const token=crypto.randomBytes(32).toString('hex');db.sessions[hash(token)]={user:u.id,exp:Date.now()+SESSION_TTL};await save();cookie(req,res,token);}
function userView(u){return {id:u.id,name:u.name,bio:u.bio||'',avatar:u.avatar?`/api/avatar/${u.id}?v=${u.avatar}`:null};}
function ownView(u){return {...userView(u),username:u.username,twoFactor:!!u.totp};}
function member(g,u){return g.members.includes(u);}
function accessible(c,u,g){return member(g,u)&&(!c.private||c.allowed.includes(u)||g.owner===u);}
function findGroup(gid,u){const g=db.groups.find(x=>x.id===gid);if(!g||!member(g,u))fail(404,'Grupo não encontrado.');return g;}
function findRoom(gid,cid,u){const g=findGroup(gid,u);const c=g.channels.find(x=>x.id===cid);if(!c||!accessible(c,u,g))fail(403,'Você não tem acesso a este canal.');return {g,c};}
function snapshot(uid){return {me:ownView(db.users.find(u=>u.id===uid)),groups:db.groups.filter(g=>member(g,uid)).map(g=>({id:g.id,name:g.name,owner:g.owner,code:g.code,members:g.members.map(m=>({...userView(db.users.find(u=>u.id===m)),online:[...online.values()].some(p=>p.uid===m)})),channels:g.channels.filter(c=>accessible(c,uid,g)).map(c=>({id:c.id,name:c.name,type:c.type,private:c.private,code:c.owner===uid||g.owner===uid?c.code:undefined,owner:c.owner,messages:c.type==='text'?c.messages.slice(-150):undefined,participants:[...online.values()].filter(p=>p.room===c.id).map(p=>({user:p.uid,...userView(db.users.find(u=>u.id===p.uid)),id:p.id,muted:p.muted,screen:p.screen}))}))}))};}
function emit(p,event,data){if(!p.res.destroyed)p.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);}
function broadcast(){for(const p of online.values())emit(p,'state',snapshot(p.uid));}
function remove(p){if(online.get(p.id)!==p)return;online.delete(p.id);clearInterval(p.ping);broadcast();}
async function body(req){let b='';for await(const chunk of req){b+=chunk;if(b.length>200000)fail(413,'Requisição muito grande.');}try{const value=b?JSON.parse(b):{};if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'JSON inválido.');return value;}catch{fail(400,'JSON inválido.');}}
const attempts=new Map();
function limit(key,max,window){const now=Date.now();let a=attempts.get(key);if(!a||a.until<now){a={count:0,until:now+window};attempts.set(key,a);}if(++a.count>max)fail(429,'Muitas tentativas. Tente novamente em instantes.');}
setInterval(()=>{for(const [k,v] of attempts)if(v.until<Date.now())attempts.delete(k);},60000).unref();
const channel=(name,type,owner,priv=false)=>({id:id(),name,type,owner,private:priv,code:priv?code():null,allowed:[owner],messages:[]});
const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');const p=url.pathname;const method=req.method;if(storageBroken&&p.startsWith('/api/'))fail(503,'Banco indisponível.');
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");if(process.env.RENDER==='true')res.setHeader('Strict-Transport-Security','max-age=31536000');res.setHeader('Permissions-Policy','microphone=(self), display-capture=(self)');
  if(p==='/healthz'&&method==='GET'){
    if(storageBroken)return json(res,503,{status:'unavailable'});
    return json(res,200,{status:'ok'});
  }
  if(method==='POST'){if(req.headers['sec-fetch-site']==='cross-site')fail(403,'Origem não permitida.');if(req.headers.origin){const host=req.headers.host;let origin;try{origin=new URL(req.headers.origin);}catch{fail(403,'Origem não permitida.');}if(origin.host!==host||!['https:','http:'].includes(origin.protocol))fail(403,'Origem não permitida.');}}
  if(p==='/api/register'||p==='/api/login'){
    if(method!=='POST')fail(405,'Método inválido.');limit('auth:'+req.socket.remoteAddress,25,60000);const b=await body(req);const username=usernameOf(b.username);limit('auth-user:'+username,15,60000);const pass=typeof b.password==='string'?b.password:'';
    if(!validUsername(username)||pass.length<8||pass.length>128)fail(400,'Use um usuário de 3 a 24 caracteres (letras, números, ponto, hífen ou _) e uma senha de 8 a 128 caracteres.');
    let u=db.users.find(x=>x.username===username);
    if(p.endsWith('register')){const name=username;if(u)fail(409,'Este usuário já existe.');const salt=crypto.randomBytes(16).toString('hex');const digest=(await scrypt(pass,salt,64)).toString('hex');if(db.users.some(x=>x.username===username))fail(409,'Este usuário já existe.');u={id:id(),name,username,salt,digest};db.users.push(u);}
    else {const digest=await scrypt(pass,u?.salt||'invalid-salt',64);if(!u||!crypto.timingSafeEqual(digest,Buffer.from(u.digest,'hex')))fail(401,'Usuário ou senha incorretos.');if(u.totp&&!b.code)return json(res,200,{twoFactorRequired:true});requireSecond(u,b.code);}
    await setSession(req,res,u);return json(res,200,snapshot(u.id));
  }
  if(p.startsWith('/api/')){
    const s=session(req);if(!s?.user)fail(401,'Faça login para continuar.');const uid=s.user.id;
    if(p.startsWith('/api/avatar/')&&method==='GET') {const target=db.users.find(u=>u.id===p.slice('/api/avatar/'.length));if(!target?.avatar||!(target.id===uid||db.groups.some(g=>member(g,uid)&&member(g,target.id))))fail(404,'Foto não encontrada.');if(!target.avatarData)fail(404,'Foto não encontrada.');res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'private, no-cache'});return res.end(Buffer.from(target.avatarData,'base64'));}
    if(p==='/api/state'&&method==='GET'){cookie(req,res,s.token);return json(res,200,snapshot(uid));}
    if(p==='/api/ice'&&method==='GET'){let iceServers=[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}];if(process.env.TURN_URL&&process.env.TURN_USERNAME&&process.env.TURN_CREDENTIAL)iceServers.push({urls:process.env.TURN_URL,username:process.env.TURN_USERNAME,credential:process.env.TURN_CREDENTIAL});return json(res,200,{iceServers});}
    if(p==='/api/events'&&method==='GET'){
      const cid=clean(url.searchParams.get('client'),80);if(!/^[a-zA-Z0-9-]{10,80}$/.test(cid))fail(400,'Cliente inválido.');const old=online.get(cid);if(old&&old.uid!==uid)fail(409,'Cliente já conectado.');
      if(old){clearInterval(old.ping);online.delete(cid);old.res.end();}
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n');const client={id:cid,uid,session:s.key,res,room:null,muted:false,screen:false};online.set(cid,client);client.ping=setInterval(()=>{if(!res.destroyed)res.write(': ping\n\n');},15000);res.on('close',()=>remove(client));emit(client,'ready',{id:cid});broadcast();return;
    }
    if(method!=='POST')fail(405,'Método inválido.');if(p!=='/api/signal')limit('write:'+uid,180,60000);const b=await body(req);let result={};
    switch(p){
      case '/api/profile': {const name=clean(b.name,32);if(name.length<2)fail(400,'Nome precisa ter pelo menos 2 caracteres.');let photo;if(typeof b.avatar==='string'){if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(b.avatar))fail(400,'Foto inválida.');photo=Buffer.from(b.avatar.split(',')[1],'base64');if(photo.length>120000||photo.length<4||photo[0]!==255||photo[1]!==216||photo.at(-2)!==255||photo.at(-1)!==217)fail(400,'Foto inválida ou muito grande.');}if(photo){s.user.avatarData=photo.toString('base64');s.user.avatar=id();}else if(b.avatar===null){s.user.avatar=null;delete s.user.avatarData;fs.rmSync(path.join(DATA,uid+'.jpg'),{force:true});}s.user.name=name;s.user.bio=clean(b.bio,160);await save();break;}
      case '/api/totp-start': {limit('account:'+uid,8,60000);await requirePassword(s.user,b.currentPassword);if(s.user.totp)fail(409,'Autenticação já ativa.');const key=twoFactorKey();const secret=totp.newSecret();pendingTotp.set(uid,{secret:totp.seal(secret,key),exp:Date.now()+300000,session:s.key});return json(res,200,{secret:totp.encodeBase32(secret)});}
      case '/api/totp-confirm': {limit('account:'+uid,8,60000);await requirePassword(s.user,b.currentPassword);const pending=pendingTotp.get(uid);if(s.user.totp||!pending||pending.exp<Date.now()||pending.session!==s.key)fail(400,'Inicie a configuração novamente.');const step=totp.verify(totp.unseal(pending.secret,twoFactorKey()),b.code);if(step===null)fail(401,'Código inválido.');const recovery=Array.from({length:10},()=>crypto.randomBytes(12).toString('hex').toUpperCase());s.user.totp={secret:pending.secret,lastStep:step,recovery:recovery.map(x=>crypto.createHash('sha256').update(x).digest('hex'))};pendingTotp.delete(uid);revokeOthers(uid,s.key);await save();return json(res,200,{recovery,state:snapshot(uid)});}
      case '/api/totp-disable': {limit('account:'+uid,8,60000);await requirePassword(s.user,b.currentPassword);if(!s.user.totp)fail(400,'Autenticação não está ativa.');requireSecond(s.user,b.code);delete s.user.totp;revokeOthers(uid,s.key);await save();break;}
      case '/api/account': {limit('account:'+uid,8,60000);const username=usernameOf(b.username);const current=typeof b.currentPassword==='string'?b.currentPassword:'';const next=typeof b.newPassword==='string'?b.newPassword:'';if(!validUsername(username))fail(400,'Usuário inválido.');if(current.length>128||!current||!crypto.timingSafeEqual(await scrypt(current,s.user.salt,64),Buffer.from(s.user.digest,'hex')))fail(401,'Senha atual incorreta.');requireSecond(s.user,b.code);if(next&&(next.length<8||next.length>128))fail(400,'A nova senha deve ter de 8 a 128 caracteres.');const salt=next?crypto.randomBytes(16).toString('hex'):null;const digest=next?(await scrypt(next,salt,64)).toString('hex'):null;if(db.users.some(u=>u.id!==uid&&u.username===username))fail(409,'Este usuário já existe.');s.user.username=username;delete s.user.email;if(next){s.user.salt=salt;s.user.digest=digest;for(const k of Object.keys(db.sessions))if(k!==s.key&&db.sessions[k].user===uid)delete db.sessions[k];for(const c of [...online.values()])if(c.uid===uid&&c.session!==s.key){remove(c);c.res.end();}}await save();break;}
      case '/api/delete-account':{
        limit('account:'+uid,8,60000);const current=typeof b.currentPassword==='string'?b.currentPassword:'';
        if(!current||current.length>128||!crypto.timingSafeEqual(await scrypt(current,s.user.salt,64),Buffer.from(s.user.digest,'hex')))fail(401,'Senha atual incorreta.');requireSecond(s.user,b.code);
        for(const c of [...online.values()])if(c.uid===uid){online.delete(c.id);clearInterval(c.ping);c.res.end();}
        for(const g of db.groups){g.members=g.members.filter(m=>m!==uid);if(g.owner===uid)g.owner=g.members[0]||null;for(const c of g.channels){c.allowed=c.allowed.filter(m=>m!==uid);if(c.owner===uid)c.owner=g.owner;if(c.type==='text')for(const m of c.messages)if(m.user===uid){m.user=null;m.name='Conta excluída';}}}
        for(const k of Object.keys(db.sessions))if(db.sessions[k].user===uid)delete db.sessions[k];
        db.users=db.users.filter(u=>u.id!==uid);fs.rmSync(path.join(DATA,uid+'.jpg'),{force:true});await save();broadcast();
        res.setHeader('Set-Cookie','voxora=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return json(res,200,{ok:true});
      }
      case '/api/revoke-other-sessions': {limit('account:'+uid,8,60000);for(const k of Object.keys(db.sessions))if(k!==s.key&&db.sessions[k].user===uid)delete db.sessions[k];for(const c of [...online.values()])if(c.uid===uid&&c.session!==s.key){remove(c);c.res.end();}await save();break;}
      case '/api/logout':delete db.sessions[s.key];await save();for(const c of [...online.values()])if(c.session===s.key){remove(c);c.res.end();}res.setHeader('Set-Cookie','voxora=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return json(res,200,{ok:true});
      case '/api/groups': {const name=clean(b.name,40);if(name.length<2)fail(400,'Nome do grupo muito curto.');if(db.groups.filter(g=>g.owner===uid).length>=30)fail(400,'Limite de grupos atingido.');const g={id:id(),name,owner:uid,code:code(),members:[uid],channels:[channel('geral','text',uid),channel('Cinema','voice',uid),channel('Resenha','voice',uid)]};db.groups.push(g);await save();result={group:g.id};break;}
      case '/api/invite': {limit('invite:'+uid,12,60000);const val=clean(b.code,32).toUpperCase();const g=db.groups.find(x=>x.code===val||x.channels.some(c=>c.code===val));if(!g)fail(404,'Código de convite inválido.');const c=g.channels.find(x=>x.code===val);if(!member(g,uid))g.members.push(uid);if(!g.owner){g.owner=uid;for(const ch of g.channels)if(!ch.owner)ch.owner=uid;}if(c&&!c.allowed.includes(uid))c.allowed.push(uid);await save();result={group:g.id,channel:c?.id};break;}
      case '/api/channels': {const g=findGroup(b.group,uid);const name=clean(b.name,40);if(name.length<2)fail(400,'Nome do canal muito curto.');if(g.channels.length>=50)fail(400,'Limite de canais atingido.');const c=channel(name,b.type==='text'?'text':'voice',uid,!!b.private);g.channels.push(c);await save();result={channel:c.id};break;}
      case '/api/message': {limit('msg:'+uid,30,10000);const {c}=findRoom(b.group,b.channel,uid);const msg=clean(b.text,2000);if(c.type!=='text'||!msg)fail(400,'Mensagem inválida.');c.messages.push({id:id(),user:uid,name:s.user.name,text:msg,time:Date.now()});if(c.messages.length>500)c.messages=c.messages.slice(-500);await save();break;}
      case '/api/voice': {const client=online.get(b.client);if(!client||client.uid!==uid||client.session!==s.key)fail(409,'Conexão em tempo real indisponível.');if(b.channel){const {c}=findRoom(b.group,b.channel,uid);if(c.type!=='voice')fail(400,'Canal inválido.');if([...online.values()].filter(x=>x.room===c.id&&x.id!==client.id).length>=6)fail(409,'Canal cheio (6 participantes no protótipo).');client.room=c.id;client.muted=!!b.muted;client.screen=false;}else{client.room=null;client.screen=false;}break;}
      case '/api/status': {const client=online.get(b.client);if(!client||client.uid!==uid||client.session!==s.key||!client.room)fail(409,'Você não está em uma chamada.');if(typeof b.muted==='boolean')client.muted=b.muted;if(typeof b.screen==='boolean')client.screen=b.screen;break;}
      case '/api/signal': {limit('signal:'+uid,600,60000);const a=online.get(b.client),z=online.get(b.to);if(!a||a.uid!==uid||a.session!==s.key||!a.room||!z||z.room!==a.room)fail(403,'Participante indisponível.');if(!b.signal||typeof b.signal!=='object')fail(400,'Sinal inválido.');emit(z,'signal',{from:a.id,signal:b.signal});return json(res,200,{ok:true});}
      case '/api/delete-channel': {const {g,c}=findRoom(b.group,b.channel,uid);if(c.owner!==uid&&g.owner!==uid)fail(403,'Sem permissão.');if(g.channels.length===1)fail(400,'Mantenha pelo menos um canal.');for(const x of online.values())if(x.room===c.id){x.room=null;x.screen=false;}g.channels=g.channels.filter(x=>x.id!==c.id);await save();break;}
      default:fail(404,'Rota não encontrada.');
    }
    broadcast();return json(res,200,{ok:true,...result,state:snapshot(uid)});
  }
  if(method!=='GET'&&method!=='HEAD')fail(405,'Método inválido.');const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/logo.svg':'logo.svg','/pitch-worklet.js':'pitch-worklet.js'};const name=files[p];if(!name)fail(404,'Página não encontrada.');const mime={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'application/javascript; charset=utf-8',svg:'image/svg+xml'};res.writeHead(200,{'Content-Type':mime[name.split('.').pop()],'Cache-Control':'no-cache'});res.end(method==='HEAD'?undefined:fs.readFileSync(path.join(ROOT,name)));
}catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'Erro interno do servidor.'});else res.end();if(!e.status)console.error(JSON.stringify({event:'request_failure',status:500,time:new Date().toISOString()}));}});
initStorage().then(()=>server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Voxora disponível na porta '+(process.env.PORT||3000)))).catch(e=>{console.error('Falha ao inicializar armazenamento:',e.message);process.exit(1);});
