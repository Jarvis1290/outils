/* ============================================================================
   🔍 Recherche commune · Suivi Véhicules et Suite Atelier (calcul), sur le modèle de Kardex
   Le MÊME fichier dans les deux apps : même champ, même clavier que Kardex (chiffres +
   QWERTZ + accents), mêmes mots proposés et mêmes résultats directs. Kardex n'est pas touché.
   Chaque app ne fournit que sa liste de choses à trouver :

   Recherche.init({
     cle:"sv",                         // préfixe localStorage (dernières recherches, choix fréquents)
     nom:"Suivi Véhicules",            // affiché dans le champ
     couleur:"#3DD39B",                // couleur d'accent de l'app
     bouton:"#rqBtn",                  // bouton(s) qui ouvrent la recherche
     exemples:["vidange","Shell"],     // proposés quand le champ est vide
     clavier:()=>true,                 // clavier de l'app ? (défaut : écran tactile)
     source:()=>[{id,g,ic,c,t,s,v,x,d,p,go}],  // g groupe, ic emoji, t titre, s sous-titre, v valeur à droite,
                                       // x mots cachés, d date ISO, p:1 = raccourci (page), go() = ouvrir
     direct:q=>[...]                   // facultatif : résultats calculés (ex. M8, 20 H7)
   });
   Recherche.ouvrir("texte") · Recherche.fermer() → true si c'était ouvert · Recherche.ouvert()
   ============================================================================ */
