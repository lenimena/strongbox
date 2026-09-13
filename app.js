const SESSION_KEY='strongboxSessionV2';
const MAX_MEMBER_LEVEL=50, MAX_VISITOR_LEVEL=30;
const LEVELS=Object.fromEntries(Array.from({length:50},(_,i)=>{const level=i+1,block=Math.floor(i/10)+1;let min=2,max=2;if(block===2)min=max=3;else if(block>=3)min=max=4;if(block===5)min=max=5;return [level,{time:55-(i%10)*5,min,max,reward:10,block}]}));
const BLOCKS={
  1:{from:1,to:10,title:'SACO DE DINERO',reward:200,image:'assets/saco-dinero.png'},
  2:{from:11,to:20,title:'LINGOTE DE PLATA',reward:300,image:'assets/lingote-plata.png'},
  3:{from:21,to:30,title:'LINGOTE DE ORO',reward:400,image:'assets/lingote-oro.png'},
  4:{from:31,to:40,title:'ESMERALDAS',reward:500,image:'assets/esmeraldas.png'},
  5:{from:41,to:50,title:'DIAMANTE',reward:600,image:'assets/diamante.png'}
};
const $=s=>document.querySelector(s), coins=n=>`${new Intl.NumberFormat('es-CO',{maximumFractionDigits:0}).format(Number(n)||0)} ClicCoin`;
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null')||{member:false,memberCode:'',memberName:'',balance:0,currentLevel:1,blockedUntil:null,sessionId:''};
state.currentLevel=Math.min(state.member?MAX_MEMBER_LEVEL:MAX_VISITOR_LEVEL,Math.max(1,Number(state.currentLevel)||1));
let rankingData=[],timerId=null,pendingView=null,adsData=[],adTimer=null,adIndex=0;
let game={level:1,target:'',board:[],revealed:[],progress:0,attempts:0,finished:false,timeLeft:55};

