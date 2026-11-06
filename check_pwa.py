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
        if 'cache: "no-store"' not in text and "cache: 'no-store'" not in text:
            errors.append("networkFirst must fetch with cache: no-store")
        if "events-shell-v111" not in text:
            errors.append("service worker shell should be events-shell-v111")

    if not index_path.is_file():
        errors.append("missing index.html")
    else:
        html = index_path.read_text(encoding="utf-8")
        if 'rel="manifest"' not in html:
            errors.append("index.html missing manifest link")
        site_js = (ROOT / "js" / "site.js").read_text(encoding="utf-8")
        if "service-worker.js" not in site_js:
            errors.append("site.js does not register service-worker.js")
        if "controllerchange" not in site_js:
            errors.append("registerPwa must reload on controllerchange")
        if "reg.update()" not in site_js and ".update()" not in site_js:
            errors.append("registerPwa must call registration.update()")
        if "em-sw-reloaded" not in site_js:
            errors.append("registerPwa missing sessionStorage reload guard")
        if 'class="detail-sticky-meta"' not in html and "detail-sticky-meta" not in html:
            errors.append("index.html missing detail-sticky-meta for title/when/where")
        if 'id="hide-allday-count"' not in html or 'id="hide-multiday-count"' not in html:
            errors.append("visibility toggles missing hide-allday/multiday count spans")
        if "updateHideToggleCounts" not in site_js or "matchesFiltersIgnoringHide" not in site_js:
            errors.append("site.js missing hide-toggle count helpers")
        if "about-desc" not in html:
            errors.append("About panel missing project description (.about-desc)")
        if "Display name" in html:
            errors.append("About panel must not use obsolete Display name label")
        if "about-name" in html or ">Alex of Rhodes<" in html:
            errors.append("About panel must not show obsolete author name hero")
        # Notes: linkify (inline + line-start) then inline MD, then blocks.
        fn = site_js
        i_fmt = fn.find("function formatNotesHtml")
        i_link = fn.find("linkifyNotesHtml(html)", i_fmt)
        i_inline = fn.find("applyNotesInlineMd(html)", i_fmt)
        i_blocks = fn.find("formatNotesBlocks(html)", i_fmt)
        if i_fmt < 0 or i_link < 0 or i_inline < 0 or i_blocks < 0:
            errors.append("formatNotesHtml missing linkify/inline/blocks calls")
        elif not (i_link < i_inline < i_blocks):
            errors.append("formatNotesHtml must call linkify → inline MD → blocks")
        if "mapNotesTextSegments" not in site_js:
            errors.append("site.js missing mapNotesTextSegments for safe inline MD")
        if "<blockquote>" not in site_js or "<del>" not in site_js or "<code>" not in site_js:
            errors.append("notes MD missing blockquote/del/code rendering")
        if "lastIndexOf(\"<a \")" not in site_js and "lastIndexOf('<a ')" not in site_js:
            errors.append("linkifyNotesHtml must allow bare URLs inline (skip inside <a>)")
        if "formatNotesList" not in site_js or "task-list" not in site_js:
            errors.append("notes MD missing nested lists / task checkboxes")
        if 'type="checkbox"' not in site_js:
            errors.append("notes task items must render disabled checkboxes")
        # Bare-URL replace must not wrap the URL in a capturing group (shifts offset/string args).
        link_fn = site_js[site_js.find("function linkifyNotesHtml") : site_js.find("function notesListItemMatch")]
        if "((?:https?:" in link_fn:
            errors.append("linkifyNotesHtml bare-URL regex must not wrap match in a capturing group")
        if "(url, offset, full)" not in link_fn:
            errors.append("linkifyNotesHtml bare-URL callback must be (url, offset, full)")

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
