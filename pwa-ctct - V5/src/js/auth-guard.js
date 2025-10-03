// auth-guard.js — Middleware chặn không đăng nhập / không đủ quyền
(function(){
  const LS_KEY = 'ctct_profile';
  function getMe(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||'null'); }catch(_){ return null; } }
  function goLogin(){
    const here = location.pathname.split('/').pop() + (location.search||'');
    location.href = `login.html?next=${encodeURIComponent(here)}`;
  }

  // Quy ước vai trò (mặc định "member")
  // - member: thi + xem "Kết quả của tôi"
  // - unit_viewer: xem kết quả toàn đơn vị
  // - ptkv_viewer: xem cấp PTKV
  // - province_admin: xem toàn tỉnh
  const need = (document.currentScript && document.currentScript.getAttribute('data-role')) || ''; 
  // data-role có thể đặt ở thẻ <script src="../js/auth-guard.js" data-role="unit_viewer">

  const me = getMe();
  if (!me || !me.name || !me.unit){
    goLogin(); return;
  }

  // Nâng cao: chặn thi hộ bằng check đơn giản (thiết bị)
  // Lưu dấu vết: người vừa login 5 phút trước mới được thi, hoặc bắt buộc tên + đơn vị khớp
  (function antiImpersonate(){
    try{
      const ts = Number(me.ts||0);
      if (!isNaN(ts) && Date.now() - ts > (1000*60*60*24*30)) {
        // quá 30 ngày: buộc xác nhận lại
        localStorage.removeItem(LS_KEY);
        goLogin();
      }
    }catch(_){}
  })();

  // Kiểm tra quyền nếu trang yêu cầu
  if (need){
    const rankOrder = { member:1, unit_viewer:2, ptkv_viewer:3, province_admin:4 };
    const mine = me.role || 'member';
    if ((rankOrder[mine]||1) < (rankOrder[need]||1)){
      alert('Tài khoản của bạn chưa đủ quyền để truy cập trang này.');
      location.href = 'index.html';
    }
  }

  // Autofill form nếu trang thi có input
  try{
    const f=document.getElementById('fullname'), u=document.getElementById('unit'), p=document.getElementById('position');
    if (f && !f.value) f.value = me.name || '';
    if (u && !u.value) u.value = me.unit || '';
    if (p && !p.value) p.value = me.position || '';
  }catch(_){}
})();
