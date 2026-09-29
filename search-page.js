// Search page interactions: facet checkboxes + sort drive full-page navigation.
(function () {
  function params() { return new URLSearchParams(location.search); }
  function go(p) {
    var s = p.toString();
    location.href = '/search' + (s ? '?' + s : '');
  }
  function toggleMulti(key, value, on) {
    var p = params();
    var cur = (p.get(key) || '').split(',').filter(Boolean);
    if (on && !cur.includes(value)) cur.push(value);
    if (!on) cur = cur.filter(function (v) { return v !== value; });
    if (cur.length) p.set(key, cur.join(','));
    else p.delete(key);
    p.delete('page');
    go(p);
  }
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches && el.matches('[data-f="cat"]')) toggleMulti('cat', el.value, el.checked);
    else if (el.matches && el.matches('[data-f="provider"]')) toggleMulti('provider', el.value, el.checked);
    else if (el.matches && el.matches('[data-f="type"]')) toggleMulti('type', el.value, el.checked);
    else if (el.matches && el.matches('[data-f="answers"]')) {
      var p = params();
      if (el.checked) p.set('answers', '1');
      else p.delete('answers');
      p.delete('page');
      go(p);
    } else if (el.matches && el.matches('#f-sort')) {
      var q = params();
      if (el.value && el.value !== 'relevance') q.set('sort', el.value);
      else q.delete('sort');
      q.delete('page');
      go(q);
    }
  });
  var ft = document.getElementById('filters-toggle');
  if (ft) ft.hidden = false;
  if (ft) ft.addEventListener('click', function () {
    var f = document.getElementById('filters');
    var open = f.classList.toggle('open');
    ft.setAttribute('aria-expanded', String(open));
  });
})();
