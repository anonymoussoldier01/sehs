// Tiny confetti burst (no dependencies). window.__sehsConfetti(n?).
// Respects prefers-reduced-motion. Canvas is removed when done.
(function () {
  'use strict';
  var COLORS = ['#5b6cff', '#ffd54d', '#4ade80', '#ff8a8a', '#7c8aff', '#ffffff'];
  function burst(n) {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) {}
    n = Math.min(160, Math.max(20, n || 90));
    var c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:90';
    document.body.appendChild(c);
    var ctx = c.getContext('2d');
    var W = (c.width = window.innerWidth), H = (c.height = window.innerHeight);
    var ps = [];
    for (var i = 0; i < n; i++) {
      ps.push({
        x: W / 2 + (Math.random() - 0.5) * W * 0.5,
        y: H * 0.32,
        vx: (Math.random() - 0.5) * 11,
        vy: -Math.random() * 10 - 3,
        s: Math.random() * 7 + 4,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        col: COLORS[i % COLORS.length],
      });
    }
    var t0 = null;
    function frame(t) {
      if (!t0) t0 = t;
      var k = (t - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      var alive = false;
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        p.vy += 0.32;
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        if (p.y < H + 20) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - k / 2.4);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
        ctx.restore();
      }
      if (alive && k < 2.6) requestAnimationFrame(frame);
      else c.remove();
    }
    requestAnimationFrame(frame);
  }
  window.__sehsConfetti = burst;
})();
