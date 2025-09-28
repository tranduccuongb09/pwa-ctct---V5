// net.js
// === Helper mạng dùng chung: fetchJSON(url, opts, timeoutMs, retries) ===

(function(){
  async function fetchJSON(url, opts={}, timeoutMs=10000, retries=1){
    const ctrl = new AbortController();
    const id = setTimeout(()=>ctrl.abort(), timeoutMs);
    try{
      const res = await fetch(url, {...opts, signal: ctrl.signal, cache: 'no-store'});
      clearTimeout(id);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      // Khi POST trả text/json linh hoạt:
      const ct = res.headers.get('content-type')||'';
      return ct.includes('application/json') ? await res.json() : await res.text();
    }catch(e){
      clearTimeout(id);
      if (retries > 0) return fetchJSON(url, opts, timeoutMs, retries - 1);
      throw e;
    }
  }
  window.fetchJSON = fetchJSON;
})();
