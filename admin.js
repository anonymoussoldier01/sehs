// Admin console client: all calls carry X-Requested-With; server re-checks admin role.
(function () {
  'use strict';
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.hidden = true; }, 2400);
  }
  async function call(method, url, body) {
    var r = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    var j = await r.json().catch(function () { return {}; });
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
      if (!confirm('Revoke ALL viewer and admin sessions (including yours)?')) return;
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
