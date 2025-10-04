/* src/js/review-core.js — core share cho 3 trang review */
(function () {
  'use strict';

  const NS = (window.CTCT_REVIEW = window.CTCT_REVIEW || {});

  /* ========== Utils ========== */
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  NS.escapeHtml = escapeHtml;

  /* ========== Meta chips (giữ nguyên API cũ) ========== */
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

  /* ========== Render list (giữ nguyên + đánh class) ========== */
  function renderList(details) {
    return details.map(d => {
      const idx = Number(d.index) || '';
      const q   = escapeHtml(d.question || '');
      const chosen  = (d.chosen || '').trim();
      const correct = (d.correct || '').trim();
      const answered= !!chosen;
      const ok      = answered && chosen === correct;

      let cls  = 'skip';
      let line = `— <b>Không trả lời</b> • Đúng: <b>${escapeHtml(correct)}</b>`;
      if (answered) {
        if (ok)  { cls='ok';  line = `✔️ <b>Đúng</b> — Bạn chọn: <b>${escapeHtml(chosen)}</b> • Đúng: <b>${escapeHtml(correct)}</b>`; }
        else     { cls='bad'; line = `✖️ <b>Sai</b> — Bạn chọn: <b>${escapeHtml(chosen)}</b> • Đúng: <b>${escapeHtml(correct)}</b>`; }
      }

      const exp = (d.explanation || '').trim();
      const expHtml = exp ? `<div class="exp"><b>Giải thích:</b> ${escapeHtml(exp)}</div>` : '';

      return `<div class="qitem ${cls}">
                <div class="q">Câu ${idx}. ${q}</div>
                <div class="ans">${line}</div>
                ${expHtml}
              </div>`;
    }).join('');
  }
  NS.renderList = renderList;

  /* ========== Render khối review (API giữ nguyên) ========== */
  
  function renderReview(containerId, storageKey, options = {}) {
    const host = document.getElementById(containerId);
    if (!host) return;

    let pack = null;
    try { pack = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) {}

    if (!pack || !Array.isArray(pack.details) || pack.details.length === 0) {
      host.innerHTML = options.emptyHtml || '<div class="card section"><b>Không có dữ liệu để xem lại.</b></div>';
      return;
    }

    const metaHtml = fmtMetaChips(pack);
    const listHtml = renderList(pack.details);

    const pillsEl = options.pillsSelector
      ? host.querySelector(options.pillsSelector)
      : (document.getElementById('reviewMeta') || host.querySelector('.review-pills'));

    const listEl  = options.listSelector
      ? host.querySelector(options.listSelector)
      : (document.getElementById('reviewList') || host.querySelector('.qwrap'));

    if (pillsEl && listEl) {
      pillsEl.innerHTML = metaHtml;
      listEl.innerHTML  = listHtml;
    } else {
      host.innerHTML = `
        <div class="review-pills">${metaHtml}</div>
        <div class="qwrap">${listHtml}</div>
      `;
    }

    NS._lastPack = pack;
    if (typeof options.onRendered === 'function') options.onRendered(pack);

    // Nếu auto-bind đã khởi tạo trước đó, áp dụng lại filter ngay
    if (NS._auto && typeof NS._auto.apply === 'function') {
      setTimeout(() => NS._auto.apply(), 0);
    }
  }
  NS.renderReview = renderReview;

  /* ========== Bổ sung: bind bộ lọc / giải thích / in ========== */
 
  function bindControls(opts = {}) {
    const q = (x) => (typeof x === 'string' ? document.querySelector(x) : x);

    const onlyWrong = q(opts.onlyWrong ?? '#onlyWrong');
    const searchBox = q(opts.search    ?? '#searchBox');
    const explain   = q(opts.explain   ?? '#explainMode') || q('#expMode'); // chấp nhận cả expMode cũ
    const printBtn  = q(opts.print     ?? '#printBtn');
    const scope     = opts.scope || document;

    const PREFS_KEY = opts.prefsKey || 'ctct_review_prefs';
    const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; } })();

    if (onlyWrong && typeof prefs.onlyWrong === 'boolean') onlyWrong.checked = prefs.onlyWrong;
    if (searchBox && typeof prefs.keyword === 'string') searchBox.value = prefs.keyword;
    if (explain && prefs.explainMode) {
      const has = Array.from(explain.options || []).some(o => o.value === prefs.explainMode);
      if (has) explain.value = prefs.explainMode;
    }
    function normMode(v) {
      // Chuẩn hoá: chấp nhận 'show' (UI cũ) như 'always'
      if (v === 'show') return 'always';
      if (v === 'always') return 'always';
      if (v === 'hide') return 'hide';
      return 'auto';
    }

    function apply() {
      const showOnlyWrong = !!(onlyWrong && onlyWrong.checked);
      const keyword = (searchBox && searchBox.value || '').trim().toLowerCase();
      
      const modeRaw = (explain && explain.value) || 'auto';
      const mode = (modeRaw === 'show' ? 'always' : modeRaw);
      localStorage.setItem(PREFS_KEY, JSON.stringify({ onlyWrong: showOnlyWrong, keyword, explainMode: mode }));

      const items = Array.from(scope.querySelectorAll('.qitem'));
      items.forEach(item => {
        const isBad = item.classList.contains('bad') ||
                      item.classList.contains('ng')  ||
                      (item.dataset.ok === '0');
        const text  = (item.querySelector('.qtext')?.textContent || item.textContent || '').toLowerCase();

        // 1) lọc chỉ câu sai
        let visible = true;
        if (showOnlyWrong && !isBad) visible = false;

         // 2) lọc theo từ khóa (chỉ vào phần text câu hỏi nếu có)
        const queryText =
          (item.querySelector('.qtext')?.textContent ||
           item.querySelector('.q')?.textContent ||
           item.textContent || '').toLowerCase();
        if (visible && keyword && !queryText.includes(keyword)) visible = false;

        item.hidden = !visible;

        // 3) chế độ giải thích (hỗ trợ .exp và .muted)
        const exp = item.querySelector('.exp, .muted');
        if (exp) {
          if (mode === 'always') { exp.hidden = false; exp.style.display = ''; }
          else if (mode === 'hide') { exp.hidden = true; exp.style.display = 'none'; }
          else { // auto
            const show = !!isBad;               // chỉ hiện khi sai
            exp.hidden = !show;
            exp.style.display = show ? '' : 'none';
        }
      }
      });
    }

    let timer = null;
    function onSearch(){ clearTimeout(timer); timer = setTimeout(apply, 120); }

    onlyWrong && onlyWrong.addEventListener('change', apply);
    explainEl && explainEl.addEventListener('change', apply);
    searchBox && searchBox.addEventListener('input', onSearch);
    printBtn  && printBtn.addEventListener('click', () => window.print());

    // chạy lần đầu
    window.addEventListener('load', apply);

    return { apply };
  }
  NS.bindControls = bindControls;

  // Auto-bind nếu trang có control
  document.addEventListener('DOMContentLoaded', () => {
    if (
      document.getElementById('onlyWrong') ||
      document.getElementById('searchBox') ||
      document.getElementById('explainMode') ||
      document.getElementById('expMode') ||
      document.getElementById('printBtn')
    ) {
      NS._auto = bindControls();
    }
  });
})();