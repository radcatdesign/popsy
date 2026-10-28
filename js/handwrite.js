/* Handwritten titles: a title inks in letter by letter, left to right like a pen, and the body and
   buttons rise in once it's mostly written. Shared by the piece popup, the about popup and the
   phone feed captions.
     PopsyWrite.write(el, delay)        -> seconds until the title is fully written
     PopsyWrite.rise(els, delay, step)  -> body/buttons fade up after that */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = [
    '.pw-w { white-space: nowrap; }',
    /* each letter is wiped on from its left edge; the generous insets keep swashes uncut */
    '.pw-c { display: inline-block; clip-path: inset(-40% 100% -40% -30%); opacity: .2;',
    '  animation: pw-ink var(--pw-d, .16s) cubic-bezier(.3,.1,.5,1) var(--pw-t, 0s) forwards; }',
    '@keyframes pw-ink { 60% { opacity: 1; } to { clip-path: inset(-40% -30% -40% -30%); opacity: 1; } }',
    '.pw-rise { opacity: 0; transform: translateY(12px); }',
    '.pw-rise.--in { opacity: 1; transform: none; transition: opacity .45s ease, transform .6s cubic-bezier(.22,1,.36,1); }'
  ].join('\n');
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  function esc(c) { return c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c; }

  function write(el, delay) {
    if (!el) return 0;
    var text = el.textContent;
    delay = delay || 0;
    if (reduce || !text.trim()) { el.textContent = text; return delay; }
    el.setAttribute('aria-label', text.trim());
    var n = 0;
    el.innerHTML = text.split(/(\s+)/).map(function (part) {
      if (!part) return '';
      if (/^\s+$/.test(part)) return ' ';
      return '<span class="pw-w" aria-hidden="true">' +
        Array.from(part).map(function (c) { n++; return '<span class="pw-c">' + esc(c) + '</span>'; }).join('') + '</span>';
    }).join('');
    // a short name writes at a relaxed pace; a long one speeds up so it never drags past ~1.1s
    var step = Math.min(0.055, 0.95 / Math.max(1, n));
    var dur = Math.max(0.1, step * 2.6);
    var chars = el.querySelectorAll('.pw-c');
    for (var i = 0; i < chars.length; i++) {
      chars[i].style.setProperty('--pw-t', (delay + i * step).toFixed(3) + 's');
      chars[i].style.setProperty('--pw-d', dur.toFixed(3) + 's');
    }
    return delay + (n - 1) * step + dur;
  }

  function rise(els, delay, step) {
    els = [].filter.call(els || [], Boolean);
    step = step == null ? 0.08 : step;
    els.forEach(function (el, i) {
      clearTimeout(el._pwT);
      el.classList.remove('--in');
      el.style.transitionDelay = '';
      if (reduce) return;
      el.classList.add('pw-rise');
      void el.offsetWidth;
      var d = delay + i * step;
      el.style.transitionDelay = d.toFixed(2) + 's';
      el.classList.add('--in');
      // hand the element back to its own styles once it's in
      el._pwT = setTimeout(function () {
        el.classList.remove('pw-rise', '--in');
        el.style.transitionDelay = '';
      }, (d + 0.7) * 1000);
    });
  }

  window.PopsyWrite = { write: write, rise: rise, reduce: reduce };
})();
