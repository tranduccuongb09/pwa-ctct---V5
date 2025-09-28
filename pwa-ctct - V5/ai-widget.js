<!-- index.html và materials.html sẽ <script src="ai-widget.js"></script> -->
<script>
/* ai-widget.js – MVP Q&A dựa trên FAQ + tìm kiếm từ khóa */
(function(){
  const API = window.SHEET_API || window.API || '';
  async function ask(q){
    const url = `${API}?action=ask&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {cache:'no-store'});
    return await res.json();
  }
  function bindAIBox(rootId='aiBox'){
    const el = document.getElementById(rootId); if(!el) return;
    const form = el.querySelector('form'); const q = el.querySelector('input[name="q"]');
    const out  = el.querySelector('.ai__out');
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const text = q.value.trim(); if(!text) return;
      out.innerHTML = '<div class="ai__thinking">Đang tìm câu trả lời…</div>';
      try{
        const data = await ask(text);
        // data: { answer, sources:[{title,url}] }
        let html = `<div class="ai__answer">${(data.answer||'Chưa có dữ liệu phù hợp.').replace(/\n/g,'<br>')}</div>`;
        if (Array.isArray(data.sources) && data.sources.length){
          html += '<div class="ai__sources"><b>Tài liệu liên quan:</b><ul>' +
            data.sources.slice(0,5).map(s=>`<li><a href="${s.url}" target="_blank" rel="noopener">${s.title||s.url}</a></li>`).join('') +
          '</ul></div>';
        }
        out.innerHTML = html;
      }catch(_){
        out.innerHTML = '<div class="ai__err">Không truy vấn được. Thử lại sau.</div>';
      }
    });
  }
  window.bindAIBox = bindAIBox;
})();
</script>
