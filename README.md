# wub site

A music streaming–style web app for one album: **wub** by **wub**.

Plain HTML/CSS/JS — no build step.

## Adding the songs

1. Put the audio files in `songs/` (mp3, m4a, ogg, wav, flac all work in modern browsers).
2. Edit `album.js` and list each track in order with its title and file path:
   ```js
   { title: "Song Name", file: "songs/01-song-name.mp3" },
   ```
   Durations and the album length are read from the files automatically.
3. To change the cover, replace `assets/cover.svg` (or point `cover` in `album.js` at a jpg/png).

## Running it

```bash
python3 -m http.server 8000
```
Then open http://localhost:8000. It can be hosted on any static host (GitHub Pages, Netlify, etc.).

## Features

- Album page with track list, total length, and now-playing equalizer
- Player bar: play/pause, previous/next, shuffle, repeat (all / one), seek, volume/mute
- Liked Songs (saved in your browser)
- Lock-screen / headphone media controls
- Keyboard: Space play/pause · ←/→ seek 5s · Shift+←/→ prev/next · ↑/↓ volume · S shuffle · R repeat · M mute
- Works on phones

## Hosting on GitHub Pages

Settings → Pages → Build and deployment → Source: **Deploy from a branch**, pick the branch and `/ (root)`, Save.
The site appears at `https://<user>.github.io/<repo>/` within a minute or two, and redeploys on every push.
