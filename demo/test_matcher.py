#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    node = shutil.which("node")
    if not node:
        print("node not found; skipping matcher tests", file=sys.stderr)
        return 1
    return subprocess.run(
        [node, str(ROOT / "demo" / "test_matcher.js"), str(ROOT / "src" / "matcher.js")],
        cwd=ROOT,
    ).returncode


if __name__ == "__main__":
    raise SystemExit(main())
