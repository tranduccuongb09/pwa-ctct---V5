/* src/js/review-normalize.js */
(function () {
  'use strict';

  const NS = (window.CTCT_REVIEW = window.CTCT_REVIEW || {});

  // ---- helpers ----
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

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function readPack() {
    try {
      const p1 = JSON.parse(localStorage.getItem('ctct_try_last_result') || 'null');
      if (p1 && Array.isArray(p1.details)) return p1;
    } catch (_) {}
    try {
      const p2 = JSON.parse(localStorage.getItem('ctct_last_result_for_review') || 'null');
      if (p2 && Array.isArray(p2.details)) return p2;
    } catch (_) {}
    return null;
  }

  // Đánh dấu khối có chữ “Giải thích” (nếu nội dung HTML có sẵn chữ này)
  function tagExplain(container) {
    container.querySelectorAll('p,div,li,span').forEach(el => {
      const t = (el.textContent || '').trim();
      if (/^giải\s*thích\b/i.test(t) || /\bgiải\s*thích\s*[:：]/i.test(t)) {
        el.classList.add('exp');
      }
    });
  }

  // Gom nhóm theo mốc “Câu N.” nếu trang chưa có .qa
  function ensureQaBlocks(root) {
    if (root.querySelector('.qa, .qitem')) return; // đã có

    // Thu thập các block trực tiếp 1 cấp
    let parent = root;
    let blocks = Array.from(
      parent.querySelectorAll(':scope > p, :scope > div, :scope > li, :scope > section, :scope > article')
    ).filter(el => !el.matches('.qa, .qitem, script, style'));

    // Nếu ít quá, thử sâu thêm 1 lớp
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

    starts.push(blocks.length); // sentinel

    for (let s = 0; s < starts.length - 1; s++) {
      const i = starts[s], j = starts[s + 1];

      const wrap = document.createElement('div');
      wrap.className = 'qa';
      parent.insertBefore(wrap, blocks[i]);

      for (let k = i; k < j; k++) wrap.appendChild(blocks[k]);

      // set data-qindex nếu tìm được “Câu N.”
      const m = /câu\s*(\d+)/i.exec((wrap.textContent || '').trim());
      if (m) wrap.dataset.qindex = String(parseInt(m[1], 10));

      // gắn trạng thái ok/ng/skip theo dòng chứa Đúng/Sai/Không trả lời
      const line = Array.from(wrap.querySelectorAll('p,div,span,li')).find(n=>{
        const t=(n.textContent||'').trim().toLowerCase();
        return /(^|[\s—\-])đúng\b/.test(t) || /(^|[\s—\-])sai\b/.test(t) || /không trả lời/.test(t);
      });
      if (line) {
        const t=line.textContent.toLowerCase();
        if (/đúng\b/.test(t) && !/sai\b/.test(t)) { wrap.classList.add('ok'); wrap.dataset.ok='1'; }
        else if (/sai\b/.test(t))                { wrap.classList.add('ng','bad'); wrap.dataset.ok='0'; }
        else if (/không trả lời/.test(t))        { wrap.classList.add('skip');      wrap.dataset.ok='0'; }
      }
    }
  }

  // Bơm .exp từ localStorage. Ghép theo:
  // 1) data-qindex nếu có
  // 2) Thứ tự xuất hiện nếu không có qindex
  function attachExpFromStorage(root) {
    const pack = readPack();
    if (!pack) return 0;

    // Chuẩn hoá mảng giải thích
    const details = Array.isArray(pack.details) ? pack.details : [];
    const byIndex = new Map();
    details.forEach(d => {
      const i = Number(d.index || 0);
      const exp = (d.explanation || '').trim();
      if (i && exp) byIndex.set(i, exp);
    });

    const qaList = Array.from(root.querySelectorAll('.qa, .qitem'));
    let added = 0;

    // Lượt 1: theo qindex
    qaList.forEach(qa => {
      if (qa.querySelector('.exp')) return; // đã có
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

    // Lượt 2: theo thứ tự nếu vẫn chưa có exp
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

  function normalize(scope) {
    const root = hostRoot(scope);
    if (!root) return false;

    // 1) Có .qa chưa? nếu chưa thì gom nhóm
    ensureQaBlocks(root);
    // 2) Đánh dấu exp nếu HTML có sẵn chữ “Giải thích”
    tagExplain(root);
    // 3) Bơm exp từ localStorage (trường hợp markup không có)
    attachExpFromStorage(root);

    return true;
  }

  // API public
  NS.normalizeReview = function (scope) {
    const ok = normalize(scope);
    if (ok && NS.bindControls) NS.bindControls({ scope: hostRoot(scope) });
    return ok;
  };

  // Tự chạy + retry nhẹ nếu nội dung load chậm
  document.addEventListener('DOMContentLoaded', () => {
    let tries = 0;
    (function tick(){
      const ok = NS.normalizeReview(document);
      if (!ok && tries++ < 5) setTimeout(tick, 120);
    })();
  });
})();
