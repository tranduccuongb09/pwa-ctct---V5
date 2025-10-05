/* src/js/review-core.js — core share cho 3 trang review */
(function () {
  'use strict';

  const NS = (window.CTCT_REVIEW = window.CTCT_REVIEW || {});

  /* ===== Utils ===== */
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  NS.escapeHtml = escapeHtml;

  /* ===== Meta chips (giữ API cũ) ===== */
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
    return bits.map(t => `<span class="pill">${t}</span>`).join('');
  }
  NS.fmtMetaChips = fmtMetaChips;

  /* ===== Render list (không đổi) ===== */
  function renderList(details) {
    return details.map(d=>{
      const idx=Number(d.index)||'';
      const q  =escapeHtml(d.question||'');
      const chosen =(d.chosen||'').trim();
      const correct=(d.correct||'').trim();
      const answered=!!chosen;
      const ok=answered && chosen===correct;

      let cls='skip', line=`— <b>Không trả lời</b> • Đúng: <b>${escapeHtml(correct)}</b>`;
      if (answered) {
        if (ok)  { cls='ok';  line=`✔️ <b>Đúng</b> — Bạn chọn: <b>${escapeHtml(chosen)}</b> • Đúng: <b>${escapeHtml(correct)}</b>`; }
        else     { cls='ng';  line=`✖️ <b>Sai</b> — Bạn chọn: <b>${escapeHtml(chosen)}</b> • Đúng: <b>${escapeHtml(correct)}</b>`; }
      }
      const exp =(d.explanation||'').trim();
      const expHtml = exp ? `<div class="exp"><b>Giải thích:</b> ${escapeHtml(exp)}</div>` : '';

      return `<div class="qa ${cls}" data-ok="${ok?'1':'0'}" data-answered="${answered?'1':'0'}">
                <div class="result">${line}</div>
                <div class="qtext"><span class="qindex">Câu ${idx}.</span> ${q}</div>
                ${expHtml}
              </div>`;
    }).join('');
  }
  NS.renderList = renderList;

  /* ===== Render khối review (API giữ nguyên) ===== */
  function renderReview(containerId, storageKey, options = {}) {
    const host = document.getElementById(containerId);
    if (!host) return;

    let pack = null;
    try { pack = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) {}

    if (!pack || !Array.isArray(pack.details) || pack.details.length === 0) {
      host.innerHTML = options.emptyHtml || '<div class="card section"><b>Không có dữ liệu để xem lại.</b></div>';
      return;
    }

    const pillsEl = document.getElementById('reviewMeta') || host.querySelector('.review-pills');
    const listEl  = document.getElementById('reviewList') || host.querySelector('.qwrap');

    if (pillsEl) pillsEl.innerHTML = fmtMetaChips(pack);
    if (listEl)  listEl.innerHTML  = renderList(pack.details);
    else host.innerHTML = `<div id="reviewList">${renderList(pack.details)}</div>`;

    NS._lastPack = pack;
    if (typeof options.onRendered === 'function') options.onRendered(pack);

    // áp lại filter nếu đã auto-bind
    if (NS._auto && typeof NS._auto.apply === 'function') setTimeout(()=>NS._auto.apply(),0);
  }
  NS.renderReview = renderReview;

  /* ===== Bộ lọc + Giải thích + In + ĐẾM ===== */
  function bindControls(opts = {}) {
    const $ = (sel) => (typeof sel === 'string' ? document.querySelector(sel) : sel);

    const onlyWrong = $(opts.onlyWrong ?? '#onlyWrong');
    const searchBox = $(opts.search    ?? '#searchBox');
    const explain   = $(opts.explain   ?? '#explainMode') || $('#expMode'); // nếu không có, mặc định 'auto'
    const printBtn  = $(opts.print     ?? '#printBtn');
    const scope     = opts.scope || document;

    const PREFS_KEY = opts.prefsKey || 'ctct_review_prefs';
    const prefs = (()=>{ try { return JSON.parse(localStorage.getItem(PREFS_KEY)||'{}'); } catch { return {}; } })();

    if (onlyWrong && typeof prefs.onlyWrong === 'boolean') onlyWrong.checked = prefs.onlyWrong;
    if (searchBox && typeof prefs.keyword === 'string')    searchBox.value  = prefs.keyword;
    if (explain && prefs.explainMode) {
      const ok = Array.from(explain.options||[]).some(o=>o.value===prefs.explainMode);
      if (ok) explain.value = prefs.explainMode;
    }

    function updateStats() {
      const all = Array.from(scope.querySelectorAll('.qa'));
      const vis = all.filter(x => !x.hidden && x.style.display !== 'none');
      const ok  = vis.filter(x => x.classList.contains('ok')).length;
      const ng  = vis.filter(x => x.classList.contains('ng') || x.classList.contains('bad')).length;
      const sk  = vis.filter(x => x.classList.contains('skip')).length;

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('statTotal',  all.length);
      set('statOk',     ok);
      set('statBad',    ng);
      set('statSkip',   sk);
      set('statVisible',vis.length);
    }

    function apply() {
      const showOnlyWrong = !!(onlyWrong && onlyWrong.checked);
      const keyword = (searchBox && searchBox.value || '').trim().toLowerCase();
      const mode = (explain && explain.value) || 'auto'; // auto | always | hide

      localStorage.setItem(PREFS_KEY, JSON.stringify({ onlyWrong: showOnlyWrong, keyword, explainMode: mode }));

      const items = Array.from(scope.querySelectorAll('.qa'));
      items.forEach(item=>{
        const isBad = item.classList.contains('ng') || item.classList.contains('bad') || (item.dataset.ok==='0');
        const text  = (item.querySelector('.qtext')?.textContent || item.textContent || '').toLowerCase();

        let visible = true;
        if (showOnlyWrong && !isBad) visible = false;
        if (visible && keyword && !text.includes(keyword)) visible = false;

        item.style.display = visible ? '' : 'none';

        const exp = item.querySelector('.exp');
        if (exp){
          if (mode==='always'){ exp.hidden=false; exp.style.display=''; }
          else if (mode==='hide'){ exp.hidden=true; exp.style.display='none'; }
          else { // auto
            const show = isBad;
            exp.hidden = !show;
            exp.style.display = show ? '' : 'none';
          }
        }
      });

      updateStats();
    }

    let t=null;
    function onSearch(){ clearTimeout(t); t=setTimeout(apply,160); }

    onlyWrong && onlyWrong.addEventListener('change', apply);
    searchBox && searchBox.addEventListener('input', onSearch);
    explain   && explain.addEventListener('change', apply);
    printBtn  && printBtn.addEventListener('click', ()=>window.print());

    window.addEventListener('load', apply);

    // expose để console có thể gọi
    const api = { apply, updateStats };
    NS._auto = api;
    return api;
  }
  NS.bindControls = bindControls;

  // Auto-bind nếu trang có control
  document.addEventListener('DOMContentLoaded', () => {
    if (
      document.getElementById('onlyWrong') ||
      document.getElementById('searchBox') ||
      document.getElementById('explainMode') || document.getElementById('expMode') ||
      document.getElementById('printBtn')
    ) {
      NS._auto = bindControls();
    }
  });
})();
