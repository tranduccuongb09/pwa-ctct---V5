/* ===== CTĐ, CTCT – Navbar + Mobile Panel ===== */
(function () {
  'use strict';

  // ====== Hồ sơ đơn giản (giữ nguyên như bản cũ của anh) ======
  const LS_KEY = 'ctct_profile';
  const J = {
    parse: (s, fb=null)=>{ try{ return JSON.parse(s); }catch{ return fb; } },
    str:   (o)=>{ try{ return JSON.stringify(o); }catch{ return ''; } }
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
  const clearProfile = ()=>{
    localStorage.removeItem(LS_KEY);
    try{ window.dispatchEvent(new StorageEvent('storage',{key:LS_KEY})); }catch(_){}
  };
  window.ctctProfile = getProfile;

  // Elements
  const nav        = document.querySelector('.nav');
  const toggleBtn  = document.querySelector('.nav__toggle');
  const panel      = document.querySelector('.nav__panel');
  const panelClose = document.querySelector('.panel__close');
  const panelAuth  = document.getElementById('panelAuth');

  const navActions = document.querySelector('.nav__actions');
  const btnLogin   = document.getElementById('btnLogin');
  const btnLogout  = document.getElementById('btnLogout');
  const navProfile = document.getElementById('navProfile');

  // ===== Render trạng thái đăng nhập (desktop text) =====
  function renderAuth(){
    const me = getProfile();
    const ok = !!(me && me.name);
    if (navActions){
      if (btnLogin)  btnLogin.hidden  = ok;
      if (btnLogout) btnLogout.hidden = !ok;
      if (navProfile){
        navProfile.hidden = !ok;
        if (ok) navProfile.textContent = `${me.name}${me.unit?` • ${me.unit}`:''}`;
      }
    }
    // cập nhật mục trong panel
    if (panelAuth){
      panelAuth.textContent = ok ? 'Đăng xuất' : 'Đăng nhập/Đăng ký';
    }
  }

  function doLogin(){
    const cur=getProfile()||{};
    const name=(prompt('Họ và tên:',cur.name||'')||'').trim(); if(!name) return;
    const unit=(prompt('Đơn vị:',cur.unit||'')||'').trim(); if(!unit) return;
    const position=(prompt('Chức vụ (tùy chọn):',cur.position||'')||'').trim();
    if (setProfile({name,unit,position})){
      renderAuth();
      try{
        const f=document.getElementById('fullname'),
              u=document.getElementById('unit'),
              p=document.getElementById('position');
        if (f && !f.value) f.value=name;
        if (u && !u.value) u.value=unit;
        if (p && !p.value) p.value=position;
      }catch(_){}
      alert('Đăng nhập thành công!');
    }
  }
  function doLogout(){
    if(!confirm('Đăng xuất tài khoản hiện tại?')) return;
    clearProfile(); renderAuth();
  }

  btnLogin  && btnLogin.addEventListener('click', doLogin);
  btnLogout && btnLogout.addEventListener('click', doLogout);
  window.addEventListener('storage', e=>{ if(e.key===LS_KEY) renderAuth(); });
  renderAuth();

  // ===== Mobile Panel open/close =====
  function openPanel(state){
    if (!panel) return;
    panel.classList.toggle('is-open', !!state);
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', state ? 'true' : 'false');
    // đổi icon hamburger
    if (toggleBtn){
      if (state) toggleBtn.innerHTML = '<span style="opacity:.0"></span><span style="opacity:.0"></span><span style="opacity:.0"></span>';
      else       toggleBtn.innerHTML = '<span></span><span></span><span></span>';
    }
    // khóa cuộn body khi mở panel
    document.documentElement.style.overflow = state ? 'hidden' : '';
    document.body.style.overflow = state ? 'hidden' : '';
  }

  toggleBtn && toggleBtn.addEventListener('click', ()=> openPanel(!panel.classList.contains('is-open')));
  panelClose && panelClose.addEventListener('click', ()=> openPanel(false));

  // click ngoài panel để đóng
  document.addEventListener('click', (e)=>{
    if (!panel || !panel.classList.contains('is-open')) return;
    const withinPanel = panel.contains(e.target) || (toggleBtn && toggleBtn.contains(e.target));
    if (!withinPanel) openPanel(false);
  });

  // phím ESC
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape') openPanel(false);
  });

  // Toggle submenu trong panel
  panel && panel.querySelectorAll('.panel__item .panel__trigger').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const li = btn.closest('.panel__item');
      const opened = li.classList.toggle('open');
      btn.setAttribute('aria-expanded', opened ? 'true' : 'false');
    });
  });

  // Hành động mục Đăng nhập/Đăng ký trong panel
  panelAuth && panelAuth.addEventListener('click', ()=>{
    const me=getProfile();
    if (me && me.name){ doLogout(); }
    else { doLogin(); }
    // không đóng panel để người dùng thấy trạng thái đổi ngay
  });

  // ===== Giữ nguyên logic “gạch vàng” active link desktop của anh nếu cần =====
  try{
    const linksWrap = document.querySelector('.nav__links');
    if (linksWrap){
      const here = location.pathname.split('/').pop() || 'index.html';
      linksWrap.querySelectorAll('a[href]').forEach(a=>{
        const f=(a.getAttribute('href')||'').split('/').pop();
        if (f===here) a.classList.add('is-active');
      });
    }
  }catch(_){}
})();
