// Admin console client: bearer token from this tab (sessionStorage), server re-checks.
(function () {
  'use strict';
  var KEY = 'sehs-admin-token';
  function token() {
    if (window.__sehsAdmin) return window.__sehsAdmin;
    try { return sessionStorage.getItem(KEY); } catch (e) { return null; }
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.hidden = true; }, 2400);
  }
  function loginWall() {
    if (document.getElementById('admin-login')) return;
    var d = document.createElement('div');
    d.className = 'modal-backdrop';
    d.id = 'admin-login';
    d.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="al-title" style="max-width:420px">' +
      '<h2 id="al-title">Admin locked</h2>' +
      '<p style="color:var(--mut)">This tab is not unlocked. Enter the admin password, or <a href="/unlock">go to the unlock page</a>.</p>' +
      '<form id="admin-login-form"><input id="admin-login-pw" type="password" autocomplete="current-password" placeholder="Admin password" required ' +
      'style="width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--line2);background:var(--panel);color:inherit;font-size:15px">' +
      '<p id="admin-login-err" class="mode-note" hidden></p>' +
      '<button class="btn" type="submit" style="width:100%;margin-top:10px">Unlock this tab</button></form></div>';
    document.body.appendChild(d);
    document.getElementById('admin-login-pw').focus();
    d.querySelector('#admin-login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = document.getElementById('admin-login-pw');
      var err = document.getElementById('admin-login-err');
      fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({ password: pw.value }),
      }).then(function (r) { return r.json().then(function (j) { return { r: r, j: j }; }); }).then(function (x) {
        if (x.r.ok && x.j.token) {
          try { sessionStorage.setItem(KEY, x.j.token); } catch (e) { /* memory only */ }
          window.__sehsAdmin = x.j.token;
          d.remove();
          location.reload();
        } else {
          err.textContent = 'Incorrect password. Please try again.';
          err.hidden = false;
          pw.value = '';
          pw.focus();
        }
      }).catch(function () {
        err.textContent = 'Could not reach the server.';
        err.hidden = false;
      });
    });
  }
  async function call(method, url, body) {
    var headers = { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' };
    var t = token();
    if (t) headers.Authorization = 'Bearer ' + t;
    var r = await fetch(url, {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    var j = await r.json().catch(function () { return {}; });
    if (r.status === 404 && !t) { loginWall(); throw new Error('locked'); }
    if (r.status === 404) { toast('Not allowed'); throw new Error('forbidden'); }
    if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
    return j;
  }
  // resources: tier toggle
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-tier]');
    if (t) {
      call('PATCH', '/api/admin/resources/' + t.getAttribute('data-tier'), { accessLevel: t.getAttribute('data-level') })
        .then(function () { location.reload(); }).catch(function (err) { toast(String(err.message || err)); });
      return;
    }
    var ed = e.target.closest && e.target.closest('[data-edit]');
    if (ed) { openEdit(Number(ed.getAttribute('data-edit'))); return; }
    if (e.target.closest && e.target.closest('#edit-x')) { document.getElementById('edit-modal').hidden = true; return; }
    if (e.target.closest && e.target.closest('#bulk-btn')) {
      var raw = document.getElementById('bulk-text').value;
      var arr;
      try { arr = JSON.parse(raw); } catch (ex) { document.getElementById('bulk-msg').textContent = 'Invalid JSON.'; return; }
      call('POST', '/api/admin/resources/bulk', { resources: arr })
        .then(function (j) {
          document.getElementById('bulk-msg').textContent = 'Added ' + j.added + (j.errors && j.errors.length ? ' · ' + j.errors.length + ' rejected' : '');
          if (j.added) setTimeout(function () { location.reload(); }, 800);
        }).catch(function (err) { document.getElementById('bulk-msg').textContent = String(err.message || err); });
      return;
    }
    var rv = e.target.closest && e.target.closest('[data-revoke-session]');
    if (rv) {
      call('POST', '/api/admin/sessions/revoke', { rowid: Number(rv.getAttribute('data-revoke-session')) })
        .then(function () { location.reload(); }).catch(function (err) { toast(String(err.message || err)); });
      return;
    }
    if (e.target.closest && e.target.closest('#revoke-all')) {
      if (!confirm('Revoke ALL admin sessions (including yours)?')) return;
      call('POST', '/api/admin/sessions/revoke-all', {})
        .then(function () { location.href = '/unlock'; }).catch(function (err) { toast(String(err.message || err)); });
      return;
    }
    if (e.target.closest && e.target.closest('#purge-btn')) {
      call('POST', '/api/admin/purge', {})
        .then(function (j) { toast('Purged ' + j.deleted + ' old events'); setTimeout(function () { location.reload(); }, 800); })
        .catch(function (err) { toast(String(err.message || err)); });
    }
  });
  // edit modal
  var editingId = null;
  function openEdit(id) {
    call('GET', '/api/admin/resources/' + id).then(function (j) {
      var r = j.resource;
      editingId = id;
      var f = document.getElementById('res-edit');
      f.id.value = id;
      f.title.value = r.title || '';
      f.description.value = r.description || '';
      f.category.value = r.category || 'other';
      f.accessLevel.value = r.accessLevel || 'public';
      f.status.value = r.status || 'available';
      f.provider.value = r.provider || '';
      f.tags.value = (r.tags || []).join(', ');
      f.visibility.checked = !!r.visibility;
      f.featured.checked = !!r.featured;
      document.getElementById('edit-modal').hidden = false;
    }).catch(function (err) { toast(String(err.message || err)); });
  }
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f.id === 'res-add') {
      e.preventDefault();
      call('POST', '/api/admin/resources', {
        title: f.title.value, provider: f.provider.value,
        category: f.category.value, accessLevel: f.accessLevel.value,
      }).then(function () { location.reload(); }).catch(function (err) { toast(String(err.message || err)); });
    } else if (f.id === 'res-edit') {
      e.preventDefault();
      call('PATCH', '/api/admin/resources/' + editingId, {
        title: f.title.value, description: f.description.value, category: f.category.value,
        accessLevel: f.accessLevel.value, status: f.status.value, provider: f.provider.value,
        tags: f.tags.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
        visibility: f.visibility.checked, featured: f.featured.checked,
      }).then(function () { location.reload(); }).catch(function (err) { toast(String(err.message || err)); });
    } else if (f.id === 'pw-form') {
      e.preventDefault();
      var msg = document.getElementById('pw-msg');
      msg.textContent = 'Working…';
      call('POST', '/api/admin/password', { role: f.role.value, current: f.current.value, next: f.next.value })
        .then(function (j) {
          msg.textContent = j.relogin ? 'Rotated — please log in again.' : 'Rotated.';
          f.reset();
          if (j.relogin) setTimeout(function () { location.href = '/unlock'; }, 1200);
        }).catch(function (err) { msg.textContent = String(err.message || err); });
    } else if (f.id === 'terms-form') {
      e.preventDefault();
      var m = document.getElementById('terms-msg');
      m.textContent = 'Publishing…';
      call('POST', '/api/admin/terms', { summary: f.summary.value, body: f.body.value })
        .then(function (j) { m.textContent = 'Published as v' + j.version + ' — users will re-accept.'; })
        .catch(function (err) { m.textContent = String(err.message || err); });
    } else if (f.id === 'ret-form') {
      e.preventDefault();
      call('POST', '/api/admin/retention', { days: Number(f.days.value) })
        .then(function (j) { toast('Retention set to ' + j.days + ' days'); })
        .catch(function (err) { toast(String(err.message || err)); });
    }
  });
  var del = document.getElementById('res-delete');
  if (del) del.addEventListener('click', function () {
    if (!editingId || !confirm('Delete this resource permanently?')) return;
    call('DELETE', '/api/admin/resources/' + editingId)
      .then(function () { location.reload(); }).catch(function (err) { toast(String(err.message || err)); });
  });
})();
