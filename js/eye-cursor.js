/* Popsy eye cursor: a hand-drawn eye that follows the mouse, blinks on its own,
   looks the way you move, widens over things you can click and squints while you drag.
   Mouse / trackpad devices only; touch screens keep their normal behavior. */
(function () {
  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var style = document.createElement('style');
  style.textContent = [
    'html.eye-cursor, html.eye-cursor * { cursor: none !important; }',
    '.eye-cursor-el { position: fixed; left: 0; top: 0; width: 28px; height: 28px; margin: -14px 0 0 -14px;',
    '  pointer-events: none; z-index: 2147483647; opacity: 0; transition: opacity .2s ease; will-change: transform; }',
    '.eye-cursor-el.--on { opacity: 1; }',
    '.eye-cursor-el .ec-size { width: 100%; height: 100%; transition: transform .25s cubic-bezier(.34,1.56,.64,1); transform-origin: 50% 50%; }',
    '.eye-cursor-el.--hover .ec-size { transform: scale(1.35); }',
    '.eye-cursor-el svg { display: block; width: 100%; height: 100%; overflow: visible; }',
    /* eyelid: parked above the ball, half down while you press/drag, all the way down to blink */
    '.eye-cursor-el .ec-lid { transform: translateY(-20px); transition: transform .16s ease; }',
    '.eye-cursor-el.--down .ec-lid { transform: translateY(-7px); }'
  ].join('\n');
  document.head.appendChild(style);

  var el = document.createElement('div');
  el.className = 'eye-cursor-el';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<div class="ec-size">' +
    '<svg viewBox="0 0 28 28" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
    '<defs><clipPath id="ec-clip"><path d="M14.2 2.6c6.4.1 11.3 5 11.2 11.5-.1 6.4-5.1 11.3-11.5 11.3S2.6 20.4 2.6 14 7.8 2.5 14.2 2.6Z"/></clipPath></defs>' +
    /* the ball */
    '<path d="M14.2 2.6c6.4.1 11.3 5 11.2 11.5-.1 6.4-5.1 11.3-11.5 11.3S2.6 20.4 2.6 14 7.8 2.5 14.2 2.6Z" fill="#fff"/>' +
    '<g clip-path="url(#ec-clip)">' +
    '<g class="ec-pupil"><circle cx="14" cy="14" r="5.6" fill="#000"/><circle cx="16" cy="11.9" r="1.6" fill="#fff"/></g>' +
    /* upper eyelid that slides down over the ball */
    '<g class="ec-lid"><path d="M-2-30h32v43.2c-5.6 3.6-26.4 3.6-32 0Z" fill="#fff"/><path d="M1.2 13.9c6 3.4 19.6 3.4 25.6 0" stroke="#000" stroke-width="2"/></g>' +
    '</g>' +
    '<path d="M14.2 2.6c6.4.1 11.3 5 11.2 11.5-.1 6.4-5.1 11.3-11.5 11.3S2.6 20.4 2.6 14 7.8 2.5 14.2 2.6Z" stroke="#000" stroke-width="2.2"/>' +
    '</svg></div>';

  var lidEl, pupilEl;
  var x = -100, y = -100, lastX = null, lastY = null, px = 0, py = 0, tx = 0, ty = 0;

  function mount() {
    document.body.appendChild(el);
    document.documentElement.classList.add('eye-cursor');
    lidEl = el.querySelector('.ec-lid');
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
      // googly: the pupil rolls toward the direction you move
      tx = Math.max(-5, Math.min(5, (x - lastX) * 0.7));
      ty = Math.max(-5, Math.min(5, (y - lastY) * 0.7));
    }
    lastX = x; lastY = y;
    var hidden = detailsTakeover(e.target);
    el.classList.toggle('--on', !hidden);
    el.classList.toggle('--hover', !!(e.target && e.target.closest && e.target.closest(CLICKABLE)));
  }, { passive: true });
  document.addEventListener('mouseover', function (e) {
    if (e.target && e.target.tagName === 'IFRAME') el.classList.remove('--on');
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
    if (!lidEl || !lidEl.animate) return;
    var rest = el.classList.contains('--down') ? 'translateY(-7px)' : 'translateY(-20px)';
    var a = lidEl.animate(
      [{ transform: rest }, { transform: 'translateY(4px)', offset: 0.45 }, { transform: rest }],
      { duration: reduceMotion ? 1 : 220, easing: 'ease-in-out' }
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
