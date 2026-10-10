// Shared ask-the-tutor box (exam guide + anywhere with #tutor-q/#tutor-go).
(function () {
  'use strict';
  var go = document.getElementById('tutor-go');
  if (!go) return;
  go.onclick = async function () {
    var q = document.getElementById('tutor-q').value.trim();
    var a = document.getElementById('tutor-a');
    if (q.length < 3) { a.hidden = false; a.textContent = 'Ask a study question first.'; return; }
    go.disabled = true;
    a.hidden = false;
    a.textContent = 'Thinking…';
    try {
      a.textContent = await window.SEHS_AI.chat('tutor', q.slice(0, 800));
    } catch (e) { a.textContent = 'AI unavailable: ' + e.message; }
    go.disabled = false;
  };
  document.getElementById('tutor-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') go.onclick(); });
})();
