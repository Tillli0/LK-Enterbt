// Beantwortet die Abrufe der Seitenleisten (/api/lernen/formeln, /api/notizzettel) im Browser.
// Merkliste und Notizzettel liegen im lokalen Speicher dieses Browsers — nichts verlässt das Gerät.
(function () {
  var BASIS = "/LK-Enterbt";
  var echt = window.fetch.bind(window);
  var formelnP = null;
  function formeln() { return (formelnP = formelnP || echt(BASIS + "/formeln.json").then(function (r) { return r.json(); })); }
  function lies(k, d) { try { var v = localStorage.getItem("lk-enterbt-" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function schreib(k, v) { try { localStorage.setItem("lk-enterbt-" + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function antwort(obj, status) { return new Response(JSON.stringify(obj), { status: status || 200, headers: { "content-type": "application/json" } }); }
  function jetzt() { return new Date().toISOString().slice(0, 19).replace("T", " "); }
  function speicher() { var s = lies("zettel", null); if (!s) { s = { weiter: 2, zettel: [{ id: 1, titel: "Zettel", zeilen: [""], striche: [], geaendertAm: jetzt() }] }; schreib("zettel", s); } return s; }
  function mitPin(f, pins) { return Object.assign({}, f, { angepinnt: !!pins[f.id] }); }

  window.fetch = function (eingabe, optionen) {
    var url = new URL(typeof eingabe === "string" ? eingabe : eingabe.url, location.href);
    var methode = ((optionen && optionen.method) || (eingabe && eingabe.method) || "GET").toUpperCase();
    var pfad = url.pathname;

    if (/\/api\/lernen\/formeln$/.test(pfad)) {
      if (methode === "POST") {
        return Promise.resolve(optionen && optionen.body ? JSON.parse(optionen.body) : {}).then(function (b) {
          var pins = lies("pins", {}); var id = b.erklaerung + "#" + b.nr;
          if (b.an) pins[id] = Date.now(); else delete pins[id];
          schreib("pins", pins); return antwort({ ok: true });
        });
      }
      return formeln().then(function (alle) {
        var pins = lies("pins", {});
        var erkl = url.searchParams.get("erklaerung") || ((/\/erklaert\/([^/]+)/.exec(location.pathname) || [])[1]);
        var thema = erkl && alle[decodeURIComponent(erkl)] ? alle[decodeURIComponent(erkl)] : { themaTitel: null, formeln: [] };
        var ids = {}; var flach = [];
        Object.keys(alle).forEach(function (k) { alle[k].formeln.forEach(function (f) { if (!ids[f.id]) { ids[f.id] = 1; flach.push(f); } }); });
        var merk = flach.filter(function (f) { return pins[f.id]; }).sort(function (a, b) { return pins[a.id] - pins[b.id]; }).map(function (f) { return mitPin(f, pins); });
        return antwort({ themaTitel: thema.themaTitel, formeln: thema.formeln.map(function (f) { return mitPin(f, pins); }), merkliste: merk });
      });
    }

    var z = /\/api\/notizzettel(?:\/(\d+))?$/.exec(pfad);
    if (z) {
      var s = speicher(); var id = z[1] ? Number(z[1]) : null;
      var eintrag = id !== null ? s.zettel.filter(function (x) { return x.id === id; })[0] : null;
      if (id === null && methode === "GET") return Promise.resolve(antwort({ zettel: s.zettel.map(function (x) { return { id: x.id, titel: x.titel, geaendertAm: x.geaendertAm }; }) }));
      if (id === null && methode === "POST") {
        return Promise.resolve(optionen && optionen.body ? JSON.parse(optionen.body) : {}).then(function (b) {
          var neu = { id: s.weiter++, titel: String((b && b.titel) || "Zettel").slice(0, 80), zeilen: [""], striche: [], geaendertAm: jetzt() };
          s.zettel.push(neu); schreib("zettel", s); return antwort(neu);
        });
      }
      if (!eintrag) return Promise.resolve(antwort({ fehler: "nicht gefunden" }, 404));
      if (methode === "GET") return Promise.resolve(antwort(eintrag));
      if (methode === "DELETE") { s.zettel = s.zettel.filter(function (x) { return x.id !== id; }); schreib("zettel", s); return Promise.resolve(antwort({ ok: true })); }
      if (methode === "PUT") {
        return Promise.resolve(optionen && optionen.body ? JSON.parse(optionen.body) : {}).then(function (b) {
          if (b.titel !== undefined) eintrag.titel = String(b.titel).trim().slice(0, 80) || "Zettel";
          if (b.zeilen !== undefined) eintrag.zeilen = b.zeilen.length ? b.zeilen : [""];
          if (b.striche !== undefined) eintrag.striche = b.striche;
          eintrag.geaendertAm = jetzt();
          return schreib("zettel", s) ? antwort({ ok: true }) : antwort({ fehler: "Speicher voll" }, 507);
        });
      }
    }
    return echt(eingabe, optionen);
  };
})();
