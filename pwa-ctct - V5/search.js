(function () {
  const form = document.getElementById('globalSearch');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const q = (new FormData(form).get('q') || '').trim();
    const url = q ? `materials.html?q=${encodeURIComponent(q)}` : 'materials.html';
    location.href = url;
  });
})();
