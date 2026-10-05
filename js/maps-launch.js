// App-first navigation for user-clicked Google Maps links; href stays usable without JS.
(function (root) {
  'use strict';
  // https://developers.google.com/maps/documentation/urls/ios-urlscheme
  // https://developer.chrome.com/docs/android/intents
  function buildLaunch(href, navigator = {}) {
    let url;
    try { url = new URL(href); } catch (_) { return null; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['www.google.com', 'maps.google.com'].includes(url.hostname)) return null;
    const match = /^\/maps\/(search|dir)\/?$/.exec(url.pathname);
    const params = url.searchParams;
    if (!match || params.getAll('api').length !== 1 || params.get('api') !== '1') return null;
    const key = match[1] === 'search' ? 'query' : 'destination';
    const value = params.get(key);
    if (params.getAll(key).length !== 1 || !value || !value.trim()) return null;
    const mode = params.get('travelmode') || 'driving';
    if (key === 'destination' && !['driving', 'walking', 'transit', 'bicycling'].includes(mode)) return null;
    const ua = navigator.userAgent || '';
    const platform = /Android/i.test(ua) ? 'android'
      : /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : null;
    if (!platform) return null;
    const fallbackUrl = url.href;
    // Re-encode data rather than interpolating a query into the Intent control fragment.
    const appParams = key === 'query' ? { q: value } : { daddr: value, directionsmode: mode };
    const intentParams = key === 'query' ? { api: '1', query: value }
      : { api: '1', destination: value, travelmode: mode };
    const intentQuery = Object.entries(intentParams).map(([name, data]) => name + '=' + encodeURIComponent(data)).join('&');
    const appUrl = platform === 'ios' ? 'comgooglemaps://?' + new URLSearchParams(appParams)
      : 'intent://' + url.hostname + url.pathname + '?' + intentQuery +
        '#Intent;scheme=https;package=com.google.android.apps.maps;S.browser_fallback_url=' + encodeURIComponent(fallbackUrl) + ';end';
    return { platform, fallbackUrl, appUrl };
  }
  function install(win) {
    const doc = win && win.document;
    if (!doc || !doc.addEventListener) return function () {};
    let timer = null;
    function cancel() {
      if (timer !== null) win.clearTimeout(timer);
      timer = null;
      doc.removeEventListener('visibilitychange', onVisibility);
      win.removeEventListener('pagehide', cancel);
    }
    function onVisibility() {
      if (doc.visibilityState === 'hidden') cancel();
    }
    function onClick(event) {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      const anchor = target && typeof target.closest === 'function' ? target.closest('a[href]') : null;
      if (!anchor || anchor.hasAttribute('download')) return;
      const plan = buildLaunch(anchor.href, win.navigator);
      if (!plan) return;
      event.preventDefault();
      cancel();
      // Same-tab assignment avoids target=_blank opening a browser ahead of the app.
      if (plan.platform === 'ios') {
        doc.addEventListener('visibilitychange', onVisibility);
        win.addEventListener('pagehide', cancel);
        timer = win.setTimeout(function () {
          cancel();
          if (doc.visibilityState === 'visible') win.location.assign(plan.fallbackUrl);
        }, 1800);
      }
      // Android Chrome owns S.browser_fallback_url; a second timer would double-open it.
      try { win.location.assign(plan.appUrl); }
      catch (_) { cancel(); win.location.assign(plan.fallbackUrl); }
    }
    doc.addEventListener('click', onClick, true);
    return function () {
      cancel();
      doc.removeEventListener('click', onClick, true);
    };
  }
  const api = { buildLaunch, install };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.MapsLaunch = api;
    install(root);
  }
})(typeof window !== 'undefined' ? window : globalThis);
