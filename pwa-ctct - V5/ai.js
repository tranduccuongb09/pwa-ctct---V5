/* ===== Trợ lý AI – CHUẨN (không gợi ý, chống lặp chào, tránh preflight) ===== */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // UI mới (khay)
  const tray   = $('ai-tray');
  const dock   = $('ai-dock');
  const toggle = $('ai-toggle');
  const btnMin = $('ai-minify');
  const btnX   = $('ai-close');
  const formNew  = $('ai-form');
  const inputNew = $('ai-input');
  const boxNew   = $('ai-messages');

  // UI cũ (nếu còn)
  const formOld  = $('aiForm');
  const inputOld = $('aiInput');
  const boxOld   = $('aiChat');

  if (!(formNew && inputNew && boxNew) && !(formOld && inputOld && boxOld)) return;

  const isNewUI = !!(formNew && inputNew && boxNew);
  const form  = isNewUI ? formNew : formOld;
  const input = isNewUI ? inputNew : inputOld;
  const box   = isNewUI ? boxNew  : boxOld;

  // Khay – mở/thu/đóng
  function openTray(){ if(!isNewUI) return; tray.hidden = false; if(dock) dock.hidden = true; input.focus(); }
  function minimize(){ if(!isNewUI) return; tray.hidden = true; if(dock) dock.hidden = false; }
  function closeAll(){ if(!isNewUI) return; tray.hidden = true; if(dock) dock.hidden = true; }

  if (isNewUI) {
    toggle && toggle.addEventListener('click', openTray);
    dock   && dock.addEventListener('click', openTray);
    btnMin && btnMin.addEventListener('click', minimize);
    btnX   && btnX.addEventListener('click', closeAll);
  }

  // ---- Config & helpers ----
  const CFG = window.CTCT_CONFIG || {};
  const SHEET_API = CFG.SHEET_API || '';  // NHỚ nạp config.js trước ai.js

  const J = { parse: (s, fb=null) => { try{ return JSON.parse(s); }catch{ return fb; } } };

  async function fetchText(url, opt={}, timeoutMs=15000){
    const ctl = new AbortController();
    const t = setTimeout(()=>ctl.abort(), timeoutMs);
    try{
      const res = await fetch(url, { ...opt, signal: ctl.signal });
      return await res.text();
    } finally { clearTimeout(t); }
  }

  function addMsg(role, html){
    const el = document.createElement('div');
    el.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
    if (!isNewUI) {
      el.style.cssText = 'margin:10px 0;padding:10px 12px;border-radius:10px;background:' +
        (role==='user'?'#fff':'#f6f6f6') + ';color:#111;border:1px solid #e5e7eb';
    }
    el.innerHTML = html;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    return el;
  }

  // Chỉ chào nếu khung trống (tránh lặp)
  if (!box.querySelector('.msg')) addMsg('bot', 'Chào bạn! Mình có thể giúp gì được cho bạn?');

  // seed prompt (nếu có)
  const seed = localStorage.getItem('ctct_ai_prompt') || '';
  if (seed) { input.value = seed; localStorage.removeItem('ctct_ai_prompt'); }

  const history = [
    { role:'system', content:'Bạn là trợ lý AI hỗ trợ học tập và kiểm tra CTĐ, CTCT.' }
  ];

  // Không set Content-Type để tránh preflight/CORS (giống app.js)
  async function callChat(messages){
    const url = `${SHEET_API}?action=chat`;
    const body = JSON.stringify({ action:'chat', messages });
    const text = await fetchText(url, { method:'POST', body });
    const data = J.parse(text, {});
    if (data && (data.answer || data.ok)) return (data.answer || '').trim();
    throw new Error('chat_failed');
  }

  // Fallback aiAsk (nếu anh vẫn giữ action này)
  async function callAiAsk(query){
    const url = `${SHEET_API}?action=aiAsk`;
    const text = await fetchText(url, { method:'POST', body: JSON.stringify({ query }) });
    const obj = J.parse(text, {});
    return (obj?.answerHTML || obj?.answer || '').trim();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = (input.value || '').trim();
    if (!q) return;

    addMsg('user', q);
    input.value = '';

    const thinking = addMsg('bot', 'Đang soạn trả lời…');

    try{
      if (!SHEET_API) throw new Error('Thiếu SHEET_API — cần nạp config.js trước ai.js');

      history.push({ role:'user', content:q });

      let answer = '';
      try{
        answer = await callChat(history.slice(-14));
      }catch(_){
        answer = await callAiAsk(q);
      }

      thinking.innerHTML = (answer || 'Mình chưa có nội dung để trả lời.').replace(/\n/g,'<br>');
      history.push({ role:'assistant', content: thinking.textContent });
    }catch(err){
      thinking.textContent = 'Không gọi được Trợ lý AI. Vui lòng thử lại sau.';
      console.error('[AI] error:', err);
    }
  });

  // Mở khay khi focus (UI mới)
  if (isNewUI && input) input.addEventListener('focus', () => { if (tray.hidden) openTray(); });
})();
