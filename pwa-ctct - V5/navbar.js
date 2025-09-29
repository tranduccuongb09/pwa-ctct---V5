/* ===== CTĐ, CTCT – Navbar chuẩn (fixed) ===== */
(function () {
  'use strict';

  // ---------- Hồ sơ đơn giản ----------
  const LS_KEY = 'ctct_profile';
  const J = { parse:(s,fb=null)=>{try{return JSON.parse(s);}catch{return fb;}}, str:o=>{try{return JSON.stringify(o);}catch{return'';}} };
  const getProfile = () => J.parse(localStorage.getItem(LS_KEY), null);
  const setProfile = (p)=>{
    if(!p||typeof p!=='object') return false;
    const name=(p.name||'').trim(), unit=(p.unit||'').trim(), position=(p.position||'').trim();
    if(!name||!unit) return false;
    localStorage.setItem(LS_KEY, J.str({name,unit,position}));
    try{ window.dispatchEvent(new StorageEvent('storage',{key:LS_KEY})); }catch(_){}
    return true;
  };
  const clearProfile = ()=>{ localStorage.removeItem(LS_KEY); try{ window.dispatchEvent(new StorageEvent('storage',{key:LS_KEY})); }catch(_){}}; 
  window.ctctProfile = getProfile;

  const linksWrap  = document.querySelector('.nav__links');
  const navActions = document.querySelector('.nav__actions');
  const btnLogin   = document.getElementById('btnLogin');
  const btnLogout  = document.getElementById('btnLogout');
  const navProfile = document.getElementById('navProfile');

  function renderNav(){
    const authDisabled = !!(navActions && (navActions.hidden || navActions.hasAttribute('hidden')));
    if (authDisabled) return;
    const me = getProfile(), ok = !!(me && me.name);
    if (navProfile){
      navProfile.hidden = !ok;
      if (ok) navProfile.textContent = `${me.name}${me.unit?` • ${me.unit}`:''}`;
    }
    if (btnLogin)  btnLogin.hidden  = ok;
    if (btnLogout) btnLogout.hidden = !ok;
  }

  // Active link
  try{
    if (linksWrap){
      const here = location.pathname.split('/').pop() || 'index.html';
      linksWrap.querySelectorAll('a[href]').forEach(a=>{
        const f=(a.getAttribute('href')||'').split('/').pop();
        if (f===here) a.classList.add('is-active');
      });
    }
  }catch(_){}

  // Login/Logout prompt
  function doLogin(){
    const cur=getProfile()||{};
    const name=(prompt('Họ và tên:',cur.name||'')||'').trim(); if(!name) return;
    const unit=(prompt('Đơn vị:',cur.unit||'')||'').trim(); if(!unit) return;
    const position=(prompt('Chức vụ (tùy chọn):',cur.position||'')||'').trim();
    if (setProfile({name,unit,position})){
      renderNav();
      try{
        const f=document.getElementById('fullname'), u=document.getElementById('unit'), p=document.getElementById('position');
        if (f && !f.value) f.value=name; if (u && !u.value) u.value=unit; if (p && !p.value) p.value=position;
      }catch(_){}
      alert('Đăng nhập thành công!');
    }
  }
  function doLogout(){ if(!confirm('Đăng xuất tài khoản hiện tại?')) return; clearProfile(); renderNav(); }

  btnLogin  && btnLogin.addEventListener('click', doLogin);
  btnLogout && btnLogout.addEventListener('click', doLogout);
  window.addEventListener('storage', e=>{ if(e.key===LS_KEY) renderNav(); });
  renderNav();

  // Autofill form nếu có
  try{
    const me=getProfile(); if(me){
      const f=document.getElementById('fullname'), u=document.getElementById('unit'), p=document.getElementById('position');
      if (f && !f.value) f.value=me.name||''; if (u && !u.value) u.value=me.unit||''; if (p && !p.value) p.value=me.position||'';
    }
  }catch(_){}
})();

