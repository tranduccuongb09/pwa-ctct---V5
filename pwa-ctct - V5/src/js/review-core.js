/* src/js/review-core.js — core share cho 3 trang review */
(function () {
  'use strict';

  const NS = (window.CTCT_REVIEW = window.CTCT_REVIEW || {});

  // ===== Utils =====
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  NS.escapeHtml = escapeHtml;

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

  function renderList(details) {
    return details.map(d => {
      const idx     = Number(d.index) || '';
      const q       = escapeHtml(d.question || '');
      const chosen  = (d.chosen  || '').trim();
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

      return `<div class="qitem ${cls}" data-ok="${ok ? '1' : '0'}">
                <div class="q">Câu ${idx}. ${q}</div>
                <p class="result ${ok?'ok':'ng'}">${line}</p>
                ${expHtml}
              </div>`;
    }).join('');
  }
  NS.renderList = renderList;

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
      host.innerHTML = `<div class="review-pills">${metaHtml}</div><div class="qwrap">${listHtml}</div>`;
    }

    NS._lastPack = pack;
    if (typeof options.onRendered === 'function') options.onRendered(pack);
    if (NS._auto && typeof NS._auto.apply === 'function') setTimeout(() => NS._auto.apply(), 0);
  }
  NS.renderReview = renderReview;

  // ===== Bộ lọc + Giải thích + In (có Fallback .result) =====
function bindControls(opts = {}) {
  const q = (x) => (typeof x === 'string' ? document.querySelector(x) : x);

  const onlyWrong = q(opts.onlyWrong ?? '#onlyWrong');
  const searchBox = q(opts.search    ?? '#searchBox');
  const explain   = q(opts.explain   ?? '#explainMode') || q('#expMode'); // chấp nhận cả id cũ
  const printBtn  = q(opts.print     ?? '#printBtn');
  const scope     = opts.scope || document;

  const PREFS_KEY = opts.prefsKey || 'ctct_review_prefs';
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { return {}; } })();

  if (onlyWrong && typeof prefs.onlyWrong === 'boolean') onlyWrong.checked = prefs.onlyWrong;
  if (searchBox && typeof prefs.keyword === 'string')     searchBox.value  = prefs.keyword;
  if (explain && prefs.explainMode) {
    const has = Array.from(explain.options || []).some(o => o.value === prefs.explainMode);
    if (has) explain.value = prefs.explainMode;
  }

  // ---- NHẬN DIỆN CÂU SAI ROBUST ----
  function isBadAnswer(item) {
    // 1) cờ/class rõ ràng
    if (item.classList.contains('bad') || item.classList.contains('ng')) return true;
    if (item.classList.contains('ok')) return false;
    if (item.dataset && item.dataset.ok === '0') return true;
    if (item.dataset && item.dataset.ok === '1') return false;

    // 2) theo nội dung .result (ưu tiên vì dữ liệu hiện tại luôn có .result)
    const res = item.querySelector('.result');
    if (res) {
      const t = (res.textContent || '').toLowerCase();
      if (/\bsai\b/.test(t))  return true;
      if (/\bđúng\b/.test(t)) return false;
    }

    // 3) fallback toàn khối
    const txt = (item.textContent || '').toLowerCase();
    if (/\bsai\b/.test(txt) && !/\bđúng\b/.test(txt)) return true;
    return false;
  }

  function apply() {
    const showOnlyWrong = !!(onlyWrong && onlyWrong.checked);
    const keyword = (searchBox && searchBox.value || '').trim().toLowerCase();
    const rawMode = (explain && explain.value) || 'auto';
    const mode = rawMode === 'show' ? 'always' : rawMode; // auto | always | hide

    localStorage.setItem(PREFS_KEY, JSON.stringify({ onlyWrong: showOnlyWrong, keyword, explainMode: mode }));

    const items = Array.from(scope.querySelectorAll('.qitem, .qa'));
    items.forEach(item => {
      const bad = isBadAnswer(item);

      // 1) lọc “Chỉ hiện câu sai”
      let visible = true;
      if (showOnlyWrong && !bad) visible = false;

      // 2) lọc từ khoá (ưu tiên .qtext/.q)
      const lookup =
        (item.querySelector('.qtext')?.textContent ||
         item.querySelector('.q')?.textContent     ||
         item.textContent || '').toLowerCase();
      if (visible && keyword && !lookup.includes(keyword)) visible = false;

      item.hidden = !visible;

      // 3) điều khiển phần giải thích
      //    Nếu có .exp/.muted dùng chúng; nếu không → điều khiển .result
      const expEls = item.querySelectorAll('.exp, .muted');
      const targets = expEls.length ? expEls : item.querySelectorAll('.result');

      targets.forEach(el => {
        if (mode === 'always') {
          el.hidden = false; el.style.display = '';
        } else if (mode === 'hide') {
          el.hidden = true;  el.style.display = 'none';
        } else { // auto
          const show = bad;  // chỉ hiện khi câu sai
          el.hidden = !show;
          el.style.display = show ? '' : 'none';
        }
      });
    });
  }

  let timer = null;
  const onSearch = () => { clearTimeout(timer); timer = setTimeout(apply, 120); };

  onlyWrong && onlyWrong.addEventListener('change', apply);
  explain   && explain.addEventListener('change', apply);
  searchBox && searchBox.addEventListener('input', onSearch);
  printBtn  && printBtn.addEventListener('click', () => window.print());

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
