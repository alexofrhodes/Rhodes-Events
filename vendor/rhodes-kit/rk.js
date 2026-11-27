/* Rhodes kit — shared UI helpers for Rhodes-Bus, Rhodes-Port, RhodesGuide, Rhodes Events, Hotspots.
   Plain script (no modules). Load in <head> without defer so the theme applies before paint. */
(function () {
  'use strict';
  var RK = (window.RK = window.RK || {});
  RK.version = '1.0.0';

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  RK.store = store;

  /* ---------- Theme: auto | light | dark ---------- */
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    // A site with its own light/dark CSS (Rhodes Events) opts out with <html data-rk-own-theme>.
    if (document.documentElement.hasAttribute('data-rk-own-theme')) return;
    var pref = store.get('rk-theme', 'auto');
    var dark = pref === 'dark' || (pref === 'auto' && mq && mq.matches);
    document.documentElement.setAttribute('data-rk-theme', dark ? 'dark' : 'light');
  }
  RK.getTheme = function () { return store.get('rk-theme', 'auto'); };
  RK.setTheme = function (pref) { store.set('rk-theme', pref); applyTheme(); syncThemeControls(); };
  applyTheme();
  if (mq && mq.addEventListener) mq.addEventListener('change', applyTheme);

  var themeControls = [];
  function syncThemeControls() {
    var cur = RK.getTheme();
    themeControls.forEach(function (root) {
      root.querySelectorAll('[data-rk-theme-opt]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-rk-theme-opt') === cur));
      });
    });
  }
  /** Render an Auto / Light / Dark segmented control into `el`. */
  RK.themeControl = function (el) {
    if (!el) return;
    el.classList.add('rk-seg');
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Theme');
    el.innerHTML = ['auto', 'light', 'dark'].map(function (k) {
      return '<button type="button" data-rk-theme-opt="' + k + '">' + k.charAt(0).toUpperCase() + k.slice(1) + '</button>';
    }).join('');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rk-theme-opt]');
      if (b) RK.setTheme(b.getAttribute('data-rk-theme-opt'));
    });
    themeControls.push(el);
    syncThemeControls();
  };

  /* ---------- Toast ---------- */
  var toastEl = null, toastTimer = 0;
  RK.toast = function (msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'rk-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, ms || 2600);
  };

  /* ---------- Share (native sheet, else copy link) ---------- */
  RK.share = function (opts) {
    opts = opts || {};
    var url = opts.url || location.href;
    var title = opts.title || document.title;
    if (navigator.share) {
      return navigator.share({ title: title, text: opts.text || title, url: url }).catch(function () {});
    }
    return RK.copy(url).then(function (ok) { RK.toast(ok ? 'Link copied' : url); });
  };
  RK.copy = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      return Promise.resolve(ok);
    } catch (e) { return Promise.resolve(false); }
  };

  /* ---------- View transitions ---------- */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  RK.transition = function (fn) {
    if (!reduce && document.startViewTransition) {
      try {
        var t = document.startViewTransition(fn);
        // A newer transition skips this one; that is expected, not an error.
        if (t && t.finished) t.finished.catch(function () {});
        if (t && t.ready) t.ready.catch(function () {});
        if (t && t.updateCallbackDone) t.updateCallbackDone.catch(function () {});
        return;
      } catch (e) { /* fall through */ }
    }
    fn();
  };

  /* ---------- Skeleton placeholders ---------- */
  RK.skeleton = function (el, rows) {
    if (!el) return;
    var n = rows || 4, html = '<div class="rk-skel" aria-busy="true" aria-label="Loading">';
    for (var i = 0; i < n; i++) html += '<div class="rk-skel-row" style="width:' + (60 + ((i * 37) % 40)) + '%"></div>';
    el.innerHTML = html + '</div>';
  };

  /* ---------- "Data updated" stamp ---------- */
  RK.formatStamp = function (iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var mon = d.toLocaleString('en-GB', { month: 'short' });
    var hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    return d.getDate() + ' ' + mon + ', ' + hh + ':' + mm;
  };
  RK.dataStamp = function (el, iso, label) {
    if (!el) return;
    var s = RK.formatStamp(iso);
    el.textContent = s ? (label || 'Data updated') + ': ' + s : '';
    el.hidden = !s;
  };

  /* ---------- What's new (once per version) ---------- */
  RK.whatsNew = function (appKey, version, text) {
    var key = 'rk-seen-' + appKey;
    var seen = store.get(key, '');
    if (seen === version) return;
    if (!seen) { store.set(key, version); return; } // first visit: nothing is "new"
    var bar = document.createElement('div');
    bar.className = 'rk-news';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<span class="rk-news-text"></span><button type="button" aria-label="Dismiss">×</button>';
    bar.querySelector('.rk-news-text').textContent = "What's new: " + text;
    bar.querySelector('button').addEventListener('click', function () { store.set(key, version); bar.remove(); });
    document.body.appendChild(bar);
  };

  /* ---------- Rhodes apps switcher ---------- */
  RK.apps = [
    { key: 'bus', label: 'Bus', url: 'https://alexofrhodes.github.io/Rhodes-Bus/' },
    { key: 'ferries', label: 'Ferries', url: 'https://alexofrhodes.github.io/Rhodes-Port/ferries.html' },
    { key: 'guide', label: 'Guide', url: 'https://alexofrhodes.github.io/RhodesGuide/' },
    { key: 'events', label: 'Events', url: 'https://alexofrhodes.github.io/Rhodes-Events/' },
  ];
  /* Rhodes Apps mark: the Knights' rose — four notched rose petals forming the eight-pointed cross
     of the Knights of Rhodes, four small petals between the arms, a gold heart. */
  var ROSE_ARM = 'M10.8 10.2L6.9 3.5Q6.5 2.5 7.6 2.4Q10.3 2.5 12 4.3Q13.7 2.5 16.4 2.4Q17.5 2.5 17.1 3.5L13.2 10.2Q12 11.8 10.8 10.2Z';
  RK.roseSvg = function (size) {
    var arms = [0, 90, 180, 270].map(function (a) {
      return '<path d="' + ROSE_ARM + '"' + (a ? ' transform="rotate(' + a + ' 12 12)"' : '') + '/>';
    }).join('');
    var small = [[17.3, 6.7, 45], [17.3, 17.3, 135], [6.7, 17.3, 45], [6.7, 6.7, 135]].map(function (p) {
      return '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="1.35" ry="2.1" transform="rotate(' + p[2] + ' ' + p[0] + ' ' + p[1] + ')"/>';
    }).join('');
    return '<svg class="rk-rose" viewBox="2.1 2.1 19.8 19.8" width="' + (size || 22) + '" height="' + (size || 22) +
      '" aria-hidden="true" focusable="false"><g class="rk-rose-turn"><g class="rk-rose-arms" fill="#e11d48">' + arms +
      '</g><g class="rk-rose-small" fill="#f43f5e">' + small + '</g></g><circle class="rk-rose-heart" cx="12" cy="12" r="1.25" fill="#f59e0b"/></svg>';
  };

  RK.switcher = function (el, current) {
    if (!el) return;
    var d = document.createElement('details');
    d.className = 'rk-apps';
    d.innerHTML = '<summary class="rk-keep-colors" aria-label="Rhodes apps" title="Rhodes apps">' + RK.roseSvg(22) + '</summary><nav class="rk-apps-menu"></nav>';
    // Bloom once per visit (not on every page of a multi-page site); turning on open/close is CSS.
    try {
      if (!sessionStorage.getItem('rk-rose-bloomed')) {
        sessionStorage.setItem('rk-rose-bloomed', '1');
        d.querySelector('.rk-rose').classList.add('rk-rose-bloom');
      }
    } catch (e) { /* private mode: no bloom */ }
    var nav = d.querySelector('nav');
    RK.apps.forEach(function (a) {
      var link = document.createElement('a');
      link.href = a.url;
      link.textContent = a.label;
      if (a.key === current) { link.setAttribute('aria-current', 'page'); link.removeAttribute('href'); }
      nav.appendChild(link);
    });
    document.addEventListener('click', function (e) { if (!d.contains(e.target)) d.open = false; });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') d.open = false; });
    // Keep the menu inside the viewport whichever side of the header the button sits on.
    function place() {
      var pad = 8, vw = document.documentElement.clientWidth, vh = window.innerHeight;
      nav.style.left = ''; nav.style.right = '0px'; nav.style.top = ''; nav.style.bottom = '';
      var r = nav.getBoundingClientRect();
      if (r.left < pad) { nav.style.right = 'auto'; nav.style.left = '0px'; r = nav.getBoundingClientRect(); }
      if (r.right > vw - pad) nav.style.left = ((parseFloat(nav.style.left) || 0) - (r.right - (vw - pad))) + 'px';
      if (r.left < pad) nav.style.left = ((parseFloat(nav.style.left) || 0) + (pad - r.left)) + 'px';
      if (r.bottom > vh - pad && r.top > r.height + pad * 2) { nav.style.top = 'auto'; nav.style.bottom = 'calc(100% + 4px)'; }
    }
    d.addEventListener('toggle', function () { if (d.open) place(); });
    el.appendChild(d);
  };

  /* ---------- Script loader: local copy first, CDN fallback ---------- */
  RK.loadScript = function (localSrc, cdnSrc) {
    function add(src) {
      return new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    return add(localSrc).catch(function () { return cdnSrc ? add(cdnSrc) : Promise.reject(new Error('load ' + localSrc)); });
  };
})();
