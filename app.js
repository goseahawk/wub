(() => {
  "use strict";

  const album = window.WUB_ALBUM;
  const $ = (id) => document.getElementById(id);
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
  const setPct = (el) => {
    const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty("--pct", pct + "%");
  };

  // Probe each file for duration (and existence) without downloading it all.
  tracks.forEach((t) => {
    const a = new Audio();
    a.preload = "metadata";
    a.addEventListener("loadedmetadata", () => { state.durations[t.index] = a.duration; renderDurations(); });
    a.addEventListener("error", () => { state.missing.add(t.index); renderList(); });
    a.src = t.src;
  });

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
          <div class="t-artist">${escapeHtml(t.artist)}${state.missing.has(t.index) ? " · file not found" : ""}</div>
        </span>
        <span class="c-dur">${fmt(state.durations[t.index])}</span>`;
      body.appendChild(li);
    });
    renderHeader();
  }

  function renderDurations() {
    document.querySelectorAll(".track").forEach((li) => {
      li.querySelector(".c-dur").textContent = fmt(state.durations[li.dataset.index]);
    });
    renderHeader();
  }

  function renderPlayState() {
    const playing = !audio.paused;
    $("playBtn").classList.toggle("playing", playing);
    $("playBtn").setAttribute("aria-label", playing ? "Pause" : "Play");
    $("bigPlay").classList.toggle("playing", playing);
    renderList();
    const t = tracks[state.current];
    document.title = t && playing ? `${t.title} • ${t.artist}` : "wubb";
  }

  function renderNow() {
    const t = tracks[state.current];
    $("nowTitle").textContent = t ? t.title : "—";
    $("nowArtist").textContent = t ? t.artist : album.artist;
  }

  function renderModes() {
    $("shuffleBtn").classList.toggle("on", state.shuffle);
    $("shuffleBtnTop").classList.toggle("on", state.shuffle);
    $("repeatBtn").classList.toggle("on", state.repeat !== "off");
    $("repeatBtn").classList.toggle("one", state.repeat === "one");
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
    buildQueue(index);
    load(state.queue[state.pos]);
  }

  function togglePlay() {
    if (state.current === -1) {
      if (!tracks.length) return;
      buildQueue(state.shuffle ? null : 0);
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
    state.pos = p;
    load(state.queue[p]);
  }

  function prev() {
    if (audio.currentTime > 3 || state.pos <= 0) { audio.currentTime = 0; return; }
    state.pos -= 1;
    load(state.queue[state.pos]);
  }

  // ── media session (lock screen / headphone keys) ──
  function updateMediaSession() {
    if (!("mediaSession" in navigator)) return;
    const t = tracks[state.current];
    if (!t) return;
    const cover = new URL(album.cover, location.href).href;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title, artist: t.artist, album: album.title,
      artwork: [{ src: cover, sizes: "600x600", type: "image/svg+xml" }],
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
  let seeking = false;
  audio.addEventListener("play", renderPlayState);
  audio.addEventListener("pause", renderPlayState);
  audio.addEventListener("ended", () => next(true));
  audio.addEventListener("loadedmetadata", () => {
    $("durTime").textContent = fmt(audio.duration);
    state.durations[state.current] = audio.duration;
  });
  audio.addEventListener("timeupdate", () => {
    if (seeking || !audio.duration) return;
    const seek = $("seek");
    seek.value = (audio.currentTime / audio.duration) * 1000;
    setPct(seek);
    $("curTime").textContent = fmt(audio.currentTime);
  });
  audio.addEventListener("error", () => {
    if (!audio.src) return;
    const t = tracks[state.current];
    state.missing.add(state.current);
    toast(`Couldn't play "${t?.title}" — is ${t?.file} in place?`);
    renderPlayState();
  });

  // ── UI events ─────────────────────────────────
  $("playBtn").onclick = togglePlay;
  $("bigPlay").onclick = togglePlay;
  $("nextBtn").onclick = () => next();
  $("prevBtn").onclick = prev;
  const toggleShuffle = () => {
    state.shuffle = !state.shuffle;
    store.set("shuffle", state.shuffle);
    if (state.current !== -1) buildQueue(state.current);
    renderModes();
  };
  $("shuffleBtn").onclick = toggleShuffle;
  $("shuffleBtnTop").onclick = toggleShuffle;
  const cycleRepeat = () => {
    state.repeat = { off: "all", all: "one", one: "off" }[state.repeat];
    store.set("repeat", state.repeat);
    renderModes();
  };
  $("repeatBtn").onclick = cycleRepeat;

  const seek = $("seek");
  seek.addEventListener("input", () => {
    seeking = true; setPct(seek);
    if (audio.duration) $("curTime").textContent = fmt((seek.value / 1000) * audio.duration);
  });
  seek.addEventListener("change", () => {
    if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration;
    seeking = false;
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

  // ── init ──────────────────────────────────────
  setPct(seek);
  renderModes();
  renderNow();
  renderList();
  renderPlayState();
})();
