# soul.exe — lvnaris' room (desktop prototype)

Plain HTML / CSS / JS. No build step, no dependencies, no backend. Relative paths, so it works on GitHub Pages.

Flow: cartridge → console animation → room menu → **New Game** (difficulty cards) or **Gallery** (error popup → loading → desktop + Explorer).

## Files

```
index.html
styles.css
script.js
tools/prepare_assets.py     turns your numbered layers (1.png–14.png) into the files below
assets/
  desktop-bg.png            1366×768  start-screen wallpaper (was 1.png, flat 79% alpha, drawn over white)
  console.png               498×704   console (2.png)
  cartridge.png             466×535   cartridge (3.png)
  room-bg.png               1366×768  bedroom (4.png)
  card-easy.png             756×708   (5.png)
  card-hard.png             619×524   (6.png)
  card-normal.png           437×610   (7.png)
  card-custom.png           626×611   (8.png)
  gallery/
    error-popup.png         695×425   baked: title, triangle, text, OK, X   (9.png)
    loading-dialog.png      598×184   baked: title, full segmented bar, X   (10.png)
    desktop.png             1366×768  baked: wallpaper, shortcuts + labels, taskbar, clock (11.png)
    explorer-frame.png      860×655   baked: chrome, toolbar, sidebar, address/status text (12.png)
    icon-folder.png         577×449   (13.png)
    icon-png.png            413×532   (14.png)
```

No duplicates were found among the 14 layers (all unique). The five mockup screenshots are references only and are not used on the site.

## Where each asset is used

| File | Used for |
|---|---|
| `desktop-bg.png` | startup backdrop |
| `console.png`, `cartridge.png` | startup sequence; the LCD text sits over the console screen |
| `room-bg.png` | room menu, difficulty screen, and under the gallery error popup |
| `card-*.png` | difficulty cards |
| `gallery/error-popup.png` | error popup (real transparent OK / close buttons sit over the baked ones) |
| `gallery/loading-dialog.png` | loading window; a grey cover hides unfilled segments |
| `gallery/desktop.png` | gallery desktop; shortcut and taskbar hit areas sit over the baked icons |
| `gallery/explorer-frame.png` | Explorer window (9-slice, so it can maximise) |
| `gallery/icon-folder.png`, `icon-png.png` | file icons in the Explorer pane and the taskbar button |

Baked details are never redrawn: the shortcut labels, taskbar, clock, toolbar, menus and Go button are inert art. Address text and item count are live HTML drawn over small patches copied from the art itself.

## Config — all in `script.js`

- `ASSETS` — every image path, in one place. `GALLERY_ESSENTIALS` lists what the loader must fetch.
- `GALLERY.root` — the folder tree. Folders are `folder(name, [children])`, files are `file(name, src)`.
- `DESKTOP.shortcuts` / `DESKTOP.taskbar` — click areas in art pixels `[left, top, right, bottom]` on the 1366×768 canvas, and what each opens (`explorer` or `soon`).
- `LOADER_SEGMENTS`, `LOADER_END` — where each bar segment starts, in art pixels.
- `TIMING` — `loaderMin` (min. loading time), `loaderHold` (full-bar pause), `loaderTimeout`.
- `styles.css`, bottom block `GALLERY` — all gallery geometry, written as `calc(N * var(--u))` where `--u` is one art pixel.

## Adding your artwork to the gallery

Put images anywhere under `assets/` (for example `assets/gallery/wips/01-01.png`) and set the path in `GALLERY.root`:

```js
file('01.png', 'assets/gallery/wips/01-01.png')
```

`src: null` shows the filename and "Preview coming soon". Images are fitted without stretching.

To add folders or files, add entries to the tree. No other code changes are needed.

## Clean exports that would improve things

The current art works, but a few layers carry baked content. Clean exports would allow live text, hover/pressed states and a live clock:

1. `9`, `10`, `11`, `12` without baked text, buttons, icons, labels and clock (buttons as separate sprites).
2. Explorer frame without the address text and "0 objects".
3. Back/Forward as separate enabled and disabled sprites (currently mirrored/greyed from the art).
4. Export at 1600×900 (or 3200×1800) so nothing is resampled by ×1.1713.
5. `desktop-bg` as an opaque image instead of a flat 79% alpha.

Re-run the asset prep after replacing layers: `python3 tools/prepare_assets.py <folder containing 1.png … 14.png>`.

## Run locally

```
python3 -m http.server 8000
```

then open http://localhost:8000. Fonts load from Google Fonts, so go online or swap the `--font-*` variables.

Reset the saved checkpoint by clearing `soulexe.checkpoint` from local storage.

## Adding the next page

1. Make the page (for example `moons-brew.html`) next to `index.html`.
2. In `DIFFICULTIES`, add `page: 'moons-brew.html'` to that card.
3. In `openProject()`, uncomment `if (d.page) { window.location.href = d.page; return; }`.
