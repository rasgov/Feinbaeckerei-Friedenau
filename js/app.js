/**
 * FEINBÄCKEREI FRIEDENAU — App v3
 * Abhängigkeitsfrei, ohne Build-Schritt, läuft auf file://, Netlify und GitHub Pages.
 * Keine Verbindung zu Drittanbietern, solange der Nutzer nicht aktiv klickt.
 */
(function () {
  'use strict';

  var WA_PHONE = '4917657225117';
  var MAPS_KEY = 'fbf.maps-consent';
  var MAPS_SRC = 'https://www.google.com/maps?q=Feinb%C3%A4ckerei%20Friedenau%2C%20Hauptstra%C3%9Fe%2072%2C%2012159%20Berlin&z=16&hl=de&output=embed';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* Browser-Speicher kann gesperrt sein (privater Modus) → immer absichern */
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignorieren */ } },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignorieren */ } }
  };

  /* ------------------------------------------------------------------
     1. Öffnungsstatus (immer Berliner Zeit, unabhängig vom Gerät)
     Mo–Fr 06:00–18:00 · Sa–So 06:00–16:00
     ------------------------------------------------------------------ */
  var HOURS = { 0: [360, 960], 1: [360, 1080], 2: [360, 1080], 3: [360, 1080], 4: [360, 1080], 5: [360, 1080], 6: [360, 960] };
  var DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var SOON_MIN = 30;

  function berlinNow() {
    var map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date());
      var o = {};
      parts.forEach(function (p) { o[p.type] = p.value; });
      return { day: map[o.weekday], min: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
    } catch (e) {
      var d = new Date();
      return { day: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
    }
  }

  function hhmm(m) {
    var h = Math.floor(m / 60), mi = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mi < 10 ? '0' : '') + mi;
  }

  function computeStatus() {
    var now = berlinNow();
    var open = HOURS[now.day][0], close = HOURS[now.day][1];
    if (now.min >= open && now.min < close) {
      var left = close - now.min;
      if (left <= SOON_MIN) {
        return { day: now.day, state: 'soon', label: 'Jetzt geöffnet – schließt bald', short: 'Schließt bald', detail: 'Noch ' + left + ' Min. – heute bis ' + hhmm(close) + ' Uhr' };
      }
      return { day: now.day, state: 'open', label: 'Jetzt geöffnet', short: 'Jetzt geöffnet', detail: 'Heute bis ' + hhmm(close) + ' Uhr' };
    }
    if (now.min < open) {
      return { day: now.day, state: 'closed', label: 'Geschlossen', short: 'Geschlossen', detail: 'Öffnet heute um ' + hhmm(open) + ' Uhr' };
    }
    var next = (now.day + 1) % 7;
    return { day: now.day, state: 'closed', label: 'Geschlossen', short: 'Geschlossen', detail: 'Öffnet morgen (' + DAYS[next] + ') um ' + hhmm(HOURS[next][0]) + ' Uhr' };
  }

  var lastStatusKey = '';
  function renderStatus() {
    var s = computeStatus();
    var key = s.state + s.detail;
    if (key === lastStatusKey) return; // nur bei Änderung aktualisieren (ruhig für Screenreader)
    lastStatusKey = key;

    $$('[data-status-pill]').forEach(function (el) {
      el.setAttribute('data-state', s.state);
      var l = $('[data-status-label]', el); if (l) l.textContent = s.short;
    });
    $$('[data-status-card]').forEach(function (el) {
      el.setAttribute('data-state', s.state);
      var l = $('[data-status-label]', el); if (l) l.textContent = s.label;
      var d = $('[data-status-detail]', el); if (d) d.textContent = s.detail;
    });
    $$('.hours tr[data-day]').forEach(function (row) {
      var today = parseInt(row.getAttribute('data-day'), 10) === s.day;
      row.classList.toggle('is-today', today);
      if (today) row.setAttribute('aria-current', 'date'); else row.removeAttribute('aria-current');
    });
  }

  /* ------------------------------------------------------------------
     2. Navigation (mobil) & Schnellaktionen
     ------------------------------------------------------------------ */
  function initNav() {
    var btn = $('#nav-toggle'), nav = $('#main-nav');
    if (!btn || !nav) return;
    function set(open) {
      nav.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    }
    btn.addEventListener('click', function () { set(btn.getAttribute('aria-expanded') !== 'true'); });
    $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { set(false); btn.focus(); }
    });
  }

  function initFab() {
    var fab = $('#fab'), btn = $('#fab-toggle');
    if (!fab || !btn) return;
    function set(open) {
      fab.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
      $('.sr-only', btn).textContent = open ? 'Schnellaktionen schließen' : 'Schnellaktionen öffnen';
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(!fab.classList.contains('is-open')); });
    document.addEventListener('click', function (e) { if (fab.classList.contains('is-open') && !fab.contains(e.target)) set(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && fab.classList.contains('is-open')) { set(false); btn.focus(); }
    });
  }

  /* ------------------------------------------------------------------
     3. Scroll-Effekte: Fortschritt, Header, Nach-oben, Scrollspy, Parallax
     ------------------------------------------------------------------ */
  function initScroll() {
    var bar = $('#scroll-progress'), header = $('#site-header'), toTop = $('#to-top');
    var toolbar = $('#toolbar'), emblem = $('.emblem-logo');
    var ticking = false;

    function update() {
      ticking = false;
      var y = window.pageYOffset || document.documentElement.scrollTop;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
      if (header) header.classList.toggle('is-scrolled', y > 12);
      if (toTop) toTop.hidden = y < 700;
      if (toolbar) {
        var top = toolbar.getBoundingClientRect().top;
        var hh = header ? header.offsetHeight : 0;
        toolbar.classList.toggle('is-stuck', top <= hh + 1 && y > 200);
      }
      if (emblem && !reduceMotion && y < window.innerHeight * 1.2) {
        // nur sanft drehen – das Logo bleibt exakt in der Kreismitte
        emblem.style.transform = 'rotate(' + (y * 0.01).toFixed(2) + 'deg)';
      }
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();

    if (toTop) toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      var brand = $('.brand'); if (brand) brand.focus({ preventScroll: true });
    });

    // Scrollspy
    var links = $$('.main-nav a[href^="#"]');
    if ('IntersectionObserver' in window && links.length) {
      var byId = {};
      links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) { a.removeAttribute('aria-current'); });
          var a = byId[en.target.id];
          if (a) a.setAttribute('aria-current', 'true');
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
    }
  }

  function initReveal() {
    var els = $$('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el, i) {
      // leichte Staffelung für Elemente in derselben Gruppe
      el.style.transitionDelay = (i % 4) * 70 + 'ms';
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------------
     4. Sortiment: Kategorie-Filter + Suche (ohne Reload, barrierefrei)
     ------------------------------------------------------------------ */
  function initSortiment() {
    var grid = $('#product-grid');
    if (!grid) return;
    var items = $$('.product', grid);
    var chips = $$('.chip[data-filter]');
    var search = $('#product-search');
    var count = $('#result-count');
    var empty = $('#empty-state');
    var reset = $('#reset-filter');
    var active = 'all';
    var labels = {};
    chips.forEach(function (c) { labels[c.getAttribute('data-filter')] = c.firstChild.textContent.trim(); });

    // Fehlende Fotos sauber ausblenden → gestalteter Platzhalter bleibt sichtbar
    function markMissing(img) { img.classList.add('is-missing'); }
    $$('img', grid).forEach(function (img) {
      if (img.complete && img.naturalWidth === 0) markMissing(img);
      img.addEventListener('error', function () { markMissing(img); }, { once: true });
    });

    function normalize(s) {
      return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').trim();
    }
    items.forEach(function (li) { li._search = normalize(li.getAttribute('data-search')); });

    function apply(animate) {
      var q = normalize(search ? search.value : '');
      var terms = q ? q.split(/\s+/) : [];
      var shown = 0;
      items.forEach(function (li) {
        var okCat = active === 'all' || li.getAttribute('data-cat') === active;
        var okQ = terms.every(function (t) { return li._search.indexOf(t) !== -1; });
        var vis = okCat && okQ;
        var wasHidden = li.hidden;
        li.hidden = !vis;
        li.classList.remove('is-entering');
        if (vis) {
          if (animate && !reduceMotion && (wasHidden || animate === 'all')) {
            li.style.setProperty('--i', Math.min(shown, 12));
            void li.offsetWidth; // Animation neu starten
            li.classList.add('is-entering');
          }
          shown++;
        }
      });
      if (empty) empty.hidden = shown !== 0;
      if (count) {
        var where = active === 'all' ? 'im gesamten Sortiment' : 'in „' + labels[active] + '“';
        count.textContent = shown + ' Artikel ' + where + (q ? ' für „' + search.value.trim() + '“' : '');
      }
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        active = chip.getAttribute('data-filter');
        chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
        // aktiven Chip in der mobilen Scrollleiste sichtbar halten
        if (chip.scrollIntoView) chip.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
        apply('all');
        // Beim Filtern unterhalb der Leiste: an den Gitteranfang springen
        var tb = $('#toolbar');
        var gridTop = grid.getBoundingClientRect().top;
        if (tb && gridTop < tb.offsetHeight + 80) {
          var y = window.pageYOffset + gridTop - tb.offsetHeight - 110;
          window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
      });
    });

    var t;
    if (search) search.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { apply(true); }, 120); });
    if (reset) reset.addEventListener('click', function () {
      if (search) search.value = '';
      active = 'all';
      chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-filter') === 'all')); });
      apply('all');
      if (search) search.focus();
    });

    apply(false);
  }

  /* ------------------------------------------------------------------
     5. Dialoge: Impressum, Datenschutz, Cookie-Hinweise
     Natives <dialog> (Fokusfalle, Esc, inert). Ohne JS: :target-Fallback.
     ------------------------------------------------------------------ */
  var supportsDialog = typeof HTMLDialogElement === 'function' && 'showModal' in HTMLDialogElement.prototype;

  function openDialog(id, opener) {
    var dlg = document.getElementById(id);
    if (!dlg || !supportsDialog) return false;
    $$('dialog[open]').forEach(function (d) { d.close(); });
    dlg._opener = opener || document.activeElement;
    dlg.showModal();
    var body = $('.dialog-body', dlg); if (body) body.scrollTop = 0;
    if (location.hash !== '#' + id && history.replaceState) history.replaceState(null, '', '#' + id);
    return true;
  }

  function initDialogs() {
    if (!supportsDialog) return; // Fallback über :target bleibt aktiv
    document.addEventListener('click', function (e) {
      var trg = e.target.closest('[data-dialog]');
      if (trg && openDialog(trg.getAttribute('data-dialog'), trg)) { e.preventDefault(); }
    });
    $$('dialog.dialog').forEach(function (dlg) {
      $$('[data-close]', dlg).forEach(function (c) {
        c.addEventListener('click', function (e) { e.preventDefault(); dlg.close(); });
      });
      // Klick auf den abgedunkelten Hintergrund schließt
      dlg.addEventListener('click', function (e) {
        if (e.target !== dlg) return;
        var r = dlg.getBoundingClientRect();
        var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside) dlg.close();
      });
      dlg.addEventListener('close', function () {
        if (location.hash === '#' + dlg.id && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
        if (dlg._opener && document.contains(dlg._opener)) dlg._opener.focus({ preventScroll: true });
      });
    });
    // Direktlink, z. B. …/#impressum
    function fromHash() {
      var id = location.hash.slice(1);
      if (id && document.getElementById(id) && document.getElementById(id).tagName === 'DIALOG') openDialog(id, null);
    }
    window.addEventListener('hashchange', fromHash);
    fromHash();
  }

  /* ------------------------------------------------------------------
     6. Google Maps – 2-Klick-Lösung
     Vor dem Klick existiert kein iframe und keine Verbindung zu Google.
     ------------------------------------------------------------------ */
  var mapLoaded = false;

  function loadMap() {
    var frame = $('#map-frame'), consent = $('#map-consent');
    if (!frame || mapLoaded) return;
    var iframe = document.createElement('iframe');
    iframe.src = MAPS_SRC;
    iframe.title = 'Karte: Feinbäckerei Friedenau, Hauptstraße 72, 12159 Berlin (Google Maps)';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('allowfullscreen', '');
    frame.appendChild(iframe);
    frame.hidden = false;
    if (consent) consent.hidden = true;
    mapLoaded = true;
  }

  function unloadMap() {
    var frame = $('#map-frame'), consent = $('#map-consent');
    if (!frame) return;
    frame.innerHTML = '';
    frame.hidden = true;
    if (consent) consent.hidden = false;
    mapLoaded = false;
  }

  function initMap() {
    var btn = $('#map-load'), remember = $('#map-remember');
    var sw = $('#consent-maps'), status = $('#consent-status');
    var granted = store.get(MAPS_KEY) === 'granted';

    if (sw) sw.checked = granted;
    if (granted) loadMap();

    if (btn) btn.addEventListener('click', function () {
      if (remember && remember.checked) { store.set(MAPS_KEY, 'granted'); if (sw) sw.checked = true; }
      loadMap();
      var f = $('#map-frame iframe'); if (f) f.focus();
    });

    if (sw) sw.addEventListener('change', function () {
      if (sw.checked) {
        store.set(MAPS_KEY, 'granted');
        loadMap();
        if (status) status.textContent = 'Gespeichert: Google Maps wird automatisch geladen.';
      } else {
        store.del(MAPS_KEY);
        unloadMap();
        if (remember) remember.checked = false;
        if (status) status.textContent = 'Widerrufen: Die Karte wird erst wieder nach Ihrem Klick geladen.';
      }
    });
  }

  /* ------------------------------------------------------------------
     7. Vorbestell-Korb + Vorbestellung per WhatsApp
     Auswahl im Sortiment → Liste mit Stückzahl & Summe → fertiger Nachrichtentext.
     Es werden keine Daten an uns oder Dritte gesendet, bis der Kunde in WhatsApp selbst abschickt.
     ------------------------------------------------------------------ */
  var CART_KEY = 'fbf.preorder';
  var cart = {};   // key → { name, price, qty }
  var MAX_QTY = 99;

  function euro(n) { return n.toFixed(2).replace('.', ',') + ' €'; }
  function loadCart() {
    try { cart = JSON.parse(window.sessionStorage.getItem(CART_KEY) || '{}') || {}; } catch (e) { cart = {}; }
  }
  function saveCart() {
    try { window.sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) { /* ignorieren */ }
  }
  function cartEntries() { return Object.keys(cart).map(function (k) { return [k, cart[k]]; }).filter(function (x) { return x[1].qty > 0; }); }
  function cartTotals() {
    var n = 0, sum = 0;
    cartEntries().forEach(function (x) { n += x[1].qty; sum += x[1].qty * x[1].price; });
    return { n: n, sum: sum };
  }

  function setQty(key, name, price, qty) {
    qty = Math.max(0, Math.min(MAX_QTY, qty));
    if (qty === 0) delete cart[key];
    else cart[key] = { name: name, price: price, qty: qty };
    saveCart();
    renderCart();
  }

  function renderCart() {
    // 1) Steuerelemente auf den Produktkarten
    $$('.qty[data-key]').forEach(function (q) {
      var item = cart[q.getAttribute('data-key')];
      var n = item ? item.qty : 0;
      var add = $('.btn-add', q), stepper = $('.stepper', q), val = $('.step-val', q);
      add.hidden = n > 0;
      stepper.hidden = n === 0;
      val.textContent = String(n);
      var card = q.closest('.product-card');
      card.classList.toggle('is-selected', $$('.qty', card).some(function (x) { return !!cart[x.getAttribute('data-key')]; }));
    });

    // 2) Liste in der Vorbestellung
    var list = $('#cart-list'), empty = $('#cart-empty'), total = $('#cart-total'), sumEl = $('#cart-sum'), clear = $('#cart-clear');
    var entries = cartEntries(), t = cartTotals();
    if (list) {
      list.innerHTML = '';
      entries.forEach(function (x) {
        var key = x[0], it = x[1];
        var li = document.createElement('li');
        li.className = 'cart-item';
        var name = document.createElement('span'); name.className = 'cart-name'; name.textContent = it.name;
        var price = document.createElement('span'); price.className = 'cart-line'; price.textContent = euro(it.qty * it.price);
        var ctl = document.createElement('span'); ctl.className = 'stepper stepper-sm';
        [['-1', '−', 'Eins weniger: '], [null], ['1', '+', 'Eins mehr: ']].forEach(function (b) {
          if (!b[0]) { var o = document.createElement('output'); o.className = 'step-val'; o.textContent = String(it.qty); ctl.appendChild(o); return; }
          var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'step'; btn.textContent = b[1];
          btn.setAttribute('aria-label', b[2] + it.name);
          btn.addEventListener('click', function () { setQty(key, it.name, it.price, it.qty + parseInt(b[0], 10)); });
          ctl.appendChild(btn);
        });
        li.appendChild(name); li.appendChild(ctl); li.appendChild(price);
        list.appendChild(li);
      });
    }
    if (empty) empty.hidden = entries.length > 0;
    if (total) total.hidden = entries.length === 0;
    if (clear) clear.hidden = entries.length === 0;
    if (sumEl) sumEl.textContent = euro(t.sum);

    // 3) Schwebende Leiste
    var bar = $('#cart-bar');
    if (bar) {
      bar.hidden = t.n === 0;
      document.body.classList.toggle('has-cart', t.n > 0);
      $('#cart-bar-count').textContent = t.n + (t.n === 1 ? ' Artikel' : ' Artikel');
      $('#cart-bar-sum').textContent = euro(t.sum);
    }
  }

  function initCart() {
    loadCart();
    // Preise immer aus der Seite übernehmen (falls sich Preise seit dem letzten Besuch geändert haben)
    var known = {};
    $$('.qty[data-key]').forEach(function (q) { known[q.getAttribute('data-key')] = q; });
    Object.keys(cart).forEach(function (k) {
      if (!known[k]) { delete cart[k]; return; }
      cart[k].price = parseFloat(known[k].getAttribute('data-price'));
      cart[k].name = known[k].getAttribute('data-name');
    });

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.qty [data-step]');
      if (!btn) return;
      var q = btn.closest('.qty');
      var key = q.getAttribute('data-key');
      var cur = cart[key] ? cart[key].qty : 0;
      setQty(key, q.getAttribute('data-name'), parseFloat(q.getAttribute('data-price')), cur + parseInt(btn.getAttribute('data-step'), 10));
      // Fokus sinnvoll halten, wenn der „Hinzufügen“-Button verschwindet bzw. wiederkommt
      var now = cart[key] ? cart[key].qty : 0;
      if (btn.classList.contains('btn-add')) { var plus = $('.stepper [data-step="1"]', q); if (plus) plus.focus(); }
      else if (now === 0) { var add = $('.btn-add', q); if (add) add.focus(); }
      if (!reduceMotion && now > cur) {
        var bar = $('#cart-bar');
        if (bar) { bar.classList.remove('is-bump'); void bar.offsetWidth; bar.classList.add('is-bump'); }
      }
    });

    var clear = $('#cart-clear');
    if (clear) clear.addEventListener('click', function () { cart = {}; saveCart(); renderCart(); });

    renderCart();
  }

  function submitEmail(form, msg, statusId) {
    var status = $(statusId), email = form.elements.email;
    if (!email.value.trim() || !email.checkValidity()) {
      status.textContent = 'Bitte eine gültige E-Mail-Adresse für unsere Antwort angeben.';
      email.focus();
      return;
    }
    form.elements.message.value = msg;
    var data = new URLSearchParams(new FormData(form));
    var buttons = $$('button[type="submit"]', form);
    buttons.forEach(function (button) { button.disabled = true; });
    status.textContent = 'Ihre Anfrage wird gesendet …';
    fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: data.toString()
    }).then(function (response) {
      if (!response.ok) throw new Error('Submission failed');
      status.textContent = 'Vielen Dank! Ihre Anfrage wurde übermittelt. Wir melden uns per E-Mail. Die Bestellung ist erst nach unserer Bestätigung verbindlich.';
    }).catch(function () {
      status.textContent = 'Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut oder schreiben Sie an info@feinbäckerei-friedenau.de.';
    }).finally(function () {
      buttons.forEach(function (button) { button.disabled = false; });
    });
  }

  function initPreorder() {
    var form = $('#preorder-form'), err = $('#po-error');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name.value.trim();
      var when = form.elements.when.value.trim();
      var notes = form.elements.notes.value.trim();
      var entries = cartEntries();
      if (!name || entries.length === 0) {
        if (err) err.hidden = false;
        if (!name) form.elements.name.focus();
        else { var s = document.getElementById('sortiment'); if (s) s.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); }
        return;
      }
      if (err) err.hidden = true;
      var t = cartTotals();
      var lines = entries.map(function (x) {
        return x[1].qty + ' × ' + x[1].name + ' (je ' + euro(x[1].price) + ')';
      });
      var msg = 'Hallo Feinbäckerei Friedenau,\n\nich möchte gerne vorbestellen:\n' + lines.join('\n') +
        '\n\nSumme: ' + euro(t.sum) +
        '\nAbholung: ' + (when || 'nach Absprache') +
        (notes ? '\nAnmerkung: ' + notes : '') +
        '\nName: ' + name;
      if (!e.submitter || e.submitter.value !== 'whatsapp') {
        submitEmail(form, msg, '#po-status');
        return;
      }
      window.open('https://wa.me/' + WA_PHONE + '?text=' + encodeURIComponent(msg.replace(/ /g, ' ')), '_blank', 'noopener');
    });
  }

  /* ------------------------------------------------------------------
     8. Party & Anlässe: Showreel, Galerie-Großansicht, Anfrage-Rechner
     ------------------------------------------------------------------ */
  var PARTY_PRICE = 2.5, PARTY_BONUS = 50, PARTY_MIN = 10;

  function initPartyVideo() {
    var v = $('#party-video'), btn = $('#video-toggle');
    if (!v || !btn) return;
    var userPaused = false;
    function setState(playing) {
      btn.setAttribute('aria-pressed', String(playing));
      $('.video-toggle-label', btn).textContent = playing ? 'Video pausieren' : 'Video abspielen';
    }
    function play() { var p = v.play(); if (p && p.catch) p.catch(function () { setState(false); }); }
    v.addEventListener('play', function () { setState(true); });
    v.addEventListener('pause', function () { setState(false); });
    btn.addEventListener('click', function () {
      if (v.paused) { userPaused = false; play(); } else { userPaused = true; v.pause(); }
    });
    // Automatisch nur abspielen, wenn sichtbar – und nie bei „Bewegung reduzieren“
    if (!reduceMotion && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          if (e.isIntersecting) { if (!userPaused) play(); } else if (!v.paused) v.pause();
        });
      }, { threshold: 0.35 }).observe(v);
    }
  }

  function initLightbox() {
    var lb = $('#lightbox'), img = $('#lightbox-img');
    var items = $$('.gallery-item');
    if (!lb || !img || !items.length || typeof lb.showModal !== 'function') return;
    var idx = 0, opener = null;
    function show(i) {
      idx = (i + items.length) % items.length;
      img.src = items[idx].getAttribute('data-full');
      img.alt = items[idx].getAttribute('data-alt');
    }
    items.forEach(function (it, i) {
      it.addEventListener('click', function () { opener = it; show(i); lb.showModal(); });
    });
    lb.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lb]');
      if (b) { var a = b.getAttribute('data-lb'); if (a === 'close') lb.close(); else show(idx + parseInt(a, 10)); return; }
      if (e.target === lb) lb.close();
    });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') show(idx + 1);
      if (e.key === 'ArrowLeft') show(idx - 1);
    });
    var sx = null;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (sx === null) return; var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); sx = null;
    });
    lb.addEventListener('close', function () { if (opener) opener.focus({ preventScroll: true }); });
  }

  function initPartyForm() {
    var form = $('#party-form');
    if (!form) return;
    var qty = form.elements.qty, sum = $('#party-sum'), hint = $('#party-hint'), err = $('#pf-error');
    function n() { var v = parseInt(qty.value, 10); return isNaN(v) ? 0 : v; }
    function update() {
      var q = Math.max(0, n());
      sum.textContent = 'ab ' + euro(Math.max(q, 0) * PARTY_PRICE);
      if (q >= PARTY_BONUS) {
        hint.textContent = '🎁 Inklusive Gratis-Käsekuchen (20 × 20 cm)!';
        hint.classList.add('is-bonus');
      } else {
        hint.textContent = q < PARTY_MIN ? 'Mindestmenge: ' + PARTY_MIN + ' Stück.' : 'Noch ' + (PARTY_BONUS - q) + ' Stück bis zum Gratis-Käsekuchen.';
        hint.classList.remove('is-bonus');
      }
    }
    $$('[data-pstep]', form).forEach(function (b) {
      b.addEventListener('click', function () {
        qty.value = String(Math.max(PARTY_MIN, Math.min(1000, n() + parseInt(b.getAttribute('data-pstep'), 10))));
        update();
      });
    });
    qty.addEventListener('input', update);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = n(), name = form.elements.name.value.trim(), when = form.elements.when.value.trim();
      if (q < PARTY_MIN || !name || !when) {
        err.hidden = false;
        (q < PARTY_MIN ? qty : (!when ? form.elements.when : form.elements.name)).focus();
        return;
      }
      err.hidden = true;
      var prefs = $$('input[name="pref"]:checked', form).map(function (c) { return c.value; });
      var occ = form.elements.occasion.value.trim(), notes = form.elements.notes.value.trim();
      var msg = 'Hallo Feinbäckerei Friedenau,\n\nich möchte gerne Partysnacks bestellen:\n' +
        'Anzahl: ' + q + ' Stück' + (q >= PARTY_BONUS ? ' (inkl. Gratis-Käsekuchen 20 × 20 cm)' : '') +
        '\nBeläge: ' + (prefs.length ? prefs.join(', ') : 'nach Ihrer Empfehlung') +
        '\nAbholung: ' + when +
        (occ ? '\nAnlass: ' + occ : '') +
        (notes ? '\nAnmerkung: ' + notes : '') +
        '\nName: ' + name +
        '\n\nBitte um Bestätigung und den genauen Preis. Danke!';
      if (!e.submitter || e.submitter.value !== 'whatsapp') {
        submitEmail(form, msg, '#pf-status');
        return;
      }
      window.open('https://wa.me/' + WA_PHONE + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    });
    update();
  }

  /* ------------------------------------------------------------------
     Start
     ------------------------------------------------------------------ */
  function init() {
    document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('js');
    var y = $('#year'); if (y) y.textContent = String(new Date().getFullYear());

    renderStatus();
    setInterval(renderStatus, 30000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) renderStatus(); });

    initNav();
    initFab();
    initScroll();
    initReveal();
    initSortiment();
    initDialogs();
    initMap();
    initCart();
    initPreorder();
    initPartyVideo();
    initLightbox();
    initPartyForm();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
