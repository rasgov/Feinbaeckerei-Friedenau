# Feinbäckerei Friedenau – Website

Statische One-Page-Website für die Feinbäckerei Friedenau, Hauptstraße 72, 12159 Berlin.
Reines HTML/CSS/JavaScript – kein Build-Schritt, keine Frameworks, keine externen Ressourcen.
Läuft per Doppelklick lokal (`file://`), auf **Netlify** und auf **GitHub Pages**.

---

## ✅ Vor dem Livegang (Pflicht)

1. **Produktfotos** – sind enthalten (69 Stück, `assets/img/products/`, 720 × 540 px).
   Sie stammen aus dem Wolt-Menü der Bäckerei; der gelbe Studiohintergrund wurde per
   `tools/recolor_photos.py` auf das Marken-Creme #F4EBD9 umgefärbt (Speisen/Teller unverändert,
   leichte Bordeaux-Vignette). Die Seite liefert alle Bilder selbst aus – keine Verbindung zu Wolt.
   ⚠️ Bildrechte klären: Bitte bestätigen, dass die Bäckerei die Fotos auch auf der eigenen Website
   nutzen darf (z. B. falls ein Wolt-Fotograf sie erstellt hat).
   Neue Fotos: Originale mit `bash tools/fetch-wolt-images.sh` laden (eigener Ordner), dann
   `python3 tools/recolor_photos.py <ordner>` (braucht Pillow, numpy, scipy).

2. **Impressum & Datenschutz vervollständigen** – in `index.html` nach `class="todo"` suchen:
   - vollständiger Name der Inhaberin / des Inhabers (bzw. Firma + Rechtsform)
   - USt-IdNr. (nur falls vorhanden)
   - Hoster: Netlify **oder** GitHub Pages stehen lassen, den anderen löschen
   Danach die gelben Markierungen (`<mark class="todo">`) entfernen.

3. **Beschreibungen prüfen** – Wolt zeigt keine Produktbeschreibungen. Die Texte in
   `tools/products.json` sind neutral aus den Produktnamen formuliert. Bitte von der Bäckerei
   gegenlesen lassen (v. a. „Cappuccino“ vs. „Cappuccino & Kuhmilch“ = Variante ohne Kuhmilch?).

4. **Private Schlüssel gehören NICHT ins Projekt.** Netlify und GitHub Pages stellen das
   HTTPS-Zertifikat automatisch aus. Die `.gitignore` blockiert `*.key`, `*.pem` usw.

---

## Preise & Sortiment ändern

Alle Artikel stehen in **`tools/products.json`** (Name, Ladenpreis, Kategorie, Beschreibung, Merkmale, Badge).
Varianten mit zwei Preisen (z. B. Joghurtbecher klein/groß) über `"variants": [{"label": "klein", "price": "2,50"}, …]`, Zusatz wie „pro Stück“ über `"unit"`.
Nach einer Änderung:

```bash
python3 tools/build.py
```

Das Skript schreibt Produktkarten, Filter-Zähler, Preisstand und die Schema.org-Speisekarte
(SEO) neu in `index.html` und aktualisiert das Foto-Download-Skript. Python 3.8+, keine Pakete nötig.
`price_date` in der JSON bei jeder Preisänderung mitpflegen – es erscheint im Hinweis unter dem Sortiment.

Neue Artikel: Eintrag in `products.json` ergänzen (`img` = Dateiname aus der Wolt-Bild-URL),
`build.py` und danach `fetch-wolt-images.sh` ausführen.

---

## Deployment

### Netlify
Ordner per Drag & Drop in Netlify ziehen oder Repository verbinden. `netlify.toml` setzt:
Content-Security-Policy, HSTS, Referrer-/Permissions-Policy, Caching. Kein Build-Befehl nötig.

### GitHub Pages
Repository → *Settings → Pages → Deploy from branch* (`main`, Ordner `/`).
`.nojekyll` ist vorhanden. Die CSP greift über das `<meta>`-Tag in `index.html`
(GitHub Pages erlaubt keine eigenen HTTP-Header).
Eigene Domain: unter *Pages → Custom domain* `feinbaeckerei-friedenau.de` eintragen.
Ohne eigene Domain (Projektseite `user.github.io/repo/`): in `404.html` den Link `href="/"` auf `href="/repo/"` ändern.

### Caching
CSS/JS werden über `?v=3.3.0` in `index.html` versioniert. Bei Änderungen an `css/main.css`
oder `js/app.js` die Versionsnummer erhöhen, sonst sehen Besucher bis zu ein Jahr die alte Datei.

