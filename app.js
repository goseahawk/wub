(() => {
  "use strict";

  const album = window.WUB_ALBUM;
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => document.querySelectorAll(sel);
  const audio = $("audio");

  const store = {
    get(k, d) { try { const v = localStorage.getItem("wub:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("wub:" + k, JSON.stringify(v)); } catch {} },
  };

  const state = {
    queue: [],              // track indices in play order
    pos: -1,                // position in queue
    current: -1,            // album track index playing
    shuffle: store.get("shuffle", false),
    repeat: store.get("repeat", "off"), // off | all | one
    durations: {},
    missing: new Set(),
    selected: -1,
    downloaded: new Set(),  // track indices saved on this device
    downloading: false,
  };

  const tracks = album.tracks.map((t, i) => ({ ...t, src: encodeURI(t.file), index: i, artist: t.artist || album.artist }));

  // ── helpers ──────────────────────────────────
  const fmt = (s) => {
    if (!isFinite(s) || s < 0) return "–:––";
    s = Math.floor(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  };
  const totalLength = () => {
    const secs = Object.values(state.durations).reduce((a, b) => a + b, 0);
    if (!secs) return "";
    const m = Math.round(secs / 60);
    return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min ${Math.round(secs % 60)} sec`;
  };
  let toastTimer;
  const toast = (msg) => {
    document.querySelector(".toast")?.remove();
    const el = document.createElement("div");
    el.className = "toast"; el.textContent = msg;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2600);
  };
  const playable = (i) => navigator.onLine || state.downloaded.has(i);
  const setPct = (el) => {
    const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty("--pct", pct + "%");
  };

  // Probe each file for duration (and existence) without downloading it all.
  function probe(t) {
    const a = new Audio();
    a.preload = "metadata";
    a.addEventListener("loadedmetadata", () => { state.durations[t.index] = a.duration; renderDurations(); });
    a.addEventListener("error", () => { if (navigator.onLine) state.missing.add(t.index); renderList(); });
    a.src = t.src;
  }
  tracks.forEach(probe);

  // ── rendering ───────────────────────────────
  function renderHeader() {
    $("heroTitle").textContent = album.title;
    $("heroCover").src = album.cover;
    const n = tracks.length;
    const len = totalLength();
    $("heroSub").innerHTML =
      `<img src="${album.cover}" alt="" style="width:24px;height:24px;border-radius:50%">` +
      `<b>${escapeHtml(album.artist)}</b>` +
      `<span class="dot"></span><span>${album.year}</span>` +
      `<span class="dot"></span><span>${n} song${n === 1 ? "" : "s"}${len ? ", " + len : ""}</span>`;
    $("albumFoot").innerHTML =
      `${album.year}<br>© ${album.year} ${escapeHtml(album.artist)}<br>℗ ${album.year} ${escapeHtml(album.artist)}`;
  }

  const DL_OK = '<svg class="dl-ok" viewBox="0 0 24 24" fill="currentColor" aria-label="Downloaded"><path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM10.4 16.4l-4-4 1.4-1.4 2.6 2.6 5.8-5.8 1.4 1.4z"/></svg>';

  function renderList() {
    const body = $("tlBody");
    body.innerHTML = "";
    tracks.forEach((t, i) => {
      const li = document.createElement("li");
      li.className = "track";
      li.dataset.index = t.index;
      if (t.index === state.current) li.classList.add("current");
      if (t.index === state.current && !audio.paused) li.classList.add("is-playing");
      if (t.index === state.selected) li.classList.add("selected");
      if (state.missing.has(t.index)) li.classList.add("missing");
      if (!playable(t.index)) li.classList.add("unavailable");
      li.innerHTML = `
        <span class="c-num">
          <span class="num-text">${i + 1}</span>
          <span class="eq"><i></i><i></i><i></i></span>
          <button class="row-play" aria-label="Play ${escapeHtml(t.title)}">
            <svg viewBox="0 0 24 24"><path d="${t.index === state.current && !audio.paused ? "M6 4h4v16H6zM14 4h4v16h-4z" : "M7 4v16l13-8z"}"/></svg>
          </button>
        </span>
        <span class="c-title">
          <div class="t-title">${escapeHtml(t.title)}</div>
          <div class="t-artist">${escapeHtml(t.artist)}${state.missing.has(t.index) ? " · file not found" : !playable(t.index) ? " · not downloaded" : ""}</div>
        </span>
        <span class="c-dur">${state.downloaded.has(t.index) ? DL_OK : ""}<span class="dur-text">${fmt(state.durations[t.index])}</span></span>`;
      body.appendChild(li);
    });
    renderHeader();
  }

  function renderDurations() {
    document.querySelectorAll(".track").forEach((li) => {
      li.querySelector(".dur-text").textContent = fmt(state.durations[li.dataset.index]);
    });
    renderHeader();
  }

  function renderPlayState() {
    const playing = !audio.paused;
    $$(".js-play").forEach((b) => {
      b.classList.toggle("playing", playing);
      b.setAttribute("aria-label", playing ? "Pause" : "Play");
    });
    $("bigPlay").classList.toggle("playing", playing);
    renderList();
    const t = tracks[state.current];
    document.title = t && playing ? `${t.title} • ${t.artist}` : "wubb";
  }

  function renderNow() {
    const t = tracks[state.current];
    $$(".js-title").forEach((el) => { el.textContent = t ? t.title : "—"; });
    $$(".js-artist").forEach((el) => { el.textContent = t ? t.artist : album.artist; });
    $("npAlbum").textContent = album.title;
    $("npCover").src = album.cover;
    document.body.classList.toggle("has-track", !!t);
  }

  function renderModes() {
    $$(".js-shuffle").forEach((b) => b.classList.toggle("on", state.shuffle));
    $$(".js-repeat").forEach((b) => {
      b.classList.toggle("on", state.repeat !== "off");
      b.classList.toggle("one", state.repeat === "one");
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ── queue & playback ────────────────────────
  function buildQueue(startIndex) {
    const order = tracks.map((t) => t.index);
    if (state.shuffle) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      if (startIndex != null) {
        order.splice(order.indexOf(startIndex), 1);
        order.unshift(startIndex);
      }
    }
    state.queue = order;
    state.pos = startIndex != null ? order.indexOf(startIndex) : 0;
  }

  function load(index, autoplay = true) {
    const t = tracks[index];
    if (!t) return;
    state.current = index;
    audio.src = t.src;
    renderNow();
    updateMediaSession();
    if (autoplay) audio.play().catch(() => {});
    renderPlayState();
  }

  function playFrom(index) {
    if (!playable(index)) return toast("Not downloaded. Connect to the internet to play this song.");
    buildQueue(index);
    load(state.queue[state.pos]);
  }

  function togglePlay() {
    if (state.current === -1) {
      const first = tracks.find((t) => playable(t.index));
      if (!first) return toast("You're offline. Download the album to play it offline.");
      buildQueue(state.shuffle && navigator.onLine ? null : first.index);
      return load(state.queue[state.pos]);
    }
    audio.paused ? audio.play().catch(() => {}) : audio.pause();
  }

  function next(auto = false) {
    if (!state.queue.length) return;
    if (auto && state.repeat === "one") { audio.currentTime = 0; audio.play(); return; }
    let p = state.pos + 1;
    if (p >= state.queue.length) {
      if (state.repeat === "off" && auto) { audio.pause(); audio.currentTime = 0; renderPlayState(); return; }
      if (state.shuffle) { buildQueue(null); p = 0; } else p = 0;
    }
    // Offline: skip songs that haven't been downloaded.
    for (let n = 0; n < state.queue.length && !playable(state.queue[p]); n++) p = (p + 1) % state.queue.length;
    if (!playable(state.queue[p])) return toast("No downloaded songs to play offline.");
    state.pos = p;
    load(state.queue[p]);
  }

  function prev() {
    if (audio.currentTime > 3 || state.pos <= 0) { audio.currentTime = 0; return; }
    let p = state.pos - 1;
    while (p > 0 && !playable(state.queue[p])) p--;
    if (!playable(state.queue[p])) { audio.currentTime = 0; return; }
    state.pos = p;
    load(state.queue[p]);
  }

  // ── media session (lock screen / headphone keys) ──
  function updateMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const t = tracks[state.current];
    if (!t) return;
    const cover = new URL(album.cover, location.href).href;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title, artist: t.artist, album: album.title,
      artwork: [{ src: cover, sizes: "1000x1000", type: "image/jpeg" }],
    });
  }
  if ("mediaSession" in navigator) {
    const ms = navigator.mediaSession;
    ms.setActionHandler("play", () => audio.play());
    ms.setActionHandler("pause", () => audio.pause());
    ms.setActionHandler("previoustrack", prev);
    ms.setActionHandler("nexttrack", () => next());
    try { ms.setActionHandler("seekto", (e) => { audio.currentTime = e.seekTime; }); } catch {}
  }

  // ── audio events ─────────────────────────────
  // Draws the progress everywhere it appears (player bar, mini bar, Now Playing).
  let scrubbing = false;
  function drawProgress(frac, secs) {
    const pct = Math.max(0, Math.min(1, frac)) * 100 + "%";
    $$(".scrub").forEach((el) => {
      el.style.setProperty("--pct", pct);
      el.setAttribute("aria-valuenow", Math.round(frac * 100));
    });
    document.querySelector(".mini-progress i").style.width = pct;
    $$(".js-cur").forEach((el) => { el.textContent = fmt(secs); });
  }
  audio.addEventListener("play", renderPlayState);
  audio.addEventListener("pause", renderPlayState);
  audio.addEventListener("ended", () => next(true));
  audio.addEventListener("loadedmetadata", () => {
    $$(".js-dur").forEach((el) => { el.textContent = fmt(audio.duration); });
    state.durations[state.current] = audio.duration;
  });
  audio.addEventListener("timeupdate", () => {
    if (scrubbing || !audio.duration) return;
    drawProgress(audio.currentTime / audio.duration, audio.currentTime);
  });
  audio.addEventListener("error", () => {
    if (!audio.src) return;
    const t = tracks[state.current];
    if (!navigator.onLine) {
      toast("You're offline and this song isn't downloaded.");
    } else {
      state.missing.add(state.current);
      toast(`Couldn't play "${t?.title}" — is ${t?.file} in place?`);
    }
    renderPlayState();
  });

  // ── UI events ─────────────────────────────────
  $$(".js-play").forEach((b) => { b.onclick = (e) => { e.stopPropagation(); togglePlay(); }; });
  $("bigPlay").onclick = togglePlay;
  $$(".js-next").forEach((b) => { b.onclick = () => next(); });
  $$(".js-prev").forEach((b) => { b.onclick = prev; });
  const toggleShuffle = () => {
    state.shuffle = !state.shuffle;
    store.set("shuffle", state.shuffle);
    if (state.current !== -1) buildQueue(state.current);
    renderModes();
  };
  $$(".js-shuffle").forEach((b) => { b.onclick = toggleShuffle; });
  const cycleRepeat = () => {
    state.repeat = { off: "all", all: "one", one: "off" }[state.repeat];
    store.set("repeat", state.repeat);
    renderModes();
  };
  $$(".js-repeat").forEach((b) => { b.onclick = cycleRepeat; });

  // Scrubber: works with mouse, touch and pen. The whole padded bar is the
  // touch target, and you can drag anywhere along it (not just the knob).
  $$(".scrub").forEach((el) => {
    const bar = el.querySelector(".scrub-track");
    let active = null, frac = 0;
    const fracAt = (x) => {
      const r = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (x - r.left) / r.width));
    };
    el.addEventListener("pointerdown", (e) => {
      if (!audio.duration || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.preventDefault();
      active = e.pointerId; scrubbing = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add("active");
      frac = fracAt(e.clientX);
      drawProgress(frac, frac * audio.duration);
    });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerId !== active) return;
      frac = fracAt(e.clientX);
      drawProgress(frac, frac * audio.duration);
    });
    const finish = (e) => {
      if (e.pointerId !== active) return;
      active = null;
      el.classList.toggle("active", false);
      if (audio.duration) audio.currentTime = frac * audio.duration;
      scrubbing = false;
    };
    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
    el.addEventListener("click", (e) => e.stopPropagation());
  });

  // ── Now Playing screen ───────────────────────
  const np = $("np"), npInner = $("npInner");
  const isNpOpen = () => !np.hidden;
  function openNp() {
    if (state.current === -1 || isNpOpen()) return;
    np.hidden = false;
    document.body.classList.add("np-open");
    history.pushState({ np: true }, "");
  }
  function closeNp(fromHistory = false) {
    if (!isNpOpen()) return;
    np.classList.add("closing");
    setTimeout(() => {
      np.hidden = true;
      np.classList.toggle("closing", false);
      npInner.style.transform = "";
    }, 220);
    document.body.classList.toggle("np-open", false);
    if (!fromHistory && history.state && history.state.np) history.back();
  }
  $("openNow").addEventListener("click", openNp);
  $("openNow").addEventListener("keydown", (e) => { if (e.key === "Enter") openNp(); });
  $("npClose").onclick = () => closeNp();
  window.addEventListener("popstate", () => closeNp(true));

  // Swipe down to close (touch only, and not while scrubbing).
  let swipeY = null;
  npInner.addEventListener("touchstart", (e) => {
    if (e.target.closest(".scrub, button")) return;
    swipeY = e.touches[0].clientY;
  }, { passive: true });
  npInner.addEventListener("touchmove", (e) => {
    if (swipeY == null) return;
    const dy = Math.max(0, e.touches[0].clientY - swipeY);
    npInner.style.transition = "none";
    npInner.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  npInner.addEventListener("touchend", (e) => {
    if (swipeY == null) return;
    const dy = e.changedTouches[0].clientY - swipeY;
    swipeY = null;
    npInner.style.transition = "";
    if (dy > 120) closeNp(); else npInner.style.transform = "";
  });

  const vol = $("volume");
  let lastVol = store.get("volume", 80);
  const applyVol = (v) => {
    vol.value = v; setPct(vol);
    audio.volume = v / 100;
    $("volIcon").setAttribute("d", v == 0
      ? "M3 9v6h4l5 5V4L7 9zm13.6 3 2.7-2.7-1.4-1.4-2.7 2.7-2.7-2.7-1.4 1.4 2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z"
      : "M3 9v6h4l5 5V4L7 9zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z");
    store.set("volume", Number(v));
  };
  vol.addEventListener("input", () => { applyVol(vol.value); if (vol.value > 0) lastVol = vol.value; });
  $("muteBtn").onclick = () => applyVol(Number(vol.value) === 0 ? (lastVol || 80) : 0);
  applyVol(lastVol);

  $("tlBody").addEventListener("click", (e) => {
    const li = e.target.closest(".track");
    if (!li) return;
    const index = Number(li.dataset.index);
    if (e.target.closest(".row-play")) {
      return index === state.current ? togglePlay() : playFrom(index);
    }
    state.selected = index;
    document.querySelectorAll(".track.selected").forEach((el) => el.classList.remove("selected"));
    li.classList.add("selected");
  });
  $("tlBody").addEventListener("dblclick", (e) => {
    const li = e.target.closest(".track");
    if (!li) return;
    playFrom(Number(li.dataset.index));
  });
  // On touch screens a single tap plays the row.
  if (matchMedia("(hover: none)").matches) {
    $("tlBody").addEventListener("click", (e) => {
      const li = e.target.closest(".track");
      if (!li || e.target.closest(".row-play")) return;
      playFrom(Number(li.dataset.index));
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea") && e.target.type !== "range") return;
    if (e.key === "Escape") return closeNp();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case " ": e.preventDefault(); togglePlay(); break;
      case "ArrowRight": if (e.shiftKey) next(); else audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5); e.preventDefault(); break;
      case "ArrowLeft": if (e.shiftKey) prev(); else audio.currentTime = Math.max(0, audio.currentTime - 5); e.preventDefault(); break;
      case "ArrowUp": e.preventDefault(); applyVol(Math.min(100, Number(vol.value) + 5)); break;
      case "ArrowDown": e.preventDefault(); applyVol(Math.max(0, Number(vol.value) - 5)); break;
      case "s": case "S": toggleShuffle(); break;
      case "r": case "R": cycleRepeat(); break;
      case "m": case "M": $("muteBtn").click(); break;
      case "Enter": if (state.selected >= 0) playFrom(state.selected); break;
    }
  });

  // ── Offline: download songs to this device ──────
  const SONGS_CACHE = "wubb-songs"; // read by sw.js, which serves these files
  const canOffline = "caches" in window && "serviceWorker" in navigator;
  const dlBtn = $("dlBtn");
  const songUrl = (t) => new URL(t.src, location.href).href;

  function renderDlBtn(pct = 0) {
    if (!canOffline) return;
    dlBtn.hidden = false;
    const all = state.downloaded.size === tracks.length;
    // Spell it out whenever there's room (installed app, or a computer); a phone
    // browser tab keeps the compact icon next to the Add to Home Screen button.
    dlBtn.classList.toggle("labeled", !(window.wubbInstall && window.wubbInstall.needsInstall()));
    dlBtn.querySelector(".dl-text").textContent = state.downloading ? `Downloading… ${Math.round(pct)}%`
      : all ? "Available offline"
      : state.downloaded.size ? "Finish download"
      : "Download for offline";
    dlBtn.classList.toggle("busy", state.downloading);
    dlBtn.classList.toggle("done", all && !state.downloading);
    dlBtn.style.setProperty("--p", pct + "%");
    dlBtn.querySelector(".dl-pct").textContent = Math.round(pct) + "%";
    const label = state.downloading ? "Downloading…"
      : all ? "Downloaded for offline listening. Tap to remove."
      : state.downloaded.size ? "Finish downloading for offline listening"
      : "Download for offline listening";
    dlBtn.title = label;
    dlBtn.setAttribute("aria-label", label);
  }

  async function refreshDownloads() {
    if (!canOffline) return;
    try {
      const cache = await caches.open(SONGS_CACHE);
      const have = new Set();
      for (const t of tracks) if (await cache.match(songUrl(t))) have.add(t.index);
      state.downloaded = have;
    } catch {}
    renderDlBtn();
    renderList();
  }

  async function downloadAll() {
    if (state.downloading) return;
    state.downloading = true;
    renderDlBtn(0);
    try {
      await navigator.serviceWorker.ready;
      const cache = await caches.open(SONGS_CACHE);
      const todo = tracks.filter((t) => !state.downloaded.has(t.index));
      for (let k = 0; k < todo.length; k++) {
        const t = todo[k];
        const res = await fetch(songUrl(t), { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const total = Number(res.headers.get("Content-Length")) || 0;
        const reader = res.body.getReader();
        const chunks = [];
        let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          got += value.length;
          if (total) renderDlBtn(((k + got / total) / todo.length) * 100);
        }
        await cache.put(songUrl(t), new Response(new Blob(chunks), {
          headers: { "Content-Type": res.headers.get("Content-Type") || "audio/mpeg" },
        }));
        state.downloaded.add(t.index);
        renderDlBtn(((k + 1) / todo.length) * 100);
        renderList();
      }
      try { navigator.storage?.persist?.(); } catch {}
      toast("Downloaded. wubb now plays offline.");
    } catch (err) {
      toast(err && err.name === "QuotaExceededError"
        ? "Not enough storage on this device."
        : "Download interrupted. Check your connection and try again.");
    } finally {
      state.downloading = false;
      renderDlBtn();
    }
  }

  async function removeDownloads() {
    try {
      const cache = await caches.open(SONGS_CACHE);
      await Promise.all(tracks.map((t) => cache.delete(songUrl(t))));
    } catch {}
    state.downloaded = new Set();
    renderDlBtn();
    renderList();
    toast("Removed downloads from this device.");
  }

  dlBtn.onclick = () => {
    if (state.downloading) return;
    // On phones, downloads only work from the installed web app (browsers can
    // clear a plain tab's saved songs). Otherwise, do what "Add to Home Screen" does.
    if (window.wubbInstall && window.wubbInstall.needsInstall()) return window.wubbInstall.prompt();
    if (state.downloaded.size === tracks.length) {
      if (confirm("Remove the downloaded songs from this device?")) removeDownloads();
    } else {
      downloadAll();
    }
  };

  window.addEventListener("offline", () => {
    toast("You're offline. Downloaded songs still play.");
    renderList();
  });
  window.addEventListener("online", () => {
    tracks.forEach((t) => { if (!(t.index in state.durations)) probe(t); });
    renderList();
  });

  // ── init ──────────────────────────────────────
  drawProgress(0, 0);
  renderModes();
  renderNow();
  renderList();
  renderPlayState();
  renderDlBtn();
  refreshDownloads();
})();