(function () {
  "use strict";
  var VERSION = "1.0";
  var O = null, EL = null, IN = null, RES = null, SUG = null, KBD = null, KBK = null;
  var ITEMS = [], VOC = null, kbLayer = "abc", kbShift = false, kbShown = false, more = {}, last = [];

  /* ---------- texte : minuscules, sans accents, virgule décimale = point (même longueur, pour surligner) ---------- */
  function nc(c) {
    if (c === "," || c === "×") return c === "," ? "." : "x";
    var n = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return n.charAt(0) || c;
  }
  function norm(s) { s = String(s == null ? "" : s); var o = ""; for (var i = 0; i < s.length; i++) o += nc(s[i]); return o; }
  function words(n) { return n.split(/[^a-z0-9.øß]+/).map(function (w) { return w.replace(/^\.+|\.+$/g, ""); }).filter(Boolean); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var p = [], i, j;
    for (j = 0; j <= b.length; j++) p[j] = j;
    for (i = 1; i <= a.length; i++) {
      var c = [i], lo = i;
      for (j = 1; j <= b.length; j++) { c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (c[j] < lo) lo = c[j]; }
      if (lo > max) return max + 1;
      p = c;
    }
    return p[b.length];
  }
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  function dateMots(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ""); if (!m || m[1] === "0000") return ""; return m[1] + " " + MOIS[+m[2] - 1] + " " + (+m[3]) + "." + (+m[2]) + "." + m[1]; }

  /* ---------- mémoire : dernières recherches + choix fréquents ---------- */
  function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(O.cle + "-rq-" + k)); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(O.cle + "-rq-" + k, JSON.stringify(v)); } catch (e) { } }
  function histAdd(q) { q = q.trim(); if (q.length < 2) return; var h = lsGet("hist", []).filter(function (x) { return norm(x) !== norm(q); }); h.unshift(q); lsSet("hist", h.slice(0, 8)); }
  function useAdd(id) { if (!id) return; var u = lsGet("use", {}); u[id] = (u[id] || 0) + 1; lsSet("use", u); }

  /* ---------- index ---------- */
  function prep(it) {
    var H = norm([it.t, it.s, it.x, it.g, dateMots(it.d)].join(" "));
    it._H = H; it._W = words(H); it._T = words(norm(it.t));
    return it;
  }
  function load() {
    var L = [];
    try { L = O.source() || []; } catch (e) { console.warn("Recherche : source", e); }
    ITEMS = L.filter(function (x) { return x && x.t; }).map(prep);
    VOC = null;
  }
  function vocab() {
    if (VOC) return VOC;
    var m = new Map(), nx = new Map(), u = lsGet("use", {});
    ITEMS.forEach(function (it) {
      var k = 1 + (u[it.id] || 0) / 2;
      [it.t, it.s, it.x, it.g].forEach(function (txt, z) {
        String(txt || "").split(/[\s·,;:/()«»"]+/).forEach(function (w) {
          w = w.replace(/^[.\-#]+|[.\-]+$/g, ""); var n = norm(w);
          if (n.length < 2 || /^[\d.]+$/.test(n) && n.length < 3) return;
          var o = m.get(n) || { w: w, n: n, k: 0 }; o.k += z === 0 ? k : k / 2; m.set(n, o);
        });
      });
      var ws = String(it.t).split(/\s+/);
      ws.forEach(function (w, i) { if (!ws[i + 1]) return; var p = norm(w), s = nx.get(p) || new Map(); s.set(ws[i + 1], (s.get(ws[i + 1]) || 0) + 1); nx.set(p, s); });
    });
    return (VOC = { words: Array.from(m.values()), next: nx });
  }

  /* ---------- recherche : chaque mot tapé doit se retrouver (début de mot, dedans, ou 1 faute) ---------- */
  function tokScore(it, q) {
    var best = 0, W = it._W;
    for (var i = 0; i < W.length; i++) { var w = W[i]; if (w === q) { best = 3; break; } if (best < 2 && w.indexOf(q) === 0) best = 2; }
    if (!best && q.length >= 2 && it._H.indexOf(q) >= 0) best = 1;
    if (!best && q.length >= 4 && !/^[\d.]+$/.test(q)) {
      for (i = 0; i < W.length; i++) { if (W[i].length >= 3 && (lev(q, W[i], 1) <= 1 || lev(q, W[i].slice(0, q.length), 1) <= 1)) { best = 0.7; break; } }
    }
    if (best && it._T.some(function (w) { return w.indexOf(q) === 0; })) best += 0.6;
    return best;
  }
  function find(q) {
    var toks = words(norm(q)); if (!toks.length) return [];
    var u = lsGet("use", {}), out = [];
    ITEMS.forEach(function (it) {
      var s = 0;
      for (var i = 0; i < toks.length; i++) { var x = tokScore(it, toks[i]); if (!x) return; s += x; }
      if (norm(it.t).indexOf(norm(q).trim()) === 0) s += 1.5;
      s += Math.min(2, (u[it.id] || 0) * 0.3);
      if (it.p) s += 0.4;
      out.push({ it: it, s: s });
    });
    out.sort(function (a, b) { return b.s - a.s || String(b.it.d || "").localeCompare(String(a.it.d || "")); });
    return out.map(function (r) { return r.it; });
  }
  function directs(q) {
    if (!O.direct || !q.trim()) return [];
    try { return (O.direct(q) || []).filter(function (x) { return x && x.t; }); } catch (e) { console.warn("Recherche : direct", e); return []; }
  }

  /* ---------- surligner les mots tapés ---------- */
  function hl(txt, toks) {
    txt = String(txt == null ? "" : txt); if (!toks.length || !txt) return esc(txt);
    var n = norm(txt), mark = new Array(txt.length).fill(false);
    toks.forEach(function (t) {
      if (!t) return; var re = 0, at;
      while ((at = n.indexOf(t, re)) >= 0) { var st = at === 0 || /[^a-z0-9]/.test(n[at - 1]); if (st || t.length >= 3) for (var k = at; k < at + t.length; k++) mark[k] = true; re = at + 1; }
    });
    var o = "", on = false;
    for (var i = 0; i < txt.length; i++) { if (mark[i] !== on) { o += mark[i] ? "<mark>" : "</mark>"; on = mark[i]; } o += esc(txt[i]); }
    return o + (on ? "</mark>" : "");
  }

  /* ---------- affichage ---------- */
  function row(it, toks, i, top) {
    return '<button type="button" class="rq-r' + (top ? " top" : "") + '" data-i="' + i + '" style="--c:' + esc(it.c || O.couleur) + '">'
      + '<span class="rq-ic">' + (it.ic || "•") + '</span>'
      + '<span class="rq-t"><b>' + hl(it.t, toks) + '</b>' + (it.s ? '<small>' + hl(it.s, toks) + '</small>' : "") + '</span>'
      + (it.v ? '<span class="rq-v">' + esc(it.v) + '</span>' : "") + '<i aria-hidden="true">›</i></button>';
  }
  function draw() {
    var q = IN.value, toks = words(norm(q)), h = "";
    EL.querySelector(".rq-x").hidden = !q;
    last = [];
    if (!toks.length) {
      var hist = lsGet("hist", []), pages = ITEMS.filter(function (x) { return x.p; });
      if (hist.length) h += '<div class="rq-g">🕘 Dernières recherches <button type="button" class="rq-clr" data-clr="1">Effacer</button></div><div class="rq-hist">' + hist.map(function (x) { return '<button type="button" data-q="' + esc(x) + '">' + esc(x) + '</button>'; }).join("") + '</div>';
      if (pages.length) { h += '<div class="rq-g">🧭 Aller à</div><div class="rq-pages">' + pages.map(function (it) { last.push(it); return '<button type="button" data-i="' + (last.length - 1) + '" style="--c:' + esc(it.c || O.couleur) + '"><span>' + (it.ic || "•") + '</span>' + esc(it.t) + '</button>'; }).join("") + '</div>'; }
      if (!hist.length && !pages.length) h += '<p class="rq-hint">Tape un mot, un chiffre ou une date.</p>';
      RES.innerHTML = h; sugg(); return;
    }
    var D = directs(q), F = find(q), groups = [], byG = {};
    D.forEach(function (it) { it._dir = 1; });
    D.concat(F).forEach(function (it) { var g = it.g || "Résultats"; if (!byG[g]) { byG[g] = []; groups.push(g); } byG[g].push(it); });
    if (!groups.length) {
      var alt = altWords(toks);
      h = '<div class="rq-none"><div>🤷 Rien trouvé pour « ' + esc(q.trim()) + ' »</div>' + (alt.length ? '<div class="rq-alt">Tu voulais dire : ' + alt.map(function (a) { return '<button type="button" data-q="' + esc(a) + '">' + esc(a) + '</button>'; }).join(" ") + '</div>' : (O.exemples && O.exemples.length ? '<div class="rq-alt">Essaie : ' + O.exemples.slice(0, 4).map(function (a) { return '<button type="button" data-q="' + esc(a) + '">' + esc(a) + '</button>'; }).join(" ") + '</div>' : "")) + '</div>';
      RES.innerHTML = h; sugg(); return;
    }
    var n = 0;
    groups.forEach(function (g) {
      var L = byG[g], lim = more[g] ? 200 : 5;
      h += '<div class="rq-g">' + esc(g) + ' <span>' + L.length + '</span></div><div class="rq-l">';
      L.slice(0, lim).forEach(function (it) { last.push(it); h += row(it, toks, last.length - 1, n++ === 0); });
      h += '</div>';
      if (L.length > lim) h += '<button type="button" class="rq-more" data-g="' + esc(g) + '">Voir les ' + L.length + '</button>';
    });
    RES.innerHTML = h; sugg();
  }
  function altWords(toks) {
    var V = vocab().words, ch = false;
    var fixed = toks.map(function (t) {
      if (t.length < 3) return t;
      var b = V.map(function (o) { return { o: o, d: Math.min(lev(t, o.n, 2), lev(t, o.n.slice(0, t.length), 2) + 0.5) }; })
        .filter(function (x) { return x.d <= 2; }).sort(function (a, b) { return a.d - b.d || b.o.k - a.o.k; })[0];
      if (b && b.o.n !== t) { ch = true; return b.o.w; }
      return t;
    });
    return ch ? [fixed.join(" ")] : [];
  }

  /* ---------- mots proposés (au-dessus du clavier, comme dans Kardex) ---------- */
  function curWord() {
    var v = IN.value, p = IN.selectionStart == null ? v.length : IN.selectionStart, b = v.slice(0, p), m = b.match(/(\S*)$/);
    var before = b.slice(0, b.length - m[1].length).trim().split(/\s+/);
    return { part: m[1], prev: before[before.length - 1] || "" };
  }
  function sugg() {
    var h = "", q = IN.value;
    if (!q.trim()) {
      h = (O.exemples || []).map(function (x) { return '<button type="button" data-kv="' + esc(x) + '" data-mode="full">' + esc(x) + '</button>'; }).join("");
    } else {
      // les 2 meilleurs résultats d'abord : un toucher et c'est ouvert
      h = last.slice(0, 2).map(function (it, i) { return '<button type="button" class="rq-kfl" data-i="' + i + '">' + (it.ic ? '<span>' + it.ic + '</span> ' : "") + esc(it.t.length > 26 ? it.t.slice(0, 25) + "…" : it.t) + '</button>'; }).join("");
      var cw = curWord(), p = norm(cw.part), V = vocab(), l = [];
      if (p) {
        l = V.words.filter(function (o) { return o.n.indexOf(p) === 0 && o.n !== p; }).sort(function (a, b) { return b.k - a.k || a.n.length - b.n.length; }).slice(0, 5);
        if (!l.length && p.length >= 3) l = V.words.filter(function (o) { return o.n !== p && lev(p, o.n.slice(0, p.length + 1), 1) <= 1; }).sort(function (a, b) { return b.k - a.k; }).slice(0, 3);
      } else if (cw.prev) {
        var s = V.next.get(norm(cw.prev)); if (s) l = Array.from(s.entries()).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5).map(function (e) { return { w: e[0] }; });
      }
      var tops = last.slice(0, 2).map(function (it) { return norm(it.t); });
      l = l.filter(function (o) { return tops.indexOf(norm(o.w)) < 0; });
      h += l.map(function (o) { return '<button type="button" data-kv="' + esc(o.w) + '" data-mode="word">' + esc(o.w) + '</button>'; }).join("");
    }
    SUG.innerHTML = h || '<span class="rq-kbh">🔍 ' + esc(O.nom || "Recherche") + '</span>';
  }

  /* ---------- clavier (le même que Kardex) ---------- */
  var ROWS = {
    abc: [["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], ["q", "w", "e", "r", "t", "z", "u", "i", "o", "p", "è"], ["a", "s", "d", "f", "g", "h", "j", "k", "l", "é", "à"], ["⇧", "y", "x", "c", "v", "b", "n", "m", "-", ".", "⌫"], ["#+=", "#", ",", "␣", "/", "↵"]],
    sym: [["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], ["Ø", "°", "×", "+", "(", ")", "\"", "'", "&", "%"], ["ä", "ö", "ü", "ç", "ê", "â", "ô", "î", "ù", "#"], ["@", "*", ":", ";", "!", "?", "=", "_", "²", "⌫"], ["abc", ",", "␣", "/", "↵"]]
  };
  function kbWanted() { try { return O.clavier ? !!O.clavier() : matchMedia("(pointer:coarse)").matches; } catch (e) { return false; } }
  function kbDraw() {
    KBK.innerHTML = ROWS[kbLayer].map(function (r) {
      return '<div class="rq-kr">' + r.map(function (k) {
        var lab = k === "␣" ? "espace" : k === "↵" ? "OK" : (kbShift && k.length === 1 ? k.toUpperCase() : k);
        var cls = k === "␣" ? "sp" : k === "↵" ? "ok" : ["⇧", "⌫", "#+=", "abc"].indexOf(k) >= 0 ? "fn" : "";
        return '<button type="button" class="' + cls + (k === "⇧" && kbShift ? " on" : "") + '" data-k="' + esc(k) + '">' + esc(lab) + '</button>';
      }).join("") + '</div>';
    }).join("");
  }
  function kbShow(on) {
    kbShown = on && kbWanted();
    KBD.hidden = !kbShown;
    if (kbShown) KBD.insertBefore(SUG, KBK); else EL.insertBefore(SUG, RES);
    EL.classList.toggle("kb", kbShown);
  }
  function put(txt, del, replace) {
    var v = IN.value, s = IN.selectionStart, e = IN.selectionEnd;
    if (s == null) { s = e = v.length; }
    var nv, pos;
    if (replace != null) { nv = v.slice(0, s - replace) + txt + v.slice(e); pos = s - replace + txt.length; }
    else if (del) { if (s === e && s > 0) { nv = v.slice(0, s - 1) + v.slice(e); pos = s - 1; } else { nv = v.slice(0, s) + v.slice(e); pos = s; } }
    else { nv = v.slice(0, s) + txt + v.slice(e); pos = s + txt.length; }
    IN.value = nv; try { IN.setSelectionRange(pos, pos); } catch (x) { }
    draw();
  }
  function buzz() { if (navigator.vibrate) try { navigator.vibrate(4); } catch (x) { } }

  /* ---------- ouvrir un résultat ---------- */
  function pick(it) {
    if (!it) return;
    if (!it.p) histAdd(IN.value);
    useAdd(it.id);
    fermer(true);
    setTimeout(function () { try { it.go && it.go(); } catch (e) { console.warn("Recherche : ouvrir", e); } }, 30);
  }

  /* ---------- construction ---------- */
  function build() {
    var st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    EL = document.createElement("div");
    EL.className = "rq"; EL.hidden = true; EL.setAttribute("role", "dialog"); EL.setAttribute("aria-label", "Recherche");
    EL.style.setProperty("--rq-acc", O.couleur || "#F5B82E");
    EL.innerHTML = '<div class="rq-top"><button type="button" class="rq-back" aria-label="Fermer la recherche">‹</button>'
      + '<label class="rq-f"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6"/></svg>'
      + '<input class="rq-in" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Rechercher">'
      + '<button type="button" class="rq-x" aria-label="Effacer" hidden>✕</button></label></div>'
      + '<div class="rq-sug"></div><div class="rq-res"></div>'
      + '<div class="rq-kb" hidden><div class="rq-kbk"></div></div>';
    document.body.appendChild(EL);
    IN = EL.querySelector(".rq-in"); RES = EL.querySelector(".rq-res"); SUG = EL.querySelector(".rq-sug"); KBD = EL.querySelector(".rq-kb"); KBK = EL.querySelector(".rq-kbk");
    IN.placeholder = "Chercher dans " + (O.nom || "l'app") + "…";
    EL.querySelector(".rq-back").onclick = function () { fermer(); };
    EL.querySelector(".rq-x").onclick = function () { IN.value = ""; more = {}; draw(); IN.focus(); kbShow(true); };
    IN.addEventListener("input", function () { more = {}; draw(); });
    IN.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); if (last[0] && IN.value.trim()) pick(last[0]); }
      if (e.key === "Escape") { e.preventDefault(); fermer(); }
    });
    IN.addEventListener("pointerdown", function () { if (!kbShown) kbShow(true); });
    IN.addEventListener("keyup", sugg); IN.addEventListener("click", sugg);
    // suggestions et clavier : on garde le curseur dans le champ
    [SUG, KBD].forEach(function (z) {
      z.addEventListener("pointerdown", function (e) { e.preventDefault(); var b = e.target.closest("button"); if (b) { b.classList.add("pr"); setTimeout(function () { b.classList.remove("pr"); }, 120); } });
    });
    SUG.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return; buzz();
      if (b.dataset.i != null) { pick(last[+b.dataset.i]); return; }
      if (b.dataset.mode === "full") { IN.value = b.dataset.kv + " "; draw(); return; }
      put(b.dataset.kv + " ", 0, curWord().part.length);
    });
    KBD.addEventListener("click", function (e) {
      var b = e.target.closest("[data-k]"); if (!b) return; var k = b.dataset.k; buzz();
      if (k === "⇧") { kbShift = !kbShift; kbDraw(); return; }
      if (k === "#+=") { kbLayer = "sym"; kbDraw(); return; }
      if (k === "abc") { kbLayer = "abc"; kbDraw(); return; }
      if (k === "⌫") { put("", 1); return; }
      if (k === "↵") { histAdd(IN.value); kbShow(false); IN.blur(); return; }
      put(k === "␣" ? " " : kbShift ? k.toUpperCase() : k);
      if (kbShift) { kbShift = false; kbDraw(); }
    });
    RES.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.dataset.clr) { lsSet("hist", []); draw(); return; }
      if (b.dataset.q != null) { IN.value = b.dataset.q + " "; draw(); return; }
      if (b.dataset.g != null) { more[b.dataset.g] = 1; draw(); return; }
      if (b.dataset.i != null) pick(last[+b.dataset.i]);
    });
    // faire défiler les résultats range le clavier (on voit tout)
    var y0 = null;
    RES.addEventListener("touchstart", function (e) { y0 = e.touches[0].clientY; }, { passive: true });
    RES.addEventListener("touchmove", function (e) { if (kbShown && y0 != null && Math.abs(e.touches[0].clientY - y0) > 24) { kbShow(false); IN.blur(); y0 = null; } }, { passive: true });
    kbDraw();
  }
  function ouvrir(q) {
    if (!EL) build();
    load(); more = {};
    IN.value = q || "";
    var kb = kbWanted();
    if (kb) IN.setAttribute("inputmode", "none"); else IN.removeAttribute("inputmode");
    EL.hidden = false; document.documentElement.classList.add("rq-on");
    requestAnimationFrame(function () { EL.classList.add("in"); });
    kbLayer = "abc"; kbShift = false; kbDraw(); kbShow(true); draw();
    setTimeout(function () { try { IN.focus({ preventScroll: true }); var n = IN.value.length; IN.setSelectionRange(n, n); } catch (e) { } }, 40);
  }
  function fermer(quiet) {
    if (!EL || EL.hidden) return false;
    if (!quiet) histAdd(IN.value);
    EL.classList.remove("in"); EL.hidden = true; kbShow(false);
    document.documentElement.classList.remove("rq-on");
    try { IN.blur(); } catch (e) { }
    return true;
  }
  function init(o) {
    O = Object.assign({ cle: "app", nom: "", couleur: "#F5B82E", exemples: [], source: function () { return []; } }, o || {});
    var bs = typeof O.bouton === "string" ? document.querySelectorAll(O.bouton) : O.bouton ? [O.bouton] : [];
    Array.prototype.forEach.call(bs, function (b) { b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); ouvrir(); }, true); });
  }

  var CSS = [
    ".rq{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;background:#0E1116;color:#EEF0F4;font-family:inherit;opacity:0;transform:translateY(10px);transition:opacity .16s,transform .16s;overscroll-behavior:contain;height:100dvh}",
    ".rq[hidden]{display:none}.rq.in{opacity:1;transform:none}",
    "html.rq-on,html.rq-on body{overflow:hidden}",
    ".rq button{font-family:inherit;-webkit-tap-highlight-color:transparent}",
    ".rq-top{display:flex;gap:8px;align-items:center;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 8px}",
    ".rq-back{flex:none;width:42px;height:46px;border:0;border-radius:12px;background:#171B22;color:#EEF0F4;font-size:30px;line-height:1;cursor:pointer;padding:0 0 4px}",
    ".rq-f{flex:1;min-width:0;display:flex;align-items:center;gap:8px;height:46px;padding:0 6px 0 12px;border-radius:14px;background:#171B22;border:2px solid var(--rq-acc)}",
    ".rq-f svg{flex:none;width:20px;height:20px;color:var(--rq-acc)}",
    ".rq-in{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#EEF0F4;font:600 17px/1.2 inherit;font-family:inherit;padding:0;caret-color:var(--rq-acc)}",
    ".rq-in::placeholder{color:#7D8592;font-weight:500}",
    ".rq-x{flex:none;width:34px;height:34px;border:0;border-radius:50%;background:#2B3038;color:#C9CED6;font-size:14px;cursor:pointer}",
    ".rq-sug{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;min-height:40px;align-items:center;padding:2px 12px 6px;flex:none}",
    ".rq-kb .rq-sug{padding:2px 2px 6px}",
    ".rq-sug::-webkit-scrollbar{display:none}",
    ".rq-sug button{flex:none;border:1px solid #2A2F38;background:#1C2027;color:#EEF0F4;border-radius:10px;padding:7px 12px;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap}",
    ".rq-sug button.rq-kfl{border-color:var(--rq-acc);color:var(--rq-acc)}",
    ".rq-sug button span{display:inline-flex;vertical-align:-3px}.rq-sug button span svg{width:17px;height:17px}",
    ".rq .rq-in:focus,.rq .rq-in:focus-visible{outline:none!important;box-shadow:none!important}",
    ".rq button:focus-visible{outline:2px solid var(--rq-acc);outline-offset:1px}",
    ".rq-sug button.pr{background:#4A515C}",
    ".rq-kbh{font-size:12px;color:#7D8592;padding-left:6px}",
    ".rq-res{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 12px 16px}",
    ".rq-g{display:flex;align-items:center;gap:8px;margin:14px 2px 6px;font-size:12.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#A9B0BC}",
    ".rq-g span{font-weight:700;color:#7D8592;letter-spacing:0}",
    ".rq-clr{margin-left:auto;border:0;background:none;color:#7D8592;font-size:12px;text-transform:none;letter-spacing:0;cursor:pointer}",
    ".rq-l{display:flex;flex-direction:column;gap:6px}",
    ".rq-r{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:1px solid #232831;background:#171B22;color:#EEF0F4;border-radius:14px;padding:9px 10px;cursor:pointer;min-height:54px}",
    ".rq-r:active{transform:scale(.985);background:#1E232B}",
    ".rq-r.top{border-color:color-mix(in srgb,var(--c) 60%,transparent);background:color-mix(in srgb,var(--c) 9%,#171B22)}",
    ".rq-ic{flex:none;width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-size:19px;background:color-mix(in srgb,var(--c) 18%,transparent);color:var(--c)}",
    ".rq-ic svg{width:22px;height:22px}",
    ".rq-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}",
    ".rq-t b{font-size:15.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".rq-t small{font-size:12.5px;color:#A9B0BC;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".rq-v{flex:none;font-size:13.5px;font-weight:700;color:var(--c);max-width:40%;text-align:right}",
    ".rq-r>i{flex:none;font-style:normal;color:#4A515C;font-size:20px}",
    ".rq mark{background:color-mix(in srgb,var(--rq-acc) 30%,transparent);color:inherit;border-radius:3px;padding:0 1px}",
    ".rq-more{display:block;width:100%;margin-top:6px;border:1px dashed #2A2F38;background:none;color:#A9B0BC;border-radius:12px;padding:9px;font-size:13.5px;font-weight:700;cursor:pointer}",
    ".rq-hist{display:flex;flex-wrap:wrap;gap:6px}",
    ".rq-hist button,.rq-alt button{border:1px solid #2A2F38;background:#171B22;color:#EEF0F4;border-radius:999px;padding:7px 13px;font-size:14px;cursor:pointer}",
    ".rq-pages{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px}",
    ".rq-pages button{display:flex;align-items:center;gap:8px;border:1px solid #232831;background:#171B22;color:#EEF0F4;border-radius:12px;padding:9px 10px;font-size:14px;font-weight:600;text-align:left;cursor:pointer}",
    ".rq-pages button span{width:28px;height:28px;flex:none;border-radius:8px;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 18%,transparent);color:var(--c);font-size:16px}",
    ".rq-pages button span svg{width:18px;height:18px}",
    ".rq-none{padding:30px 6px;text-align:center;color:#A9B0BC;font-size:15px;display:flex;flex-direction:column;gap:12px;align-items:center}",
    ".rq-alt{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:center}",
    ".rq-alt button{border-color:var(--rq-acc);color:var(--rq-acc)}",
    ".rq-hint{color:#7D8592;text-align:center;margin:30px 0}",
    ".rq-kb{flex:none;background:#0B0D11;border-top:1px solid #2A2F38;padding:4px max(4px,env(safe-area-inset-right,0px)) calc(6px + env(safe-area-inset-bottom,0px)) max(4px,env(safe-area-inset-left,0px));user-select:none;-webkit-user-select:none;touch-action:manipulation}",
    ".rq-kb[hidden]{display:none}",
    ".rq-kbk{display:flex;flex-direction:column;gap:6px;max-width:720px;margin:0 auto}",
    ".rq-kr{display:flex;gap:4px}",
    ".rq-kr button{flex:1 1 0;min-width:0;height:44px;border:0;border-radius:8px;background:#2B3038;color:#EEF0F4;font-size:18px;font-weight:500;cursor:pointer;padding:0}",
    ".rq-kr button.fn{background:#1C2027;font-size:14px;flex-grow:1.3}",
    ".rq-kr button.on{background:var(--rq-acc);color:#14110A}",
    ".rq-kr button.sp{flex-grow:4;font-size:13px;color:#7D8592}",
    ".rq-kr button.ok{flex-grow:1.6;background:var(--rq-acc);color:#14110A;font-weight:800;font-size:15px}",
    ".rq-kr button.pr{background:#4A515C}",
    "@media (prefers-reduced-motion:reduce){.rq{transition:none}}"
  ].join("\n");

  window.Recherche = { init: init, ouvrir: ouvrir, fermer: function () { return fermer(); }, ouvert: function () { return !!(EL && !EL.hidden); }, version: VERSION, norm: norm };
})();
