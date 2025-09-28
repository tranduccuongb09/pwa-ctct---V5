<script>
/* ================= mini-quiz.js — bản chuẩn =================
 * Cách dùng:
 *   - Đảm bảo đã nhúng config.js (có window.CTCT_CONFIG.SHEET_API)
 *   - Gọi:   mountMiniQuiz('miniQuizBox', '<MATERIAL_ID>');
 *   - HTML:  <div id="miniQuizBox"></div>
 */
(function(){
  "use strict";

  // ==== Resolve API (ưu tiên config.js) ====
  const API =
    (window.CTCT_CONFIG && window.CTCT_CONFIG.SHEET_API) ||
    window.SHEET_API ||
    "";

  // ==== Helpers ====
  const escapeHtml = s => String(s||"").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"
  }[m]));
  function fetchWithTimeout(url, opts={}, ms=8000){
    const ctrl = new AbortController();
    const timer = setTimeout(()=>ctrl.abort(), ms);
    return fetch(url, { ...opts, signal: ctrl.signal })
      .finally(()=>clearTimeout(timer));
  }

  async function loadMiniQuiz(materialId){
    if (!API) throw new Error("Chưa cấu hình SHEET_API (config.js).");
    const url = `${API}?action=miniQuiz&materialId=${encodeURIComponent(materialId)}`;
    const res = await fetchWithTimeout(url, { cache:'no-store' }, 10000);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error("Phản hồi không phải JSON hợp lệ."); }
    const qs = Array.isArray(data.questions) ? data.questions : [];
    return qs.map(q => ({
      question: q.question ?? "",
      answer: String(q.answer || "").trim(),
      options: q.options || {}
    }));
  }

  function renderMiniQuiz(root, qs){
    if(!qs.length){
      root.innerHTML = '<div class="mq-empty">Chưa có mini-quiz cho tài liệu này.</div>';
      return;
    }

    root.innerHTML = `
      <div class="mq-list" role="group" aria-label="Mini-quiz"></div>
      <button class="mq-submit" type="button">Nộp mini-quiz</button>
      <div class="mq-result" hidden></div>
    `;

    const list = root.querySelector('.mq-list');
    list.innerHTML = qs.map((q, i) => {
      const opts = ['A','B','C','D'].filter(k => (q.options?.[k]||'').toString().trim());
      const optsHtml = opts.map(k => `
        <label class="mq-opt">
          <input type="radio" name="mq_${i}" value="${k}" aria-labelledby="mq_q_${i}">
          <span><b>${k}.</b> ${escapeHtml(q.options[k])}</span>
        </label>
      `).join('');
      return `
        <div class="mq-item">
          <div id="mq_q_${i}" class="mq-q"><b>Câu ${i+1}.</b> ${escapeHtml(q.question)}</div>
          <div class="mq-opts">${optsHtml || '<em class="mq-empty">Chưa có đáp án.</em>'}</div>
        </div>
      `;
    }).join('');

    const btn = root.querySelector('.mq-submit');
    const resultBox = root.querySelector('.mq-result');

    btn.addEventListener('click', () => {
      let score = 0;
      qs.forEach((q, i) => {
        const picked = root.querySelector(`input[name="mq_${i}"]:checked`);
        const val = picked?.value || '';
        root.querySelectorAll(`input[name="mq_${i}"]`).forEach(inp => {
          const lab = inp.closest('.mq-opt');
          lab.classList.remove('ok','ng');
          if (inp.value === q.answer) lab.classList.add('ok');
          if (inp.checked && inp.value !== q.answer) lab.classList.add('ng');
        });
        if (val === q.answer) score++;
      });
      resultBox.hidden = false;
      resultBox.innerHTML = `Kết quả: <b>${score}/${qs.length}</b>`;
    }, { passive:true });
  }

  async function mountMiniQuiz(rootId, materialId){
    const root = document.getElementById(rootId);
    if(!root) return;
    root.innerHTML = '<div class="mq-loading">Đang tải mini-quiz…</div>';

    try{
      const qs = await loadMiniQuiz(materialId);
      renderMiniQuiz(root, qs);
    }catch(err){
      root.innerHTML = `
        <div class="mq-error">
          Không tải được mini-quiz. ${escapeHtml(err.message||String(err))}
        </div>`;
      console.error('[mini-quiz]', err);
    }
  }

  window.mountMiniQuiz = mountMiniQuiz;
})();
</script>
