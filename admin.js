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
  // resources: visibility toggle
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-vis]');
    if (t) {
      call('PATCH', '/api/admin/resources/' + t.getAttribute('data-vis'), { visibility: t.getAttribute('data-level') === '1' })
        .then(function () { bootResources(); }).catch(function (err) { toast(String(err.message || err)); });
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
      return;
    }
    var tr = e.target.closest && e.target.closest('[data-triage]');
    if (tr) {
      var parts = tr.getAttribute('data-triage').split(':');
      call('POST', '/api/admin/triage/' + parts[0] + '/' + parts[1], { status: parts[2] })
        .then(function () { location.reload(); }).catch(function (err) { toast(String(err.message || err)); });
      return;
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

  var del = document.getElementById('res-delete');
  if (del) del.addEventListener('click', function () {
    if (!editingId || !confirm('Delete this resource permanently?')) return;
    call('DELETE', '/api/admin/resources/' + editingId)
      .then(function () { location.reload(); }).catch(function (err) { toast(String(err.message || err)); });
  });

  /* ---------- page boot renderers (shells carry no data) ---------- */
  function escH(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  // dashboard
  (function bootDash() {
    var host = document.getElementById('dash-stats');
    if (!host) return;
    call('GET', '/api/admin/stats').then(function (s) {
      host.innerHTML =
        '<div class="stat-card"><b>' + s.total.toLocaleString() + '</b><span>Resources</span></div>' +
        '<div class="stat-card"><b>' + s.members.toLocaleString() + '</b><span>Members-only</span></div>' +
        '<div class="stat-card"><b>' + s.sessions + '</b><span>Active sessions</span></div>' +
        '<div class="stat-card"><b>' + s.opensToday.toLocaleString() + '</b><span>Opens today</span></div>';
      var max = s.maxDay || 1;
      var bars = function (vals, color) {
        return '<span class="spark" aria-hidden="true">' + vals.map(function (v) {
          return '<i style="height:' + Math.max(2, Math.round((v / max) * 22)) + 'px' + (color ? ';background:' + color : '') + '" title="' + v + '"></i>';
        }).join('') + '</span>';
      };
      document.getElementById('dash-chart').innerHTML =
        '<p>Opens ' + bars(s.days.map(function (d) { return d.opens; })) + '</p>' +
        '<p>Searches ' + bars(s.days.map(function (d) { return d.queries; }), 'var(--acc-line)') + '</p>';
      document.getElementById('dash-queries').innerHTML = s.topQueries.length
        ? '<table class="grid-table"><tbody>' + s.topQueries.map(function (q) { return '<tr><td>' + escH(q.key) + '</td><td style="text-align:right">' + q.c + '</td></tr>'; }).join('') + '</tbody></table>'
        : '<p>No queries yet.</p>';
      document.getElementById('dash-top').innerHTML = s.topRes.length
        ? '<table class="grid-table"><tbody>' + s.topRes.map(function (r) { return '<tr><td><a href="/r/' + r.id + '">' + escH((r.title || r.id).slice(0, 50)) + '</a></td><td style="text-align:right">' + r.c + '</td></tr>'; }).join('') + '</tbody></table>'
        : '<p>No opens yet.</p>';
      document.getElementById('dash-zero').innerHTML = s.zeroQueries.length
        ? s.zeroQueries.map(function (q) { return '<a class="quick-chip" href="/search?q=' + encodeURIComponent(q.key) + '">' + escH(q.key) + ' · ' + q.count + '</a>'; }).join(' ')
        : '<p>None recorded.</p>';
      document.getElementById('dash-ai').innerHTML =
        '<p><strong>' + (s.aiToday || 0) + '</strong> AI calls today · <strong>' + (s.aiCached || 0) + '</strong> cached answers</p>' +
        ((s.aiModes && s.aiModes.length)
          ? '<table class="grid-table"><tbody>' + s.aiModes.map(function (m) { return '<tr><td>' + escH(m.key) + '</td><td style="text-align:right">' + m.c + '</td></tr>'; }).join('') + '</tbody></table>'
          : '<p>No AI usage yet.</p>');
      return call('GET', '/api/admin/health');
    }).then(function (h) {
      document.getElementById('dash-health').innerHTML =
        'DB ' + (h.dbBytes / 1048576).toFixed(1) + ' MB · uptime ' + Math.round(h.uptimeSec / 60) +
        ' min · index rebuild ' + h.indexRebuildMs + ' ms · retention ' + h.retentionDays +
        'd · last purge ' + escH(h.lastPurge) + ' · terms v' + h.termsVersion;
    }).catch(function () { /* login wall shown by call() */ });
  })();
  // resources table
  var resPage = 1, resQ = '';
  function bootResources() {
    var tb = document.getElementById('res-rows');
    if (!tb) return;
    var q = new URLSearchParams(location.search).get('q') || '';
    resQ = q;
    call('GET', '/api/admin/resources?q=' + encodeURIComponent(q) + '&page=' + resPage).then(function (j) {
      tb.innerHTML = j.items.map(function (r) {
        return '<tr><td><a href="/r/' + r.id + '">' + escH((r.title || '').slice(0, 60)) + '</a><br><span style="color:var(--faint);font-size:12px">' +
          escH(r.provider || '') + ' · ' + escH(r.fileType) + '</span></td><td>' + escH(r.category) + '</td>' +
          '<td><span class="badge ' + (r.accessLevel === 'members' ? 'cat' : '') + '">' + escH(r.accessLevel) + '</span></td>' +
          '<td><span class="badge ' + (r.status === 'available' ? 'st-active' : 'st-unknown') + '">' + escH(r.status.replace('_', ' ')) + '</span></td>' +
          '<td>' + (r.visibility ? 'yes' : 'no') + '</td>' +
          '<td style="white-space:nowrap"><button class="btn small secondary" data-edit="' + r._id + '">Edit</button> ' +
          '<button class="btn small secondary" data-vis="' + r._id + '" data-level="' + (r.visibility ? '0' : '1') + '">' +
          (r.visibility ? 'Hide' : 'Show') + '</button></td></tr>';
      }).join('') || '<tr><td colspan="6">No resources.</td></tr>';
      document.getElementById('res-page').textContent = 'Page ' + j.page + ' of ' + j.pages + ' · ' + j.total.toLocaleString() + ' total';
      var prev = document.getElementById('res-prev'), next = document.getElementById('res-next');
      if (prev) { prev.disabled = j.page <= 1; prev.onclick = function () { resPage = j.page - 1; bootResources(); }; }
      if (next) { next.disabled = j.page >= j.pages; next.onclick = function () { resPage = j.page + 1; bootResources(); }; }
    }).catch(function () { tb.innerHTML = '<tr><td colspan="6">Sign in as admin to manage resources.</td></tr>'; });
  }
  (function () {
    if (!document.getElementById('res-rows')) return;
    var pager = document.createElement('div');
    pager.style.cssText = 'display:flex;gap:8px;margin:8px 0';
    pager.innerHTML = '<button class="btn small secondary" id="res-prev">← Prev</button><button class="btn small secondary" id="res-next">Next →</button>';
    document.getElementById('res-page').before(pager);
    var f = document.getElementById('res-search');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = f.q.value;
      var u = new URL(location.href);
      if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
      history.replaceState(null, '', u);
      resPage = 1;
      bootResources();
    });
    bootResources();
  })();
  // audit + sessions
  (function bootAudit() {
    var tb = document.getElementById('audit-rows');
    if (!tb) return;
    var type = (document.getElementById('audit-type') || {}).value || '';
    function detail(d) {
      d = d || {};
      if (d.q) return 'q=“' + String(d.q).slice(0, 60) + '”';
      if (d.which) return d.which;
      if (d.version) return 'v' + d.version;
      if (d.reason) return d.reason;
      if (d.action) return d.action;
      return '';
    }
    call('GET', '/api/admin/events' + (type ? '?type=' + encodeURIComponent(type) : '')).then(function (j) {
      tb.innerHTML = j.items.map(function (e) {
        return '<tr><td style="white-space:nowrap">' + escH(String(e.at || '').slice(0, 19).replace('T', ' ')) + '</td><td>' + escH(e.type) + '</td><td>' +
          (e.resource ? escH(e.resource.slice(0, 50)) : '—') + '</td><td>' + escH(detail(e.data)) + '</td></tr>';
      }).join('') || '<tr><td colspan="4">No events.</td></tr>';
      document.getElementById('audit-page').textContent = 'Page ' + j.page + ' of ' + j.pages + ' · ' + j.total.toLocaleString() + ' total';
    }).catch(function () { tb.innerHTML = '<tr><td colspan="4">Sign in as admin to view the log.</td></tr>'; });
    call('GET', '/api/admin/sessions').then(function (j) {
      document.getElementById('sess-n').textContent = '(' + j.sessions.length + ')';
      document.querySelector('#sess-rows').innerHTML = j.sessions.map(function (s) {
        return '<tr><td>' + escH(s.role) + '</td><td style="white-space:nowrap">' + escH(String(s.seen || '').slice(0, 19).replace('T', ' ')) + '</td><td><code>' +
          escH(s.ip) + '</code></td><td>' + escH(s.ua) + '</td><td><button class="btn small secondary" data-revoke-session="' + s.rowid + '">Revoke</button></td></tr>';
      }).join('') || '<tr><td colspan="5">None.</td></tr>';
    }).catch(function () {});
    var at = document.getElementById('audit-type');
    if (at) at.addEventListener('change', bootAudit);
    var csv = document.getElementById('audit-csv');
    if (csv) csv.addEventListener('click', function () {
      var t = token();
      if (!t) { loginWall(); return; }
      fetch('/api/admin/audit.csv', { headers: { Authorization: 'Bearer ' + t, 'X-Requested-With': 'fetch' } })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.blob();
        }).then(function (b) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = 'sehs-audit.csv';
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        }).catch(function (err) { toast(String(err.message || err)); });
    });
  })();
  // announcements
  (function bootAnn() {
    var host = document.getElementById('ann-list');
    if (!host) return;
    function paint() {
      call('GET', '/api/admin/announcements').then(function (j) {
        host.innerHTML = j.items.map(function (a) {
          return '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><span class="badge ' + (a.active ? 'st-active' : '') + '">' +
            (a.active ? 'live' : 'off') + '</span><span style="flex:1">' + escH(a.body) + '</span>' +
            '<button class="btn small secondary" data-ann="' + a.id + '" data-on="' + (a.active ? '0' : '1') + '">' + (a.active ? 'Hide' : 'Show') + '</button>' +
            '<button class="btn small secondary" data-anndel="' + a.id + '">Delete</button></div>';
        }).join('') || '<p style="color:var(--mut)">No announcements.</p>';
      }).catch(function () { host.innerHTML = '<p>Sign in as admin.</p>'; });
    }
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-ann]');
      if (t) {
        call('PATCH', '/api/admin/announcements/' + t.getAttribute('data-ann'), { active: t.getAttribute('data-on') === '1' })
          .then(paint).catch(function (err) { toast(String(err.message || err)); });
        return;
      }
      var d = e.target.closest && e.target.closest('[data-anndel]');
      if (d && confirm('Delete this announcement?')) {
        call('DELETE', '/api/admin/announcements/' + d.getAttribute('data-anndel'))
          .then(paint).catch(function (err) { toast(String(err.message || err)); });
      }
    });
    document.getElementById('ann-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = document.getElementById('ann-body').value;
      call('POST', '/api/admin/announcements', { body: v })
        .then(function () { document.getElementById('ann-body').value = ''; paint(); })
        .catch(function (err) { toast(String(err.message || err)); });
    });
    var hb = document.getElementById('health-btn');
    if (hb) hb.addEventListener('click', function () {
      call('GET', '/api/admin/health').then(function (h) {
        document.getElementById('health-out').textContent =
          'DB ' + (h.dbBytes / 1048576).toFixed(1) + ' MB · uptime ' + Math.round(h.uptimeSec / 60) +
          ' min · index rebuild ' + h.indexRebuildMs + ' ms · retention ' + h.retentionDays + 'd · terms v' + h.termsVersion;
      }).catch(function (err) { toast(String(err.message || err)); });
    });
    paint();
  })();
})();
