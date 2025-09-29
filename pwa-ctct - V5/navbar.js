/* ===== CTĐ, CTCT – Navbar chuẩn (drawer + profile + dropdown) ===== */
(function () {
  'use strict';

  /* ---------- Local profile (đơn giản) ---------- */
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
  const clearProfile = ()=>{ localStorage.removeItem(LS_KEY); try{ window.dispatchEvent(new StorageEvent('storage',{key:LS_KEY})); }catch(_){} };
  window.ctctProfile = getProfile;

  /* ---------- Elements ---------- */
  const nav        = document.querySelector('.nav');
  const linksWrap  = document.querySelector('.nav__links');
  const toggleBtn  = document.querySelector('.nav__toggle');
  const overlay    = document.querySelector('.nav__overlay');

  const btnLogin   = document.getElementById('btnLogin');
  const btnLogout  = document.getElementById('btnLogout');
  const navProfile = document.getElementById('navProfile');

  /* ---------- Drawer open/close ---------- */
  function openDrawer(state){
    if (!nav || !linksWrap || !toggleBtn) return;
    nav.classList.toggle('is-open', !!state);
    toggleBtn.classList.toggle('is-open', !!state);
    toggleBtn.setAttribute('aria-expanded', state ? 'true' : 'false');
    // icon
    toggleBtn.innerHTML = state ? '<span aria-hidden="true">✕</span>' : '<span></span><span></span><span></span>';
    document.body.classList.toggle('no-scroll', !!state);
  }

  toggleBtn && toggleBtn.addEventListener('click', ()=> openDrawer(!nav.classList.contains('is-open')));
  overlay   && overlay.addEventListener('click', ()=> openDrawer(false));
  linksWrap && linksWrap.addEventListener('click', (e)=>{
    if (e.target.closest('a')) openDrawer(false);
  });
  document.addEventListener('keydown', (e)=>{ if (e.key==='Escape') openDrawer(false); });

  /* ---------- Active link (desktop) ---------- */
  try{
    if (linksWrap){
      const here = location.pathname.split('/').pop() || 'index.html';
      linksWrap.querySelectorAll('a[href]').forEach(a=>{
        const f=(a.getAttribute('href')||'').split('/').pop();
        if (f===here) a.classList.add('is-active');
      });
    }
  }catch(_){}

  /* ---------- Login/Logout render ---------- */
  function renderNavAuth(){
    const me = getProfile(), ok = !!(me && me.name);
    if (navProfile){
      navProfile.hidden = !ok;
      if (ok) navProfile.textContent = `${me.name}${me.unit?` • ${me.unit}`:''}`;
    }
    if (btnLogin)  btnLogin.hidden  = ok;
    if (btnLogout) btnLogout.hidden = !ok;
  }

  function doLogin(){
    const cur=getProfile()||{};
    const name=(prompt('Họ và tên:',cur.name||'')||'').trim(); if(!name) return;
    const unit=(prompt('Đơn vị:',cur.unit||'')||'').trim(); if(!unit) return;
    const position=(prompt('Chức vụ (tùy chọn):',cur.position||'')||'').trim();
    if (setProfile({name,unit,position})){
      renderNavAuth();
      try{
        const f=document.getElementById('fullname'), u=document.getElementById('unit'), p=document.getElementById('position');
        if (f && !f.value) f.value=name; if (u && !u.value) u.value=unit; if (p && !p.value) p.value=position;
      }catch(_){}
      alert('Đăng nhập thành công!');
    }
  }
  function doLogout(){ if(!confirm('Đăng xuất tài khoản hiện tại?')) return; clearProfile(); renderNavAuth(); }

  btnLogin  && btnLogin.addEventListener('click', doLogin);
  btnLogout && btnLogout.addEventListener('click', doLogout);
  window.addEventListener('storage', e=>{ if(e.key===LS_KEY) renderNavAuth(); });
  renderNavAuth();

  /* ---------- Dropdown patch (đảm bảo đúng cấu trúc) ---------- */
  (function dropdownFix(){
    const norm = s => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    function findAnchorByText(text){
      const want = norm(text);
      const roots = document.querySelectorAll('.nav, nav, header');
      for (const root of roots){
        const as = root.querySelectorAll('a');
        for (const a of as) {
          const t = norm(a.textContent || '');
          if (t.includes(want)) return a;
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
        panel = document.createElement('div');
        panel.className = 'dropdown';
        li.appendChild(panel);
      }
      return { li, panel, anchor };
    }
    function addItem(panel, href, text){
      let a = [...panel.querySelectorAll('a')].find(x => norm(x.textContent)===norm(text));
      if (!a){ a=document.createElement('a'); panel.appendChild(a); }
      a.href=href; a.textContent=text;
    }
    function clearOther(panel, keep){
      const set = new Set(keep.map(norm));
      panel.querySelectorAll('a').forEach(a=>{ if(!set.has(norm(a.textContent))) a.remove(); });
    }
    function disableNavigate(titleAnchor){
      titleAnchor.setAttribute('href', '#');
      titleAnchor.style.cursor = 'default';
      const li = titleAnchor.closest('.nav__item, li');
      titleAnchor.addEventListener('click', e=>{ e.preventDefault(); li.classList.toggle('open'); });
    }
    function ensureChevron(a){
      if (!/\u25BE|\u25BC|▾|▼/.test(a.textContent)) a.innerHTML = a.textContent + ' <span class="chev">▾</span>';
    }

    // Làm bài kiểm tra
    const aQuiz = findAnchorByText('làm bài kiểm tra');
    if (aQuiz){
      const {panel, anchor} = ensureDropdownFor(aQuiz, 'lam-thi');
      clearOther(panel, ['Kiểm tra nhận thức','Ôn trắc nghiệm','Thi thử']);
      addItem(panel, 'exam.html',     'Kiểm tra nhận thức');
      addItem(panel, 'practice.html', 'Ôn trắc nghiệm');
      addItem(panel, 'quiz.html',     'Thi thử');
      ensureChevron(anchor); disableNavigate(anchor);
    }

    // Kết quả kiểm tra
    const aRes = findAnchorByText('kết quả kiểm tra');
    if (aRes){
      const {panel, anchor} = ensureDropdownFor(aRes, 'ket-qua');
      clearOther(panel, ['Kết quả của tôi','Bảng xếp hạng']);
      addItem(panel, 'my-results.html',  'Kết quả của tôi');
      addItem(panel, 'leaderboard.html', 'Bảng xếp hạng');
      ensureChevron(anchor); disableNavigate(anchor);
    }

    // Click ngoài để đóng dropdown trong drawer
    document.addEventListener('click', (e)=>{
      document.querySelectorAll('.nav__item.has-dropdown').forEach(li=>{
        if (!li.contains(e.target)) li.classList.remove('open');
      });
    });
  })();

  /* ---------- Mục Trợ lý AI trong menu ---------- */
  const navAI = document.getElementById('nav-ai');
  if (navAI){
    navAI.addEventListener('click', (e)=>{
      e.preventDefault();
      openDrawer(false);
      // ưu tiên nút hero nếu có, không thì dùng FAB
      const heroBtn = document.getElementById('ai-toggle');
      if (heroBtn) heroBtn.click();
      else {
        const dock = document.getElementById('ai-dock');
        if (dock) dock.click();
      }
    });
  }
})();
