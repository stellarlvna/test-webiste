# soul.exe — lvnaris’ room (desktop prototype)

Plain HTML / CSS / JS. No build step, no dependencies. Relative paths, so it works on GitHub Pages.

## Files

```
index.html
styles.css
script.js
assets/
  desktop-bg.png    1600×900 (or 3200×1800) desktop wallpaper only: no cartridge, console or text
  console.png       transparent PNG of the whole console, exported at 824 px wide (2× of 412)
  cartridge.png     transparent PNG, 298×344 (2× of 149×172)
  room-bg.png       1600×900 (or 3200×1800) bedroom only: no title or menu text
  card-easy.png     ≈ 490×460 (shown at about 245×230)
  card-normal.png   same
  card-hard.png     same
  card-custom.png   same (pixel sparkles; rendered with crisp scaling)
```

**The images currently in `assets/` are placeholders** with these exact names. Overwrite them with your artwork.

Notes on the artwork:
- `room-bg.png` must be 16:9 so the zoom through the console display lines up.
- Pixel art is drawn with `image-rendering: pixelated`. Export at native size or an integer multiple (1×, 2×, 3×) to keep it crisp.
- `console.png` must include the screen area. If its screen sits in a different spot, adjust `--lcd-x`, `--lcd-y`, `--lcd-w`, `--lcd-h` at the top of `styles.css` (fractions of the console's width). Console and cartridge placement are the `.console` and `.cartridge` rules; the close-up position is `CLOSEUP` in `script.js`.

## Run locally

Either double-click `index.html`, or from this folder:

```
python3 -m http.server 8000
```

then open http://localhost:8000. Fonts (Pixelify Sans, Playfair Display, Dosis) load from Google Fonts, so you need to be online, or swap the `--font-*` variables for your own font files.

To reset the saved checkpoint (so Continue is disabled again): clear `soulexe.checkpoint` from the browser's local storage.

## Where things live

- `script.js` section 1: asset paths (`ASSETS`), timings, menu items (`MENU`), card copy and images (`DIFFICULTIES`).
- `script.js` section 2: the single `state` object (`screen`, `busy`, `modal`, …).
- `script.js` section 5: `TRANSITIONS`, a map of `'from>to'` to the function that animates it.

## Adding the next page

1. Make the page (for example `moons-brew.html`) next to `index.html`.
2. In `DIFFICULTIES`, add `page: 'moons-brew.html'` to that card.
3. In `openProject()`, uncomment the line `if (d.page) { window.location.href = d.page; return; }`.

For an in-site screen instead of a separate file: add a `<section data-screen="name">` to `index.html`, register it in `SCREENS`, add its resting state to `snapTo()`, and add `'difficulty>name'` and `'name>difficulty'` entries to `TRANSITIONS`.
