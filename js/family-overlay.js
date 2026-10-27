/* Family tree overlay: the "family tree" link opens the tree in a large popup card over the
   grid (same style as the other popups) instead of leaving the page. The tree page loads in an
   iframe in embed mode, stays loaded after closing so reopening is instant, and the grid keeps
   its place underneath. Cmd/ctrl-click still opens /family in a new tab. */
(function () {
  var css = [
    '.fo { position: fixed; inset: 0; z-index: 90000; padding: 24px; background: rgba(255,255,255,.94);',
    '  opacity: 0; pointer-events: none; visibility: hidden; transition: opacity .35s ease, visibility 0s linear .35s; }',
    '.fo.--open { opacity: 1; pointer-events: auto; visibility: visible; transition: opacity .35s ease, visibility 0s; }',
    '.fo__card { position: relative; width: 100%; height: 100%; background: #fff; border: 1px solid #000; border-radius: 13px; overflow: hidden;',
    '  border-image-outset: 1px; border-image-width: 30px; border-image-slice: 25; border-image-repeat: stretch;',
    '  border-image-source: url(assets/cdn.prod.website-files.com/689e729c65f81373b9f2b204/68c9afa3203792c1866df05c_border.png);',
    '  transform: translateY(14px) scale(.985); transition: transform .5s cubic-bezier(.22,1,.36,1); }',
    '.fo.--open .fo__card { transform: none; }',
    '.fo__frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; background: #fff; }',
    '.fo__title { position: absolute; top: 18px; left: 22px; z-index: 2; font-size: 20px; pointer-events: none; }',
    '.fo__close { position: absolute; top: 10px; right: 10px; z-index: 2; width: 44px; height: 44px; display: flex; align-items: center;',
    '  justify-content: center; background: #fff; border: 0; border-radius: 50%; padding: 0; cursor: pointer; }',
    '.fo__close:focus:not(:focus-visible) { outline: none; }',
    '@media (max-width: 760px) { .fo { padding: 10px; } .fo__title { top: 14px; left: 16px; font-size: 18px; } .fo__close { top: 6px; right: 6px; } }'
  ].join('\n');

  var root, frame, lastFocus = null;
  function src(link) {
    var href = (link && link.getAttribute('href')) || '/family';
    return href + (href.indexOf('?') > -1 ? '&' : '?') + 'embed=1';
  }
  function build(link) {
    if (root) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    root = document.createElement('div');
    root.className = 'fo';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Family tree');
    root.innerHTML = '<div class="fo__card">' +
      '<div class="fo__title" aria-hidden="true">family tree</div>' +
      '<button class="fo__close" type="button" aria-label="Close family tree"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round"><path d="M18.4 5.8 5.6 18.3"/><path d="M5.7 5.6l12.7 12.9"/></svg></button>' +
      '<iframe class="fo__frame" title="Popsy family tree" allow="autoplay"></iframe></div>';
    document.body.appendChild(root);
    frame = root.querySelector('iframe');
    frame.dataset.src = src(link);
    root.addEventListener('click', function (e) {
      if (e.target === root || e.target.closest('.fo__close')) close();
    });
    ['wheel', 'pointerdown', 'mousedown', 'touchstart'].forEach(function (t) {
      root.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true });
    });
  }
  function load() { if (frame && !frame.getAttribute('src')) frame.setAttribute('src', frame.dataset.src); }
  function open(link) {
    build(link);
    load();
    lastFocus = document.activeElement;
    document.body.dataset.familyOpen = 't';
    root.classList.add('--open');
    setTimeout(function () { root.querySelector('.fo__close').focus({ preventScroll: true }); }, 40);
  }
  function close() {
    if (!root || !root.classList.contains('--open')) return;
    root.classList.remove('--open');
    document.body.dataset.familyOpen = '';
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (err) {} }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root && root.classList.contains('--open') && !document.querySelector('.pp.--open')) close();
  });
  // Esc pressed inside the tree (when no piece popup is open there) asks us to close
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'popsy:close-family') return;
    close();
  });

  function wire() {
    document.querySelectorAll('a.family-link').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
        e.preventDefault();
        open(a);
      });
      // start loading the tree as soon as someone heads for the link
      var warm = function () { build(a); load(); };
      a.addEventListener('mouseenter', warm, { once: true });
      a.addEventListener('touchstart', warm, { once: true, passive: true });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  window.FamilyOverlay = { open: function () { open(document.querySelector('a.family-link')); }, close: close };
})();
