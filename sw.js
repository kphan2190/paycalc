/* Service worker for PayCalc.

   Its one job is to hold a copy of the app so a cold launch paints from disk
   instead of waiting on the network. Without it, iOS re-downloads the whole
   page every time it has evicted the home-screen app from memory, which is the
   few seconds of blank screen you get after not opening it for a while.

   VERSION is stamped by build.js from a hash of the built index.html, so each
   published build installs a fresh cache and deletes the previous one. Nothing
   here touches localStorage: punches, bills and settings are the page's, not
   the worker's, and are never cached, cleared or sent anywhere.             */
'use strict';

var VERSION = 'df271e5020ac';
var CACHE = 'paycalc-' + VERSION;
var ASSETS = ['./', './index.html'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      // Take over at once rather than waiting for every tab to close; the
      // activate handler below clears the old cache in the same breath.
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Cache first, then refresh in the background.

   Serving the cached copy is what makes the launch instant. The network copy
   that arrives a moment later is stored for next time, so a push lands on the
   following launch rather than this one -- the price of never waiting. With no
   connection the cached copy is simply the answer, and the app works offline. */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      var fresh = fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        // Offline: the cached copy is the answer, if we have one.
        return hit;
      });
      return hit || fresh;
    })
  );
});