/* ===== Patch Dropdown CHUẨN (wrap anchor đúng chỗ) ===== */
(function(){
  const norm = s => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

  function findAnchorByText(text){
    const want = norm(text);
    const roots = document.querySelectorAll('.nav, nav, header');
    for (const root of roots){
      const as = root.querySelectorAll('a');
      for (const a of as) {
        const t = norm(a.textContent || '');
        if (t.includes(want)) return a; // nới lỏng khớp (kể cả có ký tự ▾)
      }
    }
    return null;
  }

  function wrapAsNavItem(anchor){
    let holder = anchor.closest('.nav__item, li');
    if (holder) return holder;
    holder = document.createElement('div');
    holder.className = 'nav__item has-dropdown';
    const parent = anchor.parentNode;
    parent.insertBefore(holder, anchor);
    holder.appendChild(anchor);
    return holder;
  }

  function ensureDropdownFor(anchor, dataKey){
    if (!anchor) return null;
    const li = wrapAsNavItem(anchor);
    li.classList.add('has-dropdown');
    li.dataset.menu = dataKey;

    li.querySelectorAll(':scope > .dropdown').forEach((x,i)=>{ if(i>0) x.remove(); });

    let panel = li.querySelector(':scope > .dropdown');
    if (!panel){
      const sample = document.querySelector('.nav__item.has-dropdown .dropdown');
      const tag = (sample && sample.tagName.toLowerCase()==='ul') ? 'ul' : 'div';
      panel = document.createElement(tag);
      panel.className = sample ? sample.className : 'dropdown';
      li.appendChild(panel);
    }
    return { li, panel, anchor };
  }

  function addItem(panel, href, text){
    let a = [...panel.querySelectorAll('a')].find(x => norm(x.textContent)===norm(text));
    if (!a){
      if (panel.tagName.toLowerCase()==='ul'){
        const li=document.createElement('li'); a=document.createElement('a'); li.appendChild(a); panel.appendChild(li);
      } else {
        a=document.createElement('a'); a.className='dropdown__item'; panel.appendChild(a);
      }
    }
    a.href=href; a.textContent=text;
  }

  function clearOther(panel, keep){
    const set = new Set(keep.map(norm));
    panel.querySelectorAll('a').forEach(a=>{ if(!set.has(norm(a.textContent))) a.remove(); });
    panel.querySelectorAll('li').forEach(li=>{ if(!li.querySelector('a')) li.remove(); });
  }

  function disableNavigate(titleAnchor){
    if (!titleAnchor) return;
    titleAnchor.setAttribute('href', '#');
    titleAnchor.style.cursor = 'default';
    const li = titleAnchor.closest('.nav__item, li');
    titleAnchor.addEventListener('click', e=>{ e.preventDefault(); li.classList.toggle('open'); });
  }

  function ensureChevron(a){
    if (!a.querySelector('.chev') && !(/\u25BE|\u25BC|▾|▼/.test(a.textContent))) {
      const s=document.createElement('span'); s.className='chev'; s.textContent=' ▾'; a.appendChild(s);
    }
  }

  function buildMenus(){
    const aQuiz = findAnchorByText('Làm bài kiểm tra');
    if (aQuiz){
      const {panel, anchor} = ensureDropdownFor(aQuiz, 'lam-thi');
      clearOther(panel, ['Kiểm tra nhận thức','Ôn trắc nghiệm','Thi thử']);
      addItem(panel, 'exam.html',     'Kiểm tra nhận thức');
      addItem(panel, 'practice.html', 'Ôn trắc nghiệm');
      addItem(panel, 'quiz.html',     'Thi thử');
      disableNavigate(anchor);
      ensureChevron(anchor);
    }

    const aRes = findAnchorByText('Kết quả kiểm tra');
    if (aRes){
      const {panel, anchor} = ensureDropdownFor(aRes, 'ket-qua');
      clearOther(panel, ['Kết quả của tôi','Bảng xếp hạng']);
      addItem(panel, 'my-results.html',  'Kết quả của tôi');
      addItem(panel, 'leaderboard.html', 'Bảng xếp hạng');
      disableNavigate(anchor);
      ensureChevron(anchor);
    }

    document.querySelectorAll('a[href]').forEach(a=>{
      const href=(a.getAttribute('href')||'').trim();
      if (/results\.html(\?|#|$)/i.test(href)) a.setAttribute('href','my-results.html');
    });

    document.addEventListener('click', (e)=>{
      document.querySelectorAll('.nav__item.has-dropdown').forEach(li=>{
        if (!li.contains(e.target)) li.classList.remove('open');
      });
    });
  }

  window.addEventListener('load', ()=>setTimeout(buildMenus, 100));
})();

/* ===== MOBILE Drawer & Shortcuts (bổ sung; desktop không bị ảnh hưởng) ===== */
(function(){
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav__toggle');
  const links  = document.querySelector('.nav__links');

  if (!nav || !toggle || !links) return;

  function isMobile(){ return window.matchMedia('(max-width: 768px)').matches; }

  function openDrawer(on){
    if (!isMobile()) return;
    nav.classList.toggle('is-open', !!on);
    toggle.setAttribute('aria-expanded', on ? 'true' : 'false');
    document.documentElement.classList.toggle('no-scroll', !!on);
  }

  toggle.addEventListener('click', ()=> openDrawer(!nav.classList.contains('is-open')));

  // Đóng khi chọn link trong panel (mobile)
  links.addEventListener('click', (e)=>{
    const a = e.target.closest('a');
    if (!a) return;
    if (isMobile()){
      // mở/đóng submenu nếu là tiêu đề "has-dropdown"
      const holder = a.closest('.has-dropdown');
      if (holder && holder.contains(a) && a.nextElementSibling){
        e.preventDefault();
        holder.classList.toggle('open');
        return;
      }
      // còn lại: đóng panel
      openDrawer(false);
    }
  });

  // Click ngoài panel để đóng
  document.addEventListener('click', (e)=>{
    if (!isMobile()) return;
    if (!nav.classList.contains('is-open')) return;
    if (!links.contains(e.target) && e.target!==toggle) openDrawer(false);
  });

  // ESC để đóng
  document.addEventListener('keydown', (e)=>{
    if (e.key==='Escape') openDrawer(false);
  });

  // “Trợ lý AI” trong menu
  const aiLink = document.getElementById('open-ai');
  if (aiLink){
    aiLink.addEventListener('click', (e)=>{
      e.preventDefault();
      openDrawer(false);
      // kích hoạt nút mở AI nếu có
      try{
        const dock = document.getElementById('ai-dock');
        const btn  = document.getElementById('ai-toggle');
        (btn||dock)?.click();
      }catch(_){}
    });
  }
})();
