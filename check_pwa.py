"""Assert docs/ PWA pieces meet installability basics. Run: python docs/check_pwa.py"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main() -> int:
    errors = []
    manifest_path = ROOT / "manifest.webmanifest"
    sw_path = ROOT / "service-worker.js"
    index_path = ROOT / "index.html"

    if not manifest_path.is_file():
        errors.append("missing manifest.webmanifest")
    else:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        for key in ("name", "short_name", "start_url", "scope", "display", "icons"):
            if key not in data:
                errors.append(f"manifest missing {key}")
        if data.get("display") not in {"standalone", "fullscreen", "minimal-ui"}:
            errors.append(f"display not installable: {data.get('display')}")
        sizes = set()
        for icon in data.get("icons") or []:
            src = ROOT / icon.get("src", "")
            if not src.is_file():
                errors.append(f"icon missing: {icon.get('src')}")
            sizes.add(icon.get("sizes"))
        if "192x192" not in sizes or "512x512" not in sizes:
            errors.append("need 192x192 and 512x512 icons in manifest")

    if not sw_path.is_file():
        errors.append("missing service-worker.js")
    else:
        text = sw_path.read_text(encoding="utf-8")
        if "addEventListener(\"fetch\"" not in text and "addEventListener('fetch'" not in text:
            errors.append("service worker has no fetch handler")
        if "events-shell-" not in text:
            errors.append("service worker missing shell cache name")

    if not index_path.is_file():
        errors.append("missing index.html")
    else:
        html = index_path.read_text(encoding="utf-8")
        if 'rel="manifest"' not in html:
            errors.append("index.html missing manifest link")
        if "service-worker.js" not in (ROOT / "js" / "site.js").read_text(encoding="utf-8"):
            errors.append("site.js does not register service-worker.js")

    # pixel sizes
    try:
        from PIL import Image

        for name, expect in (("icon-192.png", (192, 192)), ("icon-512.png", (512, 512))):
            path = ROOT / "icons" / name
            size = Image.open(path).size
            if size != expect:
                errors.append(f"{name} is {size}, expected {expect}")
    except Exception as exc:
        errors.append(f"icon size check failed: {exc}")

    if errors:
        print("PWA check FAILED:")
        for err in errors:
            print(" -", err)
        return 1
    print("PWA check OK: manifest, icons (192/512), SW fetch handler, registration.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
