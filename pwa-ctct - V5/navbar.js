/* ===== CTĐ, CTCT – Navbar chuẩn (desktop giữ nguyên, mobile panel căn phải) ===== */
(function () {
  'use strict';

  /* ---------- Hồ sơ đơn giản (localStorage) ---------- */
  const LS_KEY = 'ctct_profile';
  const J = {
    parse:(s,fb=null)=>{ try{ return JSON.parse(s); }catch{ return fb; } },
    str:o=>{ try{ return JSON.stringify(o); }catch{ return ''; } }
  };
  const getProfile = () => J.parse(localStorage.getItem(LS_KEY), null);
  const setProfile = (p)=>{
    if(!p||typeof p!=='object') return false;
    const name=(p.name||'').trim(), unit=(p.unit||'').trim(), position=(p.position||'').trim();
    if(!name||!unit) return false;
    localStorage.setItem(LS_KEY, J.str({name,unit,position}));
    try{ window.dispatchEvent(new StorageEvent('storage',{key:LS_KEY})); }catch(_){}
    return true;
  };
  const clearProfile = ()=>{ localStorage.removeItem(LS_KEY); try{ window.dispatchEvent(new StorageEvent('storage',{key:LS_KEY})); }catch(_){} };

  /* ---------- Phần tử ---------- */
  const nav       = document.querySelector('.nav');
  const btnToggle = document.getElementById('navToggle');
  const panel     = document.getElementById('navPanel');

  const btnLogin  = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const navProfile= document.getElementById('navProfile');

  const panelLogin  = document.getElementById('panelLogin');
  const panelLogout = document.getElementById('panelLogout');

  /* ---------- Render profile nút đăng nhập/đăng xuất ---------- */
  function renderAuth(){
    const me = getProfile();
    const ok = !!(me && me.name);
    // Desktop
    if (btnLogin)  btnLogin.hidden  =  ok;
    if (btnLogout) btnLogout.hidden = !ok;
    if (navProfile){
      navProfile.hidden = !ok;
      if (ok) navProfile.textContent = `${me.name}${me.unit?` • ${me.unit}`:''}`;
    }
    // Mobile panel
    if (panelLogin)  panelLogin.hidden  =  ok;
    if (panelLogout) panelLogout.hidden = !ok;
  }
  renderAuth();
  window.addEventListener('storage', e=>{ if(e.key===LS_KEY) renderAuth(); });

  function doLogin(){
    const cur=getProfile()||{};
    const name=(prompt('Họ và tên:',cur.name||'')||'').trim(); if(!name) return;
    const unit=(prompt('Đơn vị:',cur.unit||'')||'').trim(); if(!unit) return;
    const position=(prompt('Chức vụ (tùy chọn):',cur.position||'')||'').trim();
    if (setProfile({name,unit,position})){
      renderAuth();
      try{
        const f=document.getElementById('fullname'), u=document.getElementById('unit'), p=document.getElementById('position');
        if (f && !f.value) f.value=name; if (u && !u.value) u.value=unit; if (p && !p.value) p.value=position;
      }catch(_){}
      alert('Đăng nhập thành công!');
    }
  }
  function doLogout(){ if(!confirm('Đăng xuất tài khoản hiện tại?')) return; clearProfile(); renderAuth(); }

  btnLogin   && btnLogin.addEventListener('click', doLogin);
  btnLogout  && btnLogout.addEventListener('click', doLogout);
  panelLogin && panelLogin.addEventListener('click', ()=>{ doLogin(); closePanel(); });
  panelLogout&& panelLogout.addEventListener('click', ()=>{ doLogout(); closePanel(); });

  /* ---------- Mobile panel toggle ---------- */
  function openPanel(){ if (!nav) return; nav.classList.add('is-open'); btnToggle?.setAttribute('aria-expanded','true'); }
  function closePanel(){ if (!nav) return; nav.classList.remove('is-open'); btnToggle?.setAttribute('aria-expanded','false'); }
  function togglePanel(){ nav?.classList.toggle('is-open'); btnToggle?.setAttribute('aria-expanded', nav?.classList.contains('is-open') ? 'true' : 'false'); }

  btnToggle && btnToggle.addEventListener('click', togglePanel);

  // Đóng khi click link trong panel
  panel && panel.addEventListener('click', (e)=>{
    if (e.target.matches('a.panel-link, .panel-sub a')) closePanel();
  });

  // ESC đóng panel
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closePanel(); });

  // Accordion cho mục con
  document.querySelectorAll('.panel-acc').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.dataset.acc;
      const sub = document.querySelector(`[data-acc-content="${key}"]`);
      const opened = btn.classList.toggle('open');
      if (sub) sub.style.display = opened ? 'block' : 'none';
    });
  });

  /* ---------- Điều chỉnh “Kết quả kiểm tra” -> my-results nếu link cũ ---------- */
  document.querySelectorAll('a[href]').forEach(a=>{
    const href=(a.getAttribute('href')||'').trim();
    if (/results\.html(\?|#|$)/i.test(href)) a.setAttribute('href','my-results.html');
  });

  /* ---------- (Tuỳ chọn) Mở khay AI từ panel ---------- */
  const aiLink = document.getElementById('panel-ai');
  if (aiLink){
    aiLink.addEventListener('click', (e)=>{
      e.preventDefault();
      closePanel();
      try{
        document.getElementById('ai-toggle')?.click();
      }catch(_){}
    });
  }
})();
