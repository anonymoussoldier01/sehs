// Studylists: named collections in localStorage + shareable encoded links.
// Share links contain only public resource IDs (validated server-side).
(function () {
  'use strict';
  function load() { try { return JSON.parse(localStorage.getItem('sehs-lists') || '[]'); } catch (e) { return []; } }
  function save(lists) { try { localStorage.setItem('sehs-lists', JSON.stringify(lists.slice(0, 50))); } catch (e) {} }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.hidden = true; }, 2200);
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function encodeIds(ids) {
    var s = JSON.stringify(ids.slice(0, 100));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // ---- add-to-list menu on cards ----
  var menu = null, scrim = null;
  function closeMenu() {
    if (menu) { menu.remove(); menu = null; }
    if (scrim) { scrim.remove(); scrim = null; }
  }
  document.addEventListener('click', function (e) {
    if (menu && e.target.closest && !e.target.closest('.list-menu') && !e.target.closest('[data-listadd]')) closeMenu();
    var b = e.target.closest && e.target.closest('[data-listadd]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    var id = b.getAttribute('data-listadd');
    var lists = load();
    scrim = document.createElement('div');
    scrim.className = 'drawer-scrim';
    scrim.addEventListener('click', closeMenu);
    document.body.appendChild(scrim);
    menu = document.createElement('div');
    menu.className = 'list-menu disc-tile';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'Add to list');
    menu.style.cssText = 'position:fixed;z-index:70;min-width:240px;max-width:min(320px, calc(100vw - 32px));padding:14px';
    var r = b.getBoundingClientRect();
    var mw = 300, mh = 320;
    menu.style.left = Math.max(12, Math.min(window.innerWidth - mw - 12, r.left)) + 'px';
    menu.style.top = Math.max(12, Math.min(window.innerHeight - mh - 12, r.bottom + 8)) + 'px';
    menu.innerHTML = '<p style="font-size:12px;color:var(--mut);margin:0 0 6px">Add to list</p>' +
      lists.map(function (l, i) {
        return '<button class="btn small secondary" style="width:100%;margin-bottom:6px" data-picklist="' + i + '" data-res="' + esc(id) + '">' +
          esc(l.name) + ' (' + l.items.length + ')</button>';
      }).join('') +
      '<form id="list-quick-new" style="display:flex;gap:6px"><input id="list-quick-name" maxlength="60" placeholder="New list…" style="flex:1;padding:7px;border-radius:8px;border:1px solid var(--line2);background:var(--panel);color:inherit" aria-label="New list name"><button class="btn small" type="submit">+</button></form>';
    document.body.appendChild(menu);
    menu.querySelector('#list-quick-new').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = menu.querySelector('#list-quick-name').value.trim().slice(0, 60);
      if (!name) return;
      var ls = load();
      ls.push({ id: 'l' + Date.now().toString(36), name: name, items: [id] });
      save(ls);
      closeMenu();
      paintHub();
      toast('Added to "' + name + '"');
    });
    menu.querySelectorAll('[data-picklist]').forEach(function (pb) {
      pb.addEventListener('click', function () {
        var ls = load();
        var l = ls[Number(pb.getAttribute('data-picklist'))];
        if (l && !l.items.includes(id)) {
          l.items.push(id);
          if (l.items.length > 200) l.items = l.items.slice(-200);
          save(ls);
          paintHub();
          toast('Added to "' + l.name + '"');
        } else toast('Already in list');
        closeMenu();
      });
    });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  // ---- sidebar folders (every page has #side-lists) ----
  function paintSide() {
    var host = document.getElementById('side-lists');
    if (!host) return;
    var lists = load();
    if (!lists.length) { host.innerHTML = ''; return; }
    host.innerHTML = lists.slice(0, 6).map(function (l) {
      var href = '/list/' + encodeIds(l.items || []);
      return '<a class="side-link side-folder" href="' + href + '"><span class="side-ico" aria-hidden="true">▤</span>' +
        '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(l.name) + '</span>' +
        '<span class="c">' + (l.items || []).length + '</span></a>';
    }).join('') + (lists.length > 6 ? '<a class="side-link" href="/saved"><span class="side-ico" aria-hidden="true">…</span>All folders</a>' : '');
  }
  // ---- lists hub (Saved page) ----
  function paintHub() {
    paintSide();
    var host = document.getElementById('lists-hub');
    if (!host) return;
    var lists = load();
    host.innerHTML = lists.length ? lists.map(function (l, i) {
      return '<div class="disc-tile"><h3>' + esc(l.name) + '</h3><p>' + l.items.length + ' resources</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn small secondary" data-sharelist="' + i + '">Share link</button>' +
        '<button class="btn small secondary" data-openlist="' + i + '">Open as search</button>' +
        '<button class="btn small secondary" data-quizlist="' + i + '" title="AI quiz from this list">✦ Quiz me</button>' +
        '<button class="btn small secondary" data-dellist="' + i + '">Delete</button></div>' +
        '<div class="list-quiz" hidden style="margin-top:8px"></div></div>';
    }).join('') : '<p style="color:var(--mut)">No lists yet — tap “List +” on any resource, or create one below.</p>';
  }
  document.addEventListener('click', function (e) {
    var sh = e.target.closest && e.target.closest('[data-sharelist]');
    if (sh) {
      var l = load()[Number(sh.getAttribute('data-sharelist'))];
      if (!l || !l.items.length) { toast('List is empty'); return; }
      var url = new URL('/list/' + encodeIds(l.items), location.origin).href;
      var done = function () { toast('Share link copied'); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done);
      else done();
      return;
    }
    var op = e.target.closest && e.target.closest('[data-openlist]');
    if (op) {
      var l2 = load()[Number(op.getAttribute('data-openlist'))];
      if (l2) location.href = '/list/' + encodeIds(l2.items);
      return;
    }
    var dl = e.target.closest && e.target.closest('[data-dellist]');
    if (dl) {
      var ls = load();
      ls.splice(Number(dl.getAttribute('data-dellist')), 1);
      save(ls);
      paintHub();
      return;
    }
    var qz = e.target.closest && e.target.closest('[data-quizlist]');
    if (qz) {
      (async function () {
        var tile = qz.closest('.disc-tile');
        var box = tile.querySelector('.list-quiz');
        var l3 = load()[Number(qz.getAttribute('data-quizlist'))];
        if (!l3) return;
        box.hidden = false;
        box.innerHTML = '<p style="color:var(--mut)">Writing a quiz from "' + esc(l3.name) + '"…</p>';
        try {
          const r = await fetch('/api/ai/questions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify({ strand: 'verbal', topic: l3.name.slice(0, 100), n: 4 }) });
          const j = await r.json();
          if (!r.ok || !j.ok) throw new Error(j.error || 'failed');
          box.innerHTML = j.questions.map(function (q, i) {
            return '<div class="disc-tile" style="margin-top:8px"><p><strong>Q' + (i + 1) + '</strong> ' + esc(q.stem) + '</p>' +
              '<div style="display:grid;gap:6px">' + q.options.map(function (o, k) { return '<button class="btn secondary small" data-lqopt="' + i + ':' + k + '">' + esc(o) + '</button>'; }).join('') + '</div>' +
              '<p class="lqfb" style="font-size:13px" hidden></p></div>';
          }).join('');
          var vqs = j.questions;
          box.querySelectorAll('[data-lqopt]').forEach(function (b) {
            b.addEventListener('click', function () {
              var parts = b.getAttribute('data-lqopt').split(':');
              var q = vqs[Number(parts[0])], picked = Number(parts[1]);
              var fb = b.closest('.disc-tile').querySelector('.lqfb');
              fb.hidden = false;
              var ok = picked === q.answer;
              fb.textContent = (ok ? '✓ Correct. ' : '✗ Correct: ' + q.options[q.answer] + '. ') + q.explain;
              fb.style.color = ok ? 'var(--ok)' : 'var(--bad)';
            });
          });
        } catch (err) { box.innerHTML = '<p>AI unavailable: ' + esc(err.message) + '</p>'; }
      })();
      return;
    }
  });
  var hubForm = document.getElementById('list-new');
  if (hubForm) hubForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('list-name').value.trim().slice(0, 60);
    if (!name) return;
    var ls = load();
    ls.push({ id: 'l' + Date.now().toString(36), name: name, items: [] });
    save(ls);
    document.getElementById('list-name').value = '';
    paintHub();
  });
  paintHub();
})();
