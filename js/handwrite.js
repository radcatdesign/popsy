/* Handwritten text: titles, labels and links ink in left to right, like a pen racing across
   the page. Titles write letter by letter; short text sweeps word by word; body text (bios,
   stories, anything longer than a label) just fades up.
     PopsyWrite.write(el, delay)   -> a title, letter by letter; returns the time it ends (s)
     PopsyWrite.block(el, delay)   -> short text word by word (keeps markup); body text fades
     PopsyWrite.rise(els, delay)   -> a box (a button's outline) fades up as its label writes */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = [
    '.pw-w { white-space: nowrap; }',
    '.pw-c { display: inline-block; }',
    /* each letter / word is wiped on from its left edge; generous insets keep swashes uncut */
    '.pw-on .pw-c { clip-path: inset(-40% 100% -40% -30%); opacity: .25;',
    '  animation: pw-ink var(--pw-d, .12s) cubic-bezier(.3,.1,.5,1) var(--pw-t, 0s) forwards; }',
    '@keyframes pw-ink { 60% { opacity: 1; } to { clip-path: inset(-40% -30% -40% -30%); opacity: 1; } }',
    '.pw-rise { opacity: 0; transform: translateY(8px); }',
    '.pw-rise.--in { opacity: 1; transform: none; transition: opacity .3s ease, transform .4s cubic-bezier(.22,1,.36,1); }'
  ].join('\n');
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var esc = function (c) { return c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c; };
  // restart: drop the class, force a reflow, add it back
  var restart = function (el) { el.classList.remove('pw-on'); void el.offsetWidth; el.classList.add('pw-on'); };

  // A title: letter by letter, ~0.045s apart, never longer than ~0.85s
  function write(el, delay) {
    if (!el) return delay || 0;
    delay = delay || 0;
    var text = el.textContent;
    if (reduce || !text.trim()) return delay;
    if (el.dataset.pw !== text) {
      el.setAttribute('aria-label', text.trim());
      el.innerHTML = text.split(/(\s+)/).map(function (part) {
        if (!part) return '';
        if (/^\s+$/.test(part)) return ' ';
        return '<span class="pw-w" aria-hidden="true">' +
          Array.from(part).map(function (c) { return '<span class="pw-c">' + esc(c) + '</span>'; }).join('') + '</span>';
      }).join('');
      el.dataset.pw = el.textContent;
    }
    var chars = el.querySelectorAll('.pw-c'), n = chars.length;
    var step = Math.min(0.045, 0.75 / Math.max(1, n)), dur = Math.max(0.12, step * 3);
    for (var i = 0; i < n; i++) {
      chars[i].style.setProperty('--pw-t', (delay + i * step).toFixed(3) + 's');
      chars[i].style.setProperty('--pw-d', dur.toFixed(3) + 's');
    }
    restart(el);
    return delay + (n - 1) * step + dur;
  }

  // Body text (anything longer than a short label): fades up instead of writing itself
  var BODY = 60, FADE = '.pw-welcome__body p, .pp__text, .about-space, .pp__done, [data-pw-fade]';
  function fade(el, delay) {
    el.classList.remove('pw-on');
    if (el._pwFade) el._pwFade.cancel();
    el._pwFade = el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 650, delay: delay * 1000, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    return delay + 0.25;   // what follows starts writing as the fade gets going
  }

  // Short text (a price line, a tag, a button label): every word gets wrapped (markup stays),
  // then each line is swept left to right. Longer body text fades instead (see fade).
  // Lines start ~0.1s apart; lines past the first screenful all go at once.
  function block(el, delay, opts) {
    if (!el) return delay || 0;
    delay = delay || 0;
    if (reduce) return delay;
    opts = opts || {};
    if (el.matches(FADE) || el.textContent.trim().length > BODY) return fade(el, delay);
    if (!el.querySelector('.pw-c') || el.dataset.pwText !== el.textContent) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) { return n.parentNode.closest('input, textarea, select, svg, .pw-c') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
      });
      var nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(function (node) {
        if (!node.nodeValue.trim()) return;
        var frag = document.createDocumentFragment();
        node.nodeValue.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          var s = document.createElement('span');
          s.className = 'pw-c';
          s.textContent = part;
          frag.appendChild(s);
        });
        node.parentNode.replaceChild(frag, node);
      });
      el.dataset.pwText = el.textContent;
    }
    var words = [].slice.call(el.querySelectorAll('.pw-c'));
    if (!words.length) return delay;
    // group into lines by where they sit
    var lines = [], last = null;
    words.forEach(function (w) {
      var top = w.getBoundingClientRect().top;
      if (!last || Math.abs(top - last.top) > 4) { last = { top: top, words: [] }; lines.push(last); }
      last.words.push(w);
    });
    var lineStep = opts.lineStep || 0.1, lineDur = opts.lineDur || 0.32, cap = opts.cap || 16;
    var end = delay;
    lines.forEach(function (line, i) {
      var t0 = delay + Math.min(i, cap) * lineStep;
      var first = line.words[0].getBoundingClientRect().left;
      var lastR = line.words[line.words.length - 1].getBoundingClientRect().right;
      var span = Math.max(1, lastR - first), k = lineDur / Math.max(span, 260);
      line.words.forEach(function (w) {
        var r = w.getBoundingClientRect();
        var t = t0 + (r.left - first) * k, d = Math.max(0.05, r.width * k);
        w.style.setProperty('--pw-t', t.toFixed(3) + 's');
        w.style.setProperty('--pw-d', d.toFixed(3) + 's');
        end = Math.max(end, t + d);
      });
    });
    restart(el);
    return end;
  }

  function rise(els, delay, step) {
    els = [].filter.call(els || [], Boolean);
    step = step == null ? 0.06 : step;
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
      }, (d + 0.5) * 1000);
    });
  }

  // a run of pieces of text, each starting just before the last one finishes
  function sequence(items, delay) {
    var t = delay || 0;
    items.forEach(function (it) {
      if (!it || !it.el || it.el.hidden) return;
      if (it.box) rise([it.el], Math.max(0, t - 0.05), 0);
      t = (it.title ? write(it.el, t) : block(it.el, t)) - 0.08;
    });
    return t;
  }

  // Text links write themselves out again when you hover them (mouse / trackpad only). Only the
  // link's own words are rewritten, so icons inside a link (the back arrow) stay put.
  var HOVER = '.about-link, .family-link, .back-link, .pw-welcome__story, .bar a, .scroll-hint, [data-pw-hover]';
  function hoverTarget(el) {
    if (el._pwTarget) return el._pwTarget;
    var kids = [].slice.call(el.childNodes), elems = kids.filter(function (n) { return n.nodeType === 1; });
    var target = el;
    if (elems.length && !elems.every(function (n) { return n.classList && (n.classList.contains('pw-w') || n.classList.contains('pw-c')); })) {
      var txt = kids.filter(function (n) { return n.nodeType === 3 && n.nodeValue.trim(); })[0];
      if (!txt) return null;
      target = document.createElement('span');
      target.className = 'pw-hover';
      txt.parentNode.replaceChild(target, txt);
      target.textContent = txt.nodeValue;
    }
    return (el._pwTarget = target);
  }
  if (!reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('mouseover', function (e) {
      var el = e.target.closest && e.target.closest(HOVER);
      if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
      var now = performance.now();
      if (el._pwAt && now - el._pwAt < 400) return;   // don't restart it while it's still writing
      el._pwAt = now;
      var t = hoverTarget(el);
      if (t) write(t, 0);
    });
  }

  window.PopsyWrite = { write: write, block: block, fade: fade, rise: rise, sequence: sequence, reduce: reduce };
})();
