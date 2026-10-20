#!/usr/bin/env python3
"""Turns the numbered 1366x768 export layers into the website's assets/ files.

Usage:  python3 tools/prepare_assets.py path/to/folder-with-1.png-to-14.png

* Full-canvas backgrounds are copied untouched.
* Everything else is trimmed to its visible bounds (pixels with alpha > 8).
  Trimming only removes empty transparent margins: colours, alpha and pixel
  data inside the box are not modified.
Needs: pip install pillow
"""
import sys, os
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")

# source number -> (output file, trim?)
MAP = {
    1:  ("desktop-bg.png", False),          # start screen wallpaper (79% flat alpha: designed to sit on white)
    2:  ("console.png", True),
    3:  ("cartridge.png", True),
    4:  ("room-bg.png", False),
    5:  ("card-easy.png", True),
    6:  ("card-hard.png", True),
    7:  ("card-normal.png", True),
    8:  ("card-custom.png", True),
    9:  ("gallery/error-popup.png", True),
    10: ("gallery/loading-dialog.png", True),
    11: ("gallery/desktop.png", False),     # wallpaper + shortcut icons + taskbar (baked)
    12: ("gallery/explorer-frame.png", True),
    13: ("gallery/icon-folder.png", True),
    14: ("gallery/icon-png.png", True),
}

for n, (name, trim) in MAP.items():
    im = Image.open(os.path.join(SRC, f"{n}.png")).convert("RGBA")
    box = None
    if trim:
        box = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        im = im.crop(box)
    dest = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    im.save(dest, optimize=True)
    print(f"{n:>2}.png -> assets/{name:28s} {im.size[0]}x{im.size[1]}" + (f"  (trimmed from {box})" if box else ""))
