// "Get App" button: installs wubb as an app (Home Screen on phones, its own window on
// computers). Hidden once installed, and in desktop Firefox, which can't install web apps.
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const btn = $("installBtn");
  const sheet = $("installSheet");
  const steps = $("sheetSteps");

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isPhone = (isIOS || isAndroid) && matchMedia("(pointer: coarse)").matches;
  const isFirefoxDesktop = /Firefox\//.test(ua) && !isIOS && !isAndroid;
  const isEdge = /Edg\//.test(ua);
  const isMacSafari = /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua) && !isIOS;
  const installed = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  // Other scripts (the download button) ask this: on a phone, is the app still
  // just a browser tab? prompt() then does exactly what the "Get App" button does.
  window.wubbInstall = {
    needsInstall: () => isPhone && !installed(),
    prompt: () => {},
  };

  if (installed() || (!isPhone && isFirefoxDesktop)) return;

  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; });
  window.addEventListener("appinstalled", () => { btn.hidden = true; deferred = null; });
  btn.hidden = false;

  const shareIcon = '<svg viewBox="0 0 24 24"><path d="M12 2 7.5 6.5l1.4 1.4L11 5.8V15h2V5.8l2.1 2.1 1.4-1.4zM5 10v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10h-3v2h1v8H7v-8h1v-2z"/></svg>';
  const plusIcon = '<svg viewBox="0 0 24 24"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h14V5zm6 3h2v3h3v2h-3v3h-2v-3H8v-2h3z"/></svg>';
  const pageMenuIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6.5h16M4 12h14M4 17.5h9"/></svg>';
  const dotsIcon = '<svg viewBox="0 0 24 24"><path d="M12 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>';

  // A screenshot with one row lit up, outlined and labelled "Tap this".
  // ring = [left, top, width, height] of that row, in % of the image.
  const shot = (src, w, h, alt, [x, y, rw, rh]) =>
    `<span class="shot" style="--x:${x}%;--y:${y}%;--w:${rw}%;--h:${rh}%">` +
      `<img src="${src}" width="${w}" height="${h}" alt="${alt}" />` +
      `<span class="shot-ring" aria-hidden="true"></span>` +
      `<span class="shot-tag" aria-hidden="true">Tap this</span>` +
    `</span>`;

  function instructions() {
    if (isIOS) {
      const safari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
      return [
        safari
          ? `Tap the ${pageMenuIcon} button at the left of the address bar. In the menu that opens, tap <b>Share</b> ${shareIcon}.` +
            shot("assets/ios-page-menu.jpg", 720, 533, "Safari's page menu, with Share near the top", [1.2, 34.2, 97.6, 21.6]) +
            `<span class="step-note">On an older iPhone, just tap ${shareIcon} in the toolbar at the bottom of the screen.</span>`
          : `Tap the <b>Share</b> button ${shareIcon} next to the address bar.`,
        `<b>Scroll down</b> in the menu that pops up. The option you need is near the bottom, so it's usually hidden at first.` +
          `<span class="scroll-cue" aria-hidden="true"><i></i><i></i><i></i></span>`,
        `Tap <b>Add to Home Screen</b> ${plusIcon}. It looks like this:` +
          shot("assets/ios-share-sheet.jpg", 720, 482, "The iPhone share menu, with Add to Home Screen at the bottom of the list", [3.2, 77.6, 93.6, 21]) +
          `<span class="step-note">Not in the list? Tap <b>View More</b> in the row of round buttons above it, then scroll down again.</span>`,
        `Tap <b>Add</b>. wubb will appear on your Home Screen.`,
      ];
    }
    if (isAndroid) {
      return [
        `Tap the browser menu ${dotsIcon} at the top right.`,
        `Tap <b>Add to Home screen</b> or <b>Install app</b>.`,
        `Tap <b>Install</b>. wubb will appear on your Home Screen.`,
      ];
    }
    // Computers
    if (isMacSafari) {
      return [
        `In the menu bar at the top of the screen, click <b>File</b>.`,
        `Click <b>Add to Dock…</b>`,
        `Click <b>Add</b>. wubb will open from your Dock like any other app.` +
          `<span class="step-note">Needs macOS Sonoma or newer.</span>`,
      ];
    }
    if (isEdge) {
      return [
        `Click the <b>…</b> menu at the top right of the browser.`,
        `Choose <b>Apps</b>, then <b>Install this site as an app</b>.`,
        `Click <b>Install</b>. wubb will open in its own window, with a shortcut on your computer.`,
      ];
    }
    return [
      `Click the install icon at the right end of the address bar, or open the browser menu ${dotsIcon} at the top right.`,
      `Click <b>Install wubb…</b> In newer versions of Chrome it's under <b>Cast, save, and share</b>.`,
      `Click <b>Install</b>. wubb will open in its own window, with a shortcut on your computer.`,
    ];
  }

  const openSheet = () => {
    $("sheetTitle").textContent = isIOS || isAndroid ? "Add wubb to your Home Screen" : "Install wubb on your computer";
    steps.innerHTML = instructions().map((s) => `<li><span>${s}</span></li>`).join("");
    sheet.hidden = false;
  };
  const closeSheet = () => { sheet.hidden = true; };

  const startInstall = async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      if (outcome === "accepted") btn.hidden = true;
      return;
    }
    openSheet();
  };
  btn.addEventListener("click", startInstall);
  window.wubbInstall.prompt = startInstall;
  $("sheetClose").addEventListener("click", closeSheet);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(); });
})();
