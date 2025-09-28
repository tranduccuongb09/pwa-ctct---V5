<!-- news.js -->
<script>
(function(){
  const CFG = window.CTCT_CONFIG || {};
  const SHEET_API = CFG.SHEET_API || ''; // bắt buộc đã cấu hình

  // Chèn CSS ticker nhẹ
  const style = document.createElement('style');
  style.textContent = `
  .news-ticker{overflow:hidden; white-space:nowrap}
  .news-ticker__rail{display:inline-flex; gap:24px; animation:marquee 28s linear infinite; will-change:transform}
  @keyframes marquee{ from{transform:translateX(0)} to{transform:translateX(-50%)} }
  .news-item{display:inline-flex; gap:8px; align-items:center}
  .news-item a{color:#111827; text-decoration:none; font-weight:700}
  .news-item a:hover{text-decoration:underline}
  .news-src{color:#6b7280; font-size:12px}
  .news-list{display:grid; gap:10px; margin-top:10px}
  .news-card{background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:10px}
  .news-card a{color:#111827; text-decoration:none; font-weight:700}
  .news-card a:hover{text-decoration:underline}
  `;
  document.head.appendChild(style);

  function fmtDate(iso){
    try{ return new Date(iso).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' }); }catch(_){ return '' }
  }

  async function loadNews(limitPer=5, total=20){
    const url = `${SHEET_API}?action=news&limitPer=${limitPer}&total=${total}`;
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error(res.status+' '+res.statusText);
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  }

  // Gắn vào khối chạy ngang (ticker) + danh sách dưới
  async function mountNewsStrip(elId){
    const host = document.getElementById(elId);
    if (!host) return;
    host.innerHTML = `<div class="muted">Đang tải tin…</div>`;
    try{
      const items = await loadNews(5, 18); // mỗi nguồn 5 tin, tổng 18 tin
      if(!items.length){ host.innerHTML = `<div class="muted">Chưa có tin mới.</div>`; return; }

      // Ticker: nhân đôi list để chạy vòng
      const tickerHalf = items.slice(0, Math.max(6, Math.min(12, items.length)));
      const rail = tickerHalf.map(it => `
        <span class="news-item">📰 <a href="${it.link}" target="_blank" rel="noopener">${it.title}</a> <span class="news-src">(${fmtDate(it.dateISO)} • ${it.source||''})</span></span>
      `).join('');

      host.innerHTML = `
        <div class="news-ticker" aria-label="Tin nóng chính trị">
          <div class="news-ticker__rail">${rail}${rail}</div>
        </div>
        <div class="news-list" aria-label="Danh sách tin">
          ${items.slice(0, 6).map(it => `
            <div class="news-card">
              <div style="display:flex; justify-content:space-between; gap:10px">
                <a href="${it.link}" target="_blank" rel="noopener">${it.title}</a>
                <span class="news-src">${fmtDate(it.dateISO)} • ${it.source||''}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }catch(e){
      console.error('[news]', e);
      host.innerHTML = `<div class="muted">Không tải được bản tin. Vui lòng kiểm tra Apps Script (action=news) hoặc kết nối mạng.</div>`;
    }
  }

  // Public
  window.mountNewsStrip = mountNewsStrip;
})();
</script>
