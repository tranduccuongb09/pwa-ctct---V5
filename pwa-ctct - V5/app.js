const CFG = (window.CTCT_CONFIG || {});
const SHEET_API_MAIN = CFG.SHEET_API || '';     // kiểm tra chính thức + AI chat
const SHEET_API_TRY  = CFG.TRY_SHEET_API || ''; // thi thử

// Quiz (thi thử) có thể bật cờ này ngay trong HTML của trang đó
const USE_TRY = !!window.CTCT_USE_TRY_API;

// Endpoint mặc định cho phần thi ở trang hiện tại
let SHEET_API = USE_TRY ? SHEET_API_TRY : SHEET_API_MAIN;

// Trợ lý AI bám theo SHEET_API_MAIN (để thống nhất log/chat trên cùng hệ)
const CHAT_API = SHEET_API_MAIN || SHEET_API;
window.API_BASE = CHAT_API;

// Thư mục ngân hàng theo đối tượng (Phương án B – giữ thư mục theo topic)
const TOPIC_FOLDERS = {
  DQTV: CFG.BANK_DQTV || '',
  LLTT: CFG.BANK_LLTT || ''
};

// Tham số đề thi
const TOTAL_QUESTIONS  = 50; // 50 câu
const DURATION_MINUTES = 30; // 30 phút
const MIX_PER_FILE_MAX = 0;  // (0: tuỳ server chọn đều)
const DEFAULT_TAB      = 'Câu hỏi';

// Ôn tập
const PRACTICE_DEFAULT_COUNT = 50;

// Keys LocalStorage
const LS_STATE = 'ctct_exam_state';
const LS_QUEUE = 'ctct_result_queue';
const LS_LAST  = 'ctct_last_result_for_review';

/* ========================================================================== */
/* STATE TOÀN CỤC                                                            */
/* ========================================================================== */
let mode = 'exam';                       // 'exam' | 'practice'
let questions = [];                      // [{question, options:{A..D}, answer, ...}]
let selections = {};                     // { index: 'A'|'B'|'C'|'D' }
let currentIndex = 0;
let timer, remainingSeconds = 0;
let submitted = false;
let examCode = '';

let practiceTopic = 'DQTV';
let practiceBank = null;                 // {id,name,mimeType}
let practiceCount = PRACTICE_DEFAULT_COUNT;

