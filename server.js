const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=Number(process.env.PORT)||3000,HOST=process.env.HOST||'0.0.0.0',ROOT=__dirname;
const STORAGE_DIR=process.env.DATA_DIR||ROOT,DATA_FILE=path.join(STORAGE_DIR,'server-data.json'),ADS_DIR=path.join(ROOT,'assets','ads');
const PAYMENT_LINKS={month:process.env.NEQUI_MONTH_URL||'https://checkout.nequi.wompi.co/l/8FuLeo',year:process.env.NEQUI_YEAR_URL||'https://checkout.nequi.wompi.co/l/cV1z6Y'};
fs.mkdirSync(STORAGE_DIR,{recursive:true});fs.mkdirSync(ADS_DIR,{recursive:true});
const LEVELS=Object.fromEntries(Array.from({length:50},(_,i)=>[i+1,{reward:10,time:55-(i%10)*5}]));
const BLOCKS={1:{from:1,to:10,reward:200},2:{from:11,to:20,reward:300},3:{from:21,to:30,reward:400},4:{from:31,to:40,reward:500},5:{from:41,to:50,reward:600}};
const activeSessions=new Map();
let data={members:[{id:crypto.randomUUID(),code:'CM-DEMO-2026',name:'Jugador Demo',email:'demo@example.com',active:true,balance:100,expiresAt:null,zeroDate:null}],subscriptions:[]};
try{if(fs.existsSync(DATA_FILE))data=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));}catch{}
data.members??=[];data.subscriptions??=[];data.ads??=[];
const legacyProgress=Object.prototype.hasOwnProperty.call(data,'levelResults')||data.members.some(m=>Object.prototype.hasOwnProperty.call(m,'currentLevel'));
for(const m of data.members){m.id??=crypto.randomUUID();m.balance=Number.isFinite(Number(m.balance))?Math.max(0,Math.floor(Number(m.balance))):100;m.active=!!m.active;m.zeroDate??=null;delete m.currentLevel;}
if(legacyProgress)delete data.levelResults;
function persist(){fs.writeFileSync(DATA_FILE,JSON.stringify(data,null,2));}
if(legacyProgress)persist();
function bogotaDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function nextBogotaMidnight(){const now=new Date(),parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),y=parts.find(x=>x.type==='year').value,mo=parts.find(x=>x.type==='month').value,d=parts.find(x=>x.type==='day').value;return Date.parse(`${y}-${mo}-${d}T05:00:00Z`)+86400000;}
function resetDailyIfNeeded(m){const today=bogotaDate();if(m.balance<=0&&m.zeroDate&&m.zeroDate!==today){m.balance=100;m.zeroDate=null;persist();}return m;}
function activeMember(code){const c=String(code||'').trim().toUpperCase(),m=data.members.find(x=>x.code===c&&x.active);if(!m)return null;if(m.expiresAt&&Date.now()>=m.expiresAt){m.active=false;persist();return null}resetDailyIfNeeded(m);return m;}
function expireMembers(){let changed=false;const now=Date.now();for(const m of data.members){if(m.active&&m.expiresAt&&now>=m.expiresAt){m.active=false;changed=true;}}if(changed)persist();return changed;}
function rankingList(){expireMembers();return data.members.filter(m=>m.active).sort((a,b)=>(b.balance||0)-(a.balance||0)||String(a.name).localeCompare(String(b.name)));}
function ranking(){return rankingList().slice(0,20).map((m,i)=>({position:i+1,id:m.id,name:m.name,balance:m.balance}));}
function rankingMember(code){const a=rankingList(),i=a.findIndex(m=>m.code===String(code||'').trim().toUpperCase());if(i<0)return null;return{position:i+1,id:a[i].id,name:a[i].name,balance:a[i].balance,inTop20:i<20};}
function body(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}})});}
function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
function levelResult(m,level,success){
  const n=Math.floor(Number(level));if(!m||!Number.isInteger(n)||n<1||n>50)return{ok:false,error:'Nivel inválido.'};
  resetDailyIfNeeded(m);if(m.balance<=0)return{ok:false,error:'Saldo agotado. Espera hasta el siguiente día.',balance:0,blockedUntil:nextBogotaMidnight()};
  const levelReward=LEVELS[n].reward;
  let delta=success?levelReward:-levelReward,blockBonus=0;
  if(success&&n%10===0){blockBonus=BLOCKS[Math.floor((n-1)/10)+1].reward;delta+=blockBonus;}
  m.balance=Math.max(0,m.balance+delta);
  if(m.balance===0)m.zeroDate=bogotaDate();
  const out={balance:m.balance,delta,levelReward:success?levelReward:-levelReward,blockBonus,blocked:m.balance===0,blockedUntil:m.balance===0?nextBogotaMidnight():null};
  persist();return{ok:true,...out};
}
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
if(req.method==='POST'&&u.pathname==='/api/member/validate'){
  const b=await body(req),m=activeMember(b.code);
  if(!m)return json(res,403,{valid:false,error:'Código no válido o membresía inactiva.'});
  const sessionId=crypto.randomBytes(24).toString('hex');
  activeSessions.set(sessionId,{memberId:m.id,currentLevel:1,createdAt:Date.now(),lastSeen:Date.now()});
  return json(res,200,{valid:true,code:m.code,name:m.name,balance:m.balance,sessionId, currentLevel:1,blockedUntil:m.balance<=0?nextBogotaMidnight():null});
}
if(req.method==='GET'&&u.pathname==='/healthz')return json(res,200,{ok:true,service:'strongbox'});
if(req.method==='GET'&&u.pathname==='/api/member/balance'){const m=activeMember(u.searchParams.get('code'));return json(res,m?200:403,m?{name:m.name,balance:m.balance,blockedUntil:m.balance<=0?nextBogotaMidnight():null}:{error:'Membresía no válida.'});}
if(req.method==='POST'&&u.pathname==='/api/member/level-result'){
  const b=await body(req),m=activeMember(b.code),session=activeSessions.get(String(b.sessionId||''));
  if(!m||!session||session.memberId!==m.id)return json(res,403,{error:'Sesión de juego no válida. Activa nuevamente la membresía.'});
  session.lastSeen=Date.now();
  const level=Math.floor(Number(b.level));
  if(level!==session.currentLevel)return json(res,400,{error:`Debes completar el Nivel ${session.currentLevel} antes de continuar.`,currentLevel:session.currentLevel});
  const r=levelResult(m,level,!!b.success);
  if(r.ok&&b.success)session.currentLevel=Math.min(50,session.currentLevel+1);
  return json(res,r.ok?200:400,{...r,currentLevel:session.currentLevel});
}
if(req.method==='GET'&&u.pathname==='/api/ranking'){if(!activeMember(u.searchParams.get('code')))return json(res,403,{error:'Membresía no válida.'});return json(res,200,{ranking:ranking()});}
if(req.method==='GET'&&u.pathname==='/api/ranking/search'){if(!activeMember(u.searchParams.get('code')))return json(res,403,{error:'Membresía no válida.'});const m=rankingMember(u.searchParams.get('memberCode'));return json(res,m?200:404,m?{member:m}:{error:'Miembro no encontrado o inactivo.'});}
if(req.method==='POST'&&u.pathname==='/api/subscriptions'){
  const b=await body(req),name=String(b.name||'').trim().slice(0,60),email=String(b.email||'').trim().toLowerCase(),plan=b.plan==='year'?'year':'month';
  if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json(res,400,{error:'Datos de suscripción inválidos.'});
  const sub={id:crypto.randomUUID(),name,email,plan,price:plan==='year'?49000:6000,status:'pending',paymentClicked:false,paymentClickedAt:null,createdAt:Date.now(),verifiedAt:null,code:null};
  data.subscriptions.push(sub);persist();
  return json(res,201,{id:sub.id,status:sub.status});
}
if(req.method==='POST'&&u.pathname.match(/^\/api\/subscriptions\/[^/]+\/payment-click$/)){
  const id=u.pathname.split('/')[3],sub=data.subscriptions.find(x=>x.id===id);
  if(!sub)return json(res,404,{error:'Solicitud de suscripción no encontrada.'});
  sub.paymentClicked=true;sub.paymentClickedAt=Date.now();persist();
  return json(res,200,{ok:true,paymentUrl:PAYMENT_LINKS[sub.plan]});
}
if(req.method==='POST'&&u.pathname==='/api/admin/login'){const b=await body(req),ok=b.code===(process.env.ADMIN_CODE||'CM-ADMIN-2026');return json(res,ok?200:401,{ok});}
if(req.method==='GET'&&u.pathname==='/api/admin/members'){expireMembers();return json(res,200,{members:data.members});}
if(req.method==='GET'&&u.pathname==='/api/ads'){expireMembers();const now=Date.now();return json(res,200,{ads:data.ads.filter(a=>a.active&&(!a.startAt||now>=a.startAt)&&(!a.endAt||now<a.endAt)).slice(-10)});}
if(req.method==='GET'&&u.pathname==='/api/admin/ads'){const now=Date.now();let changed=false;for(const a of data.ads){if(a.endAt&&now>=a.endAt&&a.active){a.active=false;changed=true}}if(changed)persist();return json(res,200,{ads:data.ads.slice().reverse()});}
if(req.method==='POST'&&u.pathname==='/api/admin/ads'){const b=await body(req),image=String(b.imageData||''),link=String(b.link||'').trim(),startAt=Number(b.startAt),endAt=Number(b.endAt);if(!image.startsWith('data:image/'))return json(res,400,{error:'Imagen inválida.'});if(image.length>7_000_000)return json(res,413,{error:'La imagen es demasiado grande. Máximo aproximado: 5 MB.'});if(data.ads.length>=10)return json(res,400,{error:'Máximo 10 anuncios permitidos.'});if(!Number.isFinite(startAt)||!Number.isFinite(endAt)||startAt>=endAt)return json(res,400,{error:'Debes indicar una fecha de inicio y una fecha de finalización válidas.'});const match=image.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);if(!match)return json(res,400,{error:'Formato no permitido. Usa PNG, JPG o WebP.'});const ext=match[1]==='jpeg'?'jpg':match[1],id=crypto.randomUUID(),dir=path.join(ROOT,'assets','ads');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,id+'.'+ext),Buffer.from(match[2],'base64'));const now=Date.now();const ad={id,image:'/ads/'+id+'.'+ext,link,active:now>=startAt&&now<endAt,startAt,endAt,createdAt:now};data.ads.push(ad);persist();return json(res,201,{ad});}
if(req.method==='PATCH'&&u.pathname.match(/^\/api\/admin\/ads\/[^/]+$/)){const id=u.pathname.split('/').pop(),b=await body(req),ad=data.ads.find(x=>x.id===id);if(!ad)return json(res,404,{error:'Anuncio no encontrado.'});if('active' in b)ad.active=!!b.active;if('link' in b)ad.link=String(b.link||'').trim();if('startAt' in b)ad.startAt=Number(b.startAt);if('endAt' in b)ad.endAt=Number(b.endAt);if(!Number.isFinite(ad.startAt)||!Number.isFinite(ad.endAt)||ad.startAt>=ad.endAt)return json(res,400,{error:'Las fechas del anuncio no son válidas.'});const now=Date.now();if(now>=ad.endAt)ad.active=false;else if(now<ad.startAt)ad.active=false;persist();return json(res,200,{ad});}
if(req.method==='DELETE'&&u.pathname.match(/^\/api\/admin\/ads\/[^/]+$/)){const id=u.pathname.split('/').pop(),ad=data.ads.find(x=>x.id===id);if(!ad)return json(res,404,{error:'Anuncio no encontrado.'});try{const stored=String(ad.image||'');if(stored.startsWith('/ads/'))fs.unlinkSync(path.join(ADS_DIR,path.basename(stored)));else if(stored.startsWith('assets/ads/'))fs.unlinkSync(path.join(ROOT,stored));}catch{}data.ads=data.ads.filter(x=>x.id!==id);persist();return json(res,200,{ok:true});}
if(req.method==='GET'&&u.pathname==='/api/admin/subscriptions')return json(res,200,{subscriptions:data.subscriptions});
if(req.method==='POST'&&u.pathname.match(/^\/api\/admin\/subscriptions\/[^/]+\/activate$/)){const id=u.pathname.split('/')[4],sub=data.subscriptions.find(x=>x.id===id);if(!sub)return json(res,404,{error:'Solicitud no encontrada.'});if(sub.status==='active')return json(res,200,{subscription:sub});const code='CM-'+crypto.randomBytes(2).toString('hex').toUpperCase()+'-'+crypto.randomBytes(2).toString('hex').toUpperCase(),days=sub.plan==='year'?365:30,startedAt=Date.now(),expiresAt=startedAt+days*86400000,member={id:crypto.randomUUID(),code,name:sub.name,email:sub.email,active:true,balance:100,startedAt,expiresAt,zeroDate:null};data.members.push(member);sub.status='active';sub.verifiedAt=Date.now();sub.code=code;sub.memberId=member.id;persist();return json(res,200,{subscription:sub,member});}
if(req.method==='POST'&&u.pathname==='/api/admin/members'){const b=await body(req),name=String(b.name||'').trim().slice(0,60),email=String(b.email||'').trim().toLowerCase();if(!name)return json(res,400,{error:'Nombre obligatorio.'});const code=String(b.code||('CM-'+crypto.randomBytes(2).toString('hex').toUpperCase()+'-'+crypto.randomBytes(2).toString('hex').toUpperCase())).toUpperCase();if(data.members.some(m=>m.code===code))return json(res,409,{error:'Ese código ya existe.'});const m={id:crypto.randomUUID(),code,name,email,active:true,balance:100,startedAt:Date.now(),expiresAt:null,zeroDate:null};data.members.push(m);persist();return json(res,201,{member:m});}
const mm=req.method==='PATCH'&&u.pathname.match(/^\/api\/admin\/members\/([^/]+)$/);if(mm){const code=decodeURIComponent(mm[1]),b=await body(req),m=data.members.find(x=>x.code===code);if(!m)return json(res,404,{error:'No existe.'});if('active'in b)m.active=!!b.active;if('balance'in b&&Number.isFinite(Number(b.balance)))m.balance=Math.max(0,Math.floor(Number(b.balance)));persist();return json(res,200,{member:m});}
let file=u.pathname==='/'?'/index.html':u.pathname;if(file==='/admin')file='/admin.html';if(file.startsWith('/ads/')){const ap=path.normalize(path.join(ADS_DIR,path.basename(file)));if(!ap.startsWith(ADS_DIR))return json(res,403,{error:'Forbidden'});return fs.readFile(ap,(e,buf)=>{if(e){res.writeHead(404);return res.end('Not found')}const ext=path.extname(ap),types={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'public, max-age=3600'});res.end(buf);});}
const fp=path.normalize(path.join(ROOT,file));if(!fp.startsWith(ROOT))return json(res,403,{error:'Forbidden'});fs.readFile(fp,(e,buf)=>{if(e){res.writeHead(404);return res.end('Not found')}const ext=path.extname(fp),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'});res.end(buf);});
}catch(e){console.error(e);json(res,500,{error:'Error interno'});}});server.listen(PORT,HOST,()=>console.log(`STRONGBOX listening on ${HOST}:${PORT}`));

setInterval(expireMembers,60000);
