(() => {
  'use strict';
  const PIN_KEY='fin360-security-pin-v1';
  const ENABLED_KEY='fin360-security-enabled';
  const IDLE_KEY='fin360-security-idle-minutes';
  const LAST_KEY='fin360-security-last-active';
  let locked=false, idleTimer=null;
  const enc=new TextEncoder();
  const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode('FIN360::'+value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const enabled=()=>localStorage.getItem(ENABLED_KEY)==='1' && !!localStorage.getItem(PIN_KEY);
  const idleMinutes=()=>Math.max(1,Math.min(60,+(localStorage.getItem(IDLE_KEY)||5)));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const style=document.createElement('style');
  style.textContent=`
  .fin360-lock{display:none;position:fixed;inset:0;z-index:1000;background:linear-gradient(145deg,#052f2d,#08765f);align-items:center;justify-content:center;padding:20px;color:#fff}
  .fin360-lock.open{display:flex}.fin360-lock-card{width:min(390px,100%);background:#fff;color:#172127;border-radius:22px;padding:28px;box-shadow:0 24px 80px #001b1966;text-align:center}
  .fin360-lock-logo{width:64px;height:64px;margin:0 auto 12px;border-radius:18px;background:#0f9f6e;color:#fff;display:grid;place-items:center;font-size:30px;font-weight:900}
  .fin360-pin{font-size:25px;letter-spacing:8px;text-align:center;width:100%;padding:13px;border:1px solid #ccd8d5;border-radius:12px;margin:14px 0}
  .fin360-security-msg{min-height:22px;color:#b42318;font-size:13px}.fin360-privacy-blur .app,.fin360-privacy-blur .mobilebar{filter:blur(16px);pointer-events:none;user-select:none}
  #securityQuickLock{padding:8px 10px}`;
  document.head.appendChild(style);

  const overlay=document.createElement('div');
  overlay.id='fin360Lock'; overlay.className='fin360-lock';
  overlay.innerHTML=`<div class="fin360-lock-card"><div class="fin360-lock-logo">F</div><h2 style="margin:0">Fin360 bloqueado</h2><p style="color:#6b7880">Digite seu PIN para visualizar seus dados.</p><input id="fin360UnlockPin" class="fin360-pin" inputmode="numeric" type="password" maxlength="6" autocomplete="off" aria-label="PIN"><div id="fin360LockMsg" class="fin360-security-msg"></div><button id="fin360UnlockBtn" class="btn primary" style="width:100%" type="button">Desbloquear</button><button id="fin360LogoutLocked" class="btn soft" style="width:100%;margin-top:8px" type="button">Sair da conta</button></div>`;
  document.body.appendChild(overlay);

  function lock(reason='Proteção ativada'){
    if(!enabled()) return;
    locked=true; document.body.classList.add('fin360-privacy-blur'); overlay.classList.add('open');
    overlay.querySelector('#fin360LockMsg').textContent=reason==='idle'?'Bloqueado por inatividade.':'';
    setTimeout(()=>overlay.querySelector('#fin360UnlockPin').focus(),80);
  }
  function unlock(){locked=false;document.body.classList.remove('fin360-privacy-blur');overlay.classList.remove('open');localStorage.setItem(LAST_KEY,String(Date.now()));schedule();}
  async function tryUnlock(){
    const input=overlay.querySelector('#fin360UnlockPin'); const msg=overlay.querySelector('#fin360LockMsg');
    if(await digest(input.value)===localStorage.getItem(PIN_KEY)){input.value='';msg.textContent='';unlock();}else{msg.textContent='PIN incorreto.';input.select();}
  }
  function schedule(){clearTimeout(idleTimer);if(!enabled()||locked)return;localStorage.setItem(LAST_KEY,String(Date.now()));idleTimer=setTimeout(()=>lock('idle'),idleMinutes()*60000);}
  ['pointerdown','keydown','touchstart'].forEach(evt=>document.addEventListener(evt,()=>{if(!locked)schedule();},{passive:true}));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){localStorage.setItem(LAST_KEY,String(Date.now()));return;}if(enabled() && Date.now()-(+(localStorage.getItem(LAST_KEY)||0))>idleMinutes()*60000)lock('idle');});
  overlay.querySelector('#fin360UnlockBtn').onclick=tryUnlock;
  overlay.querySelector('#fin360UnlockPin').onkeydown=e=>{if(e.key==='Enter')tryUnlock();};
  overlay.querySelector('#fin360LogoutLocked').onclick=async()=>{unlock();if(window.FIN360_LOGOUT){await window.FIN360_LOGOUT();}else{try{await firebase.auth().signOut();}catch{}window.FIN360_SET_LOGGED_OUT_SCREEN?.(true);}};

  function securityDialog(){
    const has=enabled();
    const current=idleMinutes();
    const html=`<div class="notice"><b>Proteção deste aparelho</b><br>O PIN bloqueia a visualização dos seus dados neste navegador. A nuvem continua protegida pelo login e pelas regras individuais do Firebase.</div>
      <div class="form"><div class="field full"><label>${has?'Novo PIN (deixe vazio para manter)':'Crie um PIN de 6 números'}</label><input id="securityPin" inputmode="numeric" type="password" maxlength="6" pattern="[0-9]{6}" placeholder="••••••"></div>
      <div class="field full"><label>Bloquear após inatividade</label><select id="securityIdle"><option value="1">1 minuto</option><option value="5">5 minutos</option><option value="10">10 minutos</option><option value="15">15 minutos</option><option value="30">30 minutos</option></select></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px"><button class="btn primary" id="securitySave" type="button">${has?'Atualizar proteção':'Ativar proteção'}</button>${has?'<button class="btn soft" id="securityLockNow" type="button">Bloquear agora</button><button class="btn danger" id="securityDisable" type="button">Desativar PIN</button>':''}</div>
      <p class="muted" style="font-size:12px;margin-top:16px"><b>Importante:</b> não use senha de banco. O Fin360 não solicita senha bancária e não deve armazenar número completo de cartão ou código de segurança.</p>`;
    if(typeof window.openForm==='function'){
      window.openForm('Segurança',html,()=>{});
      const form=document.getElementById('form'); form.onsubmit=e=>e.preventDefault();
      document.getElementById('securityIdle').value=String(current);
      document.getElementById('securitySave').onclick=async()=>{const pin=document.getElementById('securityPin').value.trim();if(!has && !/^\d{6}$/.test(pin))return alert('Crie um PIN com exatamente 6 números.');if(pin && !/^\d{6}$/.test(pin))return alert('O PIN deve ter exatamente 6 números.');if(pin)localStorage.setItem(PIN_KEY,await digest(pin));localStorage.setItem(ENABLED_KEY,'1');localStorage.setItem(IDLE_KEY,document.getElementById('securityIdle').value);document.getElementById('modal').classList.remove('open');schedule();alert('Proteção ativada neste aparelho.');};
      document.getElementById('securityLockNow')?.addEventListener('click',()=>{document.getElementById('modal').classList.remove('open');lock();});
      document.getElementById('securityDisable')?.addEventListener('click',()=>{if(confirm('Desativar o bloqueio por PIN neste aparelho?')){localStorage.removeItem(PIN_KEY);localStorage.removeItem(ENABLED_KEY);clearTimeout(idleTimer);document.getElementById('modal').classList.remove('open');alert('Bloqueio por PIN desativado.');}});
    }
  }
  window.FIN360_SECURITY={open:securityDialog,lock,isEnabled:enabled};
  const actions=document.querySelector('.top-actions');
  if(actions){const btn=document.createElement('button');btn.id='securityQuickLock';btn.className='btn soft';btn.type='button';btn.title='Segurança e bloqueio';btn.textContent='🔒';btn.onclick=()=>enabled()?lock():securityDialog();actions.appendChild(btn);}
  let authReady=false;
  window.addEventListener('fin360-auth-changed',event=>{
    authReady=true;
    const user=event.detail?.user||null;
    if(!user){ locked=false; clearTimeout(idleTimer); document.body.classList.remove('fin360-privacy-blur'); overlay.classList.remove('open'); return; }
    if(enabled()) lock(); else schedule();
  });
  setTimeout(()=>{ if(!authReady && window.FIN360_AUTH_USER){ if(enabled()) lock(); else schedule(); } },1200);
})();