/* ========================================================================== */
/* TIỆN ÍCH CHUNG                                                            */
/* ========================================================================== */
const pad = n => (n < 10 ? '0' + n : '' + n);
const classify = (s, t) => { const r=s/t; return r>=.9?'Giỏi':r>=.8?'Khá':r>=.6?'Đạt yêu cầu':'Chưa đạt'; };
const genCode = () => {
  const base = (Date.now() % 9000) + 1000;
  const rnd = Math.floor(Math.random()*9);
  return String((base + rnd) % 9000 + 1000);
};
async function apiJson(url){
  const res = await fetch(url, { cache:'no-store' });
  if (!res.ok) throw new Error('HTTP '+res.status);
  return res.json();
}
const isExcel = (mime='') => /spreadsheetml\.sheet/i.test(mime);
function shuffle_(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* Đảo đáp án của một câu, cập nhật lại chữ cái answer */
function shuffleOptionsOne(q){
  const opts = q.options || {};
  const letters = ['A','B','C','D'].filter(k => (opts[k]??'').toString().trim());
  const pairs = letters.map(k => ({ key:k, text:opts[k] }));
  shuffle_(pairs);
  const out = {}, newLetters = ['A','B','C','D'];
  let newAnswer = 'A';
  pairs.forEach((p,idx)=>{
    const L = newLetters[idx];
    out[L] = p.text;
    if (p.key === q.answer) newAnswer = L;
  });
  return { ...q, options: out, answer: newAnswer };
}
function shuffleQuestionsAndOptions(arr){
  const shuffled = shuffle_(arr.slice());
  return shuffled.map(shuffleOptionsOne);
}

/* Hàng đợi offline khi POST thất bại */
function getQueue(){ try{ return JSON.parse(localStorage.getItem(LS_QUEUE)||'[]'); }catch{ return []; } }
function setQueue(list){ localStorage.setItem(LS_QUEUE, JSON.stringify(list)); }
async function flushQueue(){
  const q = getQueue();
  if(!q.length) return;
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

/* ========================================================================== */
/* LẤY CÂU HỎI (Phương án B – theo thư mục topic)                            */
/* ========================================================================== */

/** Trộn câu hỏi từ nhiều file trong một folder */
async function loadMixedQuestionsFromFolder(folderId, limit){
  const url = `${SHEET_API}?action=mixQuestions&folderId=${encodeURIComponent(folderId)}&limit=${limit}&perFile=${MIX_PER_FILE_MAX}&tab=${encodeURIComponent(DEFAULT_TAB)}`;
  const data = await apiJson(url);
  const bank = Array.isArray(data.questions) ? data.questions : [];
  if (!bank.length) throw new Error('Không lấy được câu hỏi từ thư mục ngân hàng.');
  questions = shuffleQuestionsAndOptions(bank).slice(0, limit);
  const prog = document.getElementById('progress'); if (prog) prog.textContent = `0/${questions.length}`;
  const fill = document.getElementById('progressFill'); if (fill) fill.style.width = '0%';
}

/** Liệt kê các file ngân hàng trong folder topic (để PRACTICE lấy file đầu tiên) */
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

/** PRACTICE: lấy câu hỏi từ file đầu tiên của folder topic */
async function loadFirstBankForTopic(topic){
  const items = await listPracticeBanks(topic);
  if(!items.length) throw new Error('Thư mục không có bộ câu hỏi.');
  practiceBank = items[0];
  await loadQuestionsFromFile(practiceBank);
}

/** Đọc câu hỏi từ một file cụ thể (xlsx/google sheet) */
async function loadQuestionsFromFile(file){
  let url;
  if (isExcel(file.mimeType)){
    url = `${SHEET_API}?action=questionsXlsx&fileId=${encodeURIComponent(file.id)}&tab=${encodeURIComponent(DEFAULT_TAB)}`;
  } else {
    url = `${SHEET_API}?action=questions&sheetId=${encodeURIComponent(file.id)}&tab=${encodeURIComponent(DEFAULT_TAB)}`;
  }
  const data = await apiJson(url);
  let bank = Array.isArray(data.questions) ? data.questions : (Array.isArray(data) ? data : []);
  if(!bank.length) throw new Error('File không có dữ liệu câu hỏi: ' + (file.name||file.title||''));
  questions = shuffleQuestionsAndOptions(bank).slice(0, PRACTICE_DEFAULT_COUNT);
  const prog = document.getElementById('progress'); if (prog) prog.textContent = `0/${questions.length}`;
  const fill = document.getElementById('progressFill'); if (fill) fill.style.width = '0%';
}

/* ========================================================================== */
/* RENDER / TƯƠNG TÁC BÀI LÀM                                                */
/* ========================================================================== */
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

  saveState(); // autosave
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

/* Resume state */
function saveState(){
  const payload = { ts: Date.now(), examCode, currentIndex, remainingSeconds, selections, questions, mode, practiceTopic, practiceBank, practiceCount };
  localStorage.setItem(LS_STATE, JSON.stringify(payload));
}
function hasState(){ return !!localStorage.getItem(LS_STATE); }
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
function clearState(){ localStorage.removeItem(LS_STATE); }

/* ========================================================================== */
/* SUBMIT                                                                     */
/* ========================================================================== */
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

  const head = (mode==='practice') ? `Ôn tập — ` : (USE_TRY ? 'Thi thử — ' : 'Thi chính thức — ');
  const resultText = document.getElementById('resultText');
  if (resultText){
    resultText.textContent = `${head}${name?name+' - ':''}${unit?unit+' ':''}${position?('('+position+') '):''}| Mã đề ${examCode}: ${score}/${total} điểm`;
  }
  const clsEl = document.getElementById('classification');
  if (clsEl){ clsEl.textContent = (mode==='practice') ? 'Chế độ ôn tập (không lưu điểm chính thức).' : ('Xếp loại: ' + classify(score,total)); }

  const quizBox = document.getElementById('quizBox');
  const resultCard = document.getElementById('resultCard');
  if (quizBox) quizBox.hidden = true;
  if (resultCard) resultCard.hidden = false;

  // Lưu để trang review đọc lại
  localStorage.setItem(LS_LAST, JSON.stringify({ name, unit, position, examCode, score, total, details, mode, practiceTopic, practiceBank }));
  clearState();

  // Chỉ gửi Sheets khi là thi (exam.html hoặc quiz.html-thi thử)
  if (mode === 'exam'){
    const payload = {
      action: 'submitResult',
      examCode, name, unit, position, score, total, details,
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

/* ========================================================================== */
/* BOOTSTRAP TRANG THI / ÔN / THI THỬ                                        */
/* ========================================================================== */
window.addEventListener('DOMContentLoaded', ()=>{
  flushQueue();

  const isQuizLayout = document.getElementById('quizBox') && document.getElementById('startBtn');
  const isPracticePage = /practice\.html/i.test(location.pathname) || (window.CTCT_MODE === 'practice');

  if (isQuizLayout || isPracticePage){
    // Khoá mode theo trang
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
        // Thi (chính thức hoặc thi thử)
        if(!name || !unit || !position){ alert('Vui lòng nhập đầy đủ Họ tên, Đơn vị, Chức vụ.'); return; }
        const topic = (document.getElementById('examTopic')?.value) || 'DQTV';
        const folderId = TOPIC_FOLDERS[topic] || '';
        if (!folderId){ alert('Chưa cấu hình thư mục cho đối tượng: '+topic); return; }

        examCode = genCode();
        const codeEl=document.getElementById('examCode'); if (codeEl) codeEl.textContent = examCode;

        try{ await loadMixedQuestionsFromFolder(folderId, TOTAL_QUESTIONS); }
        catch(e){ alert(e.message || 'Lỗi tải câu hỏi.'); return; }

        startCard.hidden = true; quizBox.hidden = false;
        renderQuestion(); startTimer();

      }else{
        // Ôn tập
        examCode = 'PRAC-'+genCode();
        practiceTopic = (document.getElementById('practiceTopic')?.value) || 'DQTV';
        try{ await loadFirstBankForTopic(practiceTopic); }
        catch(e){ alert(e.message || 'Lỗi tải câu hỏi từ thư mục đối tượng.'); return; }

        startCard.hidden = true; quizBox.hidden = false; renderQuestion();
        if (timeEl) timeEl.textContent = '∞';
      }
    });

    resumeBtn && resumeBtn.addEventListener('click', ()=>{
      const ok = loadState();
      if(!ok){ alert('Không tìm thấy bài đang làm.'); return; }
      const codeEl=document.getElementById('examCode'); if (codeEl) codeEl.textContent = examCode;
      startCard.hidden = true; quizBox.hidden = false;
      renderQuestion();

      if (mode==='exam'){
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
    document.getElementById('submitBtn')?.addEventListener('click', submitQuiz);
  }

  /* ======================================================================== */
  /* TRỢ LÝ AI (khay ở góc phải dưới)                                         */
  /* ======================================================================== */
  const $toggle = document.getElementById('ai-toggle');
  const $tray   = document.getElementById('ai-tray');
  const $dock   = document.getElementById('ai-dock');
  const $minify = document.getElementById('ai-minify');
  const $close  = document.getElementById('ai-close');
  const $form   = document.getElementById('ai-form');
  const $input  = document.getElementById('ai-input');
  const $msgs   = document.getElementById('ai-messages');

  // Nếu trang không có khay AI thì bỏ qua
  if (!$form || !$msgs) return;

  // Mở/thu/đóng
  const openTray = () => { if($tray){ $tray.hidden = false; } if($dock){ $dock.hidden = true; } $input?.focus(); };
  const showDock = () => { if($tray){ $tray.hidden = true;  } if($dock){ $dock.hidden = false; } };
  const hideAll  = () => { if($tray){ $tray.hidden = true;  } if($dock){ $dock.hidden = true;  } };

  $toggle && $toggle.addEventListener('click', openTray);
  $dock   && $dock.addEventListener('click', openTray);
  $minify && $minify.addEventListener('click', showDock);
  $close  && $close.addEventListener('click', hideAll);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $tray && !$tray.hidden) showDock(); });

  // Chỉ chào 1 lần khi khung trống
  if (!$msgs.querySelector('.msg')){
    const hello = document.createElement('div');
    hello.className = 'msg bot';
    hello.textContent = 'Chào bạn! Mình có thể giúp gì được cho bạn?';
    $msgs.appendChild(hello);
  }

  // API chat đơn giản
  const history = [
    { role:'system', content:'Bạn là trợ lý AI hỗ trợ học tập và kiểm tra CTĐ, CTCT cho BAN CHỈ HUY PTKV3. Trả lời ngắn gọn, chuẩn mực, dẫn dắt từng bước.' }
  ];

  const pushMsg = (text, who='bot') => {
    const div = document.createElement('div');
    div.className = `msg ${who}`;
    div.textContent = text;
    $msgs.appendChild(div);
    $msgs.scrollTop = $msgs.scrollHeight;
  };

  $form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const q = ($input.value || '').trim();
    if (!q) return;

    pushMsg(q, 'user'); $input.value = ''; $input.focus();
    history.push({ role:'user', content:q });

    try{
      const endpoint = `${API_BASE}?action=chat`;
      const res = await fetch(endpoint, {
        method:'POST',
        body: JSON.stringify({ action:'chat', messages: history.slice(-14) })
      });
      const raw = await res.text();
      let data; try { data = JSON.parse(raw); } catch { throw new Error('Phản hồi không phải JSON: '+raw.slice(0,180)); }
      if (!res.ok || data.ok === false) throw new Error(data?.error || ('HTTP '+res.status));

      const answer = data?.answer || 'Không có nội dung trả về.';
      pushMsg(answer, 'bot');
      history.push({ role:'assistant', content: answer });
    }catch(err){
      pushMsg('Có lỗi kết nối: '+String(err).slice(0,140), 'bot');
      console.error('[AI chat] error:', err);
    }
  });
});