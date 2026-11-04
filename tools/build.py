#!/usr/bin/env python3
"""
Feinbäckerei Friedenau – Sortiment-Generator (ohne Abhängigkeiten, Python 3.8+)

Liest tools/products.json und schreibt:
  1. die Produktkarten, Filter-Buttons und das Schema.org-Menü in index.html
     (zwischen den Markern <!-- GEN:… --> … <!-- /GEN:… -->)
  2. tools/fetch-wolt-images.sh (lädt die Wolt-Produktfotos lokal herunter)

Aufruf (im Projektordner):   python3 tools/build.py
Preise ändern? → products.json anpassen, Skript erneut ausführen. Fertig.
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "tools" / "products.json").read_text(encoding="utf-8"))
INDEX = ROOT / "index.html"
WOLT_URL = "https://wolt.com/de/deu/berlin/venue/feinbckerei-friedenau"

e = lambda s: html.escape(str(s), quote=True)
cats = {c["id"]: c for c in DATA["categories"]}
products = DATA["products"]

ARROW_UNUSED = ('<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
         '<path d="M7 17 17 7M9 7h8v8"/></svg>')


def money(s):
    return s.replace(",", ".")


def qty_control(key, label, price, aria_name):
    """Mengenwahl für den Vorbestell-Korb (ohne JS ausgeblendet)."""
    return f"""
                    <div class="qty" data-key="{e(key)}" data-name="{e(label)}" data-price="{money(price)}">
                      <button type="button" class="btn btn-add" data-step="1">In die Vorbestellung <span aria-hidden="true">+</span><span class="sr-only">: {e(aria_name)}</span></button>
                      <div class="stepper" hidden>
                        <button type="button" class="step" data-step="-1" aria-label="Eins weniger: {e(aria_name)}">−</button>
                        <output class="step-val" aria-live="polite" aria-label="Menge {e(aria_name)}">0</output>
                        <button type="button" class="step" data-step="1" aria-label="Eins mehr: {e(aria_name)}">+</button>
                      </div>
                    </div>"""


def card(p, i):
    cat = cats[p["cat"]]
    search = " ".join([p["name"], p.get("sub", ""), cat["label"], " ".join(p.get("tags", []))]).lower()
    badge = f'<span class="product-badge">{e(p["badge"])}</span>' if p.get("badge") else ""
    sub = p.get("sub") or cat["short"]
    tags = "".join(f"<li>{e(t)}</li>" for t in p.get("tags", []))
    if p.get("variants"):
        rows = []
        for v in p["variants"]:
            rows.append(f"""
                  <div class="variant">
                    <p class="product-price"><data value="{money(v['price'])}">{e(v['price'])}&nbsp;€</data><span>{e(v['label'])}</span></p>{qty_control(p['slug'] + '-' + v['label'], p['name'] + ' (' + v['label'] + ')', v['price'], p['name'] + ' ' + v['label'])}
                  </div>""")
        foot = "".join(rows)
    else:
        unit = p.get("unit", "")
        foot = f"""
                  <p class="product-price"><data value="{money(p['price'])}">{e(p['price'])}&nbsp;€</data><span>{e(unit)}</span></p>{qty_control(p['slug'], p['name'], p['price'], p['name'])}"""
    return f"""
          <li class="product" data-cat="{e(p['cat'])}" data-search="{e(search)}">
            <article class="product-card" aria-labelledby="p-{e(p['slug'])}">
              <div class="product-media media-{e(p['cat'])}">
                <img src="./assets/img/products/{e(p['slug'])}.jpg" alt="{e(p['name'])}" width="720" height="540" loading="lazy" decoding="async">
                <span class="product-sub">{e(sub)}</span>{badge}
              </div>
              <div class="product-body">
                <h3 class="product-name" id="p-{e(p['slug'])}">{e(p['name'])}</h3>
                <p class="product-desc">{e(p['desc'])}</p>
                <ul class="product-tags" aria-label="Merkmale">{tags}</ul>
                <div class="product-foot">{foot}
                </div>
              </div>
            </article>
          </li>"""


def filters():
    out = [f'<button type="button" class="chip" data-filter="all" aria-pressed="true">Alle <span class="chip-count">{len(products)}</span></button>']
    for c in DATA["categories"]:
        n = sum(1 for p in products if p["cat"] == c["id"])
        out.append(f'<button type="button" class="chip" data-filter="{e(c["id"])}" aria-pressed="false">{e(c["label"])} <span class="chip-count">{n}</span></button>')
    return "\n            ".join(out)


def jsonld():
    data = {
        "@context": "https://schema.org",
        "@type": "Bakery",
        "name": "Feinbäckerei Friedenau",
        "url": "https://feinbaeckerei-friedenau.de/",
        "image": "https://feinbaeckerei-friedenau.de/assets/img/og-image.jpg",
        "logo": "https://feinbaeckerei-friedenau.de/assets/img/logo-bordeaux.png",
        "telephone": "+49 176 57225117",
        "priceRange": "€",
        "address": {"@type": "PostalAddress", "streetAddress": "Hauptstraße 72", "postalCode": "12159",
                    "addressLocality": "Berlin", "addressCountry": "DE"},
        "geo": {"@type": "GeoCoordinates", "latitude": 52.4749583, "longitude": 13.3390579},
        "openingHoursSpecification": [
            {"@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "opens": "06:00", "closes": "18:00"},
            {"@type": "OpeningHoursSpecification", "dayOfWeek": ["Saturday", "Sunday"], "opens": "06:00", "closes": "16:00"},
        ],
        "sameAs": [WOLT_URL],
        "hasMenu": jsonld_menu(),
    }
    return json.dumps(data, ensure_ascii=False, indent=2).replace("</", "<\\/")


def jsonld_menu():
    sections = []
    for c in DATA["categories"]:
        items = [{
            "@type": "MenuItem",
            "name": p["name"],
            "description": p["desc"],
            "offers": [{"@type": "Offer", "price": money(v["price"]), "priceCurrency": "EUR"} for v in p["variants"]]
            if p.get("variants") else {"@type": "Offer", "price": money(p["price"]), "priceCurrency": "EUR"},
        } for p in products if p["cat"] == c["id"]]
        sections.append({"@type": "MenuSection", "name": c["label"], "hasMenuItem": items})
    return {"@type": "Menu", "name": "Sortiment", "hasMenuSection": sections}


def replace_block(text, name, content):
    pat = re.compile(rf"(<!-- GEN:{name} -->)(.*?)(<!-- /GEN:{name} -->)", re.S)
    if not pat.search(text):
        raise SystemExit(f"Marker GEN:{name} fehlt in index.html")
    return pat.sub(lambda m: m.group(1) + content + m.group(3), text)


def main():
    text = INDEX.read_text(encoding="utf-8")
    text = replace_block(text, "products", "".join(card(p, i) for i, p in enumerate(products)) + "\n        ")
    text = replace_block(text, "filters", "\n            " + filters() + "\n            ")
    text = replace_block(text, "count", str(len(products)))
    text = replace_block(text, "pricedate", e(DATA["price_date"]))
    # JSON-LD (Schema.org Bakery inkl. Speisekarte) komplett neu schreiben
    ld = re.compile(r'(<script type="application/ld\+json" id="ld-bakery">)(.*?)(</script>)', re.S)
    if not ld.search(text):
        raise SystemExit("JSON-LD-Block #ld-bakery fehlt in index.html")
    text = ld.sub(lambda m: m.group(1) + "\n" + jsonld() + "\n  " + m.group(3), text)
    INDEX.write_text(text, encoding="utf-8")

    # Download-Skript für die Wolt-Fotos
    lines = ["#!/bin/bash",
             "# Lädt die Original-Produktfotos der Feinbäckerei von Wolt und speichert sie lokal.",
             "# Danach lädt die Website KEINE Bilder mehr von Drittservern (DSGVO).",
             "# Aufruf im Projektordner:  bash tools/fetch-wolt-images.sh",
             'set -u; cd "$(dirname "$0")/../assets/img/products" || exit 1',
             'ok=0; fail=0',
             'get() { if curl -fsSL --retry 2 -o "$1.jpg" "$2"; then ok=$((ok+1)); else echo "  ✗ $1"; fail=$((fail+1)); fi; }',
             'echo "Lade Produktfotos …"']
    for p in products:
        if p.get("img"):
            url = DATA["img_base"] + p["img"] + "?w=800"
        elif p.get("imgAsset"):
            url = "https://imageproxy.wolt.com/assets/" + p["imgAsset"] + "?w=800"
        else:
            continue  # eigenes Foto, nicht von Wolt
        lines.append(f'get "{p["slug"]}" "{url}"')
    lines += ['# Auf 800 px Breite begrenzen & komprimieren (macOS: sips ist vorinstalliert)',
              'if command -v sips >/dev/null; then for f in *.jpg; do sips -Z 800 -s formatOptions 78 "$f" >/dev/null 2>&1; done; fi',
              'echo "Fertig: $ok geladen, $fail fehlgeschlagen."']
    sh = ROOT / "tools" / "fetch-wolt-images.sh"
    sh.write_text("\n".join(lines) + "\n", encoding="utf-8")
    sh.chmod(0o755)
    print(f"OK – {len(products)} Produkte in index.html geschrieben, Download-Skript erzeugt.")


if __name__ == "__main__":
    main()
