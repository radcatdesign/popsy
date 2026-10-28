/* Welcome: once the grid has built itself, a first-time visitor gets a short note on what this
   is: an art series by Brandon Kaufer, monsters made of the feelings we push down, and every one
   of them looking for a home. Same card as the piece popup; shown once per visitor. */
(function () {
  var KEY = 'popsy-welcome-seen';
  var seen = false;
  try { seen = localStorage.getItem(KEY) === '1'; } catch (e) {}
  if (seen) return;

  var css = [
    '.pw-welcome { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 24px;',
    '  background: rgba(255,255,255,.9); opacity: 0; pointer-events: none; transition: opacity .35s ease; }',
    '.pw-welcome.--open { opacity: 1; pointer-events: auto; }',
    '.pw-welcome__card { position: relative; width: min(540px, 100%); max-height: calc(100svh - 48px); overflow-y: auto; scrollbar-width: none;',
    '  background: #fff; border: 1px solid #000; border-radius: 13px; padding: 32px 34px 28px; text-align: left;',
    '  border-image-outset: 1px; border-image-width: 30px; border-image-slice: 25; border-image-repeat: stretch;',
    '  border-image-source: url(assets/cdn.prod.website-files.com/689e729c65f81373b9f2b204/68c9afa3203792c1866df05c_border.webp);',
    '  transform: translateY(16px) scale(.97); transition: transform .5s cubic-bezier(.22,1,.36,1); }',
    '.pw-welcome.--open .pw-welcome__card { transform: none; }',
    '.pw-welcome__title { font-size: 34px; line-height: 1.1; margin: 0 44px 16px 0; font-weight: normal; }',
    '.pw-welcome__body p { font-size: 18px; line-height: 1.5; margin: 0 0 12px; }',
    '.pw-welcome__actions { display: flex; align-items: center; gap: 22px; margin-top: 8px; flex-wrap: wrap; }',
    '.pw-welcome__go { appearance: none; font: inherit; font-size: 20px; cursor: pointer; padding: 10px 26px; border-radius: 8px;',
    '  background: #000; color: #fff; border: 1px solid transparent; transition: transform .2s ease;',
    '  border-image-outset: 3px; border-image-width: 30px; border-image-slice: 15; border-image-repeat: stretch;',
    '  border-image-source: url(assets/cdn.prod.website-files.com/689e729c65f81373b9f2b204/68c9afa3b6987922f881509d_border2.webp); }',
    '.pw-welcome__go:hover { transform: rotate(-1.5deg); }',
    '.pw-welcome__go:focus:not(:focus-visible) { outline: none; }',
    /* underline drawn as a line under the button, so it runs unbroken under the handwriting */
    '.pw-welcome__story { appearance: none; background: none; border: 0; border-bottom: 1px solid #000; border-radius: 0; padding: 2px 0;',
    '  font: inherit; font-size: 18px; line-height: 1.2; color: #000; cursor: pointer; }',
    '.pw-welcome__close { position: absolute; top: 14px; right: 14px; width: 40px; height: 40px; display: flex; align-items: center;',
    '  justify-content: center; background: none; border: 0; padding: 0; cursor: pointer; }',
    '.pw-welcome__close:focus:not(:focus-visible) { outline: none; }',
    '@media (max-width: 760px) {',
    '  .pw-welcome { padding: 14px; }',
    '  .pw-welcome__card { padding: 24px 22px 22px; }',
    '  .pw-welcome__title { font-size: 28px; }',
    '  .pw-welcome__body p { font-size: 16px; }',
    '  .pw-welcome__go { flex: 1 1 auto; text-align: center; }',
    '}'
  ].join('\n');

  var root;
  function build() {
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
    root = document.createElement('div');
    root.className = 'pw-welcome';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'pw-welcome-title');
    root.innerHTML =
      '<div class="pw-welcome__card">' +
      '<button class="pw-welcome__close" type="button" aria-label="Close"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round"><path d="M18.4 5.8 5.6 18.3"/><path d="M5.7 5.6l12.7 12.9"/></svg></button>' +
      '<h2 class="pw-welcome__title" id="pw-welcome-title">Meet the monsters</h2>' +
      '<div class="pw-welcome__body">' +
      '<p>Popsy Loves You is an art series by Brandon Kaufer, aka Popsy Wolf.</p>' +
      '<p>Every piece is a clay monster, and every monster is a feeling we usually push down. The anxious one. The sad one. The scared one. The one that just wants to play.</p>' +
      '<p>They have names, families and stories, and every one of them is looking to be adopted.</p>' +
      '</div>' +
      '<div class="pw-welcome__actions">' +
      '<button class="pw-welcome__go" type="button" data-act="go">Meet them</button>' +
      '<button class="pw-welcome__story" type="button" data-act="story">Read the story</button>' +
      '</div></div>';
    document.body.appendChild(root);
    root.addEventListener('click', function (e) {
      var card = root.querySelector('.pw-welcome__card');
      var act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'go') askMotion();
      if (!card.contains(e.target) || e.target.closest('.pw-welcome__close') || (act && act.dataset.act === 'go')) return close();
      if (act && act.dataset.act === 'story') {
        close();
        var link = document.querySelector('.about-link');
        if (link) setTimeout(function () { link.click(); }, 250);
      }
    });
    // keep drags / wheel from reaching the grid underneath
    ['wheel', 'pointerdown', 'mousedown', 'touchstart'].forEach(function (t) {
      root.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('--open')) close();
    });
  }

  // Phones: "Meet them" is a tap, the one moment iPhones let a site ask for the motion sensors,
  // so ask here; the eye then tilts with the phone (Android needs no ask)
  function askMotion() {
    var D = window.DeviceOrientationEvent;
    if (!D || typeof D.requestPermission !== 'function') return;
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    try { D.requestPermission().catch(function () {}); } catch (e) {}
  }

  function open() {
    // something else is already up (a piece, the about, the family tree): don't stack on it
    if (document.querySelector('.pp.--open') || document.body.dataset.aboutOpen === 't' || document.body.dataset.familyOpen === 't') return;
    if (!root) build();
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    root.classList.add('--open');
    var W = window.PopsyWrite;
    if (W) {
      var items = [{ el: root.querySelector('.pw-welcome__title'), title: true }];
      [].forEach.call(root.querySelectorAll('.pw-welcome__body p'), function (p) { items.push({ el: p }); });
      items.push({ el: root.querySelector('[data-act="go"]'), box: true }, { el: root.querySelector('[data-act="story"]') });
      W.sequence(items, 0.2);
    }
    setTimeout(function () { root.querySelector('[data-act="go"]').focus({ preventScroll: true }); }, 60);
  }

  function close() {
    if (!root) return;
    root.classList.remove('--open');
  }

  // after the grid has built itself (body[data-started="true"]), give it a moment, then say hi
  function wait() {
    if (document.body.dataset.started === 'true') return setTimeout(open, 700);
    var mo = new MutationObserver(function () {
      if (document.body.dataset.started !== 'true') return;
      mo.disconnect();
      setTimeout(open, 700);
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-started'] });
  }
  if (document.body) wait(); else document.addEventListener('DOMContentLoaded', wait);
})();
