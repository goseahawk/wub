// Add to Home Screen — shown on phones only, hidden once installed.
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
  const installed = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  if (!isPhone || installed()) return;

  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; });
  window.addEventListener("appinstalled", () => { btn.hidden = true; deferred = null; });
  btn.hidden = false;

  const shareIcon = '<svg viewBox="0 0 24 24"><path d="M12 2 7.5 6.5l1.4 1.4L11 5.8V15h2V5.8l2.1 2.1 1.4-1.4zM5 10v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V10h-3v2h1v8H7v-8h1v-2z"/></svg>';
  const plusIcon = '<svg viewBox="0 0 24 24"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h14V5zm6 3h2v3h3v2h-3v3h-2v-3H8v-2h3z"/></svg>';
  const pageMenuIcon = '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="6" height="4" rx="1"/><rect x="4" y="12" width="15" height="2" rx="1"/><rect x="4" y="17" width="11" height="2" rx="1"/></svg>';
  const dotsIcon = '<svg viewBox="0 0 24 24"><path d="M12 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>';

  function instructions() {
    if (isIOS) {
      const safari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
      return [
        safari
          ? `Tap the ${pageMenuIcon} button at the left of the address bar, then tap <b>Share</b> ${shareIcon}. (On older iPhones, just tap ${shareIcon} at the bottom.)`
          : `Tap the <b>Share</b> button ${shareIcon} next to the address bar.`,
        `Scroll down and tap <b>Add to Home Screen</b> ${plusIcon}.`,
        `Tap <b>Add</b>. wubb will appear on your Home Screen.`,
      ];
    }
    return [
      `Tap the browser menu ${dotsIcon} at the top right.`,
      `Tap <b>Add to Home screen</b> or <b>Install app</b>.`,
      `Tap <b>Install</b>. wubb will appear on your Home Screen.`,
    ];
  }

  const openSheet = () => {
    steps.innerHTML = instructions().map((s) => `<li><span>${s}</span></li>`).join("");
    sheet.hidden = false;
  };
  const closeSheet = () => { sheet.hidden = true; };

  btn.addEventListener("click", async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      if (outcome === "accepted") btn.hidden = true;
      return;
    }
    openSheet();
  });
  $("sheetClose").addEventListener("click", closeSheet);
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(); });
})();
