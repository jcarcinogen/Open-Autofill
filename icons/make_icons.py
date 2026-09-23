#!/usr/bin/env python3
"""Render store and optically sized toolbar icons with librsvg."""
from __future__ import annotations

import shutil
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path(__file__).resolve().parent
SVG = OUT / "icon.svg"


def main() -> None:
    rsvg = shutil.which("rsvg-convert")
    if not rsvg:
        raise SystemExit("rsvg-convert is required to render icons")
    for size in (16, 32, 48, 128, 512):
        source = ET.parse(OUT / "toolbar16.svg" if size == 16 else SVG).getroot()
        if size in (32, 48):
            # Toolbar artwork gets a 1px inset; store artwork keeps its 16px inset.
            source.set("viewBox", "16 16 96 96")
            source.set("x", "1")
            source.set("y", "1")
            source.set("width", str(size - 2))
            source.set("height", str(size - 2))
            wrapper = ET.Element("{http://www.w3.org/2000/svg}svg", {"viewBox": f"0 0 {size} {size}"})
            wrapper.append(source)
            source = wrapper
        dest = OUT / f"icon{size}.png"
        subprocess.run([rsvg, "-w", str(size), "-h", str(size), "-o", str(dest)], input=ET.tostring(source), check=True)
        print("wrote", dest)


if __name__ == "__main__":
    main()
