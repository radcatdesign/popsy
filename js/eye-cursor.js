/* Popsy eye cursor: a hand-drawn eye that follows the mouse, blinks on its own,
   looks the way you move, widens over things you can click and squints while you drag.
   Mouse / trackpad devices only; touch screens keep their normal behavior. */
(function () {
  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var style = document.createElement('style');
  style.textContent = [
    'html.eye-cursor, html.eye-cursor * { cursor: none !important; }',
    '.eye-cursor-el { position: fixed; left: 0; top: 0; width: 46px; height: 32px; margin: -16px 0 0 -23px;',
    '  pointer-events: none; z-index: 2147483647; opacity: 0; transition: opacity .2s ease; will-change: transform; }',
    '.eye-cursor-el.--on { opacity: 1; }',
    '.eye-cursor-el .ec-size { width: 100%; height: 100%; transition: transform .25s cubic-bezier(.34,1.56,.64,1); transform-origin: 50% 50%; }',
    '.eye-cursor-el.--hover .ec-size { transform: scale(1.35); }',
    '.eye-cursor-el .ec-squint { width: 100%; height: 100%; transition: transform .18s ease; transform-origin: 50% 50%; }',
    '.eye-cursor-el.--down .ec-squint { transform: scaleY(.5); }',
    '.eye-cursor-el svg { display: block; width: 100%; height: 100%; overflow: visible; }',
    '.eye-cursor-el .ec-blink { transform-origin: 23px 16px; transform-box: view-box; }'
  ].join('\n');
  document.head.appendChild(style);

  var el = document.createElement('div');
  el.className = 'eye-cursor-el';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<div class="ec-size"><div class="ec-squint">' +
    '<svg viewBox="0 0 46 32" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    '<defs><clipPath id="ec-clip"><path d="M3.4 16.4C9.6 6.9 16.2 4.3 23.2 4.4c7.2.1 13.6 3.4 19.4 11.7-5.9 8.3-12.4 11.7-19.6 11.6-7.1-.1-13.6-3.2-19.6-11.3Z"/></clipPath></defs>' +
    '<g class="ec-blink">' +
    '<path d="M3.4 16.4C9.6 6.9 16.2 4.3 23.2 4.4c7.2.1 13.6 3.4 19.4 11.7-5.9 8.3-12.4 11.7-19.6 11.6-7.1-.1-13.6-3.2-19.6-11.3Z" fill="#fff" stroke="#000" stroke-width="2.4"/>' +
    '<g clip-path="url(#ec-clip)"><g class="ec-pupil">' +
    '<circle cx="23" cy="16" r="7.2" fill="#000"/>' +
    '<circle cx="25.6" cy="13.3" r="2.1" fill="#fff"/>' +
    '</g></g>' +
    '<path d="M12.4 8.3 10.2 4.6M19.6 5.4l-.9-4M27.3 5.3l1-4M34.4 8l2.4-3.4" stroke="#000" stroke-width="2.2"/>' +
    '</g></svg></div></div>';

  var blinkEl, pupilEl;
  var x = -100, y = -100, lastX = null, lastY = null, px = 0, py = 0, tx = 0, ty = 0;

  function mount() {
    document.body.appendChild(el);
    document.documentElement.classList.add('eye-cursor');
    blinkEl = el.querySelector('.ec-blink');
    pupilEl = el.querySelector('.ec-pupil');
    requestAnimationFrame(tick);
    scheduleBlink();
  }

  var CLICKABLE = 'a, button, [role="button"], .filter-btn, .view-btn, .about-link, .family-link, .back-link,' +
    ' .product > div, .react-flow__node, .react-flow__controls-button, [data-cta], .cross, .about-popup-close, .about-popup-bd';

  function detailsTakeover(target) {
    // while a piece's details are open, the close "x" that follows the mouse takes over outside the panel
    var open = document.querySelector('#container.--is-details-showing') || document.body.classList.contains('--is-details-showing');
    return open && !(target && target.closest && target.closest('.details'));
  }

  document.addEventListener('mousemove', function (e) {
    x = e.clientX; y = e.clientY;
    if (lastX !== null) {
      // look the way you're moving
      tx = Math.max(-4, Math.min(4, (x - lastX) * 0.6));
      ty = Math.max(-3, Math.min(3, (y - lastY) * 0.6));
    }
    lastX = x; lastY = y;
    var hidden = detailsTakeover(e.target);
    el.classList.toggle('--on', !hidden);
    el.classList.toggle('--hover', !!(e.target && e.target.closest && e.target.closest(CLICKABLE)));
  }, { passive: true });
  document.addEventListener('mousedown', function () { el.classList.add('--down'); }, { passive: true });
  document.addEventListener('mouseup', function () { el.classList.remove('--down'); blink(); }, { passive: true });
  document.addEventListener('mouseleave', function () { el.classList.remove('--on'); });
  document.documentElement.addEventListener('mouseleave', function () { el.classList.remove('--on'); });
  window.addEventListener('blur', function () { el.classList.remove('--on'); });

  function tick() {
    el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    // pupil eases toward the movement direction and drifts back to center when still
    px += (tx - px) * 0.18; py += (ty - py) * 0.18;
    tx *= 0.9; ty *= 0.9;
    if (pupilEl) pupilEl.setAttribute('transform', 'translate(' + px.toFixed(2) + ' ' + py.toFixed(2) + ')');
    requestAnimationFrame(tick);
  }

  function blink(double) {
    if (!blinkEl || !blinkEl.animate) return;
    var a = blinkEl.animate(
      [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.08)', offset: 0.45 }, { transform: 'scaleY(1)' }],
      { duration: reduceMotion ? 1 : 190, easing: 'ease-in-out' }
    );
    if (double) a.onfinish = function () { setTimeout(function () { blink(false); }, 90); };
  }
  function scheduleBlink() {
    setTimeout(function () {
      if (!document.hidden) blink(Math.random() < 0.25);
      scheduleBlink();
    }, 2200 + Math.random() * 3300);
  }

  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
