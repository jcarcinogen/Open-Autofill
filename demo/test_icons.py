"""Render in isolation; check store footprint and the optical toolbar source."""
from pathlib import Path
import os
import shutil
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="oa-icons-", dir=os.environ.get("TMPDIR")) as folder:
    icons = Path(folder) / "icons"
    shutil.copytree(ROOT / "icons", icons)
    subprocess.run(["python3", str(icons / "make_icons.py")], check=True)
    for size in (16, 32, 48, 128, 512):
        with Image.open(icons / f"icon{size}.png") as image:
            assert image.size == (size, size)
            assert image.mode == "RGBA"
            assert image.getchannel("A").getpixel((0, 0)) == 0
            if size == 128:
                assert image.getbbox() == (16, 16, 112, 112), "store artwork must occupy exactly 96px"
    expected = Path(folder) / "optical16.png"
    subprocess.run(["rsvg-convert", "-w", "16", "-h", "16", str(icons / "toolbar16.svg"), "-o", str(expected)], check=True)
    actual = Image.open(icons / "icon16.png").convert("RGBA")
    assert actual.tobytes() == Image.open(expected).convert("RGBA").tobytes(), "16px must use the optical SVG"
print("PASS icon sizes, transparency, 96px footprint, optical 16px source")
