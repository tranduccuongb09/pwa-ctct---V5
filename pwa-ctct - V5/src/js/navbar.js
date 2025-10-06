/* ===== CTĐ, CTCT – Navbar chuẩn (auth + user chip) ===== */
(function () {
  'use strict';

  // ---------- Hồ sơ + trạng thái đăng nhập ----------
  const LS_PROFILE = 'ctct_profile';
  const LS_TOKEN   = 'ctct_token'; // nếu hệ thống dùng token
  const J = {
    parse: (s, fb=null) => { try { return JSON.parse(s); } catch { return fb; } },
    str:   (o)          => { try { return JSON.stringify(o); } catch { return ''; } }
  };

  const getProfile = () => J.parse(localStorage.getItem(LS_PROFILE), null);
  const setProfile = (p)=>{
    if(!p||typeof p!=='object') return false;
    const name=(p.name||'').trim(), unit=(p.unit||'').trim(), position=(p.position||'').trim();
    if(!name||!unit) return false;
    localStorage.setItem(LS_PROFILE, J.str({name,unit,position}));
    try{ window.dispatchEvent(new StorageEvent('storage',{key:LS_PROFILE})); }catch(_){}
    return true;
  };
  const clearProfile = ()=>{
    localStorage.removeItem(LS_PROFILE);
    try{ window.dispatchEvent(new StorageEvent('storage',{key:LS_PROFILE})); }catch(_){}
  };

  const isAuthed = ()=>{
    // Ưu tiên biến global (nếu backend đã set)
    const u = window.CTCT_USER;
    if (u && (u.isLoggedIn || u.id || u.token)) return true;
    // Token (nếu dùng)
    const t = localStorage.getItem(LS_TOKEN) || sessionStorage.getItem(LS_TOKEN);
    if (t && t !== 'null' && t !== 'undefined') return true;
    // Hồ sơ đơn giản (fallback)
    const p = getProfile();
    return !!(p && p.name);
  };

  // Expose (nếu nơi khác cần đọc)
  window.ctctProfile = getProfile;

  const linksWrap  = document.querySelector('.nav__links');
  const navActions = document.querySelector('.nav__actions');
  const btnLogin   = document.getElementById('btnLogin');    // "Đăng ký / Đăng nhập"
  const btnLogout  = document.getElementById('btnLogout');   // "Đăng xuất"
  const navProfile = document.getElementById('navProfile');  // chip text cũ (nếu dùng)
  const userChip   = document.getElementById('userChip');    // chip avatar + tên (mới)

  function renderNav(){
    const authDisabled = !!(navActions && (navActions.hidden || navActions.hasAttribute('hidden')));
    if (authDisabled) return;

    const authed = isAuthed();
    const me = getProfile();

    // Ẩn/hiện nút
    if (btnLogin)  btnLogin.hidden  = authed;
    if (btnLogout) btnLogout.hidden = !authed;

    // Chip text cũ (nếu site cũ đang dùng)
    if (navProfile){
      if (me && me.name){
        navProfile.hidden = false;
        navProfile.textContent = `${me.name}${me.unit?` • ${me.unit}`:''}`;
      } else {
        navProfile.hidden = true;
        navProfile.textContent = '';
      }
    }

    // User chip (avatar + tên rút gọn)
    if (userChip){
      if (authed && me && me.name){
        const lastWord = (me.name || '').trim().split(/\s+/).slice(-1)[0] || '';
        const initial  = lastWord.charAt(0).toUpperCase() || 'U';
        userChip.innerHTML = `
          <div class="chip-avatar" aria-hidden="true">${initial}</div>
          <span class="chip-name" title="${me.name}${me.unit?` • ${me.unit}`:''}">
            ${me.name}
          </span>
        `;
        userChip.hidden = false;
      } else {
        userChip.hidden = true;
        userChip.innerHTML = '';
      }
    }
  }

  // Active link (giữ nguyên hành vi)
  try{
    if (linksWrap){
      const here = location.pathname.split('/').pop() || 'index.html';
      linksWrap.querySelectorAll('a[href]').forEach(a=>{
        const f=(a.getAttribute('href')||'').split('/').pop();
        if (f===here) a.classList.add('is-active');
      });
    }
  }catch(_){}
  
  // ---------- Login / Logout ----------
  function doLogin(){
    // Điều hướng thẳng tới trang đăng ký/đăng nhập (không prompt/alert)
    location.href = 'login.html';
  }
  function doLogout(){
    // Xoá các dấu vết đăng nhập phổ biến + phát sự kiện cập nhật UI
    try {
      localStorage.removeItem(LS_TOKEN);
      sessionStorage.removeItem(LS_TOKEN);
      if (window.CTCT_USER) delete window.CTCT_USER;
    } catch {}
    clearProfile();
    renderNav();
    window.dispatchEvent(new Event('ctct:auth-changed'));
  }

  btnLogin  && btnLogin.addEventListener('click', doLogin);
  btnLogout && btnLogout.addEventListener('click', doLogout);

  // Đồng bộ UI khi storage thay đổi (tab khác đăng nhập/đăng xuất)
  window.addEventListener('storage', (e)=>{
    if (e.key === LS_PROFILE || e.key === LS_TOKEN) renderNav();
  });
  // Cho phép nơi khác chủ động báo đã đổi trạng thái
  window.addEventListener('ctct:auth-changed', renderNav);

  renderNav();

  // Autofill form nếu có (họ tên/đơn vị/chức vụ) – không bắt buộc
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
        if (t.includes(want)) return a; // khớp nới lỏng (kể cả có ký tự ▾)
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
    titleAnchor.setAttribute('href', '#'); // không điều hướng
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
    const aQuiz = findAnchorByText('lam bai kiem tra');
    if (aQuiz){
      const {panel, anchor} = ensureDropdownFor(aQuiz, 'lam-thi');
      clearOther(panel, ['Kiem tra nhan thuc','On trac nghiem','Thi thu']);
      addItem(panel, 'exam.html',     'Kiểm tra nhận thức');
      addItem(panel, 'practice.html', 'Ôn trắc nghiệm');
      addItem(panel, 'quiz.html',     'Thi thử');
      disableNavigate(anchor);
      ensureChevron(anchor);
    }

    // === KẾT QUẢ KIỂM TRA ===
    const aRes = findAnchorByText('ket qua kiem tra');
    if (aRes){
      const {panel, anchor} = ensureDropdownFor(aRes, 'ket-qua');
      clearOther(panel, ['Ket qua cua toi','Bang xep hang']);
      addItem(panel, 'my-results.html',  'Kết quả của tôi');
      addItem(panel, 'leaderboard.html', 'Bảng xếp hạng');
      disableNavigate(anchor);
      ensureChevron(anchor);
    }

    // chuyển thẳng mọi link cũ results.html -> my-results.html
    document.querySelectorAll('a[href]').forEach(a=>{
      const href=(a.getAttribute('href')||'').trim();
      if (/results\.html(\?|#|$)/i.test(href)) a.setAttribute('href','my-results.html');
    });

    // click ra ngoài -> đóng
    document.addEventListener('click', (e)=>{
      document.querySelectorAll('.nav__item.has-dropdown').forEach(li=>{
        if (!li.contains(e.target)) li.classList.remove('open');
      });
    });
  }

  window.addEventListener('load', ()=>setTimeout(buildMenus, 100));
})();

/* =========================================================
   ➤ MOBILE DRAWER (chuẩn hóa)
   ========================================================= */
(function(){
  const mq = window.matchMedia('(max-width: 768px)');
  const toggleBtn = document.querySelector('.nav__toggle');
  const drawer = document.getElementById('mDrawer');

  if (!toggleBtn || !drawer) return;

  const open = (yes)=> {
    drawer.classList.toggle('open', !!yes);
    document.body.classList.toggle('noscroll', !!yes);
    toggleBtn.setAttribute('aria-expanded', yes ? 'true' : 'false');
  };

  toggleBtn.addEventListener('click', ()=> {
    if (!mq.matches) return;          // chỉ hoạt động mobile
    open(!drawer.classList.contains('open'));
  });

  // đóng khi chạm ngoài vùng panel
  document.addEventListener('click', (e)=>{
    if (!mq.matches) return;
    if (!drawer.classList.contains('open')) return;
    const withinDrawer = drawer.contains(e.target);
    const withinToggle = toggleBtn.contains(e.target);
    if (!withinDrawer && !withinToggle) open(false);
  });

  // các dropdown trong Drawer
  drawer.querySelectorAll('.m-drop').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-target');
      const panel = id ? drawer.querySelector(id) : null;
      if (!panel) return;
      const show = panel.style.display !== 'block';
      btn.classList.toggle('active', show);
      panel.style.display = show ? 'block' : 'none';
    });
  });

  // điều hướng trong Drawer -> đóng panel
  drawer.querySelectorAll('a[href]').forEach(a=>{
    a.addEventListener('click', ()=> open(false));
  });

  // Auth trong Drawer
  const mLogin  = document.getElementById('m-login');
  const mLogout = document.getElementById('m-register'); // tái dụng id cũ làm "Đăng xuất"

  mLogin  && mLogin.addEventListener('click', (e)=>{ e.preventDefault(); open(false); location.href='login.html'; });
  mLogout && mLogout.addEventListener('click', (e)=>{
    e.preventDefault();
    open(false);
    try {
      localStorage.removeItem('ctct_token');
      sessionStorage.removeItem('ctct_token');
      if (window.CTCT_USER) delete window.CTCT_USER;
      localStorage.removeItem('ctct_profile');
      window.dispatchEvent(new Event('ctct:auth-changed'));
    } catch {}
  });
})();

