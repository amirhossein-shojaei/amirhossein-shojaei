"""Rasterize SVG strings to RGBA PNGs with headless Chrome/Chromium (transparent background)."""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

CANDIDATES = ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome")


def find_chrome():
    env = os.environ.get("CHROME")
    if env:
        return env
    for name in CANDIDATES:
        path = shutil.which(name)
        if path:
            return path
    raise SystemExit("Chrome/Chromium not found. Install it or set CHROME=/path/to/chrome.")


def svg_to_png(svg: str, width: int, height: int, out: Path, chrome: str | None = None) -> Path:
    chrome = chrome or find_chrome()
    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / "layer.html"
        page.write_text(
            "<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}"
            "svg{display:block}</style></head><body>" + svg + "</body></html>",
            encoding="utf-8",
        )
        cmd = [
            chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
            "--default-background-color=00000000", f"--window-size={width},{height}",
            f"--user-data-dir={tmp}/profile", f"--screenshot={out}", page.as_uri(),
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
    if not out.exists():
        raise RuntimeError(f"Chrome did not produce {out}")
    return out
