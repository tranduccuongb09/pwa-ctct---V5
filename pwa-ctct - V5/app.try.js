// app.try.js — Khối ÔN + THI THỬ (độc lập với app.js của thi chính thức)
// Cập nhật: tách trang review sang review-try.html

(() => {
  'use strict';

  /* ======================= CẤU HÌNH & HẰNG SỐ ======================= */
  const CFG = (window.CTCT_CONFIG || {});
  const SHEET_API_MAIN = CFG.SHEET_API || '';
  const SHEET_API_TRY  = CFG.TRY_SHEET_API || '';
  const SHEET_API = SHEET_API_TRY || SHEET_API_MAIN; // ưu tiên TRY

  const TOPIC_FOLDERS = { DQTV: CFG.BANK_DQTV || '', LLTT: CFG.BANK_LLTT || '' };

  const TOTAL_QUESTIONS  = 50;
  const DURATION_MINUTES = 30;
  const MIX_PER_FILE_MAX = 0;           // 0 = server chọn đều
  const DEFAULT_TAB      = 'Câu hỏi';
  const PRACTICE_DEFAULT_COUNT = 50;
  const IS_TRY = true;

  // LocalStorage namespaces (riêng khối TRY)
  const LS_STATE = 'ctct_try_state';
  const LS_QUEUE = 'ctct_try_result_queue';
  const LS_LAST  = 'ctct_try_last_result';

  /* ============================ STATE ============================== */
  let mode = 'exam';             // 'exam' | 'practice'
  let questions = [];
  let selections = {};
  let currentIndex = 0;
  let timer, remainingSeconds = 0;
  let submitted = false;
  let examCode = '';

  let practiceTopic = 'DQTV';
  let practiceBank = null;
  let practiceCount = PRACTICE_DEFAULT_COUNT;

  /* ============================ TIỆN ÍCH ============================ */
  (function injectStyle(){
    const css = `
      #qText, .opt-text { text-align: justify; text-wrap: pretty; }
      label.option { display:block; }
      .try-menu { display:flex; gap:.75rem; flex-wrap:wrap; margin-bottom:.5rem }
      .try-menu a { padding:.25rem .5rem; border-radius:.375rem; background:#f3f4f6; text-decoration:none; color:#111827; font-weight:500 }
      .try-menu a:hover { background:#e5e7eb }
      .rv-item .q { font-weight:600; margin:.5rem 0 .25rem }
      .rv-item .exp { margin:.25rem 0 .75rem; color:#374151 }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  })();

  const pad = n => (n < 10 ? '0' + n : '' + n);
  const classify = (s, t) => { const r=s/t; return r>=.9?'Giỏi':r>=.8?'Khá':r>=.6?'Đạt yêu cầu':'Chưa đạt'; };
  const genCode = () => String((((Date.now() % 9000) + 1000) + Math.floor(Math.random()*9)) % 9000 + 1000);

  async function apiJson(url){
    const res = await fetch(url, { cache:'no-store' });
    if (!res.ok) throw new Error('HTTP '+res.status);
    return res.json();
  }
  const isExcel = (mime='') => /spreadsheetml\.sheet/i.test(mime);
  function shuffle_(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

  function shuffleOptionsOne(q){
    const opts = q.options || {};
    const letters = ['A','B','C','D'].filter(k => (opts[k]??'').toString().trim());
    const pairs = letters.map(k => ({ key:k, text:opts[k] }));
    shuffle_(pairs);
    const out = {}, newLetters = ['A','B','C','D']; let newAnswer = 'A';
    pairs.forEach((p,idx)=>{ const L=newLetters[idx]; out[L]=p.text; if(p.key===q.answer) newAnswer=L; });
    return { ...q, options: out, answer: newAnswer };
  }
  const shuffleQuestionsAndOptions = arr => shuffle_(arr.slice()).map(shuffleOptionsOne);

  // Hàng đợi offline khi POST thất bại
  const getQueue = () => { try{ return JSON.parse(localStorage.getItem(LS_QUEUE)||'[]'); }catch{ return []; } };
  const setQueue = list => localStorage.setItem(LS_QUEUE, JSON.stringify(list));
  async function flushQueue(){
    const q = getQueue(); if(!q.length) return;
    const remain = [];
    for (const item of q){
      try{
        await fetch(SHEET_API, {
          method:'POST', mode:'no-cors',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(item)
        });
      }catch{ remain.push(item); }
    }
    setQueue(remain);
  }
  window.addEventListener('online', flushQueue);

  /* ====================== LẤY CÂU HỎI (TRY) ======================== */
  async function loadMixedQuestionsFromFolder(folderId, limit){
    const url = `${SHEET_API}?action=mixQuestions&folderId=${encodeURIComponent(folderId)}&limit=${limit}&perFile=${MIX_PER_FILE_MAX}&tab=${encodeURIComponent(DEFAULT_TAB)}`;
    const data = await apiJson(url);
    if (data?.error) throw new Error(`API lỗi: ${data.error}${data.detail ? ' — ' + data.detail : ''}`);
    const bank = Array.isArray(data.questions) ? data.questions : [];
    if (!bank.length) throw new Error('Không lấy được câu hỏi: pool rỗng (có thể thư mục chỉ có .xlsx hoặc thiếu quyền).');
    questions = shuffleQuestionsAndOptions(bank).slice(0, limit);
    const prog = document.getElementById('progress'); if (prog) prog.textContent = `0/${questions.length}`;
    const fill = document.getElementById('progressFill'); if (fill) fill.style.width = '0%';
  }

  async function listPracticeBanks(topic){
    const folderId = TOPIC_FOLDERS[topic];
    if(!folderId) throw new Error('Chưa cấu hình thư mục cho đối tượng: ' + topic);
    const url = `${SHEET_API}?action=listBanks&folderId=${encodeURIComponent(folderId)}`;
    const data = await apiJson(url);
    const items = Array.isArray(data.items) ? data.items
                : (Array.isArray(data.banks) ? data.banks.map(b => ({
                    id:b.id, name:b.title, mimeType: b.type==='xlsx'
                      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                      : 'application/vnd.google-apps.spreadsheet'
                  })) : []);
    return items;
  }

  async function loadFirstBankForTopic(topic){
    const items = await listPracticeBanks(topic);
    if(!items.length) throw new Error('Thư mục không có bộ câu hỏi.');
    practiceBank = items[0];
    await loadQuestionsFromFile(practiceBank);
  }

  async function loadQuestionsFromFile(file){
    const url = isExcel(file.mimeType)
      ? `${SHEET_API}?action=questionsXlsx&fileId=${encodeURIComponent(file.id)}&tab=${encodeURIComponent(DEFAULT_TAB)}`
      : `${SHEET_API}?action=questions&sheetId=${encodeURIComponent(file.id)}&tab=${encodeURIComponent(DEFAULT_TAB)}`;
    const data = await apiJson(url);
    const bank = Array.isArray(data.questions) ? data.questions : (Array.isArray(data) ? data : []);
    if(!bank.length) throw new Error('File không có dữ liệu câu hỏi: ' + (file.name||file.title||''));
    questions = shuffleQuestionsAndOptions(bank).slice(0, practiceCount);
    const prog = document.getElementById('progress'); if (prog) prog.textContent = `0/${questions.length}`;
    const fill = document.getElementById('progressFill'); if (fill) fill.style.width = '0%';
  }

  // “Câu hay trả lời sai”
  async function loadTopWrong(topic){
    const box = document.getElementById('wrongList');
    if (!box) return; box.textContent = 'Đang tải…';
    try{
      const url = `${SHEET_API}?action=topWrong&topic=${encodeURIComponent(topic)}&limit=5`;
      const data = await apiJson(url);
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length){ box.textContent = 'Chưa có dữ liệu thống kê.'; return; }
      box.innerHTML = items.map((it,i)=>`<div style="margin:6px 0">
        <b>${i+1}.</b> ${it.question} <span class="muted">(Sai ${it.wrong}/${it.total}, ${Math.round(it.rate*100)}%)</span>
      </div>`).join('');
    }catch{
      box.textContent = 'Không tải được thống kê.';
    }
  }
  function initTopWrongFilter(){
    const box = document.getElementById('wrongList');
    if (!box || box.dataset.inited === '1') return;
    box.dataset.inited = '1';
    const wrap = document.createElement('div');
    wrap.style.margin = '8px 0';
    wrap.innerHTML = `
      <label>Đối tượng:
        <select id="wrongTopicSel">
          <option value="DQTV">DQTV</option>
          <option value="LLTT">LLTT</option>
        </select>
      </label>`;
    box.parentNode.insertBefore(wrap, box);

    const sel = wrap.querySelector('#wrongTopicSel');
    sel.value = (document.getElementById('examTopic')?.value) || practiceTopic || 'DQTV';
    const reload = () => loadTopWrong(sel.value);
    sel.addEventListener('change', reload);
    reload();
  }
  function getWrongSection(){
    const list = document.getElementById('wrongList');
    if (!list) return null;
    return list.closest('#wrongSection, .card, .section, .panel') || list.parentElement;
  }
  function setTopWrongVisibility(show){
    const section = getWrongSection();
    if (!section) return;
    section.hidden = !show;
    if (show){
      initTopWrongFilter();
      const topicFromSelect = document.getElementById('wrongTopicSel')?.value;
      const topicFallback   = document.getElementById('wrongTopic')?.value;
      const topic = topicFromSelect || topicFallback || document.getElementById('examTopic')?.value || 'DQTV';
      loadTopWrong(topic).catch(()=>{});
    }
  }

  /* ======================== RENDER / TIMER ========================== */
  function renderQuestion(){
    const q = questions[currentIndex] || {};
    const titleEl = document.getElementById('qTitle'); if (titleEl) titleEl.textContent = `Câu ${currentIndex+1}`;
    const textEl  = document.getElementById('qText');  if (textEl)  textEl.textContent  = q.question || '';

    const box = document.getElementById('options');
    if (box){ box.innerHTML=''; box.setAttribute('role','radiogroup'); }
    const opts = q.options || {};
    const keys = ['A','B','C','D'].filter(k => (opts[k]??'').toString().trim().length>0);

    keys.forEach(k=>{
      const id=`opt_${currentIndex}_${k}`;
      const label=document.createElement('label'); label.className='option'; label.setAttribute('for',id);
      label.innerHTML=`<input type="radio" id="${id}" name="ans" value="${k}"><span class="opt-text"><b>${k}.</b> ${opts[k]??''}</span>`;
      box.appendChild(label);
    });

    if(selections[currentIndex] && keys.includes(selections[currentIndex])){
      const sel=document.querySelector(`input[name="ans"][value="${selections[currentIndex]}"]`); if(sel) sel.checked=true;
    } else { delete selections[currentIndex]; }

    const progEl=document.getElementById('progress'); if (progEl) progEl.textContent=`${currentIndex+1}/${questions.length}`;
    const fill=document.getElementById('progressFill'); if (fill) fill.style.width=`${((currentIndex+1)/questions.length)*100}%`;

    saveState();
  }

  function startTimer(){
    remainingSeconds = DURATION_MINUTES*60;
    const el=document.getElementById('time');
    const tick=()=>{
      const m=Math.floor(remainingSeconds/60), s=remainingSeconds%60;
      if (el){
        el.textContent=`${pad(Math.max(m,0))}:${pad(Math.max(s,0))}`;
        if(remainingSeconds<=300){ el.style.color='#a00000'; el.style.fontWeight='700'; }
      }
      if(remainingSeconds<=0){ clearInterval(timer); submitQuiz(); return; }
      remainingSeconds--; saveState();
    };
    tick(); timer=setInterval(tick,1000);
  }

  /* ============================ STATE ============================== */
  function saveState(){
    const payload = { ts: Date.now(), examCode, currentIndex, remainingSeconds, selections, questions, mode, practiceTopic, practiceBank, practiceCount };
    localStorage.setItem(LS_STATE, JSON.stringify(payload));
  }
  const hasState = () => !!localStorage.getItem(LS_STATE);
  function loadState(){
    try{
      const st=JSON.parse(localStorage.getItem(LS_STATE)||'{}');
      if(!st || !st.questions || !Array.isArray(st.questions)) return false;
      examCode = st.examCode || genCode();
      questions = st.questions; selections = st.selections||{};
      currentIndex = st.currentIndex||0; remainingSeconds = st.remainingSeconds||DURATION_MINUTES*60;
      mode = st.mode || mode;
      practiceTopic = st.practiceTopic || practiceTopic;
      practiceBank  = st.practiceBank  || practiceBank;
      practiceCount = st.practiceCount || PRACTICE_DEFAULT_COUNT;
      return true;
    }catch{ return false; }
  }
  const clearState = () => localStorage.removeItem(LS_STATE);

  /* ============================= SUBMIT ============================ */
  async function submitQuiz(){
    if(submitted) return; submitted = true;
    const btn=document.getElementById('submitBtn'); if(btn) btn.disabled=true;
    if (mode==='exam') clearInterval(timer);

    const lastPick = document.querySelector('input[name="ans"]:checked'); if(lastPick) selections[currentIndex] = lastPick.value;

    let score = 0;
    const details = questions.map((q,i)=>{
      const chosen = selections[i] || '';
      const ok = chosen === q.answer; if (ok) score++;
      return { index:i+1, question:q.question, chosen, correct:q.answer, explanation: q.explanation || '' };
    });

    const total = questions.length;
    const name=(document.getElementById('fullname')?.value||'').trim();
    const unit=(document.getElementById('unit')?.value||'').trim();
    const position=(document.getElementById('position')?.value||'').trim();

    const head = (mode === 'practice') ? 'Ôn tập — ' : (IS_TRY ? 'Thi thử — ' : 'Thi chính thức — ');
    const resultText = document.getElementById('resultText');
    if (resultText){
      if (mode === 'practice') resultText.textContent = `${head}${score}/${total} điểm`;
      else resultText.textContent = `${head}${name?name+' - ':''}${unit?unit+' ':''}${position?('('+position+') '):''}| Mã đề ${examCode}: ${score}/${total} điểm`;
    }

    const clsEl = document.getElementById('classification');
    if (clsEl){ clsEl.textContent = (mode==='practice') ? 'Chế độ ôn tập (không lưu điểm chính thức).' : ('Xếp loại: ' + classify(score,total)); }

    const quizBox = document.getElementById('quizBox');
    const resultCard = document.getElementById('resultCard');
    if (quizBox) quizBox.hidden = true;
    if (resultCard) resultCard.hidden = false;

    // Lưu gói review cho review-try.html (kèm nhãn đối tượng)
    const topicValue = (document.getElementById('examTopic')?.value || '').trim();
    const topicSel = document.getElementById('examTopic');
    const topicLabel = topicSel ? (topicSel.options[topicSel.selectedIndex]?.text || topicValue) : topicValue;

    localStorage.setItem(LS_LAST, JSON.stringify({
      name, unit, position,
      topic: topicValue, topicLabel,
      examCode, score, total, details,
      mode, practiceTopic, practiceBank
    }));
    clearState();

    // Điều chỉnh link "Xem lại & giải thích" -> review-try.html (không phụ thuộc id cụ thể)
    (function setReviewLink(){
      const container = resultCard || document;
      const candidates = Array.from(container.querySelectorAll('a,button'));
      const vn = s => (s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
      for (const el of candidates){
        const t = vn(el.textContent);
        if (t.includes('xem lai') && t.includes('giai thich')){
          if (el.tagName === 'A') el.setAttribute('href','review-try.html');
          el.addEventListener('click', (e)=>{ if(el.tagName!=='A'){ e.preventDefault(); location.href='review-try.html'; }});
        }
      }
    })();

    // Gửi Sheets khi thi thử
    if (mode === 'exam'){
      const payload = {
        action: 'submitResult',
        examCode, name, unit, position, score, total, details,
        topic: topicValue,
        timestamp: new Date().toISOString()
      };
      try{
        await fetch(SHEET_API, {
          method:'POST', mode:'no-cors',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
      }catch{
        const q = getQueue(); q.push(payload); setQueue(q);
      }
    }
  }

  /* =========================== KHỞI ĐỘNG =========================== */
  function buildTryMenu(){
    const host = document.querySelector('.try-menu');
    if (!host) return;
    host.innerHTML = `
      <a href="practice.html">Ôn trắc nghiệm</a>
      <a href="try.html">Thi thử</a>
      <a href="my-results.html">Kết quả của tôi</a>
    `;
  }

  window.addEventListener('DOMContentLoaded', ()=>{
    flushQueue();
    buildTryMenu();

    // Lúc vào trang: hiển thị box “Câu hay trả lời sai”
    initTopWrongFilter();
    setTopWrongVisibility(true);

    const isPracticePage = /practice\.html/i.test(location.pathname) || !!document.getElementById('practiceTopic');
    const isQuizLayout   = !!(document.getElementById('quizBox') && document.getElementById('startBtn'));
    if (!isPracticePage && !isQuizLayout) return;

    mode = isPracticePage ? 'practice' : 'exam';

    const startBtn   = document.getElementById('startBtn');
    const resumeBtn  = document.getElementById('resumeBtn');
    const startCard  = document.getElementById('startCard');
    const quizBox    = document.getElementById('quizBox');
    const timeEl     = document.getElementById('time');

    if (isPracticePage && timeEl) timeEl.textContent = '∞';
    if (hasState() && resumeBtn)  resumeBtn.hidden = false;

    startBtn && startBtn.addEventListener('click', async ()=>{
      const name=(document.getElementById('fullname')?.value||'').trim();
      const unit=(document.getElementById('unit')?.value||'').trim();
      const position=(document.getElementById('position')?.value||'').trim();

      if (mode==='exam'){
        if(!name || !unit || !position){ alert('Vui lòng nhập đầy đủ Họ tên, Đơn vị, Chức vụ.'); return; }
        const topic = (document.getElementById('examTopic')?.value) || 'DQTV';
        const folderId = TOPIC_FOLDERS[topic] || '';
        if (!folderId){ alert('Chưa cấu hình thư mục cho đối tượng: '+topic); return; }

        examCode = genCode();
        const codeEl=document.getElementById('examCode'); if (codeEl) codeEl.textContent = examCode;

        try{
          await loadMixedQuestionsFromFolder(folderId, TOTAL_QUESTIONS);
          setTopWrongVisibility(false); // ẨN ngay khi bắt đầu thi thử
        }catch(e){ alert(e.message || 'Lỗi tải câu hỏi.'); return; }

        if (startCard) startCard.hidden = true;
        if (quizBox)   quizBox.hidden = false;
        renderQuestion(); startTimer();

      }else{
        // Ôn tập
        examCode = 'PRAC-'+genCode();
        practiceTopic = (document.getElementById('practiceTopic')?.value) || 'DQTV';
        try{
          await loadFirstBankForTopic(practiceTopic);
        }catch(e){ alert(e.message || 'Lỗi tải câu hỏi từ thư mục đối tượng.'); return; }

        if (startCard) startCard.hidden = true;
        if (quizBox)   quizBox.hidden = false;
        renderQuestion();
        if (timeEl) timeEl.textContent = '∞';
        setTopWrongVisibility(true);
      }
    });

    resumeBtn && resumeBtn.addEventListener('click', ()=>{
      const ok = loadState();
      if(!ok){ alert('Không tìm thấy bài đang làm.'); return; }
      const codeEl=document.getElementById('examCode'); if (codeEl) codeEl.textContent = examCode;
      if (startCard) startCard.hidden = true;
      if (quizBox)   quizBox.hidden = false;
      renderQuestion();

      if (mode==='exam'){
        setTopWrongVisibility(false);
        const el=document.getElementById('time');
        const tick=()=>{
          const m=Math.floor(remainingSeconds/60), s=remainingSeconds%60;
          if (el){
            el.textContent=`${pad(Math.max(m,0))}:${pad(Math.max(s,0))}`;
            if(remainingSeconds<=300){ el.style.color='#a00000'; el.style.fontWeight='700'; }
          }
          if(remainingSeconds<=0){ clearInterval(timer); submitQuiz(); return; }
          remainingSeconds--; saveState();
        };
        tick(); timer=setInterval(tick,1000);
      }else{
        setTopWrongVisibility(true);
        if (timeEl) timeEl.textContent = '∞';
      }
    });

    // Điều hướng câu hỏi
    document.getElementById('nextBtn')?.addEventListener('click', ()=>{
      const c=document.querySelector('input[name="ans"]:checked'); if(c) selections[currentIndex]=c.value;
      if(currentIndex<questions.length-1){ currentIndex++; renderQuestion(); }
    });
    document.getElementById('prevBtn')?.addEventListener('click', ()=>{
      const c=document.querySelector('input[name="ans"]:checked'); if(c) selections[currentIndex]=c.value;
      if(currentIndex>0){ currentIndex--; renderQuestion(); }
    });

    // Kiểm tra câu chưa trả lời
    document.getElementById('reviewBtn')?.addEventListener('click', ()=>{
      const unanswered = questions.map((_,i)=> selections[i]?null:i+1).filter(Boolean);
      if(unanswered.length){
        alert('Bạn chưa trả lời các câu: '+unanswered.join(', '));
        const idx=unanswered[0]-1; if(idx>=0){ currentIndex=idx; renderQuestion(); }
      }else alert('Bạn đã trả lời tất cả câu hỏi.');
    });

    // Nộp bài
    document.getElementById('submitBtn')?.addEventListener('click', () => {
      try { submitQuiz(); } catch(e){ console.error(e); alert('Lỗi nộp bài: '+ e.message); }
    });

    // Khi đổi đối tượng trong box “Câu hay trả lời sai”
    document.getElementById('wrongTopic')?.addEventListener('change', (e)=>{
      loadTopWrong(e.target.value);
    });
  });
})();
