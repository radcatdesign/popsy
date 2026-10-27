/* Popsy eye cursor: a little glazed ceramic eyeball (cream ball, black pupil, pink speckled
   lid shell) that rolls along under the mouse like a real ball, settles back to look at you
   when you stop, blinks on its own, closes halfway while you hold the button down, and swells
   a little over things you can click. Mouse / trackpad devices only.

   No 3D library: at cursor size the ball is only ~70x70 real pixels, so a small canvas
   ray-traces two spheres (the lid shell and the slightly smaller ball inside it) every frame
   it moves, with glaze-like lighting and speckle textures made from noise. */
(function () {
  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var SIZE = 34;                       // CSS px
  var style = document.createElement('style');
  style.textContent = [
    'html.eye-cursor, html.eye-cursor * { cursor: none !important; }',
    '.eye-cursor-el { position: fixed; left: 0; top: 0; width: ' + SIZE + 'px; height: ' + SIZE + 'px; margin: -' + SIZE / 2 + 'px 0 0 -' + SIZE / 2 + 'px;',
    '  pointer-events: none; z-index: 2147483647; opacity: 0; transition: opacity .2s ease; will-change: transform; }',
    '.eye-cursor-el.--on { opacity: 1; }',
    '.eye-cursor-el .ec-size { position: relative; width: 100%; height: 100%; transition: transform .25s cubic-bezier(.34,1.56,.64,1); transform-origin: 50% 50%; }',
    '.eye-cursor-el.--hover .ec-size { transform: scale(1.35); }',
    '.eye-cursor-el canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }',
    /* a soft contact shadow so it reads as a ball sitting just above the page */
    '.eye-cursor-el .ec-shadow { position: absolute; left: 12%; right: 4%; top: 62%; height: 46%; border-radius: 50%;',
    '  background: radial-gradient(closest-side, rgba(60,30,20,.28), rgba(60,30,20,0)); transform: translate(3px, 2px); }'
  ].join('\n');
  document.head.appendChild(style);

  var el = document.createElement('div');
  el.className = 'eye-cursor-el';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="ec-size"><div class="ec-shadow"></div><canvas></canvas></div>';
  var canvas = el.querySelector('canvas');
  var ctx = canvas.getContext('2d');
  var N = Math.min(104, Math.round(SIZE * Math.min(3, window.devicePixelRatio || 1) * 1.3)); // a little supersampled for smooth edges
  canvas.width = canvas.height = N;
  var img = ctx.createImageData(N, N);
  var px = img.data;

  /* ---------- noise (3D value noise on a small lattice; textures follow the ball) ---------- */
  var G = 32, lattice = new Float32Array(G * G * G);
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  for (var i = 0; i < lattice.length; i++) lattice[i] = rnd();
  function noise(x, y, z) {
    x += 64; y += 64; z += 64;
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
    var x0 = xi & 31, x1 = (xi + 1) & 31, y0 = (yi & 31) * G, y1 = ((yi + 1) & 31) * G, z0 = (zi & 31) * G * G, z1 = ((zi + 1) & 31) * G * G;
    var a = lattice[x0 + y0 + z0] + (lattice[x1 + y0 + z0] - lattice[x0 + y0 + z0]) * xf;
    var b = lattice[x0 + y1 + z0] + (lattice[x1 + y1 + z0] - lattice[x0 + y1 + z0]) * xf;
    var c = lattice[x0 + y0 + z1] + (lattice[x1 + y0 + z1] - lattice[x0 + y0 + z1]) * xf;
    var d = lattice[x0 + y1 + z1] + (lattice[x1 + y1 + z1] - lattice[x0 + y1 + z1]) * xf;
    var e = a + (b - a) * yf, f = c + (d - c) * yf;
    return e + (f - e) * zf;
  }

  /* ---------- orientation (quaternion, local -> world) ---------- */
  var q = [1, 0, 0, 0];
  function qmul(a, b) {
    return [a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
            a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
            a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
            a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
  }
  function qnorm(a) { var l = Math.hypot(a[0], a[1], a[2], a[3]) || 1; return [a[0] / l, a[1] / l, a[2] / l, a[3] / l]; }
  function roll(dx, dy, radius) {
    // rolling on the page: the side facing you travels with the mouse
    var d = Math.hypot(dx, dy);
    if (d < 0.01) return;
    var ang = d / radius, s = Math.sin(ang / 2);
    q = qnorm(qmul([Math.cos(ang / 2), (dy / d) * s, (dx / d) * s, 0], q));
  }
  function settle(k) {
    // ease back toward looking straight at you (shortest way round)
    if (q[0] < 0) q = [-q[0], -q[1], -q[2], -q[3]];
    q = qnorm([q[0] + (1 - q[0]) * k, q[1] * (1 - k), q[2] * (1 - k), q[3] * (1 - k)]);
  }

  /* ---------- the model ---------- */
  var BALL = 0.95;                                  // ball radius inside the lid shell (shell = 1)
  var OPEN_AX = 84 * Math.PI / 180, OPEN_AY = 39 * Math.PI / 180;   // eye-shaped opening (wide, not tall)
  var REST_TILT = 20 * Math.PI / 180, SHUT_TILT = 74 * Math.PI / 180; // opening sits a little below centre
  var PUPIL = 19 * Math.PI / 180;
  // the pupil looks slightly down, sitting in the middle of the opening (like the photos)
  var PUP_T = 11 * Math.PI / 180, PUP_Y = -Math.sin(PUP_T), PUP_Z = Math.cos(PUP_T);
  var lid = 0;                                      // 0 open, 0.5 half, 1 shut
  var L = [-0.45, 0.62, 0.64]; (function () { var l = Math.hypot(L[0], L[1], L[2]); L = [L[0] / l, L[1] / l, L[2] / l]; })();
  var H = [L[0], L[1], L[2] + 1]; (function () { var l = Math.hypot(H[0], H[1], H[2]); H = [H[0] / l, H[1] / l, H[2] / l]; })();

  // how far a local direction sits inside the opening (<1 = inside), for the current lid
  var tilt = REST_TILT, ct = Math.cos(tilt), st = Math.sin(tilt);
  function openness(x, y, z) {
    // rotate into the opening's frame (opening points along +z, tipped down by `tilt`)
    var yy = y * ct + z * st, zz = -y * st + z * ct;
    if (zz <= 0) return 9;
    var u = Math.abs(Math.atan2(x, zz) / OPEN_AX), v = Math.abs(Math.atan2(yy, zz) / OPEN_AY);
    return Math.pow(u * u * u + v * v * v, 1 / 3);   // rounded-rectangle eye shape, not a lens
  }

  function lidColour(x, y, z, out) {
    var m = noise(x * 2.2, y * 2.2, z * 2.2) * 0.65 + noise(x * 4.6, y * 4.6, z * 4.6) * 0.35;
    var g = noise(x * 2.4 + 9, y * 2.4, z * 2.4 - 4);
    var r = 222, gg = 176, b = 148;                              // peach base
    var red = Math.max(0, Math.min(1, (m - 0.4) * 2.6));         // pink/red blotches
    r += (214 - r) * red; gg += (112 - gg) * red; b += (104 - b) * red;
    var sage = Math.max(0, Math.min(1, (g - 0.6) * 3)) * 0.6;    // sage-grey patches
    r += (184 - r) * sage; gg += (188 - gg) * sage; b += (170 - b) * sage;
    if (noise(x * 26, y * 26, z * 26) > 0.88) { r *= 0.8; gg *= 0.58; b *= 0.56; } // a few dark specks
    out[0] = r; out[1] = gg; out[2] = b;
  }
  function ballColour(x, y, z, out) {
    var v = noise(x * 4, y * 4, z * 4) * 8 - 4;
    var r = 246 + v, g = 218 + v, b = 192 + v;
    if (noise(x * 34 + 3, y * 34, z * 34) > 0.9) { r = 206; g = 140; b = 110; } // fine glaze specks
    out[0] = r; out[1] = g; out[2] = b;
  }

  var col = [0, 0, 0];
  function shade(nx, ny, nz, gloss, out, amb) {
    var diff = nx * L[0] + ny * L[1] + nz * L[2]; if (diff < 0) diff = 0;
    var spec = nx * H[0] + ny * H[1] + nz * H[2]; spec = spec > 0 ? Math.pow(spec, 90) * gloss + Math.pow(spec, 22) * 0.07 : 0;
    var k = (amb || 0.66) + (1.08 - (amb || 0.66)) * diff;
    out[0] = out[0] * k + 255 * spec; out[1] = out[1] * k + 255 * spec; out[2] = out[2] * k + 255 * spec;
  }

  function render() {
    // rotation matrix (local -> world); its transpose takes a world point back to the ball's own frame
    var w = q[0], x = q[1], y = q[2], z = q[3];
    var m00 = 1 - 2 * (y * y + z * z), m01 = 2 * (x * y - w * z), m02 = 2 * (x * z + w * y);
    var m10 = 2 * (x * y + w * z), m11 = 1 - 2 * (x * x + z * z), m12 = 2 * (y * z - w * x);
    var m20 = 2 * (x * z - w * y), m21 = 2 * (y * z + w * x), m22 = 1 - 2 * (x * x + y * y);
    tilt = REST_TILT + (SHUT_TILT - REST_TILT) * lid; ct = Math.cos(tilt); st = Math.sin(tilt);
    var edge = N / 2 - 0.5, inv = 1 / edge;
    for (var j = 0; j < N; j++) {
      var wy = (edge - j) * inv;
      for (var i = 0; i < N; i++) {
        var wx = (i - edge) * inv, r2 = wx * wx + wy * wy, o = (j * N + i) * 4;
        if (r2 > 1.02) { px[o + 3] = 0; continue; }
        var alpha = Math.max(0, Math.min(1, (1 - Math.sqrt(r2)) * edge * 1.2 + 0.5));
        var r2c = Math.min(r2, 1), wz = Math.sqrt(1 - r2c);
        // 1) outer shell
        var lx = m00 * wx + m10 * wy + m20 * wz, ly = m01 * wx + m11 * wy + m21 * wz, lz = m02 * wx + m12 * wy + m22 * wz;
        var op = openness(lx, ly, lz);
        if (op >= 1) {
          lidColour(lx, ly, lz, col);
          // the lid's rounded lip catches light right at the opening
          // the lid's rounded lip: a lighter roll right at the opening, darker just behind it
          if (op < 1.12) { var t = (1.12 - op) / 0.12; col[0] += 30 * t * t; col[1] += 24 * t * t; col[2] += 22 * t * t; }
          else if (op < 1.2) { var t2 = 1 - Math.abs(op - 1.16) / 0.04; if (t2 > 0) { col[0] *= 1 - 0.12 * t2; col[1] *= 1 - 0.14 * t2; col[2] *= 1 - 0.14 * t2; } }
          shade(wx, wy, wz, 0.55, col);
        } else if (r2 <= BALL * BALL) {
          // 2) through the opening onto the ball
          var bz = Math.sqrt(BALL * BALL - r2), nx = wx / BALL, ny = wy / BALL, nz = bz / BALL;
          var bx = m00 * nx + m10 * ny + m20 * nz, by = m01 * nx + m11 * ny + m21 * nz, bzl = m02 * nx + m12 * ny + m22 * nz;
          var pa = Math.acos(Math.max(-1, Math.min(1, by * PUP_Y + bzl * PUP_Z))); // angle from the pupil
          if (pa < PUPIL) {
            var e = Math.max(0, (pa - PUPIL * 0.75) / (PUPIL * 0.25));    // soft inner edge of the hole
            col[0] = 18 + 30 * e; col[1] = 12 + 22 * e; col[2] = 12 + 18 * e;
          } else {
            ballColour(bx, by, bzl, col);
            if (pa < PUPIL * 1.25) { var rim = (PUPIL * 1.25 - pa) / (PUPIL * 0.25); col[0] -= 40 * rim; col[1] -= 40 * rim; col[2] -= 36 * rim; }
          }
          // shadow tucked under the lid's edge
          var ob = openness(bx, by, bzl);
          if (ob > 0.86) { var sh = Math.min(1, (ob - 0.86) / 0.14); col[0] *= 1 - 0.3 * sh; col[1] *= 1 - 0.34 * sh; col[2] *= 1 - 0.36 * sh; }
          shade(nx, ny, nz, 0.6, col, 0.76);
        } else {
          // 3) the thin gap at the rim: inside of the shell, in shadow
          lidColour(lx, ly, lz, col);
          col[0] *= 0.45; col[1] *= 0.4; col[2] *= 0.4;
        }
        px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = alpha * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /* ---------- motion ---------- */
  var x = -100, y = -100, lastX = null, lastY = null, lastMove = 0, dirty = true;
  var lidTarget = 0, blinkT = -1, down = false;
  var RADIUS = SIZE / 2 * 1.5;   // a touch slower than a true roll so it reads, not spins

  function mount() {
    document.body.appendChild(el);
    document.documentElement.classList.add('eye-cursor');
    render();
    requestAnimationFrame(tick);
    scheduleBlink();
  }

  var CLICKABLE = 'a, button, [role="button"], .filter-btn, .view-btn, .about-link, .family-link, .back-link,' +
    ' .product > div, .react-flow__node, .react-flow__controls-button, [data-cta], .cross, .about-popup-close, .about-popup-bd';
  function detailsTakeover(target) {
    var open = document.querySelector('#container.--is-details-showing') || document.body.classList.contains('--is-details-showing');
    return open && !(target && target.closest && target.closest('.details'));
  }

  document.addEventListener('mousemove', function (e) {
    x = e.clientX; y = e.clientY;
    if (lastX !== null && !reduceMotion) {
      var dx = x - lastX, dy = y - lastY;
      if (Math.abs(dx) < 120 && Math.abs(dy) < 120) { roll(dx, dy, RADIUS); dirty = true; } // ignore jumps (re-entering the window)
    }
    lastX = x; lastY = y; lastMove = performance.now();
    el.classList.toggle('--on', !detailsTakeover(e.target));
    el.classList.toggle('--hover', !!(e.target && e.target.closest && e.target.closest(CLICKABLE)));
  }, { passive: true });
  document.addEventListener('mouseover', function (e) {
    if (e.target && e.target.tagName === 'IFRAME') el.classList.remove('--on');
  }, { passive: true });
  document.addEventListener('mousedown', function () { down = true; lidTarget = 0.5; }, { passive: true });
  document.addEventListener('mouseup', function () { down = false; lidTarget = 0; blink(); }, { passive: true });
  document.addEventListener('mouseleave', function () { el.classList.remove('--on'); });
  document.documentElement.addEventListener('mouseleave', function () { el.classList.remove('--on'); });
  window.addEventListener('blur', function () { el.classList.remove('--on'); });

  var prev = performance.now();
  function tick(now) {
    var dt = Math.min(64, now - prev); prev = now;
    el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    // settle back to face you once the mouse rests
    if (!reduceMotion && now - lastMove > 140 && (Math.abs(1 - Math.abs(q[0])) > 1e-5)) { settle(1 - Math.exp(-dt / 260)); dirty = true; }
    // lid: blink pulse on top of the held (half-shut while pressed) position
    var target = lidTarget;
    if (blinkT >= 0) {
      var p = (now - blinkT) / (reduceMotion ? 1 : 200);
      if (p >= 1) blinkT = -1; else target = Math.max(target, Math.sin(Math.PI * p));
    }
    var nl = lid + (target - lid) * (blinkT >= 0 ? 1 : 1 - Math.exp(-dt / 55));
    if (Math.abs(nl - lid) > 0.002) { lid = nl; dirty = true; } else if (lid !== target) { lid = target; dirty = true; }
    if (dirty && el.classList.contains('--on')) { render(); dirty = false; }
    requestAnimationFrame(tick);
  }

  function blink(double) {
    blinkT = performance.now();
    if (double) setTimeout(function () { blinkT = performance.now(); }, 290);
  }
  function scheduleBlink() {
    setTimeout(function () {
      if (!document.hidden && !down) blink(Math.random() < 0.25);
      scheduleBlink();
    }, 2200 + Math.random() * 3300);
  }

  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
