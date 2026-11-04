#!/usr/bin/env python3
"""
Passt den hellgelben Wolt-Studiohintergrund der Produktfotos an das Marken-Creme an.

- erkennt den Hintergrund (vom Bildrand aus zusammenhängende, gelbliche Flächen inkl. Schatten)
- ersetzt nur diesen Farbton durch Creme #F4EBD9, Helligkeit/Schatten bleiben erhalten
- Teller, Tassen und Speisen bleiben unverändert (der weiße Tellerrand stoppt die Erkennung)
- leichte warme Vignette in Bordeaux, Zuschnitt auf 4:3 (720 × 540)

Aufruf: python3 tools/recolor_photos.py <eingangsordner> [<ausgangsordner>]
Benötigt: Pillow, numpy, scipy
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

CREAM = np.array([244, 235, 217], dtype=np.float32)
BORDEAUX = np.array([59, 17, 25], dtype=np.float32)


def background_mask(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = (r + g + b) / 3
    yellow = (r + g) / 2 - b          # wie „gelb“ ein Pixel ist
    rg = r - g                        # orange/braun (Kruste) hat hohe Werte
    # lokale Struktur: Studiohintergrund ist glatt, Brot/Speisen haben Textur
    m = ndimage.uniform_filter(lum, 5)
    m2 = ndimage.uniform_filter(lum * lum, 5)
    sd = np.sqrt(np.maximum(m2 - m * m, 0))
    # 1) sicherer Hintergrund: hell, deutlich gelb, nicht orange, glatt
    seed = (lum > 195) & (yellow > 45) & (rg < 22) & (rg > -5) & (sd < 1.5)
    lab, _ = ndimage.label(seed)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    seed = np.isin(lab, border[border > 0])
    # 2) vollständig in gelbliche, glatte Schattenflächen hineinwachsen
    #    (weißer Teller-/Tassenrand und strukturiertes Brot stoppen das Wachstum)
    grow = (yellow > 22) & (rg < 24) & (rg > -8) & (lum > 95) & (sd < 2.5)
    mask = ndimage.binary_propagation(seed, mask=grow)
    mask = ndimage.binary_closing(mask, iterations=2) & (yellow > 18) & (rg < 26)
    # Kantenpixel (Mischfarbe aus weißem Tellerrand und gelbem Grund) mitnehmen → kein gelber Saum
    edge = ndimage.binary_dilation(mask, iterations=3) & (yellow > 10) & (rg < 20) & (lum > 140)
    mask = mask | edge
    return mask, lum, seed


def process(src, dst):
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    mask, lum, seed = background_mask(a)
    ref = np.median(lum[seed]) if seed.any() else 230.0
    # weiche Kante
    alpha = ndimage.gaussian_filter(mask.astype(np.float32), 1.2)[..., None]
    shade = np.clip(lum / ref, 0, 1.15)[..., None]
    recolored = np.clip(CREAM * shade, 0, 255)
    out = a * (1 - alpha) + recolored * alpha

    # leichte Wärme fürs ganze Bild (Hauch Richtung Creme)
    out = out * 0.96 + CREAM * 0.04 * (out / 255)
    out = out / out.max() * 255 if out.max() > 255 else out

    # Vignette
    h, w = out.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / np.sqrt(2)
    v = np.clip((d - 0.55) / 0.45, 0, 1) ** 1.6 * 0.16
    out = out * (1 - v[..., None]) + BORDEAUX * v[..., None]

    res = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    # 4:3 mittig zuschneiden
    tw = int(h * 4 / 3)
    if tw < w:
        x0 = (w - tw) // 2
        res = res.crop((x0, 0, x0 + tw, h))
    res = res.resize((720, 540), Image.LANCZOS)
    res.save(dst, "JPEG", quality=82, optimize=True, progressive=True)
    return float(mask.mean())


def main():
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "assets/img/products"
    dst.mkdir(parents=True, exist_ok=True)
    files = sorted([p for p in src.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")])
    for p in files:
        cov = process(p, dst / (p.stem + ".jpg"))
        flag = "  ← prüfen" if cov < 0.25 or cov > 0.85 else ""
        print(f"{p.stem:30s} Hintergrund {cov:5.1%}{flag}")


if __name__ == "__main__":
    main()
