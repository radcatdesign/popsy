/* About popup restyle: same card as the piece popup (white, hand-drawn border, soft white
   backdrop), a hand-lettered heading, and the small hand-drawn close x in the corner.
   Works with the existing Webflow markup and its body[data-about-open] toggle. */
(function () {
  var css = [
    '.about-popup-w { background: rgba(255,255,255,.94); padding: 24px; transition: opacity .3s ease; }',
    'body .about-popup-w .about-popup-bd { background: transparent; padding: 0; }',
    'body .about-popup-w .about-popup-close { display: none; }',
    'body .about-popup-w .about-popup {',
    '  position: relative; z-index: 2; width: min(640px, 100%); height: auto; max-width: none; max-height: min(78svh, 720px);',
    '  display: flex; flex-direction: column; text-align: left; overflow: hidden;',
    '  background: #fff; border: 1px solid #000; border-radius: 13px; padding: 30px 34px 24px;',
    '  border-image-outset: 1px; border-image-width: 30px; border-image-slice: 25; border-image-repeat: stretch;',
    '  border-image-source: url(assets/cdn.prod.website-files.com/689e729c65f81373b9f2b204/68c9afa3203792c1866df05c_border.png);',
    '  transform: translateY(14px) scale(.97); transition: transform .45s cubic-bezier(.22,1,.36,1); }',
    'body[data-about-open="t"] .about-popup-w .about-popup { transform: none; }',
    '.about-popup .ap-title { font-size: 34px; line-height: 1.1; margin: 0 44px 14px 0; font-weight: normal; }',
    '.about-popup .ap-close { position: absolute; top: 14px; right: 14px; width: 40px; height: 40px; display: flex;',
    '  align-items: center; justify-content: center; background: none; border: 0; padding: 0; cursor: pointer; z-index: 3; }',
    '.about-popup .ap-close:focus:not(:focus-visible) { outline: none; }',
    'body .about-popup .about-popup-c, body .about-popup .about-popup-content { display: block; width: 100%; height: auto; min-height: 0; flex: 1 1 auto; overflow: hidden; }',
    'body .about-popup .about-popup-block.v--scroll { display: block; margin: 0; padding: 0; max-height: none; height: 100%; }',
    'body .about-popup .about-popup-block__scroll.v--scroll { display: block; margin: 0; padding: 4px 8px 16px 0; text-align: left;',
    '  max-height: calc(min(78svh, 720px) - 130px); overflow-y: auto; scrollbar-width: none; }',
    'body .about-popup .about-popup-block__scroll.v--scroll::-webkit-scrollbar { display: none; }',
    'body .about-popup .about-space { font-size: 18px; line-height: 1.5; white-space: normal; }',
    '.about-popup .about-space p { margin: 0 0 1em; font-size: inherit; line-height: inherit; }',
    'body .about-popup .about-popup-block__scroll.v--scroll { padding-top: 14px; }',
    '.about-popup .about-space .ap-sign { margin: 1.6em 0 .4em; }',
    '@media (max-width: 760px) {',
    '  .about-popup-w { padding: 12px; align-items: flex-end; }',
    '  body .about-popup-w .about-popup { max-height: calc(100svh - 24px); padding: 22px 20px 16px; }',
    '  .about-popup .ap-title { font-size: 26px; }',
    '  body .about-popup .about-popup-block__scroll.v--scroll { max-height: calc(100svh - 24px - 110px); }',
    '  body .about-popup .about-space { font-size: 16px; }',
    '}'
  ].join('\n');

  function setup() {
    var popup = document.querySelector('.about-popup');
    if (!popup || popup.querySelector('.ap-close')) return;
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
    var wrap = document.querySelector('.about-popup-w');
    if (wrap) {
      wrap.setAttribute('role', 'dialog');
      wrap.setAttribute('aria-modal', 'true');
      wrap.setAttribute('aria-labelledby', 'ap-title');
    }
    var title = document.createElement('h2');
    title.className = 'ap-title';
    title.id = 'ap-title';
    title.textContent = 'No problem';
    popup.insertBefore(title, popup.firstChild);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ap-close';
    btn.setAttribute('aria-label', 'Close');
    btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round"><path d="M18.4 5.8 5.6 18.3"/><path d="M5.7 5.6l12.7 12.9"/></svg>';
    btn.addEventListener('click', function () { document.body.dataset.aboutOpen = ''; });
    popup.appendChild(btn);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.dataset.aboutOpen === 't') document.body.dataset.aboutOpen = '';
    });
    // each time it opens: the title writes itself in, then the story rises in under it
    var body = popup.querySelector('.about-popup-c');
    new MutationObserver(function () {
      if (document.body.dataset.aboutOpen !== 't' || !window.PopsyWrite) return;
      var end = window.PopsyWrite.write(title, 0.2);
      window.PopsyWrite.rise([body], end * 0.75);
    }).observe(document.body, { attributes: true, attributeFilter: ['data-about-open'] });
    // reset the story to the top each time it opens
    var scroller = popup.querySelector('.about-popup-block__scroll');
    var link = document.querySelector('.about-link');
    if (link && scroller) link.addEventListener('click', function () { scroller.scrollTop = 0; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
