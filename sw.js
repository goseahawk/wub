// Service worker for wubb:
//  • makes the app installable and lets the app shell open offline
//  • serves songs the listener has downloaded (see the download button),
//    including HTTP Range requests, which audio elements need for seeking
const CACHE = "wubb-shell-v24";
const SONGS = "wubb-songs"; // downloaded songs; kept across app updates
const SHELL = ["./", "index.html", "style.css", "app.js", "album.js", "install.js", "assets/cover.jpg", "assets/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== SONGS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function song(req) {
  const cache = await caches.open(SONGS);
  const hit = await cache.match(req.url);
  if (!hit) return fetch(req); // not downloaded: stream from the network

  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
  if (!m) return hit;

  // The browser asked for part of the file; answer with a 206 slice.
  const blob = await hit.blob();
  const size = blob.size;
  let start, end;
  if (m[1] === "") { start = Math.max(0, size - Number(m[2])); end = size - 1; }       // "bytes=-N"
  else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (!(start < size) || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": hit.headers.get("Content-Type") || "audio/mpeg",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/songs/")) { e.respondWith(song(req)); return; }
  // Everything else: network first so updates show up right away; cache when offline.
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
  );
});
