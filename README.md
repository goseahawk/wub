# wubb

A music streaming–style web app for one album: **wubb** by **wubb**.

Plain HTML/CSS/JS — no build step.

## Adding the songs

1. Put the audio files in `songs/` (mp3, m4a, ogg, wav, flac all work in modern browsers).
2. Edit `album.js` and list each track in order with its title and file path:
   ```js
   { title: "Song Name", file: "songs/01-song-name.mp3" },
   ```
   Durations and the album length are read from the files automatically.
3. To change the cover, replace `assets/cover.jpg` (square, about 1000×1000) and regenerate the `assets/icon-*.png` app icons.

## Running it

```bash
python3 -m http.server 8000
```
Then open http://localhost:8000. It can be hosted on any static host (GitHub Pages, Netlify, etc.).

## Features

- Album page with track list, total length, and now-playing equalizer
- Player bar: play/pause, previous/next, shuffle, repeat (all / one), touch-friendly scrubbing, volume/mute
- Offline mode: the download button (next to shuffle) saves the album to the device; the app and downloaded songs then work with no connection (`sw.js`)
- Now Playing screen: tap the player bar (swipe down or tap the arrow to close)
- Lock-screen / headphone media controls
- Keyboard: Space play/pause · ←/→ seek 5s · Shift+←/→ prev/next · ↑/↓ volume · S shuffle · R repeat · M mute
- Works on phones, and feels like an app when installed:
  reopens on the last song at the same spot, no bounce or pull-to-refresh, buttons press in when tapped,
  status bar blends with the page, progress bar and scrubbing on the lock screen,
  a launch screen on iPhone (`assets/splash/`), and an Android icon that suits any shape (`assets/icon-maskable-512.png`)

## Hosting on GitHub Pages

Settings → Pages → Build and deployment → Source: **Deploy from a branch**, pick the branch and `/ (root)`, Save.
The site appears at `https://<user>.github.io/<repo>/` within a minute or two, and redeploys on every push.

## Get App (install to the Home Screen)

On phones there's a **Get App** button next to the shuffle button. On Android it opens the
browser's install prompt; on iPhone it shows step-by-step instructions. Once installed, wubb opens
full screen like an app, and the button no longer shows. (`manifest.webmanifest`, `sw.js`, `install.js`)
