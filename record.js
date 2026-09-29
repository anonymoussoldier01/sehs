// Record page: copy link button (open flow lives in open.js).
(function () {
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#copy-link')) {
      var done = function () {
        var t = document.getElementById('toast');
        if (t) { t.textContent = 'Link copied'; t.hidden = false; setTimeout(function () { t.hidden = true; }, 2000); }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).then(done, done);
      else done();
    }
  });
})();
