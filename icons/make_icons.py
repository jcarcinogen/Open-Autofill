#!/usr/bin/env python3
"""Render Open Autofill toolbar icons from icons/icon.svg."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "icons"
SVG = OUT / "icon.svg"


def main() -> None:
    rsvg = shutil.which("rsvg-convert")
    magick = shutil.which("magick")
    if not rsvg:
        raise SystemExit("rsvg-convert is required to render icons")
    master = OUT / "icon512.png"
    subprocess.run([rsvg, "-w", "512", "-h", "512", str(SVG), "-o", str(master)], check=True)
    for size in (16, 32, 48, 128):
        dest = OUT / f"icon{size}.png"
        if magick:
            subprocess.run(
                [magick, str(master), "-resize", f"{size}x{size}", str(dest)],
                check=True,
            )
        else:
            subprocess.run([rsvg, "-w", str(size), "-h", str(size), str(SVG), "-o", str(dest)], check=True)
        print("wrote", dest)


if __name__ == "__main__":
    main()
