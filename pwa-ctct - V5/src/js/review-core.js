/* review-core.js — CORE HỢP NHẤT: render + normalize + controls + điều hướng
   — BẢN CÓ BẢO ĐẢM HỘP “GIẢI THÍCH” DƯỚI MỖI CÂU —
*/
(function () {
  'use strict';
  const NS = (window.CTCT_REVIEW = window.CTCT_REVIEW || {});

  // ========= Utils =========
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  NS.escapeHtml = escapeHtml;

  function hostRoot(scope) {
    return (
      (scope && (scope.querySelector('#reviewList') || scope.querySelector('#box'))) ||
      document.getElementById('reviewList') ||
      document.getElementById('box') ||
      document.querySelector('.qwrap') ||
      document.querySelector('main') ||
      document.body
    );
  }

  // ========= Storage Keys =========
  const STORAGE_KEYS = {
    ktnt:     'ctct_review_pack_ktnt',      // Kiểm tra nhận thức
    practice: 'ctct_review_pack_practice',  // Ôn trắc nghiệm
    try:      'ctct_review_pack_try'        // Thi thử
  };
  const FALLBACK_KEYS = [
    'ctct_last_result_for_review',
    'ctct_try_last_result'
  ];

  function readPackByKeys(keys) {
    for (const k of keys) {
      try {
        const p = JSON.parse(localStorage.getItem(k) || 'null');
        if (p && Array.isArray(p.details)) return { pack: p, key: k };
      } catch (_) {}
    }
    return { pack: null, key: null };
  }

  function getPageType() {
    const t = document.body.getAttribute('data-page') || 'ktnt';
    return (t in STORAGE_KEYS) ? t : 'ktnt';
  }

  function readAnyPack(pageType) {
    const arr = [];
    if (pageType && STORAGE_KEYS[pageType]) arr.push(STORAGE_KEYS[pageType]);
    arr.push(...FALLBACK_KEYS);
    return readPackByKeys(arr);
  }

  // ========= Meta pills =========
  function fmtMetaChips(pack) {
    const name  = pack.name || '-';
    const unit  = pack.unit || '';
    const pos   = pack.position || '';
    const topic = pack.topicLabel || pack.topic || '';
    const code  = pack.examCode || '';
    const score = Number(pack.score || 0);
    const total = Number(pack.total || 0);
    const bits = [
      `👤 ${escapeHtml(name)}`,
      unit ? `🏢 ${escapeHtml(unit)}` : '',
      pos  ? `🎖️ ${escapeHtml(pos)}` : '',
      topic? `🎯 ${escapeHtml(topic)}` : '',
      code ? `🧾 Mã đề: ${escapeHtml(code)}` : '',
      `📈 Điểm: <b>${score}/${total}</b>`
    ].filter(Boolean);
    return bits.map(t=>`<span class="pill">${t}</span>`).join('');
  }
  NS.fmtMetaChips = fmtMetaChips;

  // ========= Render từ pack (dùng khi list trống) =========
  function renderList(details) {
    return details.map(d=>{
      const idx     = Number(d.index) || '';
      const q       = escapeHtml(d.question || '');
      const chosen  = (d.chosen  || '').trim();
      const correct = (d.correct || '').trim();
      const answered= !!chosen;
      const ok      = answered && chosen === correct;

      let cls  = 'skip';
      let line = `⏳ <b>Không trả lời</b> • Đúng: <span class="ans ans--ok">${escapeHtml(correct)}</span>`;
      if (answered) {
        if (ok)  { cls='ok';  line = `✔️ <b>Đúng</b> — Bạn chọn: <span class="ans ans--ok">${escapeHtml(chosen)}</span> • Đúng: <span class="ans ans--ok">${escapeHtml(correct)}</span>`;}
        else     { cls='bad'; line = `✖️ <b>Sai</b> — Bạn chọn: <span class="ans ans--bad">${escapeHtml(chosen)}</span> • Đúng: <span class="ans ans--ok">${escapeHtml(correct)}</span>`;}
      }

      const exp = (d.explanation || '').trim();
      const expHtml = `<div class="exp"><b>Giải thích:</b> ${escapeHtml(exp || '(Chưa có nội dung)')}</div>`;

      return `<article class="row qitem ${cls}" data-ok="${ok ? '1' : '0'}">
                <h3 class="q">Câu ${idx}.</h3>
                <p class="qtext">${q}</p>
                <p class="result judge ${ok?'ok':'ng bad'} ${answered?'':'skip'}" data-role="judge">${line}</p>
                ${expHtml}
              </article>`;
    }).join('');
  }
  NS.renderList = renderList;

  function renderReview(containerId, storageKey, options = {}) {
    const host = document.getElementById(containerId);
    if (!host) return;
    let pack = null;
    try { pack = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) {}

    if (!pack || !Array.isArray(pack.details) || pack.details.length === 0) {
      host.innerHTML = options.emptyHtml || '<div class="row"><b>Không có dữ liệu để xem lại.</b></div>';
      return;
    }

    const metaEl = options.pillsSelector
      ? document.querySelector(options.pillsSelector)
      : (document.getElementById('reviewMeta') || document.querySelector('.review-pills'));
    const listEl  = options.listSelector
      ? document.querySelector(options.listSelector)
      : (document.getElementById(containerId));

    if (metaEl) metaEl.innerHTML = fmtMetaChips(pack);
    if (listEl) listEl.innerHTML = renderList(pack.details);

    NS._lastPack = pack;
    if (typeof options.onRendered === 'function') options.onRendered(pack);
  }
  NS.renderReview = renderReview;

  // ========= Normalize & BẢO ĐẢM HỘP GIẢI THÍCH =========
  function tagExplain(container) {
    container.querySelectorAll('p,div,li,span').forEach(el => {
      const t = (el.textContent || '').trim();
      if (/^giải\s*thích\b/i.test(t) || /\bgiải\s*thích\s*[:：]/i.test(t)) {
        el.classList.add('exp');
      }
    });
  }

  function ensureQaBlocks(root) {
    if (root.querySelector('.qa, .qitem')) return;

    let parent = root;
    let blocks = Array.from(
      parent.querySelectorAll(':scope > p, :scope > div, :scope > li, :scope > section, :scope > article')
    ).filter(el => !el.matches('.qa, .qitem, script, style'));

    if (blocks.length < 2 && parent.firstElementChild) {
      const mid = parent.firstElementChild;
      const sub = Array.from(
        mid.querySelectorAll(':scope > p, :scope > div, :scope > li, :scope > section, :scope > article')
      ).filter(el => !el.matches('.qa, .qitem, script, style'));
      if (sub.length > blocks.length) { parent = mid; blocks = sub; }
    }
    if (!blocks.length) return;

    const isStart = el => /^câu\s*\d+[\.:]?/i.test((el.textContent || '').trim());
    const starts = [];
    blocks.forEach((el, i) => { if (isStart(el)) starts.push(i); });
    if (!starts.length) return;

    starts.push(blocks.length);

    for (let s = 0; s < starts.length - 1; s++) {
      const i = starts[s], j = starts[s + 1];

      const wrap = document.createElement('div');
      wrap.className = 'qa';
      parent.insertBefore(wrap, blocks[i]);

      for (let k = i; k < j; k++) wrap.appendChild(blocks[k]);

      const m = /câu\s*(\d+)/i.exec((wrap.textContent || '').trim());
      if (m) wrap.dataset.qindex = String(parseInt(m[1], 10));

      const line = Array.from(wrap.querySelectorAll('p,div,span,li')).find(n=>{
        const t=(n.textContent||'').trim().toLowerCase();
        return /(^|[\s—-])đúng\b/.test(t) || /(^|[\s—-])sai\b/.test(t) || /không trả lời/.test(t);
      });
      if (line) {
        const t=line.textContent.toLowerCase();
        if (/đúng\b/.test(t) && !/sai\b/.test(t)) { wrap.classList.add('ok'); wrap.dataset.ok='1'; }
        else if (/sai\b/.test(t))                { wrap.classList.add('ng','bad'); wrap.dataset.ok='0'; }
        else if (/không trả lời/.test(t))        { wrap.classList.add('skip');      wrap.dataset.ok='0'; }
      }
    }
  }

  // Bơm giải thích từ storage (nếu có)
  function attachExpFromStorage(root) {
    const { pack } = readAnyPack(getPageType());
    if (!pack) return 0;

    const details = Array.isArray(pack.details) ? pack.details : [];
    const byIndex = new Map();
    details.forEach(d => {
      const i = Number(d.index || 0);
      const exp = (d.explanation || '').trim();
      if (i && exp) byIndex.set(i, exp);
    });

    const qaList = Array.from(root.querySelectorAll('.qa, .qitem'));
    let added = 0;

    qaList.forEach(qa => {
      if (qa.querySelector('.exp')) return;
      const i = Number(qa.dataset.qindex || 0);
      const exp = i ? byIndex.get(i) : null;
      if (exp) {
        const dv = document.createElement('div');
        dv.className = 'exp';
        dv.innerHTML = '<b>Giải thích:</b> ' + escapeHtml(exp);
        qa.appendChild(dv);
        added++;
      }
    });

    if (added === 0 || qaList.some(qa => !qa.querySelector('.exp'))) {
      let p = 0;
      qaList.forEach(qa => {
        if (qa.querySelector('.exp')) return;
        while (p < details.length && !(details[p] && (details[p].explanation || '').trim())) p++;
        if (p >= details.length) return;
        const exp = (details[p++].explanation || '').trim();
        if (!exp) return;

        const dv = document.createElement('div');
        dv.className = 'exp';
        dv.innerHTML = '<b>Giải thích:</b> ' + escapeHtml(exp);
        qa.appendChild(dv);
        added++;
      });
    }

    return added;
  }

  // MỚI: luôn đảm bảo có hộp .exp đặt đúng chỗ dưới .result
  function ensureExplainBox(root) {
    const qaList = Array.from(root.querySelectorAll('.qa, .qitem'));
    qaList.forEach(qa => {
      // 1) Tìm phần judge/result làm mốc chèn
      const judge = qa.querySelector('.result[data-role="judge"], .result.judge, .result, .badge-result');

      // 2) Tìm các biến thể “giải thích” hiện có
      let exp = qa.querySelector('.exp, .explain, .explanation, .muted');

      // 3) Nếu chưa có, tạo placeholder
      if (!exp) {
        exp = document.createElement('div');
        exp.className = 'exp';
        exp.innerHTML = '<b>Giải thích:</b> <i>(Chưa có nội dung)</i>';
      } else {
        // chuẩn hoá class & text
        exp.classList.add('exp');
        if (!/giải\s*thích/i.test(exp.textContent || '')) {
          const inner = (exp.innerHTML || exp.textContent || '').trim();
          exp.innerHTML = '<b>Giải thích:</b> ' + inner;
        }
      }

      // 4) Đặt đúng vị trí: ngay sau judge/result
      if (judge) {
        if (exp.parentElement !== qa || exp.previousElementSibling !== judge) {
          // Nếu exp đã ở nơi khác, move vào sau judge
          exp.remove();
          judge.insertAdjacentElement('afterend', exp);
        }
      } else if (!qa.contains(exp)) {
        qa.appendChild(exp);
      }
    });
  }

  function normalize(scope) {
    const root = hostRoot(scope);
    if (!root) return false;

    ensureQaBlocks(root);
    tagExplain(root);
    attachExpFromStorage(root);
    ensureExplainBox(root); // <— đảm bảo luôn có hộp Giải thích

    return true;
  }

  NS.normalizeReview = function (scope) {
    return normalize(scope);
  };

  // ========= Controls (lọc + thống kê + in) =========
  function detectBad(item) {
    if (item.classList.contains('bad') || item.classList.contains('ng') || item.classList.contains('skip')) return true;
    if (item.dataset && item.dataset.ok === '0') return true;

    const res = item.querySelector('.result[data-role="judge"], .result.ok, .result.ng, .result.bad, .badge-result, .judge, .q + .result, .result');
    if (res) {
      if (res.classList.contains('ng') || res.classList.contains('bad')) return true;
      const dok = res.getAttribute('data-ok');
      if (dok === '0') return true;
      const t = (res.textContent || '').normalize('NFC').toLowerCase();
      if (/(\bsai\b|không\s*trả\s*lời|✖)/.test(t)) return true;
    }
    return false;
  }

  function bindControls(opts = {}) {
    const q = (x)=> (typeof x==='string' ? document.querySelector(x) : x);

    const onlyWrong = q(opts.onlyWrong ?? '#onlyWrong');
    const searchBox = q(opts.search    ?? '#searchBox');
    const printBtn  = q(opts.print     ?? '#printBtn');
    const listSel   = opts.listSelector ?? '#reviewList';
    const scope     = opts.scope || document;

    function items(){
      const wrap = q(listSel) || scope;
      return Array.from(wrap.querySelectorAll('.qitem, .qa, .review-item, .q-review, [data-item="review"]'));
    }

    function updateStats(){
      const all = items();
      const total = all.length;
      let ok=0,bad=0,skip=0,shown=0;
      all.forEach(it=>{
        const isBad = detectBad(it);
        if (isBad){
          if (it.classList.contains('skip')) skip++;
          else bad++;
        } else ok++;
        if (!it.hidden) shown++;
      });
      const S=(id,v)=>{const el=document.getElementById(id); if(el) el.textContent=v;};
      S('stTotal', total); S('stOk', ok); S('stBad', bad); S('stSkip', skip); S('stShown', shown);
    }

    function apply(){
      const only = !!(onlyWrong && onlyWrong.checked);
      const kw = (searchBox && searchBox.value || '').trim().toLowerCase();

      items().forEach(it=>{
        const isBad = detectBad(it);
        let visible = true;
        if (only && !isBad) visible = false; // chỉ hiển thị sai/skip
        if (visible && kw){
          const text = (it.querySelector('.qtext')?.textContent || it.querySelector('.q')?.textContent || it.textContent || '').toLowerCase();
          if (!text.includes(kw)) visible = false;
        }
        it.hidden = !visible;
      });
      updateStats();
    }

    let timer=null;
    onlyWrong && onlyWrong.addEventListener('change', apply);
    searchBox && searchBox.addEventListener('input', ()=>{ clearTimeout(timer); timer = setTimeout(apply, 120); });
    printBtn  && printBtn.addEventListener('click', ()=>window.print());
    window.addEventListener('load', apply);

    // Nút lên đầu (nếu có)
    const toTop = document.getElementById('toTop');
    if (toTop){
      window.addEventListener('scroll', ()=>{ toTop.style.display = (window.scrollY>300)?'block':'none'; });
    }

    return { apply, updateStats };
  }
  NS.bindControls = bindControls;

  // ========= Tiêu đề + Điều hướng =========
  const TITLES = {
    ktnt:     'XEM LẠI & GIẢI THÍCH — KIỂM TRA NHẬN THỨC',
    practice: 'XEM LẠI & GIẢI THÍCH — ÔN TRẮC NGHIỆM',
    try:      'XEM LẠI & GIẢI THÍCH — THI THỬ'
  };

  function setTitle(){
    const page = getPageType();
    const h1 = document.querySelector('.hdr__title');
    if (h1) h1.textContent = TITLES[page] || TITLES.ktnt;
  }

  // ROUTES (cho phép ghi đè qua window.REVIEW_ROUTES)
  const USER_ROUTES = window.REVIEW_ROUTES || {};
  const ROUTES = {
    home:      USER_ROUTES.home      || '../src/pages/index.html',
    materials: USER_ROUTES.materials || '../src/pages/materials.html',
    againByPage: {
      ktnt:     (USER_ROUTES.againByPage && USER_ROUTES.againByPage.ktnt)     || '../scr/pages/exam.html',     // Kiểm tra nhận thức
      practice: (USER_ROUTES.againByPage && USER_ROUTES.againByPage.practice) || '../src/pages/practice.html', // Ôn trắc nghiệm
      try:      (USER_ROUTES.againByPage && USER_ROUTES.againByPage.try)      || '../scr/pages/quiz.html'      // Thi thử
    }
  };

  function wireNav(){
    const page = getPageType();
    const btnAgain = document.getElementById('navAgain');
    const btnDocs  = document.getElementById('navDocs');
    const btnHome  = document.getElementById('navHome');

    const againUrl = (ROUTES.againByPage[page] || ROUTES.home);
    btnAgain && btnAgain.addEventListener('click', ()=> location.assign(againUrl));
    btnDocs  && btnDocs.addEventListener('click',  ()=> location.assign(ROUTES.materials));
    btnHome  && btnHome.addEventListener('click',  ()=> location.assign(ROUTES.home));
  }

  // ========= Boot =========
  document.addEventListener('DOMContentLoaded', () => {
    setTitle();
    wireNav();

    const page = getPageType();
    const { pack, key } = readAnyPack(page);

    const listEl = document.getElementById('reviewList');
    if (listEl && !listEl.children.length && pack) {
      NS.renderReview('reviewList', key);
    }

    // Normalize (dù render hay markup sẵn) — đảm bảo hộp Giải thích
    let tries = 0;
    (function tick(){
      const ok = NS.normalizeReview(document);
      if (!ok && tries++ < 5) setTimeout(tick, 120);
    })();

    // Controls + thống kê
    const ctl = NS.bindControls({ listSelector: '#reviewList' });
    if (ctl && typeof ctl.apply === 'function') ctl.apply();
  });
})();
