// Writing studio client: prompts + timer + word count (local only).
(function () {
  'use strict';
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  var prompts = [];
  var timer = null, secs = 20 * 60;
  function fmt(s) { var m = Math.floor(s / 60), ss = s % 60; return (m < 10 ? '0' : '') + m + ':' + (ss < 10 ? '0' : '') + ss; }
  function paint() {
    document.getElementById('write-timer').textContent = fmt(Math.max(0, secs));
    var n = (document.getElementById('write-box').value.trim().match(/\S+/g) || []).length;
    document.getElementById('word-count').textContent = n + ' words' + (n >= 250 && n <= 350 ? ' ✓' : ' (target 250-350)');
  }
  fetch('/api/writing').then(function (r) { return r.json(); }).then(function (j) {
    prompts = j.prompts || [];
    if (prompts.length) show(prompts[Math.floor(Math.random() * prompts.length)]);
  }).catch(function () {});
  function show(p) {
    document.getElementById('prompt-title').textContent = (p.kind === 'persuasive' ? 'Persuasive: ' : 'Creative: ') + p.prompt;
    document.getElementById('prompt-stim').textContent = p.stimulus || '';
    document.getElementById('prompt-plan').textContent = 'Plan: ' + (p.plan || []).join(' → ');
  }
  document.getElementById('prompt-random').onclick = function () {
    if (!prompts.length) return;
    show(prompts[Math.floor(Math.random() * prompts.length)]);
  };
  var aiPromptBtn = document.getElementById('prompt-ai');
  if (aiPromptBtn) aiPromptBtn.onclick = async function () {
    aiPromptBtn.disabled = true;
    aiPromptBtn.textContent = 'Writing…';
    try {
      const r = await fetch('/api/ai/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify({ kind: Math.random() < 0.5 ? 'persuasive' : 'creative', theme: 'exam practice' }) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'failed');
      show({ kind: j.kind, prompt: j.prompt.prompt, stimulus: j.prompt.stimulus, plan: j.prompt.plan });
    } catch (e) {
      document.getElementById('prompt-title').textContent = 'AI unavailable: ' + e.message;
    }
    aiPromptBtn.disabled = false;
    aiPromptBtn.textContent = '✦ New AI prompt';
  };
  document.querySelectorAll('[data-kind]').forEach(function (b) {
    b.onclick = function () {
      var list = prompts.filter(function (p) { return p.kind === b.getAttribute('data-kind'); });
      if (list.length) show(list[Math.floor(Math.random() * list.length)]);
    };
  });
  document.getElementById('write-box').addEventListener('input', paint);
  document.getElementById('timer-start').onclick = function () {
    if (timer) { clearInterval(timer); timer = null; this.textContent = 'Start'; return; }
    this.textContent = 'Pause';
    timer = setInterval(function () {
      secs--;
      paint();
      if (secs <= 0) { clearInterval(timer); timer = null; document.getElementById('timer-start').textContent = 'Start'; }
    }, 1000);
  };
  document.getElementById('timer-reset').onclick = function () {
    if (timer) clearInterval(timer);
    timer = null; secs = 20 * 60;
    document.getElementById('timer-start').textContent = 'Start';
    paint();
  };
  paint();

  /* ---------- optional free AI feedback + grading (server proxy) ---------- */
  function essayKind() { return document.getElementById('prompt-title').textContent.startsWith('Creative') ? 'creative' : 'persuasive'; }
  var fbBtn = document.getElementById('ai-feedback');
  if (fbBtn) {
    fbBtn.onclick = async function () {
      var essay = document.getElementById('write-box').value.trim();
      var words = (essay.match(/\S+/g) || []).length;
      var out = document.getElementById('ai-out');
      var txt = document.getElementById('ai-text');
      if (words < 30) { txt.textContent = 'Write at least ~30 words first — the AI needs something to respond to.'; out.hidden = false; return; }
      var kind = (document.getElementById('prompt-title').textContent.startsWith('Creative') ? 'creative' : 'persuasive');
      fbBtn.disabled = true;
      fbBtn.textContent = 'Thinking…';
      txt.textContent = 'Asking the free tutor… (shared quota, can take ~20s)';
      out.hidden = false;
      try {
        var fb = await window.SEHS_AI.chat('writing', '[' + kind + '] ' + essay.slice(0, 3000));
        txt.textContent = fb;
      } catch (e) {
        txt.textContent = 'AI unavailable: ' + e.message + ' — use the self-rubric above instead.';
      }
      fbBtn.disabled = false;
      fbBtn.textContent = 'Get AI feedback';
    };
  }
  var gradeBtn = document.getElementById('ai-grade');
  if (gradeBtn) {
    gradeBtn.onclick = async function () {
      var essay = document.getElementById('write-box').value.trim();
      var words = (essay.match(/\S+/g) || []).length;
      var out = document.getElementById('grade-out');
      var bars = document.getElementById('grade-bars');
      var note = document.getElementById('grade-note');
      if (words < 30) { bars.innerHTML = ''; note.textContent = 'Write at least ~30 words first.'; out.hidden = false; return; }
      gradeBtn.disabled = true;
      gradeBtn.textContent = 'Grading…';
      bars.innerHTML = '<p style="color:var(--mut)">Marking…</p>';
      note.textContent = '';
      out.hidden = false;
      var bar = function (label, v) {
        return '<div style="display:flex;gap:8px;align-items:center;margin:4px 0"><span style="width:110px;font-size:13px">' + label + '</span>' +
          '<span style="flex:1;background:var(--bg2);border-radius:6px;height:10px"><span style="display:block;height:10px;width:' + (v * 20) + '%;background:var(--acc);border-radius:6px"></span></span>' +
          '<span style="font-size:13px;width:24px;text-align:right">' + v + '</span></div>';
      };
      try {
        const r = await fetch('/api/ai/grade', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify({ kind: essayKind(), essay: essay.slice(0, 3200) }) });
        const j = await r.json();
        if (!r.ok || !j.ok) throw new Error(j.error || 'failed');
        var a = j.auto;
        var html = '<p style="font-size:13px;color:var(--mut)">Automatic checks — overall ' + a.overall + '/5 · ' + a.words + ' words · ' + a.sentences + ' sentences · ' + a.paras + ' paragraphs</p>' +
          Object.keys(a.scores).map(function (k) { return bar(k, a.scores[k]); }).join('');
        if (j.ai) {
          html += '<p style="font-size:13px;color:var(--mut);margin-top:8px">AI marker — overall ' + j.ai.overall + '/5' + (j.cached ? ' (instant)' : '') + '</p>' +
            Object.keys(j.ai.scores).map(function (k) { return bar(k + ' ✦', j.ai.scores[k]); }).join('') +
            (j.ai.strength ? '<p style="font-size:13px">✓ ' + esc(j.ai.strength) + '</p>' : '') +
            (j.ai.fix1 ? '<p style="font-size:13px">→ ' + esc(j.ai.fix1) + '</p>' : '') +
            (j.ai.fix2 ? '<p style="font-size:13px">→ ' + esc(j.ai.fix2) + '</p>' : '');
        }
        bars.innerHTML = html;
        note.textContent = j.note || (j.ai ? 'AI + automatic checks agree-ish? Trust the fixes, not just the number.' : '');
      } catch (e) {
        bars.innerHTML = '';
        note.textContent = 'Grader unavailable: ' + e.message;
      }
      gradeBtn.disabled = false;
      gradeBtn.textContent = 'Grade my writing';
    };
  }
})();
