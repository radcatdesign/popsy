/* Instant hover videos: when a monster with a video is on (or near) the screen, download its
   video file into memory once and point every <video> of that piece at the in-memory copy, so
   playing starts immediately instead of waiting on the network. Safari / iPhone get the MP4
   (hardware decoded); other browsers get the smaller WebM. */
(function () {
  var ua = navigator.userAgent;
  var preferMp4 = /iPad|iPhone|iPod/.test(ua) || (/^((?!chrome|android|crios|fxios).)*safari/i.test(ua));
  var cache = new Map(); // url -> Promise<blob url>

  function pick(v) {
    var list = [].slice.call(v.querySelectorAll('source')).map(function (s) {
      return { src: s.getAttribute('src'), type: s.getAttribute('type') || '' };
    }).filter(function (s) { return s.src; });
    if (!list.length) return null;
    var mp4 = list.filter(function (s) { return /mp4/.test(s.type) || /\.mp4$/i.test(s.src); })[0];
    var webm = list.filter(function (s) { return /webm/.test(s.type) || /\.webm$/i.test(s.src); })[0];
    var canWebm = webm && v.canPlayType('video/webm; codecs="vp8"');
    if (preferMp4 && mp4) return mp4.src;
    if (canWebm) return webm.src;
    return (mp4 || list[0]).src;
  }

  var progressFns = new Map(); // url -> fn(bytesSoFar, totalBytes)
  function load(url) {
    if (!cache.has(url)) {
      cache.set(url, fetch(url).then(function (r) {
        if (!r.ok) throw new Error('video ' + r.status);
        var total = +r.headers.get('content-length') || 0;
        var report = function (n) { var f = progressFns.get(url); if (f) f(n, total); };
        // stream it so a preloader can show real progress
        if (!r.body || !r.body.getReader) return r.blob().then(function (b) { report(b.size); return b; });
        var reader = r.body.getReader(), chunks = [], got = 0;
        var type = r.headers.get('content-type') || '';
        var pump = function () {
          return reader.read().then(function (res) {
            if (res.done) return new Blob(chunks, { type: type });
            chunks.push(res.value); got += res.value.length; report(got);
            return pump();
          });
        };
        return pump();
      }).then(function (b) { return URL.createObjectURL(b); }).catch(function (e) { cache.delete(url); throw e; }));
    }
    return cache.get(url);
  }

  // Which file this browser will actually play for a .webm hover video (same choice as pick())
  var probe = document.createElement('video');
  var canWebm = !!probe.canPlayType('video/webm; codecs="vp8"');
  function fileFor(webm) {
    var mp4 = webm.replace(/\.webm$/i, '.mp4');
    if (preferMp4 || !canWebm) return mp4;
    return webm;
  }

  // Download a whole set up front. onProgress(0..1) as bytes arrive; failures count as done
  // (that piece just loads the normal way later). Resolves when every file has settled.
  function preloadAll(urls, onProgress, concurrency) {
    urls = urls.filter(function (u, i) { return u && urls.indexOf(u) === i; });
    var n = urls.length, done = 0, bytes = {}, totals = {};
    if (!n) { if (onProgress) onProgress(1); return Promise.resolve(); }
    var tick = function () {
      if (!onProgress) return;
      // each file counts equally until its size is known, then by bytes
      var p = 0;
      urls.forEach(function (u) { p += totals[u] ? Math.min(1, (bytes[u] || 0) / totals[u]) : (bytes[u] === true ? 1 : 0); });
      onProgress(p / n);
    };
    var queue = urls.slice();
    var worker = function () {
      var u = queue.shift();
      if (!u) return Promise.resolve();
      progressFns.set(u, function (got, total) { bytes[u] = got; if (total) totals[u] = total; tick(); });
      return load(u).catch(function () {}).then(function () {
        progressFns.delete(u); bytes[u] = true; totals[u] = 0; done++; tick();
        return worker();
      });
    };
    var workers = [];
    for (var i = 0; i < Math.min(concurrency || 6, n); i++) workers.push(worker());
    return Promise.all(workers);
  }

  // Point a <video> at the in-memory copy (only while it's idle, so nothing mid-play restarts)
  function prime(v) {
    if (!v || v.dataset.primed) return Promise.resolve(v);
    var url = pick(v);
    if (!url) return Promise.resolve(v);
    v.dataset.primed = 'pending';
    return load(url).then(function (blobUrl) {
      var apply = function () {
        if (v.dataset.primed === 'done') return;
        v.src = blobUrl;
        v.dataset.primed = 'done';
      };
      if (v.paused) apply();
      else v.addEventListener('pause', apply, { once: true });
      return v;
    }).catch(function () { delete v.dataset.primed; return v; });
  }

  // Watch elements; when one comes within reach of the screen, prime the video inside it
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var v = e.target.tagName === 'VIDEO' ? e.target : e.target.querySelector('video');
      if (v) prime(v);
      io.unobserve(e.target);
    });
  }, { rootMargin: '250px' }) : null;

  function watch(els) {
    [].forEach.call(els || [], function (el) {
      var v = el.tagName === 'VIDEO' ? el : el.querySelector && el.querySelector('video');
      if (!v || v.dataset.primed) return;
      if (io) io.observe(el); else prime(v);
    });
  }

  window.PopsyVideo = { prime: prime, watch: watch, pick: pick, fileFor: fileFor, preloadAll: preloadAll };
})();
