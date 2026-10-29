/* Instant hover videos: when a monster with a video is on (or near) the screen, download its
   video file into memory once and point every <video> of that piece at the in-memory copy, so
   playing starts immediately instead of waiting on the network. Safari / iPhone get the H.264
   MP4 (hardware decoded); other browsers get the smaller VP9 WebM. (HEVC was tried for Safari:
   iPhone draws it on a separate video layer that ignores the page's multiply blend and the big
   tiles' sizing, so it stays H.264.) */
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
    var okWebm = webm && v.canPlayType('video/webm; codecs="vp9"');
    if (preferMp4 && mp4) return hd(mp4.src);
    if (okWebm) return hd(webm.src);
    return hd((mp4 || list[0]).src);
  }

  var progressFns = new Map(); // url -> fn(bytesSoFar, totalBytes)
  function load(url) {
    if (!cache.has(url)) {
      cache.set(url, fetch(url).then(function (r) {
        if (!r.ok) throw new Error('video ' + r.status);
        var total = +r.headers.get('content-length') || 0;
        var report = function (n) { var f = progressFns.get(url); if (f) f(n, total); };
        // stream it chunk by chunk only when something is showing progress; otherwise let the
        // browser read it in one go (no per-chunk JavaScript competing with the page)
        if (!progressFns.has(url) || !r.body || !r.body.getReader) return r.blob().then(function (b) { report(b.size); return b; });
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
      var queued = waiting.get(url);
      if (queued) {
        waiting.delete(url);
        // once it's in, hand it over one player at a time when the page is idle
        cache.get(url).then(function () {
          queued.forEach(function (v) { idle(function () { if (v.isConnected) prime(v); }); });
        }).catch(function () {});
      }
    }
    return cache.get(url);
  }

  // Which file this browser will actually play for a .webm hover video (same choice as pick())
  var probe = document.createElement('video');
  var canWebm = !!probe.canPlayType('video/webm; codecs="vp9"');
  // Pieces with a sharper 960px cut (name-hd.webm / name-hd.mp4). Tiles, the big 2x2 tiles and
  // the shelf are drawn well past 480px on desktop and tablet, so those screens get it; phones
  // keep the lighter 480px file.
  var HD = ['darlene', 'dremmel', 'frillick', 'gorble', 'gumphrey', 'marnie', 'noshik', 'peepers', 'tav', 'tiv', 'ziggo', 'tessik',
    'piece-1', 'piece-3', 'piece-4', 'piece-6', 'piece-7', 'piece-8', 'piece-9', 'piece-10', 'piece-11', 'piece-12', 'piece-13',
    'piece-14', 'piece-15', 'piece-16', 'clatter', 'piece-18', 'piece-22', 'piece-23', 'piece-24', 'piece-26', 'piece-27', 'piece-32'];
  var wantHd = !!(window.matchMedia && window.matchMedia('(min-width: 768px)').matches);
  function hd(url) {
    if (!wantHd || !url) return url;
    var m = url.match(/\/([a-z0-9-]+?)\.(webm|mp4)$/i);
    return m && HD.indexOf(m[1].toLowerCase()) > -1 ? url.replace(/\.(webm|mp4)$/i, '-hd.$1') : url;
  }
  function fileFor(webm) {
    var mp4 = webm.replace(/\.webm$/i, '.mp4');
    if (preferMp4 || !canWebm) return hd(mp4);
    return hd(webm);
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
      if (onProgress) progressFns.set(u, function (got, total) { bytes[u] = got; if (total) totals[u] = total; tick(); });
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
  var idle = window.requestIdleCallback ? function (f) { window.requestIdleCallback(f, { timeout: 2000 }); } : function (f) { setTimeout(f, 50); };
  // lazy: don't start a download for this, just take the copy once something else has fetched it
  var waiting = new Map(); // url -> [video] waiting for that file
  function prime(v, lazy) {
    if (!v || v.dataset.primed) return Promise.resolve(v);
    var url = pick(v);
    if (!url) return Promise.resolve(v);
    if (lazy && !cache.has(url)) {
      if (!waiting.has(url)) waiting.set(url, []);
      waiting.get(url).push(v);
      return Promise.resolve(v);
    }
    v.dataset.primed = 'pending';
    return load(url).then(function (blobUrl) {
      var apply = function () {
        if (v.dataset.primed === 'done') return;
        if (!v.paused) return v.addEventListener('pause', later, { once: true });
        v.src = blobUrl;
        v.dataset.primed = 'done';
      };
      // swap a beat after it stops, so a play that just finished still gets its 'ended'
      var later = function () { setTimeout(apply, 0); };
      apply();
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

  // Phones can only run a handful of video players at once, so there only tiles on or near the
  // screen get one, and it's handed back once the tile is well off screen (the file itself stays
  // in memory, so coming back is instant).
  var near = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target.tagName === 'VIDEO' ? e.target : e.target.querySelector('video');
      if (!v) return;
      if (e.isIntersecting) { prime(v); return; }
      if (v.dataset.primed === 'done' && v.paused) {
        v.removeAttribute('src');
        v.load();
        delete v.dataset.primed;
      }
    });
  }, { rootMargin: '60% 0px' }) : null;
  function watchNear(els) {
    if (!near) return watch(els);
    [].forEach.call(els || [], function (el) { near.observe(el); });
  }
  function forget(els) { if (near) [].forEach.call(els || [], function (el) { near.unobserve(el); }); }

  window.PopsyVideo = { prime: prime, watch: watch, watchNear: watchNear, forget: forget, pick: pick, fileFor: fileFor, preloadAll: preloadAll, load: load };
})();
