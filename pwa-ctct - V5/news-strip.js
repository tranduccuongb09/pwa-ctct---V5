<script>
(function(){
  const API = window.SHEET_API || '';
  async function loadNews(){
    const url = `${API}?action=news`;
    const res = await fetch(url,{cache:'no-store'}); return await res.json();
  }
  async function mountNewsStrip(rootId='newsStrip'){
    const root = document.getElementById(rootId); if(!root) return;
    root.innerHTML = '<div class="strip__loading">Đang tải…</div>';
    try{
      const data = await loadNews(); // { slogans:[...], items:[{title,url,date}] }
      const slogans = (data.slogans||[]).map(s=>`<span class="strip__tag">${s}</span>`).join('');
      const items   = (data.items||[]).slice(0,6).map(n=>`<a href="${n.url}" target="_blank" rel="noopener">${n.title}</a>`).join(' • ');
      root.innerHTML = `<div class="strip__slogans">${slogans}</div><div class="strip__items">${items}</div>`;
    }catch(_){ root.innerHTML='<div class="strip__err">Không tải được tin.</div>'; }
  }
  window.mountNewsStrip = mountNewsStrip;
})();
</script>

<style>
.strip__slogans{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.strip__tag{padding:6px 10px;border-radius:999px;background:#fff;color:#A41919;font-weight:800}
.strip__items{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
</style>