// Diệt "nút –" dù là inject muộn
(function killWeirdDashForever(){
  const root = document.querySelector('.nav__inner') || document.querySelector('.nav');
  if (!root) return;

  const sweep = () => {
    [...root.querySelectorAll('button,span,div,a')].forEach(el=>{
      // bỏ qua các phần tử hợp lệ
      if (el.id === 'btnLogin' || el.id === 'btnLogout' || el.classList.contains('btn')) return;
      if (el.closest('.m-drawer')) return; // không đụng drawer mobile

      const t = (el.textContent || '').trim();
      const onlyDash = (t === '–' || t === '—' || t === '-');
      // nút/nhãn rất nhỏ, không có role, chỉ có dấu gạch -> remove
      if (onlyDash) el.remove();
    });
  };

  // quét ngay và theo dõi thay đổi sau này
  sweep();
  const mo = new MutationObserver(sweep);
  mo.observe(root, { childList: true, subtree: true });
})();

// Xoá phần tử đứng ngay sau .nav__search nếu không phải nút auth/chip
(function nukeWeirdSiblingAfterSearch(){
  const s = document.querySelector('.nav__search');
  if (!s) return;

  const kill = () => {
    const sib = s.nextElementSibling;
    if (!sib) return;
    const ok = sib.id === 'btnLogin' || sib.id === 'btnLogout' || sib.classList.contains('user-chip');
    if (!ok) sib.remove();
  };

  // chạy ngay và lỡ có script khác chèn muộn thì vẫn quét lại
  kill();
  const mo = new MutationObserver(kill);
  mo.observe(s.parentNode, { childList: true });
})();

document.getElementById('globalSearch')?.addEventListener('submit', (e)=>{
  const q = e.currentTarget.querySelector('input[name="q"]')?.value?.trim();
  if (!q) e.preventDefault();
});

// Update năm dưới footer
document.getElementById('y') && (document.getElementById('y').textContent = new Date().getFullYear());

// Footer: mở khay AI khi bấm "Trợ lý AI"
(function(){
  const link = document.getElementById('m-ai');
  const toggle = document.getElementById('ai-toggle');
  if (link && toggle){
    link.addEventListener('click', (e)=>{ e.preventDefault(); toggle.click(); });
  }
})();
