// analytics.js
// === Ghi sự kiện sử dụng về Apps Script (Sheet "logs") ===

(function(){
  const { SHEET_API } = window.CTCT_CONFIG || {};
  function safeParse(s){ try{ return JSON.parse(s); }catch{ return null; } }

  // Gọi: window.ctctLog('event_name', {k:'v'})
  window.ctctLog = async function(event, data={}){
    if (!SHEET_API) return;
    try{
      const me = safeParse(localStorage.getItem('ctct_profile')) || {};
      const payload = {
        action: 'log',
        event,
        data,
        me,
        ts: new Date().toISOString(),
        ua: navigator.userAgent
      };
      await fetchJSON(SHEET_API+'?action=log', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      }, 8000, 0);
    }catch(e){
      // logging thất bại thì bỏ qua, tránh làm ảnh hưởng UI
      console.warn('[analytics] log fail', e);
    }
  };

  // Một toast nhỏ gọn để hiển thị lỗi/thông báo (dùng chung)
  if (!document.getElementById('toast')){
    const t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;right:12px;bottom:12px;background:#111;color:#fff;padding:10px 14px;border-radius:10px;display:none;z-index:9999';
    document.addEventListener('DOMContentLoaded', ()=>document.body.appendChild(t));
  }
  window.toast = (msg)=>{
    const t = document.getElementById('toast'); if(!t) return;
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(()=> t.style.display='none', 3500);
  };
})();
