/* Piece popup: a centered card for one piece (photo or looping video, name, details, story)
   with an Inquire button that swaps to a short form.
   Usage: PiecePopup.open(item, { onClose }) where item has name, img|image, description,
   price, size, video. Inquiries POST to /api/inquiry; if that isn't set up yet, the
   visitor's email app opens with everything filled in so nothing gets lost. */
(function () {
  var INQUIRY_TO = 'brandon@socialgoodclub.com';

  var css = [
    '.pp { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 24px;',
    '  background: rgba(255,255,255,.94); opacity: 0; pointer-events: none; transition: opacity .3s ease; }',
    '.pp.--open { opacity: 1; pointer-events: auto; }',
    '.pp__card { position: relative; display: flex; gap: 32px; width: min(980px, 100%); max-height: min(640px, calc(100svh - 48px));',
    '  background: #fff; border: 1px solid transparent; border-radius: 13px; padding: 28px; overflow: hidden;',
    '  transform: translateY(14px) scale(.97); transition: transform .45s cubic-bezier(.22,1,.36,1); }',
    /* the hand-drawn border sits on its own layer above the content, so a piece (or its video,
       scaled up so arms aren't cropped) can never paint over the line */
    '.pp__card::after { content: ""; position: absolute; inset: -1px; z-index: 6; pointer-events: none; border: 1px solid #000; border-radius: 13px;',
    '  border-image-outset: 1px; border-image-width: 30px; border-image-slice: 25; border-image-repeat: stretch;',
    '  border-image-source: url(assets/cdn.prod.website-files.com/689e729c65f81373b9f2b204/68c9afa3203792c1866df05c_border.webp); }',
    '.pp.--open .pp__card { transform: none; }',
    '.pp__media { position: relative; flex: 0 0 auto; width: min(46%, 440px); aspect-ratio: 1; align-self: center; }',
    '.pp__media img, .pp__media video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }',
    '.pp__media video { opacity: 0; transition: opacity .4s ease; }',
    '.pp__media video.--playing { opacity: 1; }',
    /* plays once, then a round replay button pops up by the piece (same as the phone feed) */
    '.pp__replay { position: absolute; right: 0; bottom: 4px; z-index: 2; width: 42px; height: 42px; padding: 0; display: flex;',
    '  align-items: center; justify-content: center; color: #000; background: #fff; border: 1.5px solid #000; border-radius: 50%;',
    '  cursor: pointer; -webkit-tap-highlight-color: transparent; opacity: 0; transform: scale(.5) rotate(-90deg); pointer-events: none;',
    '  transition: opacity .25s ease, transform .45s cubic-bezier(.34,1.56,.64,1); }',
    '.pp__media.--replay .pp__replay { opacity: 1; transform: none; pointer-events: auto; }',
    '.pp__replay:hover { transform: rotate(-20deg); }',
    '.pp__replay:active { transform: scale(.9); }',
    '.pp__body { position: relative; flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; min-height: 0; }',
    '.pp__view { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }',
    '.pp__view[hidden] { display: none; }',
    '.pp__title { font-size: 34px; line-height: 1.1; margin: 0 40px 12px 0; }',
    '.pp__meta { font-size: 18px; margin-bottom: 10px; display: flex; gap: 18px; flex-wrap: wrap; }',
    '.pp__text { font-size: 19px; line-height: 1.45; white-space: pre-line; overflow-y: auto; flex: 1 1 auto; min-height: 0;',
    '  padding-right: 6px; scrollbar-width: none; }',
    '.pp__text::-webkit-scrollbar { display: none; }',
    '.pp__btn { appearance: none; font: inherit; font-size: 20px; cursor: pointer; margin-top: 18px; align-self: flex-start;',
    '  padding: 10px 26px; border-radius: 8px; background: #000; color: #fff; border: 1px solid transparent;',
    '  border-image-outset: 3px; border-image-width: 30px; border-image-slice: 15; border-image-repeat: stretch;',
    '  border-image-source: url(assets/cdn.prod.website-files.com/689e729c65f81373b9f2b204/68c9afa3b6987922f881509d_border2.webp); }',
    '.pp__btn:hover { transform: rotate(-1.5deg); }',
    '.pp__btn[disabled] { opacity: .6; transform: none; }',
    '.pp__btn.--adopted, .pp__btn.--adopted:hover { opacity: .45; cursor: default; transform: none; }',
    '.pp__close:focus:not(:focus-visible) { outline: none; }',
    '.pp__close { position: absolute; top: 14px; right: 14px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;',
    '  cursor: pointer; background: none; border: 0; padding: 0; z-index: 2; }',
    '.pp__back { appearance: none; background: none; border: 0; font: inherit; font-size: 17px; cursor: pointer; padding: 0; align-self: flex-start;',
    '  margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }',
    '.pp__form { display: flex; flex-direction: column; gap: 12px; overflow-y: auto; min-height: 0; }',
    '.pp__form label { display: flex; flex-direction: column; gap: 4px; font-size: 16px; }',
    '.pp__form input, .pp__form textarea { font: inherit; font-size: 17px; color: #000; background: #fff; border: 1.5px solid #000;',
    '  border-radius: 8px; padding: 10px 12px; outline: none; }',
    '.pp__form textarea { min-height: 120px; resize: vertical; }',
    '.pp__form input:focus, .pp__form textarea:focus { box-shadow: 0 0 0 3px rgba(0,0,0,.12); }',
    '.pp__hp { position: absolute !important; left: -9999px !important; width: 1px; height: 1px; opacity: 0; }',
    '.pp__note { font-size: 15px; min-height: 1.2em; }',
    '.pp__done { font-size: 22px; line-height: 1.35; margin-top: 12px; }',
    '@media (max-width: 760px) {',
    '  .pp { padding: 12px; align-items: flex-end; }',
    '  .pp__card { flex-direction: column; gap: 14px; padding: 18px; max-height: calc(100svh - 24px); }',
    '  .pp__media { width: min(100%, 38svh); align-self: center; }',
    '  .pp__title { font-size: 26px; }',
    '  .pp__text { font-size: 16px; }',
    '  .pp__card.--form .pp__media, .pp__card.--done .pp__media { display: none; }',
    '  .pp__btn { align-self: stretch; text-align: center; }',
    '}'
  ].join('\n');

  var root, card, media, imgEl, videoEl, titleEl, metaEl, textEl, infoView, formView, doneView, form, note, sendBtn;
  var current = null, onCloseCb = null, lastFocus = null;

  // pieces that already have a home: the button says so and can't be used
  var ADOPTED = ['Moro', 'Gumphrey', 'Tiv', 'Stubbs', 'Craig', 'Ned', 'Tav', 'Murn', 'Noshik', 'Droozle', 'Dremmel', 'Gabbles', 'Hortencia'];
  function isAdopted(name) { return ADOPTED.indexOf(String(name).trim().split(/\s+/)[0]) !== -1; }
  window.PopsyAdopted = isAdopted;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function plain(html) { var d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent; }

  function build() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    root = document.createElement('div');
    root.className = 'pp';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'pp-title');
    root.innerHTML =
      '<div class="pp__card">' +
      '<button class="pp__close" type="button" aria-label="Close"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round"><path d="M18.4 5.8 5.6 18.3"/><path d="M5.7 5.6l12.7 12.9"/></svg></button>' +
      '<div class="pp__media"><img alt=""><video muted playsinline preload="auto"></video>' +
      '<button class="pp__replay" type="button" data-action="replay" aria-label="Play again"><svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M25.6 12.4c-1.6-4.3-5.6-7.1-10.2-6.9-6 .3-10.3 5.3-9.9 11.2.4 5.6 5.3 9.9 10.9 9.6 3.9-.2 7.2-2.6 8.8-6"/><path d="M26.4 5.6l-.7 7-6.8-1.2"/></svg></button></div>' +
      '<div class="pp__body">' +
      '<div class="pp__view" data-view="info">' +
      '<h2 class="pp__title" id="pp-title"></h2><div class="pp__meta"></div><div class="pp__text"></div>' +
      '<button class="pp__btn" type="button" data-action="inquire">Inquire</button>' +
      '</div>' +
      '<div class="pp__view" data-view="form" hidden>' +
      '<button class="pp__back" type="button" data-action="back"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12.4c-4.6-.3-9.6-.1-14.6.2"/><path d="M10.4 6.2c-2.1 2-4 3.9-5.6 6.2 1.8 1.9 3.7 3.7 5.8 5.5"/></svg>back</button>' +
      '<h2 class="pp__title pp__form-title"></h2>' +
      '<form class="pp__form" novalidate>' +
      '<label>Name<input name="name" autocomplete="name" required></label>' +
      '<label>Email<input name="email" type="email" autocomplete="email" required></label>' +
      '<label>Message<textarea name="message" required></textarea></label>' +
      '<input class="pp__hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<div class="pp__note" aria-live="polite"></div>' +
      '<button class="pp__btn" type="submit">Send</button>' +
      '</form>' +
      '</div>' +
      '<div class="pp__view" data-view="done" hidden>' +
      '<h2 class="pp__title">Sent!</h2><p class="pp__done"></p>' +
      '<button class="pp__btn" type="button" data-action="close">Back to the monsters</button>' +
      '</div>' +
      '</div></div>';
    document.body.appendChild(root);
    card = root.querySelector('.pp__card');
    media = root.querySelector('.pp__media');
    imgEl = media.querySelector('img');
    videoEl = media.querySelector('video');
    videoEl.muted = true;
    titleEl = root.querySelector('#pp-title');
    metaEl = root.querySelector('.pp__meta');
    textEl = root.querySelector('.pp__text');
    infoView = root.querySelector('[data-view="info"]');
    formView = root.querySelector('[data-view="form"]');
    doneView = root.querySelector('[data-view="done"]');
    form = root.querySelector('.pp__form');
    note = root.querySelector('.pp__note');
    sendBtn = form.querySelector('button[type="submit"]');

    root.addEventListener('click', function (e) {
      if (!card.contains(e.target)) return close();
      var a = e.target.closest('[data-action]');
      if (a && a.dataset.action === 'replay') {
        media.classList.remove('--replay');
        try { videoEl.currentTime = 0; } catch (err) {}
        videoEl.play().catch(function () {});
      }
      if (a && a.dataset.action === 'inquire') show('form');
      if (a && a.dataset.action === 'back') show('info');
      if (a && a.dataset.action === 'close') close();
      if (e.target.closest('.pp__close')) close();
    });
    // keep grid drags / wheel from leaking through
    ['wheel', 'pointerdown', 'mousedown', 'touchstart'].forEach(function (t) {
      root.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true });
    });
    document.addEventListener('keydown', function (e) {
      if (!root.classList.contains('--open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') trapFocus(e);
    });
    form.addEventListener('submit', submit);
    videoEl.addEventListener('playing', function () { videoEl.classList.add('--playing'); media.classList.remove('--replay'); });
    // after one play it fades back to the photo and the replay button shows
    videoEl.addEventListener('ended', function () {
      videoEl.classList.remove('--playing');
      if (root.classList.contains('--open')) media.classList.add('--replay');
    });
  }

  function trapFocus(e) {
    var f = [].slice.call(card.querySelectorAll('button, input, textarea, a[href]')).filter(function (el) {
      return el.offsetParent !== null && el.tabIndex !== -1;
    });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function show(view) {
    infoView.hidden = view !== 'info';
    formView.hidden = view !== 'form';
    doneView.hidden = view !== 'done';
    card.classList.toggle('--form', view === 'form');
    card.classList.toggle('--done', view === 'done');
    // everything writes itself in, fast: the title, then the details, the story and the button
    var W = window.PopsyWrite;
    if (W) {
      var v = view === 'form' ? formView : view === 'done' ? doneView : infoView;
      var items = [{ el: v.querySelector('.pp__title'), title: true }];
      if (view === 'info') items.push({ el: metaEl }, { el: textEl }, { el: v.querySelector('[data-action="inquire"]'), box: true });
      else if (view === 'form') [].forEach.call(form.querySelectorAll('label, button[type="submit"]'), function (el) { items.push({ el: el, box: el.tagName === 'BUTTON' }); });
      else items.push({ el: v.querySelector('.pp__done') }, { el: v.querySelector('[data-action="close"]'), box: true });
      W.sequence(items, 0.12);
    }
    if (view === 'form') {
      var nameInput = form.querySelector('[name="name"]');
      setTimeout(function () { nameInput.focus(); }, 50);
    }
  }

  function open(item, opts) {
    if (!root) build();
    current = item;
    onCloseCb = opts && opts.onClose;
    lastFocus = document.activeElement;
    var name = plain(item.name);
    titleEl.textContent = name;
    var inq = infoView.querySelector('[data-action="inquire"]');
    var adopted = isAdopted(name);
    inq.textContent = adopted ? 'Adopted' : 'Inquire';
    inq.disabled = adopted;
    inq.classList.toggle('--adopted', adopted);
    root.querySelector('.pp__form-title').textContent = 'Inquire about ' + name.replace(/\s*[“"].*$/, '');
    var meta = [];
    if (item.price) meta.push('$' + esc(item.price));
    if (item.size) meta.push('Size: ' + esc(item.size));
    metaEl.innerHTML = meta.map(function (m) { return '<span>' + m + '</span>'; }).join('');
    metaEl.hidden = !meta.length;
    textEl.textContent = plain(item.description);
    textEl.scrollTop = 0;
    imgEl.src = item.img || item.image || '';
    imgEl.alt = name;
    videoEl.classList.remove('--playing');
    media.classList.remove('--replay');
    videoEl.pause();
    videoEl.removeAttribute('src');
    delete videoEl.dataset.primed;
    videoEl.innerHTML = '';
    videoEl.style.transform = item.videoZoom ? 'scale(' + item.videoZoom + ')' : '';
    if (item.video) {
      videoEl.innerHTML = '<source src="' + esc(item.video) + '" type="video/webm">' +
        (/^assets\/hover\/.+\.webm$/i.test(item.video) ? '<source src="' + esc(item.video.replace(/\.webm$/i, '.mp4')) + '" type="video/mp4">' : '');
      videoEl.load();
      if (window.PopsyVideo) window.PopsyVideo.prime(videoEl).then(function () { videoEl.play().catch(function () {}); });
      else videoEl.play().catch(function () {});
    }
    form.reset();
    form.querySelector('[name="message"]').value = 'Hi Brandon, I’m interested in ' + name + '.';
    note.textContent = '';
    sendBtn.disabled = false;
    show('info');
    root.classList.add('--open');
    setTimeout(function () { root.querySelector('.pp__close').focus({ preventScroll: true }); }, 30);
  }

  function close() {
    if (!root || !root.classList.contains('--open')) return;
    root.classList.remove('--open');
    setTimeout(function () { if (!root.classList.contains('--open')) { videoEl.pause(); } }, 320);
    var cb = onCloseCb; onCloseCb = null;
    if (cb) cb();
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (err) {} }
  }

  function mailtoFallback(data) {
    var body = data.message + '\n\n' + data.name + '\n' + data.email + '\n\nPiece: ' + data.piece + (data.url ? '\n' + data.url : '');
    window.location.href = 'mailto:' + INQUIRY_TO + '?subject=' + encodeURIComponent('Inquiry: ' + data.piece) + '&body=' + encodeURIComponent(body);
  }

  function submit(e) {
    e.preventDefault();
    var fd = new FormData(form);
    var data = {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      message: String(fd.get('message') || '').trim(),
      website: String(fd.get('website') || ''),
      piece: plain(current && current.name),
      pieceId: current && current.id,
      url: location.origin + location.pathname
    };
    if (!data.name || !data.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      note.textContent = !data.name ? 'Add your name.' : (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ? 'Add a valid email.' : 'Add a message.');
      return;
    }
    sendBtn.disabled = true;
    note.textContent = 'Sending…';
    fetch('/api/inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j && res.j.ok) {
          root.querySelector('.pp__done').textContent = 'Thanks, ' + data.name.split(' ')[0] + '. Brandon will get back to you at ' + data.email + '.';
          show('done');
        } else if (res.status === 400) {
          note.textContent = (res.j && res.j.error) || 'Check the form and try again.';
          sendBtn.disabled = false;
        } else {
          // direct sending isn't set up (or failed): hand it to the visitor's email app
          note.textContent = 'Opening your email app to send it…';
          sendBtn.disabled = false;
          mailtoFallback(data);
        }
      })
      .catch(function () {
        note.textContent = 'Opening your email app to send it…';
        sendBtn.disabled = false;
        mailtoFallback(data);
      });
  }

  window.PiecePopup = { open: open, close: close };
})();