---

## Datenschutz-Konzept (DSGVO / TDDDG)

| Thema | Umsetzung |
|---|---|
| Schriften | Selbst gehostet (`assets/fonts/`, SIL OFL) – kein Google Fonts |
| Bilder | Selbst gehostet – kein Hotlinking zu Wolt/Unsplash |
| Google Maps | 2-Klick: iframe wird erst nach Klick erzeugt; Widerruf unter „Cookie-Hinweise“ |
| Cookies | Keine. Deshalb kein Cookie-Banner nötig |
| localStorage | Nur, wenn Nutzer „Entscheidung merken“ wählt (`fbf.maps-consent`) |
| Wolt, WhatsApp, Routen | Reine Links – Datenübertragung erst beim Anklicken |
| Vorbestellung und Party-Anfrage | Wahlweise Netlify Forms oder WhatsApp mit vorbereitetem Text |
| CSP | `default-src 'self'`, keine Inline-Skripte/-Styles |

Die Rechtstexte sind eine sorgfältige Vorlage, ersetzen aber keine Rechtsberatung.

---

## Struktur

```
index.html            One-Pager (Produktkarten werden von tools/build.py erzeugt)
404.html              Eigenständige Fehlerseite (funktioniert auf jeder Pfadtiefe)
css/main.css          Gesamtes Design (Mobile First)
js/boot.js            Setzt .js-Klasse vor dem Rendern (kein Flackern)
js/app.js             Öffnungsstatus, Filter/Suche, Dialoge, 2-Klick-Karte, Navigation
assets/fonts/         FBF Serif (Lora-Subset) + Inter, WOFF, mit OFL.txt
assets/img/           Logo (freigestellt, Creme/Bordeaux), OG-Bild, products/
tools/products.json   Sortiment & Ladenpreise (Quelle der Wahrheit)
tools/build.py        Generator
tools/fetch-wolt-images.sh   Foto-Download
netlify.toml · .nojekyll · robots.txt · sitemap.xml · site.webmanifest · Favicons
```

## Vorbestell-Korb
Jede Produktkarte hat „In die Vorbestellung“ bzw. einen Mengenregler. Die Auswahl erscheint mit Stückzahl
und Summe im Bereich „Ihre Vorbestellung“ und wird beim Absenden als fertiger WhatsApp-Text geöffnet
(an 0176 57225117, Konstante `WA_PHONE` in `js/app.js`). Es gibt keinen Server und keine Bezahlung online.

## Party & Anlässe
Abschnitt `#party`: Showreel (`assets/media/party-showreel.mp4`, 20 s, 4:5, ohne Ton, stabilisiert & farbkorrigiert),
Galerie mit Großansicht (6 Platten-Fotos, einheitlich bearbeitet) und Anfrageformular.
Preislogik in `js/app.js`: `PARTY_PRICE = 2.5` (Richtwert „ab“), `PARTY_BONUS = 50` (Gratis-Käsekuchen 20 × 20 cm), `PARTY_MIN = 10`.
Das Video spielt nur, wenn es sichtbar ist, und nie automatisch bei „Bewegung reduzieren“.

## Öffnungszeiten anpassen
Laden: Mo–Fr 06:00–18:00, Sa–So 06:00–16:00. Wolt-Lieferzeiten stehen separat im Bereich „Bestellen“.
`js/app.js` → `HOURS` (Minuten ab Mitternacht, 0 = Sonntag) sowie die Tabelle in `index.html`,
der Footer und `openingHoursSpecification` in `tools/build.py`.

## Kontakt per E-Mail

Die Kontaktadresse lautet info@feinbäckerei-friedenau.de. Mailto-Links verwenden die gleichwertige ASCII-Domain info@xn--feinbckerei-friedenau-91b.de. Beide Formulare bieten eine Übermittlung über Netlify Forms mit Rückantwortadresse und Spam-Schutz sowie weiterhin WhatsApp an.

Für die Zustellung an das Postfach muss unter Netlify → Forms → Submission notifications eine E-Mail-Benachrichtigung für neue Einsendungen an info@xn--feinbckerei-friedenau-91b.de eingerichtet werden. Die automatische Einrichtung wurde mit „Unauthorized“ abgelehnt; die Benachrichtigung ist daher noch nicht eingerichtet. Nach dem Deployment eine echte Anfrage übermitteln und den Eingang im Postfach prüfen.
