/* Popsy eye cursor: a little glazed ceramic eyeball (cream ball, black pupil, pink speckled
   lid shell) that follows the normal pointer around, rolling along behind it like a real ball, settles back to look at you
   when you stop, blinks on its own, closes halfway while you hold the button down, and swells
   a little over things you can click. On phones and tablets it's a loose ball on the screen
   that rolls around as you tilt the device (motion sensors), bounces off the edges, and
   squints / blinks when you touch the screen.

   No 3D library: at cursor size the ball is only ~70x70 real pixels, so a small canvas
   ray-traces it every frame it moves. The look comes from the clay eyeball model (Meshy), baked
   into two small sphere maps: its colours (eye-colour.webp) and its surface shape (eye-shape.webp:
   surface direction in RGB, how far the surface stands out in alpha, which is what tells the
   raised lid from the ball). Until those load, a drawn stand-in with the same proportions shows. */
(function () {
  if (!window.matchMedia) return;
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;          // mouse / trackpad
  var TILT = !FINE && ('ontouchstart' in window || navigator.maxTouchPoints > 0);       // phone / tablet
  if (!FINE && !TILT) return;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var SIZE = FINE ? 34 : 44;           // CSS px
  var style = document.createElement('style');
  style.textContent = [
    /* above the grid and its buttons, behind every popup (piece, about, family tree) */
    '.eye-cursor-el { position: fixed; left: 0; top: 0; width: ' + SIZE + 'px; height: ' + SIZE + 'px; margin: -' + SIZE / 2 + 'px 0 0 -' + SIZE / 2 + 'px;',
    '  pointer-events: none; z-index: 50000; opacity: 0; transition: opacity .2s ease; will-change: transform; }',
    '.eye-cursor-el.--on { opacity: 1; }',
    '.eye-cursor-el .ec-size { position: relative; width: 100%; height: 100%; transition: transform .25s cubic-bezier(.34,1.56,.64,1); transform-origin: 50% 50%; }',
    '.eye-cursor-el.--hover .ec-size { transform: scale(1.35); }',
    '.eye-cursor-el canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }',
    /* phones: the eye itself can be tapped (to let it roll / send it home) */
    '.eye-cursor-el.--tap { pointer-events: auto; cursor: pointer; -webkit-tap-highlight-color: transparent; }',
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
  var lid = 0;                                      // -0.4 wide open, 0 open, 0.5 half, 1 shut
  var WIDE = -0.4;                                  // pressed: the lid pulls right up
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

  /* ---------- the clay model, baked to sphere maps ---------- */
  var MW = 512, MH = 256, COL = null, SHP = null;
  var LID_EDGE = 134;                                // shape alpha above this = the raised lid
  var LID_MAX = 64 * Math.PI / 180;                  // how far the lid slides down for a full blink
  var OC = [0.001, -0.188, 0.982];                   // the middle of the eye's opening, in the model
  (function loadModel() {
    var base = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/js\/eye-cursor\.js.*$/, '') : '/';
    var got = 0, imgs = [new Image(), new Image()];
    imgs.forEach(function (im, k) {
      im.decoding = 'async';
      im.onload = function () {
        var c = document.createElement('canvas'); c.width = MW; c.height = MH;
        var g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(im, 0, 0, MW, MH);
        var data = g.getImageData(0, 0, MW, MH).data;
        if (k === 0) COL = data; else SHP = data;
        if (++got === 2) dirty = true;
      };
      im.src = base + 'assets/eye/' + (k === 0 ? 'eye-colour.webp' : 'eye-shape.webp');
    });
  })();
  var TWO_PI = Math.PI * 2;
  function texel(x, y, z) {
    var u = (Math.atan2(x, z) / TWO_PI + 0.5) * MW, v = (0.5 - Math.asin(y > 1 ? 1 : y < -1 ? -1 : y) / Math.PI) * MH;
    var iu = u | 0, iv = v | 0; if (iu >= MW) iu = MW - 1; if (iv >= MH) iv = MH - 1;
    return (iv * MW + iu) * 4;
  }
  function renderModel(m00, m01, m02, m10, m11, m12, m20, m21, m22) {
    var edge = N / 2 - 0.5, inv = 1 / edge;
    var a = Math.max(0, lid) * LID_MAX, ca = Math.cos(a), sa = Math.sin(a);
    var wide = Math.max(0, -lid / -WIDE), reach = wide * 62 * Math.PI / 180, sw = Math.sin(reach);
    var a2 = a + 0.09, ca2 = Math.cos(a2), sa2 = Math.sin(a2);
    for (var j = 0; j < N; j++) {
      var wy = (edge - j) * inv;
      for (var i = 0; i < N; i++) {
        var wx = (i - edge) * inv, r2 = wx * wx + wy * wy, o = (j * N + i) * 4;
        if (r2 > 1.02) { px[o + 3] = 0; continue; }
        var alpha = Math.max(0, Math.min(1, (1 - Math.sqrt(r2)) * edge * 1.2 + 0.5));
        var wz = Math.sqrt(1 - Math.min(r2, 1));
        // the ball's own direction for this pixel
        var dx = m00 * wx + m10 * wy + m20 * wz, dy = m01 * wx + m11 * wy + m21 * wz, dz = m02 * wx + m12 * wy + m22 * wz;
        var t = texel(dx, dy, dz), fromLid = false, shadow = 0, bare = false;
        if (wide > 0.001 && SHP[t + 3] > LID_EDGE) {
          // eyes wide: the opening grows in every direction, so the lid shrinks back to the edges.
          // A lid spot stays lid only if the spot `reach` closer to the eye's centre is still lid.
          var cd = dx * OC[0] + dy * OC[1] + dz * OC[2], ph = Math.acos(cd > 1 ? 1 : cd < -1 ? -1 : cd);
          if (ph <= reach) bare = true;
          else {
            var sp = Math.sin(ph), f1 = Math.sin(ph - reach) / sp, f2 = sw / sp;
            if (SHP[texel(dx * f1 + OC[0] * f2, dy * f1 + OC[1] * f2, dz * f1 + OC[2] * f2) + 3] <= LID_EDGE) bare = true;
          }
        } else if (a > 0.001) {
          // the lid slides (down to blink, up to open wide): look up where this spot sat on the lid
          var ly = dy * ca + dz * sa, lz = -dy * sa + dz * ca;
          var tl = texel(dx, ly, lz);
          if (SHP[tl + 3] > LID_EDGE) { t = tl; fromLid = true; }
          else {
            var ly2 = dy * ca2 + dz * sa2, lz2 = -dy * sa2 + dz * ca2;
            if (SHP[texel(dx, ly2, lz2) + 3] > LID_EDGE) shadow = 0.32;   // tucked just under the moving lid
          }
        }
        if (bare) {
          ballColour(dx, dy, dz, col);
          glaze(wx, wy, wz, 0.6, col, 0.7);
          px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = alpha * 255;
          continue;
        }
        col[0] = COL[t]; col[1] = COL[t + 1]; col[2] = COL[t + 2];
        // the model's own surface direction, turned with the ball (and the lid, if it came from there)
        var nx = SHP[t] / 127.5 - 1, ny = SHP[t + 1] / 127.5 - 1, nz = SHP[t + 2] / 127.5 - 1;
        if (fromLid) { var ny2 = ny * ca - nz * sa; nz = ny * sa + nz * ca; ny = ny2; }
        var wnx = m00 * nx + m01 * ny + m02 * nz, wny = m10 * nx + m11 * ny + m12 * nz, wnz = m20 * nx + m21 * ny + m22 * nz;
        var nl = Math.hypot(wnx, wny, wnz) || 1; wnx /= nl; wny /= nl; wnz /= nl;
        // keep the outline round: lean the silhouette normals toward the sphere
        var k = 1 - wz * wz; k = k * k * 0.5; wnx += (wx - wnx) * k; wny += (wy - wny) * k; wnz += (wz - wnz) * k;
        if (shadow) { col[0] *= 1 - shadow; col[1] *= 1 - shadow * 1.05; col[2] *= 1 - shadow * 1.1; }
        glaze(wnx, wny, wnz, COL[t + 3] / 255, col, 0.68);
        px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2]; px[o + 3] = alpha * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // Glazed clay: the gloss map decides how tight and bright the shine is; a window-shaped
  // reflection (like the white streaks in the photos) breaks up over the bumps, which is
  // most of what makes the surface read as 3D.
  function glaze(nx, ny, nz, g, out, amb) {
    var diff = nx * L[0] + ny * L[1] + nz * L[2]; if (diff < 0) diff = 0;
    var k = amb + (1.1 - amb) * diff;
    var sh = nx * H[0] + ny * H[1] + nz * H[2];
    var spec = sh > 0 ? Math.pow(sh, 30 + 160 * g) * (0.15 + 0.85 * g) + Math.pow(sh, 10) * 0.05 : 0;
    // mirror direction for a viewer straight ahead
    var rx = 2 * nz * nx, ry = 2 * nz * ny;
    var ex = Math.abs(rx + 0.4) - 0.2, ey = Math.abs(ry - 0.46) - 0.13, soft = 0.035 + 0.05 * (1 - g);
    var win = Math.max(0, Math.min(1, -ex / soft)) * Math.max(0, Math.min(1, -ey / soft));
    if (win > 0) { var bar = Math.abs(rx + 0.4); if (bar < 0.018) win *= bar / 0.018; }   // the window's middle bar
    spec += win * (0.25 + 0.6 * g) * (nz > 0 ? 1 : 0);
    var rim = 1 - nz; rim = rim * rim * rim * 0.22 * g;                                  // glaze sheen at the edge
    out[0] = out[0] * k + 255 * (spec + rim); out[1] = out[1] * k + 255 * (spec + rim); out[2] = out[2] * k + 250 * (spec + rim);
  }

  function render() {
    // rotation matrix (local -> world); its transpose takes a world point back to the ball's own frame
    var w = q[0], x = q[1], y = q[2], z = q[3];
    var m00 = 1 - 2 * (y * y + z * z), m01 = 2 * (x * y - w * z), m02 = 2 * (x * z + w * y);
    var m10 = 2 * (x * y + w * z), m11 = 1 - 2 * (x * x + z * z), m12 = 2 * (y * z - w * x);
    var m20 = 2 * (x * z - w * y), m21 = 2 * (y * z + w * x), m22 = 1 - 2 * (x * x + y * y);
    if (COL && SHP) return renderModel(m00, m01, m02, m10, m11, m12, m20, m21, m22);
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
  // the eye trails the normal pointer, sitting just below and to the right of the arrow
  var OFF_X = 26, OFF_Y = 28, FOLLOW = 110;          // px, px, ms (how far behind it lags)
  var ex = null, ey = null;
  var lidTarget = 0, blinkT = -1, down = false, holdTimer = 0;
  // eyes go wide only on a proper hold, not a quick tap / click; letting go blinks
  var HOLD_MS = 260;
  function press() {
    down = true;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(function () { if (down) lidTarget = WIDE; }, HOLD_MS);
  }
  function release(quiet) {
    down = false;
    clearTimeout(holdTimer);
    lidTarget = 0;
    if (quiet !== true) blink();
  }
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

  if (FINE) {
  document.addEventListener('mousemove', function (e) {
    x = e.clientX; y = e.clientY;
    if (ex === null || lastX === null || Math.abs(x - lastX) > 200 || Math.abs(y - lastY) > 200) { ex = x + OFF_X; ey = y + OFF_Y; } // first sight / re-entering: no flying in
    lastX = x; lastY = y;
    el.classList.toggle('--on', !detailsTakeover(e.target));
    el.classList.toggle('--hover', !!(e.target && e.target.closest && e.target.closest(CLICKABLE)));
  }, { passive: true });
  document.addEventListener('mouseover', function (e) {
    if (e.target && e.target.tagName === 'IFRAME') el.classList.remove('--on');
  }, { passive: true });
  document.addEventListener('mousedown', press, { passive: true });
  document.addEventListener('mouseup', release, { passive: true });
  document.addEventListener('mouseleave', function () { el.classList.remove('--on'); });
  document.documentElement.addEventListener('mouseleave', function () { el.classList.remove('--on'); });
  window.addEventListener('blur', function () { el.classList.remove('--on'); });
  }

  /* ---------- phones: a loose ball that rolls with the tilt of the device ---------- */
  var bx = 0, by = 0, vx = 0, vy = 0, gx = 0, gy = 0, base = null;
  // docked: parked at the top middle, tipping in place with the phone; tap to let it roll,
  // tap again while it's rolling to send it back up
  var docked = true;
  var dockX = function () { return (window.visualViewport ? window.visualViewport.width : window.innerWidth) / 2; };
  var DOCK_Y = 16 + SIZE / 2;
  // UI it bumps into instead of rolling over
  var WALLS = '.nav.v--new, .view-nav, .about-link, .family-link, .sv-btn';
  var walls = [], wallsAt = 0;
  var look = null;   // phones: a spot it's looking at (where you just touched)
  // the turn that points the front of the eye at a spot on screen (same sense as rolling)
  function lookQuat(dx, dy) {
    var d = Math.hypot(dx, dy);
    if (d < 1) return [1, 0, 0, 0];
    var ang = Math.min(1, d / 240) * 1.0, sh = Math.sin(ang / 2);
    return [Math.cos(ang / 2), dy / d * sh, dx / d * sh, 0];
  }
  function turnToward(qt, f) {
    if (qt[0] * q[0] + qt[1] * q[1] + qt[2] * q[2] + qt[3] * q[3] < 0) qt = [-qt[0], -qt[1], -qt[2], -qt[3]];
    q = qnorm([q[0] + (qt[0] - q[0]) * f, q[1] + (qt[1] - q[1]) * f, q[2] + (qt[2] - q[2]) * f, q[3] + (qt[3] - q[3]) * f]);
  }
  if (TILT) {
    bx = ex = window.innerWidth / 2; by = ey = DOCK_Y;
    window.addEventListener('deviceorientation', function (e) {
      if (e.beta == null || e.gamma == null) return;
      var b = e.beta, g = e.gamma;
      if (!sensing && wantRoll) docked = false;   // allowed after a tap: off it goes
      sensing = true;
      // "level" is how you're holding the phone when it first wakes up; after that, tilting
      // keeps it rolling like a marble (it only creeps toward your grip over half a minute or so)
      if (!base) base = { b: b, g: g };
      base.b += (b - base.b) * 0.0005; base.g += (g - base.g) * 0.0005;
      var dX = Math.sin((g - base.g) * Math.PI / 180), dY = Math.sin((b - base.b) * Math.PI / 180);
      var ang = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
      if (ang === 90) { gx = dY; gy = -dX; }
      else if (ang === 270 || ang === -90) { gx = -dY; gy = dX; }
      else if (ang === 180) { gx = -dX; gy = -dY; }
      else { gx = dX; gy = dY; }
    });
    // iPhone / iPad: motion sensors need the visitor's OK, and Safari only asks from a tap.
    // Keep asking on taps until there's an answer (a tap that doesn't count just fails quietly).
    var D = window.DeviceOrientationEvent, needsAsk = !!(D && typeof D.requestPermission === 'function'), answered = false, sensing = false;
    var pending = false, wantRoll = false;
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      blink();
      if (sensing) { docked = !docked; if (docked) { vx = vy = 0; } return; }   // roll / come home
      // not reporting yet: on iPhone the first tap asks for motion (Safari's rule: only from a tap)
      wantRoll = true;
      if (!needsAsk || answered || pending) return;
      pending = true;
      D.requestPermission().then(function (r) { answered = true; if (r !== 'granted') needsAsk = false; })
        .catch(function () {}).then(function () { pending = false; });
    });
    // it looks where you touch, follows your finger while it's down, then goes back to the tilt
    var watching = false;
    var lookAt = function (e) {
      if (e.pointerType === 'mouse' || (e.target && e.target.closest && e.target.closest('.eye-cursor-el'))) return;
      look = { x: e.clientX, y: e.clientY, until: performance.now() + 1100 };
    };
    document.addEventListener('pointerdown', function (e) { watching = true; lookAt(e); }, { passive: true, capture: true });
    document.addEventListener('pointermove', function (e) { if (watching) lookAt(e); }, { passive: true, capture: true });
    ['pointerup', 'pointercancel'].forEach(function (t) {
      document.addEventListener(t, function () { watching = false; if (look) look.until = performance.now() + 900; }, { passive: true, capture: true });
    });
    document.addEventListener('touchstart', press, { passive: true });
    document.addEventListener('touchend', release, { passive: true });
    document.addEventListener('touchcancel', function () { release(true); }, { passive: true });
  }
  // circle vs the UI's buttons: push out and bounce off their edges
  function bumpWalls(R) {
    if (performance.now() - wallsAt > 400) {
      wallsAt = performance.now();
      walls = [].slice.call(document.querySelectorAll(WALLS)).map(function (w) { return w.getBoundingClientRect(); })
        .filter(function (r) { return r.width > 4 && r.height > 4; });
    }
    var hit = 0;
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var cx = Math.max(w.left, Math.min(bx, w.right)), cy = Math.max(w.top, Math.min(by, w.bottom));
      var dx = bx - cx, dy = by - cy, d = Math.hypot(dx, dy);
      if (d >= R) continue;
      var nx, ny;
      if (d > 0.001) { nx = dx / d; ny = dy / d; }
      else {  // centre got inside: leave by the nearest side
        var l = bx - w.left, rr = w.right - bx, t = by - w.top, bo = w.bottom - by, m = Math.min(l, rr, t, bo);
        nx = m === l ? -1 : m === rr ? 1 : 0; ny = m === t ? -1 : m === bo ? 1 : 0; d = 0;
      }
      bx = cx + nx * R; by = cy + ny * R;
      var vn = vx * nx + vy * ny;
      if (vn < 0) { hit = Math.max(hit, -vn); vx -= 1.45 * vn * nx; vy -= 1.45 * vn * ny; }
    }
    return hit;
  }
  function tiltStep(now, dt) {
    var s = dt / 1000, vv = window.visualViewport;
    var W = vv ? vv.width : window.innerWidth, Hh = vv ? vv.height : window.innerHeight;
    if (docked) {
      // roll back up to the top middle, then tip in place with the phone
      var k = reduceMotion ? 1 : 1 - Math.exp(-dt / 170);
      bx += (dockX() - bx) * k; by += (DOCK_Y - by) * k; vx = vy = 0;
      if (Math.hypot(dockX() - bx, DOCK_Y - by) < 1.5 && sensing && !reduceMotion && !(look && now < look.until)) {
        var g = Math.hypot(gx, gy), ang = Math.min(1, g * 2.4) * 0.9;
        var qt = [1, 0, 0, 0];
        if (g > 0.001) { var sh = Math.sin(ang / 2); qt = [Math.cos(ang / 2), gy / g * sh, gx / g * sh, 0]; }  // look the way it's tipped
        if (qt[0] * q[0] + qt[1] * q[1] + qt[2] * q[2] + qt[3] * q[3] < 0) qt = [-qt[0], -qt[1], -qt[2], -qt[3]];
        var f = 1 - Math.exp(-dt / 110);
        q = qnorm([q[0] + (qt[0] - q[0]) * f, q[1] + (qt[1] - q[1]) * f, q[2] + (qt[2] - q[2]) * f, q[3] + (qt[3] - q[3]) * f]);
        dirty = true;
      }
      if (sensing) lastMove = now;   // it does its own looking while parked (no motion: it settles back to you)
    } else if (!reduceMotion && sensing) {
      vx += gx * 3600 * s; vy += gy * 3600 * s;              // downhill
      var fr = Math.exp(-s * 0.55); vx *= fr; vy *= fr;        // a little rolling resistance
      bx += vx * s; by += vy * s;
    }
    var r = SIZE / 2 + 2, hit = docked ? 0 : bumpWalls(r);
    if (bx < r) { bx = r; if (vx < 0) { hit = Math.max(hit, -vx); vx = -vx * 0.45; } }
    if (bx > W - r) { bx = W - r; if (vx > 0) { hit = Math.max(hit, vx); vx = -vx * 0.45; } }
    if (by < r) { by = r; if (vy < 0) { hit = Math.max(hit, -vy); vy = -vy * 0.45; } }
    if (by > Hh - r) { by = Hh - r; if (vy > 0) { hit = Math.max(hit, vy); vy = -vy * 0.45; } }
    if (hit > 320 && blinkT < 0) blink();                       // a hard knock makes it blink
    var mx = bx - ex, my = by - ey; ex = bx; ey = by;
    if (Math.abs(mx) + Math.abs(my) > 0.05) { roll(mx, my, SIZE / 2); dirty = true; }
    // looking at a touch wins over everything else for a moment
    if (look && now < look.until && !reduceMotion) {
      turnToward(lookQuat(look.x - ex, look.y - ey), 1 - Math.exp(-dt / 70));
      lastMove = now; dirty = true;
    } else if (look) look = null;
    // once it's barely moving, let it turn back to look at you
    if (Math.hypot(vx, vy) > 14) lastMove = now;
    el.style.transform = 'translate3d(' + ex + 'px,' + ey + 'px,0)';
    // appear once the grid has opened
    if (!el.classList.contains('--on') && document.body.dataset.started) { el.classList.add('--on', '--tap'); dirty = true; }
  }

  var prev = performance.now();
  function tick(now) {
    var dt = Math.min(64, now - prev); prev = now;
    if (TILT) tiltStep(now, dt);
    else if (ex !== null) {
      // ease toward the pointer, and roll by however far the eye itself moved this frame
      var f = reduceMotion ? 1 : 1 - Math.exp(-dt / FOLLOW);
      var mx = (x + OFF_X - ex) * f, my = (y + OFF_Y - ey) * f;
      ex += mx; ey += my;
      if (Math.abs(mx) + Math.abs(my) > 0.05) {
        lastMove = now;
        if (!reduceMotion) { roll(mx, my, RADIUS); dirty = true; }
      }
      el.style.transform = 'translate3d(' + ex + 'px,' + ey + 'px,0)';
    }
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