function save(){sessionStorage.setItem(SESSION_KEY,JSON.stringify(state));updateUI();}
function updateUI(){
  $('#session-label').textContent=state.member?(state.memberName||'Miembro'):'Visitante';
  $('#session-status').textContent=state.member?'Miembro activo':'Modo visitante';
  $('#account-access').textContent=state.member?'Miembro activo':'Visitante';
  $('#account-rooms').textContent='Juego individual';
  $('#account-balance').textContent=state.member?coins(state.balance):'Sin ClicCoin';
  $('#balance').textContent=state.member?coins(state.balance):'Sin ClicCoin';
  $('#home-balance').textContent=state.member?coins(state.balance):'Sin ClicCoin';
  $('#ranking-card').hidden=!state.member; $('#ranking-nav').disabled=!state.member; $('#ad-banner').hidden=state.member;
  renderLevels();
}
function currentBlock(level=state.currentLevel){return Math.floor((level-1)/10)+1;}
function renderLevels(){
  const wrap=$('#levels-grid');if(!wrap)return;wrap.innerHTML='';
  const limit=state.member?MAX_MEMBER_LEVEL:MAX_VISITOR_LEVEL,n=Math.min(limit,Math.max(1,Number(state.currentLevel)||1));
  const b=currentBlock(n),cfg=LEVELS[n],block=BLOCKS[b];
  const card=document.createElement('button');card.type='button';card.className='level-card current';
  card.innerHTML=`<span class="level-num">${n}</span><div><b>Nivel ${n}</b><small>Bloque ${b} · ⏱ ${cfg.time}s · 🔢 ${cfg.min}${cfg.max!==cfg.min?'–'+cfg.max:''} cifras</small><small>${state.member?`Premio: +${coins(cfg.reward)}`:'Sin ClicCoin · visitante'}</small></div><span class="level-arrow">JUGAR →</span>`;
  card.onclick=()=>startGame(n);wrap.appendChild(card);
  const prize=document.createElement('div');prize.className='block-prize';
  prize.innerHTML=`<img class="block-icon-img" src="${block.image}" alt="${block.title}"><div class="block-prize-copy"><b>Bloque ${b}: ${block.title}</b><small>Niveles ${block.from}–${block.to} · Premio especial al completarlo: <strong>+${coins(block.reward)}</strong></small></div>`;
  wrap.appendChild(prize);
  const note=document.createElement('p');note.className='level-progress';
  note.textContent=state.member?(n===50?'Nivel 50 · último desafío · 5 bloques disponibles':`Nivel actual: ${n} de 50 · Bloque ${b} de 5`):(n>=30?'Bloque 3 completado · Hazte miembro para desbloquear los bloques 4 y 5':`Nivel actual: ${n} de 30 · Visitante · ${30-n} niveles de prueba restantes`);
  wrap.appendChild(note);
}
async function refreshAds(){if(state.member)return;try{const r=await fetch('/api/ads?ts='+Date.now(),{cache:'no-store'});if(!r.ok)return;const d=await r.json();adsData=d.ads||[];renderAds();}catch{}}
function renderAds(){const root=$('#ad-banner');if(!root)return;if(!adsData.length){root.innerHTML='<div class="ad-image"><img src="assets/gta-banner.svg" alt="Publicidad de prueba"></div><div class="ad-copy"><span>PUBLICIDAD · ESPACIO PARA ANUNCIANTE</span><b>GTA V</b><small>Banner de prueba para usuarios visitantes.</small></div>';root.onclick=null;return;}adIndex=Math.min(adIndex,adsData.length-1);const a=adsData[adIndex];root.innerHTML=`<div class="ad-image"><img src="${a.image}" alt="Publicidad"></div><div class="ad-copy"><span>PUBLICIDAD</span><b>${adIndex+1} / ${adsData.length}</b><small>Toque para visitar el anuncio</small></div>`;root.onclick=()=>{if(a.link)window.open(a.link,'_blank','noopener,noreferrer')};root.classList.add('carousel-ad');clearInterval(adTimer);if(adsData.length>1)adTimer=setInterval(()=>{adIndex=(adIndex+1)%adsData.length;renderAds()},5000)}
function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));const v=$('#'+id);if(v)v.classList.add('active');document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===id));}
function gameIsActive(){return $('#game')?.classList.contains('active')&&!game.finished}
function openLeaveConfirm(next){pendingView=next||'home';$('#leave-modal').classList.add('show')}
function closeLeaveConfirm(){pendingView=null;$('#leave-modal').classList.remove('show')}
function stopTimer(){if(timerId){clearInterval(timerId);timerId=null}}
function leaveGameAndNavigate(){const next=pendingView||'home';closeLeaveConfirm();stopTimer();game.finished=true;if(next==='__logout__'){sessionStorage.removeItem(SESSION_KEY);location.reload();return}if(next==='__admin__'){location.href='admin.html';return}show(next)}
function navigateTo(id){
  if(id==='game')return show(id);
  if(gameIsActive())return openLeaveConfirm(id);
  if(id==='ranking'){
    if(!state.member)return show('home');
    show('home');refreshRanking();setTimeout(()=>$('#ranking-card')?.scrollIntoView({behavior:'smooth',block:'start'}),40);return;
  }
  show(id);if(id==='home'){refreshRanking();refreshAds();}
}
function bindSafeNavigation(){document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();if(!b.disabled)navigateTo(b.dataset.view)},true));document.querySelectorAll('[data-back]').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();navigateTo('home')},true))}
async function activateCode(){
  const code=$('#member-code').value.trim().toUpperCase();
  try{const r=await fetch('/api/member/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Código no válido.');
    state={...state,member:true,memberCode:d.code,memberName:d.name||'Miembro',balance:Number(d.balance)||0,blockedUntil:d.blockedUntil||null,sessionId:d.sessionId||''};
    save();$('#member-error').textContent='';show('home');refreshRanking();alert('Membresía activada correctamente. El progreso de niveles es temporal y solo se conserva durante esta sesión.');
  }catch(e){$('#member-error').textContent=e.message||'Código no válido o membresía no activa.'}
}
async function submitMembership(){
  const name=$('#sub-name').value.trim(),email=$('#sub-email').value.trim().toLowerCase(),confirm=$('#sub-email-confirm').value.trim().toLowerCase(),plan=$('input[name="plan"]:checked')?.value;
  if(!name||!email||!confirm){$('#sub-error').textContent='Completa nombre y los dos correos.';return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$('#sub-error').textContent='Introduce un correo válido.';return}
  if(email!==confirm){$('#sub-error').textContent='Los correos no coinciden.';return}
  try{const r=await fetch('/api/subscriptions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,plan})});const d=await r.json();if(!r.ok)throw new Error(d.error||'No se pudo registrar la solicitud.');
    $('#payment-title').textContent=plan==='month'?'Membresía mensual · $6.000 COP':'Membresía anual · $49.000 COP';$('#payment-text').textContent='Solicitud registrada como pendiente. Realiza el pago mediante el enlace correspondiente de Nequi Negocio. La activación será verificada en un plazo de hasta 24 horas.';
    $('#payment-link').dataset.subscriptionId=d.id;$('#payment-link').href='#';$('#payment-link').textContent='CONTINUAR CON EL PAGO';$('#payment-link').classList.add('primary-btn');$('#payment-modal').classList.add('show');$('#sub-error').textContent='';
  }catch(e){$('#sub-error').textContent=e.message||'Error registrando la suscripción.'}
}
async function syncBalance(){if(!state.member)return;try{const r=await fetch('/api/member/balance?code='+encodeURIComponent(state.memberCode));if(!r.ok)return;const d=await r.json();state.balance=Number(d.balance)||0;state.blockedUntil=d.blockedUntil||null;save()}catch{}}
async function refreshRanking(){if(!state.member)return;try{const r=await fetch('/api/ranking?code='+encodeURIComponent(state.memberCode)+'&ts='+Date.now(),{cache:'no-store'});if(!r.ok)return;const d=await r.json();rankingData=d.ranking||[];renderRanking()}catch{}}
function renderRanking(){const list=$('#ranking-list');if(!list)return;if(!rankingData.length){list.innerHTML='<p class="notice">Aún no hay miembros con ClicCoin acumulado.</p>';return}list.innerHTML=rankingData.map(m=>`<div class="ranking-row"><b class="rank-pos">${m.position}</b><span class="rank-name">${escapeHtml(m.name)}</span><strong>${coins(m.balance)}</strong></div>`).join('')}
async function searchRankingMember(){if(!state.member)return;const code=$('#ranking-code-search').value.trim().toUpperCase(),result=$('#ranking-search-result');if(!code){result.textContent='Introduce el código del miembro.';return}result.textContent='Buscando…';try{const r=await fetch('/api/ranking/search?code='+encodeURIComponent(state.memberCode)+'&memberCode='+encodeURIComponent(code));const d=await r.json();if(!r.ok)throw new Error(d.error);result.innerHTML=`<b>${escapeHtml(d.member.name)}</b> · Puesto <b>#${d.member.position}</b> · ${coins(d.member.balance)}${d.member.inTop20?' · Top 20.':''}`}catch(e){result.textContent=e.message||'No encontrado.'}}
function randomTarget(cfg){let s='';for(let i=0;i<cfg.max;i++)s+=(i===0?String(1+Math.floor(Math.random()*9)):String(Math.floor(Math.random()*10)));return s}
function buildBoard(target){const req=target.split(''),used=new Set(req),f=[];for(let d=0;d<=9&&f.length<16-req.length;d++)if(!used.has(String(d)))f.push(String(d));while(f.length<16-req.length)f.push(String(Math.floor(Math.random()*10)));const b=[...req,...f];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
function startGame(level){
  const limit=state.member?MAX_MEMBER_LEVEL:MAX_VISITOR_LEVEL;if(level!==state.currentLevel||level>limit)return;
  if(state.member&&state.balance<=0){alert('Tu saldo llegó a cero. Debes esperar hasta el siguiente día para recibir nuevamente 100 ClicCoin.');return}
  const cfg=LEVELS[level];closeLeaveConfirm();closeModal();stopTimer();game={level,target:randomTarget(cfg),board:[],revealed:[],progress:0,attempts:0,finished:false,timeLeft:cfg.time};game.board=buildBoard(game.target);show('game');
  $('#game-mode').textContent=`NIVEL ${level} · BLOQUE ${cfg.block} · ${cfg.time} SEGUNDOS`;$('#target-number').textContent=game.target;$('#attempts').textContent='0';$('#game-status').textContent='Buscando';
  $('#game-reward').textContent=state.member?`Acierto: +${coins(cfg.reward)} · Fallo: −${coins(cfg.reward)}`:'Modo visitante · sin ClicCoin';updateTimerUI();renderBoard();startTimer();
}
function formatTime(s){return `00:${String(s).padStart(2,'0')}`}
function updateTimerUI(){const el=$('#game-timer');el.textContent=formatTime(game.timeLeft);el.classList.toggle('warning',game.timeLeft<=15&&game.timeLeft>5);el.classList.toggle('danger',game.timeLeft<=5)}
function startTimer(){timerId=setInterval(()=>{if(game.finished)return stopTimer();game.timeLeft=Math.max(0,game.timeLeft-1);updateTimerUI();if(game.timeLeft===0)timeExpired()},1000)}
function finishModal(title,eyebrow,text,delta=0,buttonText='CONTINUAR',kind='normal'){
  $('#modal-eyebrow').textContent=eyebrow;$('#modal-title').textContent=title;$('#modal-text').textContent=text;
  $('#modal-balance').textContent=state.member?(delta?`${delta>0?'+':''}${coins(Math.abs(delta))} · Saldo: ${coins(state.balance)}`:coins(state.balance)):'Sin ClicCoin';
  $('#new-game').hidden=false;$('#new-game').textContent=buttonText;$('#new-game-help').hidden=false;
  $('#new-game-help').textContent=kind==='loss'?(state.member?(state.balance<=0?'Saldo en cero. Espera hasta el siguiente día para recibir nuevamente 100 ClicCoin.':'No avanzas de nivel. Debes superar este mismo nivel para continuar.'):'No se acumulan ClicCoin en modo visitante.'):(state.member?'Solo al superar este nivel se desbloquea el siguiente.':'Los visitantes pueden jugar hasta el Nivel 30.');
  $('#modal').classList.add('show');
}
async function applyResult(success){
  if(!state.member)return null;
  try{const r=await fetch('/api/member/level-result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:state.memberCode,sessionId:state.sessionId,level:game.level,success})});const d=await r.json();if(!r.ok)throw new Error(d.error||'No se pudo actualizar el saldo.');
    state.balance=Number(d.balance)||0;state.blockedUntil=d.blockedUntil||null;if(Number.isInteger(Number(d.currentLevel)))state.currentLevel=Number(d.currentLevel);save();refreshRanking();return d;
  }catch(e){return{error:e.message}}
}
async function timeExpired(){if(game.finished)return;game.finished=true;stopTimer();$('#game-status').textContent='TIEMPO AGOTADO';const d=await applyResult(false);const loss=d&&!d.error?d.levelReward:0;const bal=d&&!d.error?d.balance:state.balance;finishModal('Clave no descubierta','Tiempo agotado',`No descubriste la clave del Nivel ${game.level}. Permaneces en el Nivel ${game.level}.${bal<=0?' Tu saldo llegó a 0.':''}`,loss,'REINTENTAR NIVEL','loss')}
function renderBoard(){const board=$('#board');board.innerHTML='';for(let i=0;i<16;i++){const b=document.createElement('button');b.className='cell';b.type='button';if(game.revealed.includes(i)){b.classList.add('revealed');b.dataset.digit=game.board[i]}else b.innerHTML='<img src="assets/moneda.svg" alt="Número oculto">';b.onclick=()=>pick(i,b);board.appendChild(b)}}
function revealCell(index,digit,error=false){game.revealed=game.revealed.filter(x=>x!==index);game.revealed.push(index);const b=$('#board').children[index];b.classList.add(error?'error-reveal':'revealed');b.dataset.digit=digit;b.innerHTML=''}
async function pick(i,btn){
  if(game.finished||game.revealed.includes(i)||game.timeLeft<=0)return;
  game.attempts++;const digit=game.board[i];revealCell(i,digit);$('#attempts').textContent=game.attempts;
  if(digit===game.target[game.progress]){
    game.progress++;$('#game-status').textContent='Correcto';
    if(game.progress===game.target.length){
      game.finished=true;stopTimer();const previousLevel=game.level;const d=await applyResult(true);if(!state.member)state.currentLevel=Math.min(MAX_VISITOR_LEVEL,previousLevel+1);save();const levelReward=d&&!d.error?d.levelReward:0,blockBonus=d&&!d.error?d.blockBonus:0,delta=d&&!d.error?d.delta:levelReward+blockBonus,next=state.currentLevel,block=BLOCKS[currentBlock(previousLevel)],completedBlock=previousLevel%10===0;
      if(!state.member&&previousLevel===MAX_VISITOR_LEVEL)finishModal('¡Bloque 3 completado!','🔒 MEMBRESÍA REQUERIDA','Has completado los 30 niveles de prueba. Hazte miembro para desbloquear los niveles 31 al 50, acumular ClicCoin y aparecer en el Ranking Millonario.',0,'OBTENER MEMBRESÍA');
      else if(completedBlock)finishModal(`¡Bloque ${block.title} completado!`,'🏆 BLOQUE COMPLETADO',`Has dominado los niveles ${block.from} al ${block.to}. Premio especial: +${coins(block.reward)}.`,delta,next<=MAX_MEMBER_LEVEL?'SIGUIENTE NIVEL':'FINALIZAR');
      else if(previousLevel===MAX_MEMBER_LEVEL)finishModal('¡STRONGBOX COMPLETADO!','💎 NIVEL 50 SUPERADO','Descubriste la última clave y completaste los 5 bloques.',delta,'VOLVER AL MENÚ');
      else finishModal(`¡Nivel ${previousLevel} superado!`,'🔓 NIVEL DESBLOQUEADO',`Clave ${game.target} descubierta. Recompensa del nivel: +${coins(levelReward)}. Ahora está disponible el Nivel ${next}.`,delta,'SIGUIENTE NIVEL');
    }
  }else{
    $('#game-status').textContent='Incorrecto';btn.classList.remove('revealed');btn.classList.add('error-reveal');
    setTimeout(()=>{if(!game.finished){game.revealed=[];game.progress=0;renderBoard();$('#game-status').textContent='Buscando'}},700);
  }
}
function closeModal(){$('#modal').classList.remove('show')}
$('#ranking-search-btn').onclick=searchRankingMember;$('#ranking-code-search').onkeydown=e=>{if(e.key==='Enter')searchRankingMember()};$('#confirm-member').onclick=activateCode;$('#membership-submit').onclick=submitMembership;$('#close-modal').onclick=closeModal;$('#payment-link').onclick=async e=>{e.preventDefault();const id=$('#payment-link').dataset.subscriptionId;if(!id)return;try{const r=await fetch('/api/subscriptions/'+encodeURIComponent(id)+'/payment-click',{method:'POST'});const d=await r.json();if(!r.ok)throw new Error(d.error||'No se pudo iniciar el pago.');window.location.href=d.paymentUrl;}catch(err){$('#sub-error').textContent=err.message||'No se pudo abrir el pago.'}};$('#close-payment').onclick=()=>$('#payment-modal').classList.remove('show');$('#stay-game').onclick=closeLeaveConfirm;$('#confirm-leave').onclick=leaveGameAndNavigate;
$('#new-game').onclick=()=>{const finishedLevel=game.level;if(!state.member&&finishedLevel===MAX_VISITOR_LEVEL){closeModal();show('membership');return}if(state.member&&finishedLevel===MAX_MEMBER_LEVEL){closeModal();show('home');return}closeModal();if(state.member&&state.balance<=0){alert('Debes esperar hasta el siguiente día para recibir nuevamente 100 ClicCoin.');show('home');return}startGame(state.currentLevel)};
$('#open-membership').onclick=()=>navigateTo('membership');$('#activate-btn').onclick=()=>navigateTo('member');$('#logout').onclick=()=>{if(gameIsActive())return openLeaveConfirm('__logout__');sessionStorage.removeItem(SESSION_KEY);location.reload()};
const adminLink=$('a[href="admin.html"]');if(adminLink)adminLink.onclick=e=>{if(gameIsActive()){e.preventDefault();openLeaveConfirm('__admin__')}};bindSafeNavigation();updateUI();if(state.member){syncBalance();refreshRanking()}else refreshAds();
