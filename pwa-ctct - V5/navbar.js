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
  const clearProfile = ()=>{ localStorage.removeItem(LS_KEY); try{ window.dispatchEvent(new StorageEvent('storage',{key:LS_KEY})); }catch(_){} };
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
    // === LÀM BÀI KIỂM TRA ===
    const aQuiz = findAnchorByText('làm bài kiểm tra');
    if (aQuiz){
      const {panel, anchor} = ensureDropdownFor(aQuiz, 'lam-thi');
      clearOther(panel, ['Kiểm tra nhận thức','Ôn trắc nghiệm','Thi thử']);
      addItem(panel, 'exam.html',     'Kiểm tra nhận thức');
      addItem(panel, 'practice.html', 'Ôn trắc nghiệm');
      addItem(panel, 'quiz.html',     'Thi thử');
      disableNavigate(anchor);
      ensureChevron(anchor);
    }

    // === KẾT QUẢ KIỂM TRA ===
    const aRes = findAnchorByText('kết quả kiểm tra');
    if (aRes){
      const {panel, anchor} = ensureDropdownFor(aRes, 'ket-qua');
      clearOther(panel, ['Kết quả của tôi','Bảng xếp hạng']);
      addItem(panel, 'my-results.html',  'Kết quả của tôi');
      addItem(panel, 'leaderboard.html', 'Bảng xếp hạng');
      disableNavigate(anchor);
      ensureChevron(anchor);
    }

    // Điều chỉnh link cũ
    document.querySelectorAll('a[href]').forEach(a=>{
      const href=(a.getAttribute('href')||'').trim();
      if (/results\.html(\?|#|$)/i.test(href)) a.setAttribute('href','my-results.html');
    });

    // click ngoài -> đóng
    document.addEventListener('click', (e)=>{
      document.querySelectorAll('.nav__item.has-dropdown').forEach(li=>{
        if (!li.contains(e.target)) li.classList.remove('open');
      });
    });
  }

  window.addEventListener('load', ()=>setTimeout(buildMenus, 100));
})();

/* ===== Mobile Hamburger: mở/đóng menu, a11y, ESC ===== */
(function(){
  const nav    = document.querySelector('.nav');
  const toggle = document.querySelector('.nav__toggle');
  const links  = document.querySelector('.nav__links');
  if (!nav || !toggle || !links) return;

  const openMenu = (on) => {
    nav.classList.toggle('is-open', on);
    document.body.style.overflow = on ? 'hidden' : '';
    toggle.setAttribute('aria-expanded', on ? 'true' : 'false');
    toggle.innerHTML = on ? '✕' : '<span></span><span></span><span></span>';
  };

  toggle.addEventListener('click', ()=> openMenu(!nav.classList.contains('is-open')));

  // Đóng khi click link (trừ khi mở accordion dropdown ở mobile)
  links.addEventListener('click', (e)=>{
    const a = e.target.closest('a');
    if (!a) return;

    // Nếu là tiêu đề dropdown ở mobile -> thành accordion
    const item = a.parentElement;
    const isDropdownTitle = item && item.classList.contains('has-dropdown');
    const isMobile = window.matchMedia('(max-width:768px)').matches;

    if (isMobile && isDropdownTitle) {
      e.preventDefault();
      item.classList.toggle('open');
      return;
    }
    openMenu(false);
  });

  // ESC để đóng
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') openMenu(false); });

  // Tự đóng khi resize về desktop
  window.addEventListener('resize', ()=>{ if (window.innerWidth>768) openMenu(false); });
})();
/* ====== Mobile “Bali style” drawer toggle (an toàn, không đụng logic cũ) ====== */
(function () {
  'use strict';

  // Nếu đã có nav__drawer (tránh tạo trùng)
  const nav = document.querySelector('.nav');
  if (!nav) return;

  // Tạo scrim + drawer nếu chưa có
  let scrim   = document.querySelector('.nav__scrim');
  let drawer  = document.querySelector('.nav__drawer');
  const toggleBtn = document.querySelector('.nav__toggle');

  if (!toggleBtn) return; // desktop-only layout

  if (!scrim){
    scrim = document.createElement('div');
    scrim.className = 'nav__scrim';
    document.body.appendChild(scrim);
  }

  if (!drawer){
    drawer = document.createElement('div');
    drawer.className = 'nav__drawer';
    // nội dung: clone các link đã có + build dropdown (phần build dropdown ở trên vẫn chạy bình thường)
    const brand = document.querySelector('.brand')?.textContent || 'MENU';
    drawer.innerHTML = `
      <div class="drawer__brand">${brand}</div>
      <div class="drawer__links" id="drawerLinks"></div>
    `;
    document.body.appendChild(drawer);

    // dựng danh sách từ .nav__links (nếu có)
    const src = document.querySelector('.nav__links');
    const dst = drawer.querySelector('#drawerLinks');
    if (src && dst){
      // nhóm có dropdown
      src.querySelectorAll(':scope > .nav__item, :scope > a').forEach(node=>{
        if (node.classList?.contains('nav__item')) {
          const a = node.querySelector(':scope > a');
          if (!a) return;
          const wrap = document.createElement('div');
          wrap.className = 'has-sub';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = a.textContent.replace(/▾|▼/g,'').trim();
          wrap.appendChild(btn);
          const sub = document.createElement('div');
          sub.className = 'sub';
          wrap.appendChild(sub);
          node.querySelectorAll(':scope .dropdown a').forEach(x=>{
            const link = document.createElement('a');
            link.href = x.getAttribute('href') || '#';
            link.textContent = x.textContent.trim();
            sub.appendChild(link);
          });
          dst.appendChild(wrap);
        } else if (node.tagName === 'A') {
          const link = document.createElement('a');
          link.href = node.getAttribute('href') || '#';
          link.textContent = node.textContent.trim();
          dst.appendChild(link);
        }
      });
    }

    // mở/đóng submenu trong drawer
    drawer.addEventListener('click', (e)=>{
      const btn = e.target.closest('.has-sub > button');
      if (!btn) return;
      const holder = btn.parentElement;
      holder.classList.toggle('open');
    });

    // click link trong drawer -> đóng
    drawer.addEventListener('click', (e)=>{
      const a = e.target.closest('a[href]');
      if (a) closeMenu();
    });
  }

  function lockScroll(on){
    document.documentElement.style.overflow = on ? 'hidden' : '';
    document.body.style.overflow = on ? 'hidden' : '';
  }

  function openMenu(){
    nav.classList.add('is-open');
    toggleBtn.setAttribute('aria-expanded', 'true');
    lockScroll(true);
  }
  function closeMenu(){
    nav.classList.remove('is-open');
    toggleBtn.setAttribute('aria-expanded', 'false');
    lockScroll(false);
  }
  function toggleMenu(){
    if (nav.classList.contains('is-open')) closeMenu(); else openMenu();
  }

  toggleBtn.addEventListener('click', toggleMenu);
  scrim.addEventListener('click', closeMenu);
  window.addEventListener('keydown', (e)=>{ if (e.key==='Escape') closeMenu(); });
  window.addEventListener('resize', ()=>{ if (innerWidth>900) closeMenu(); });
})();
