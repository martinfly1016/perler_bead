#!/usr/bin/env python3
"""Subset Noto Sans JP for the print PDF and write vendor/bead-print-font.js.

The variable font is downloaded once from the Google Fonts repo (OFL) and is
not committed. Re-run from the repo root:

  python3 scripts/build-print-font.py
"""
import os
import urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.subset import Options, Subsetter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.environ.get("NOTO_SANS_JP", "/tmp/NotoSansJP-VF.ttf")
SOURCE_URL = "https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf"
OUT_JS = os.path.join(ROOT, "vendor", "bead-print-font.js")
OUT_TTF = "/tmp/NotoSansJP-Regular.subset.ttf"


def collect_text():
    chars = set()
    for start, end in ((0x20, 0x7E), (0x3000, 0x303F), (0x3040, 0x30FF), (0xFF00, 0xFFEF)):
        for code in range(start, end + 1):
            chars.add(chr(code))
    chars.add("\u00d7")  # ×
    chars.add("\u2013")
    chars.add("\u2014")
    chars.add("\u2015")
    chars.add("\u2026")
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [name for name in dirnames if name not in (".git", "vendor", "node_modules")]
        for name in filenames:
            if not name.endswith((".html", ".js", ".json", ".mjs", ".css")):
                continue
            path = os.path.join(dirpath, name)
            with open(path, encoding="utf-8") as handle:
                chars.update(ch for ch in handle.read() if ord(ch) > 127)
    return "".join(sorted(chars))


def main():
    if not os.path.exists(SOURCE):
        print("downloading", SOURCE_URL)
        urllib.request.urlretrieve(SOURCE_URL, SOURCE)
    font = TTFont(SOURCE)
    font = instantiateVariableFont(font, {"wght": 400}, inplace=False, static=True)
    options = Options()
    options.layout_features = []
    options.hinting = False
    options.desubroutinize = True
    options.drop_tables = ["DSIG", "GSUB", "GPOS", "GDEF", "vhea", "vmtx", "VORG", "MATH"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.recommended_glyphs = True
    subsetter = Subsetter(options=options)
    text = collect_text()
    subsetter.populate(text=text)
    subsetter.subset(font)
    os.makedirs(os.path.dirname(OUT_TTF), exist_ok=True)
    font.save(OUT_TTF)
    with open(OUT_TTF, "rb") as handle:
        raw = handle.read()
    b64 = __import__("base64").b64encode(raw).decode("ascii")
    with open(OUT_JS, "w", encoding="utf-8") as handle:
        handle.write("/* Noto Sans JP Regular, subset, OFL. See vendor/OFL-NotoSansJP.txt */\n")
        handle.write("window.BEAD_PRINT_FONT_B64 = '" + b64 + "';\n")
    print("glyphs", len(font.getGlyphOrder()), "ttf", len(raw), "js", os.path.getsize(OUT_JS))


if __name__ == "__main__":
    main()
