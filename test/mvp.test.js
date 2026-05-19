const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = require("../frontend/app.js");
const aanbiedingenUpdater = require("../scripts/update-aanbiedingen.js");
const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("YAML startdata bevat de gevraagde boodschappen", () => {
  const items = app.parseYamlItems(read("frontend/data/boodschappen.yml"));
  assert.deepEqual(items.map((item) => item.naam), ["Kwark", "Sprite Zero", "aardbeien", "blauwe bessen"]);
  assert.ok(items.every((item) => app.SUPERMARKTEN.every((supermarkt) => item.supermarkten.includes(supermarkt))));
});

test("items worden per categorie als route gegroepeerd en lokaal te combineren", () => {
  const seed = app.parseYamlItems(read("frontend/data/boodschappen.yml"));
  const eigen = app.normaliseerItem({ naam: "komkommer", categorie: "Groente", supermarkten: ["Lidl"], eigenItem: true });
  const gecombineerd = app.combineerItems(seed, [eigen, { ...seed[0], afgevinkt: true }]);
  const groepen = app.groepeerVoorRoute(gecombineerd, "Lidl");

  assert.equal(gecombineerd.find((item) => item.naam === "Kwark").afgevinkt, true);
  assert.deepEqual(Object.keys(groepen), ["Zuivel", "Groente", "Fruit", "Dranken"]);
  assert.equal(groepen.Groente[0].naam, "komkommer");
});

test("boodschappenitems kunnen los van supermarkten worden verwijderd", () => {
  const items = [
    app.normaliseerItem({ id: "melk", naam: "melk", categorie: "Zuivel", supermarkten: ["AH"] }),
    app.normaliseerItem({ id: "brood", naam: "brood", categorie: "Brood", supermarkten: ["Lidl"] })
  ];

  const bijgewerkt = app.verwijderItem(items, "melk");

  assert.deepEqual(bijgewerkt.map((item) => item.id), ["brood"]);
  assert.deepEqual(app.normaliseerSupermarkten(["AH", "Lidl"]), ["AH", "Lidl"]);
});

test("supermarkt verwijderen behoudt items en koppelt die supermarkt los", () => {
  const items = [
    app.normaliseerItem({ id: "melk", naam: "melk", categorie: "Zuivel", supermarkten: ["AH", "Lidl"] }),
    app.normaliseerItem({ id: "brood", naam: "brood", categorie: "Brood", supermarkten: ["AH"] })
  ];

  const bijgewerkt = app.ontkoppelSupermarkt(items, "AH", ["Lidl"]);
  const groepenZonderSupermarkt = app.groepeerVoorRoute(bijgewerkt, app.GEEN_SUPERMARKT_FILTER);

  assert.equal(bijgewerkt.length, 2);
  assert.deepEqual(bijgewerkt.find((item) => item.id === "melk").supermarkten, ["Lidl"]);
  assert.deepEqual(bijgewerkt.find((item) => item.id === "brood").supermarkten, []);
  assert.equal(app.formatteerSupermarkten(bijgewerkt.find((item) => item.id === "brood")), "Geen supermarkt");
  assert.deepEqual(Object.keys(groepenZonderSupermarkt), ["Brood"]);
});

test("supermarkt van bestaand item wijzigen bewaart overige itemgegevens", () => {
  const items = [
    app.normaliseerItem({ id: "melk", naam: "melk", categorie: "Zuivel", supermarkten: ["AH"], afgevinkt: true, eigenItem: true }),
    app.normaliseerItem({ id: "brood", naam: "brood", categorie: "Brood", supermarkten: ["AH"] })
  ];

  const bijgewerkt = app.wijzigItemSupermarkten(items, "melk", ["Lidl"], ["AH", "Lidl"]);
  const melk = bijgewerkt.find((item) => item.id === "melk");

  assert.deepEqual(melk.supermarkten, ["Lidl"]);
  assert.equal(melk.naam, "melk");
  assert.equal(melk.categorie, "Zuivel");
  assert.equal(melk.afgevinkt, true);
  assert.equal(melk.eigenItem, true);
  assert.deepEqual(bijgewerkt.find((item) => item.id === "brood").supermarkten, ["AH"]);
  assert.deepEqual(Object.keys(app.groepeerVoorRoute(bijgewerkt, "Lidl")), ["Zuivel"]);
  assert.deepEqual(Object.keys(app.groepeerVoorRoute(bijgewerkt, "AH")), ["Brood"]);
});

test("supermarkten worden uniek opgeslagen en geladen", () => {
  const storage = {
    waarde: "",
    getItem() { return this.waarde; },
    setItem(_key, value) { this.waarde = value; }
  };

  const opgeslagen = app.bewaarSupermarkten(storage, ["AH", "Plus", "AH", ""]);

  assert.deepEqual(opgeslagen, ["AH", "Plus"]);
  assert.deepEqual(app.laadSupermarkten(storage), ["AH", "Plus"]);
});

test("aangepaste categorievolgorde stuurt de supermarkt-route", () => {
  const route = app.bewaarRoute({
    waarde: "",
    setItem(_key, value) { this.waarde = value; }
  }, ["Groente", "Brood", "Zuivel"]);
  const items = [
    app.normaliseerItem({ naam: "melk", categorie: "Zuivel", supermarkten: ["AH"] }),
    app.normaliseerItem({ naam: "sla", categorie: "Groente", supermarkten: ["AH"] }),
    app.normaliseerItem({ naam: "stokbrood", categorie: "Brood", supermarkten: ["AH"] })
  ];
  const groepen = app.groepeerVoorRoute(items, "AH", route);

  assert.deepEqual(route.slice(0, 3), ["Groente", "Brood", "Zuivel"]);
  assert.deepEqual(Object.keys(groepen), ["Groente", "Brood", "Zuivel"]);
});

test("routevolgorde wordt lokaal geladen en verplaatst", () => {
  const storage = {
    waarde: "",
    getItem() { return this.waarde; },
    setItem(_key, value) { this.waarde = value; }
  };

  app.bewaarRoute(storage, ["Groente", "Brood", "Zuivel"]);
  assert.deepEqual(app.laadRoute(storage).slice(0, 3), ["Groente", "Brood", "Zuivel"]);
  assert.deepEqual(app.verplaatsInRoute(app.laadRoute(storage), 2, 0).slice(0, 3), ["Zuivel", "Groente", "Brood"]);
});

test("aanbiedingen matchen fuzzy op productnaam en gekozen supermarkt", () => {
  const aanbiedingen = [
    { productnaam: "Coca-Cola Zero Sugar 1,5L", supermarkt: "Albert Heijn", prijs: 1.49, oudePrijs: 2.19, url: "https://www.reclamefolder.nl/aanbiedingen/cola-zero" },
    { productnaam: "Coca Cola Zero blikjes", supermarkt: "Jumbo", prijs: 1.29, korting: "2e halve prijs" },
    { productnaam: "Pepsi Max", supermarkt: "Dirk", prijs: 0.99 }
  ];

  const matches = app.matchAanbiedingen("Cola Zero", aanbiedingen, { supermarkten: ["AH", "Jumbo"] });

  assert.deepEqual(matches.map((aanbieding) => aanbieding.supermarkt), ["Jumbo", "Albert Heijn"]);
  assert.ok(matches.every((aanbieding) => aanbieding.productnaam.includes("Cola")));
});

test("aanbiedingen zoeken ondersteunt merk en categorie en koppelt resultaten aan items", () => {
  const aanbiedingen = [
    { productnaam: "Magere yoghurt 1L", supermarkt: "Lidl", merk: "Milbona", categorie: { name: "Zuivel" }, prijs: 0.89, url: "https://example.test/yoghurt" },
    { productnaam: "Appelsientje sinaasappel", supermarkt: "AH", merk: "Appelsientje", categorie: { name: "Dranken" }, prijs: 1.49 }
  ];
  const items = [
    app.normaliseerItem({ id: "yoghurt", naam: "yoghurt", categorie: "Zuivel", supermarkten: ["Lidl"], gekoppeldeAanbiedingen: [app.maakAanbiedingSleutel(aanbiedingen[0])] })
  ];

  const merkMatches = app.matchAanbiedingen("Milbona", aanbiedingen, { supermarkten: ["Lidl"] });
  const categorieMatches = app.matchAanbiedingen("Dranken", aanbiedingen, { supermarkten: ["AH"] });
  const gekoppeld = app.selecteerGekoppeldeAanbiedingen(items[0], aanbiedingen);
  const ontkoppeld = app.ontkoppelAanbiedingVanItem(items, "yoghurt", app.maakAanbiedingSleutel(aanbiedingen[0]));

  assert.equal(merkMatches[0].productnaam, "Magere yoghurt 1L");
  assert.equal(categorieMatches[0].productnaam, "Appelsientje sinaasappel");
  assert.deepEqual(items[0].gekoppeldeAanbiedingen, [app.maakAanbiedingSleutel(aanbiedingen[0])]);
  assert.equal(gekoppeld[0].merk, "Milbona");
  assert.equal(gekoppeld[0].categorie, "Zuivel");
  assert.deepEqual(ontkoppeld[0].gekoppeldeAanbiedingen, []);
});

test("aanbiedingenoverzicht zoekt en filtert zonder productstaat te wijzigen", () => {
  const aanbiedingen = [
    { productnaam: "Magere kwark", supermarkt: "Albert Heijn", merk: "AH", prijs: 1.09 },
    { productnaam: "Volle kwark", supermarkt: "Jumbo", prijs: 0.99 },
    { productnaam: "Sinaasappelsap", supermarkt: "Lidl", prijs: 1.49 },
    { productnaam: "Kwark dessert", supermarkt: "Albert Heijn", prijs: 1.29 }
  ];

  const goedkoopsteBijAlle = app.selecteerAanbiedingenOverzicht("", "alle", aanbiedingen, 2);
  const ahZoekresultaten = app.selecteerAanbiedingenOverzicht("kwark", "AH", aanbiedingen, 5);
  const geenResultaten = app.selecteerAanbiedingenOverzicht("kwark", "Lidl", aanbiedingen, 5);

  assert.deepEqual(goedkoopsteBijAlle.map((aanbieding) => aanbieding.productnaam), ["Volle kwark", "Magere kwark"]);
  assert.deepEqual(goedkoopsteBijAlle.map((aanbieding) => aanbieding.prijs), [0.99, 1.09]);
  assert.deepEqual(ahZoekresultaten.map((aanbieding) => aanbieding.productnaam), ["Magere kwark", "Kwark dessert"]);
  assert.deepEqual(geenResultaten, []);
  assert.equal(app.formatteerAanbiedingenOverzichtStatus(2, "kwark", "AH"), "2 aanbiedingen getoond voor kwark bij AH.");
  assert.equal(app.formatteerAanbiedingenOverzichtStatus(2, "kwark", "alle"), "2 aanbiedingen getoond voor kwark.");
  assert.equal(app.formatteerAanbiedingenOverzichtStatus(2, "", "AH"), "2 aanbiedingen getoond voor AH.");
  assert.equal(app.formatteerAanbiedingenOverzichtStatus(0, "", "alle", true), "Bezig met live scannen...");
});

test("aanbieding koppelen bewaart maximaal unieke aanbieding-sleutels per item", () => {
  const items = [app.normaliseerItem({ id: "cola", naam: "Cola", categorie: "Dranken", supermarkten: ["Jumbo"] })];
  const aanbiedingen = [
    { productnaam: "Cola Zero", supermarkt: "Jumbo", prijs: 1.29 },
    { productnaam: "Cola Regular", supermarkt: "Jumbo", prijs: 1.39 },
    { productnaam: "Cola Max", supermarkt: "Jumbo", prijs: 0.99 }
  ];

  const eenKeer = app.koppelAanbiedingAanItem(items, "cola", aanbiedingen[0]);
  const dubbel = app.koppelAanbiedingAanItem(eenKeer, "cola", aanbiedingen[0]);
  const twee = app.koppelAanbiedingAanItem(dubbel, "cola", aanbiedingen[1]);
  const nieuwste = app.koppelAanbiedingAanItem(twee, "cola", aanbiedingen[2], 1);

  assert.equal(dubbel[0].gekoppeldeAanbiedingen.length, 1);
  assert.deepEqual(app.selecteerGekoppeldeAanbiedingen(twee[0], aanbiedingen).map((aanbieding) => aanbieding.productnaam), ["Cola Zero", "Cola Regular"]);
  assert.deepEqual(app.selecteerGekoppeldeAanbiedingen(nieuwste[0], aanbiedingen).map((aanbieding) => aanbieding.productnaam), ["Cola Max"]);
});

test("aanbiedingenbestand wordt met cache-buster en reload opgehaald", async () => {
  const aanroepen = [];
  const resultaat = await app.laadAanbiedingenBestand(async (url, opties) => {
    aanroepen.push({ url, opties });
    return {
      ok: true,
      async json() {
        return { aanbiedingen: [], bijgewerktOp: "", bron: "https://www.reclamefolder.nl/aanbiedingen/" };
      }
    };
  });

  assert.equal(aanroepen.length, 1);
  assert.match(aanroepen[0].url, /^data\/aanbiedingen\.json\?t=\d+$/);
  assert.equal(aanroepen[0].opties.cache, "reload");
  assert.equal(resultaat.fout, "");
});

test("aanbiedingenbestand geeft foutmelding bij niet-ok response", async () => {
  const resultaat = await app.laadAanbiedingenBestand(async () => ({
    ok: false,
    status: 503
  }));

  assert.equal(resultaat.aanbiedingen.length, 0);
  assert.match(resultaat.fout, /status 503/);
});

test("live aanbiedingen-API wordt zonder browser-CORS direct via de eigen proxy opgehaald", async () => {
  const aanroepen = [];
  const resultaat = await app.laadLiveAanbiedingen(async (url, opties) => {
    aanroepen.push({ url, opties });
    return {
      ok: true,
      async json() {
        return {
          bron: "live",
          bijgewerktOp: "2026-05-19T00:00:00.000Z",
          aanbiedingen: [{
            productnaam: "Voorbeeldproduct",
            supermarkt: "Albert Heijn",
            prijs: "1,99",
            oudePrijs: "2,49",
            url: "https://voorbeeld.nl"
          }]
        };
      }
    };
  });

  assert.equal(aanroepen.length, 1);
  assert.match(aanroepen[0].url, /^api\/aanbiedingen\?t=\d+$/);
  assert.equal(aanroepen[0].opties.cache, "no-store");
  assert.equal(resultaat.bron, "live");
  assert.equal(resultaat.aanbiedingen[0].prijs, 1.99);
  assert.equal(resultaat.aanbiedingen[0].prijsTekst, "€ 1,99");
  assert.equal(resultaat.fout, "");
});

test("live aanbiedingen halen valt toetsbaar terug wanneer de proxy faalt", async () => {
  const resultaat = await app.laadLiveAanbiedingen(async () => ({
    ok: false,
    status: 502
  }));

  assert.equal(resultaat.aanbiedingen.length, 0);
  assert.equal(resultaat.bron, "live");
  assert.match(resultaat.fout, /status 502/);
});

test("scan aanbiedingen wist oude resultaten en toont laadstatus voor opnieuw matchen", () => {
  const js = read("frontend/app.js");

  assert.equal(app.formatteerAanbiedingenTitel(0, true), "Bezig met live scannen...");
  assert.equal(app.formatteerAanbiedingenTitel(0), "Geen actuele aanbieding gevonden");
  assert.equal(app.formatteerAanbiedingenTitel(1), "1 aanbieding gevonden");
  assert.equal(app.formatteerAanbiedingenTitel(2), "2 aanbiedingen gevonden");
  assert.deepEqual(app.maakLegeAanbiedingenData(), {
    aanbiedingen: [],
    bijgewerktOp: "",
    bron: "",
    fout: ""
  });
  assert.match(js, /if \(isAanbiedingenScanBezig\) return;/);
  assert.match(js, /elementen\.aanbiedingenScannen\.disabled = true;/);
  assert.match(js, /aanbiedingenData = maakLegeAanbiedingenData\(\);/);
  assert.match(js, /status\("Bezig met live scannen\.\.\."\);/);
  assert.match(js, /const liveAanbiedingenData = await laadLiveAanbiedingen\(\);/);
  assert.match(js, /fallbackNodig \? await laadAanbiedingenBestand\(\) : liveAanbiedingenData/);
  assert.match(js, /Live ophalen mislukt; \$\{aantal\} lokale aanbiedingen geladen\./);
  assert.match(js, /\$\{aantal\} live aanbiedingen geladen\./);
  assert.match(js, /elementen\.aanbiedingenScannen\.disabled = false;/);
  assert.match(js, /formatteerAanbiedingenTitel\(itemAanbiedingen\.length, isAanbiedingenScanBezig\)/);
});

test("serverless aanbiedingenproxy normaliseert live brondata naar frontendformaat", async () => {
  const api = require("../api/aanbiedingen.js");
  const liveFetch = async () => ({
    ok: true,
    headers: { get() { return "application/json"; } },
    async text() {
      return JSON.stringify({
        productnaam: "Live kwark",
        supermarkt: "Lidl",
        prijs: 0.99,
        oudePrijs: 1.49,
        korting: "Actie",
        url: "https://example.test/kwark"
      });
    }
  });
  const headers = {};
  const res = {
    statusCode: 200,
    setHeader(naam, waarde) { headers[naam] = waarde; },
    end(inhoud = "") { this.inhoud = inhoud; }
  };

  await api({ method: "GET", fetch: liveFetch }, res);

  const body = JSON.parse(res.inhoud);
  assert.equal(res.statusCode, 200);
  assert.equal(headers["Access-Control-Allow-Origin"], "*");
  assert.equal(body.bron, "live");
  assert.equal(body.aanbiedingen[0].productnaam, "Live kwark");
  assert.equal(body.aanbiedingen[0].prijsTekst, "€ 0,99");
});

test("aanbiedingenupdate ondersteunt Reclamefolder JSON-LD als enige bron", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    "@type": "Product",
    name: "Kwark voordeelpak",
    supermarket: "Lidl",
    offers: [{
      price: "0.99",
      highPrice: "1.49",
      seller: { name: "Lidl" },
      url: "/aanbiedingen/kwark"
    }],
    description: "Aanbieding"
  })}</script>`;
  const catalogus = aanbiedingenUpdater.parseCatalogus(html, "text/html");
  const aanbieding = aanbiedingenUpdater.vindObjecten(catalogus)
    .map((node) => aanbiedingenUpdater.normaliseer(node, "https://www.reclamefolder.nl/aanbiedingen/"))
    .find(Boolean);

  assert.deepEqual(aanbiedingenUpdater.BRONNEN, ["https://www.reclamefolder.nl/aanbiedingen/"]);
  assert.equal(aanbieding.productnaam, "Kwark voordeelpak");
  assert.equal(aanbieding.supermarkt, "Lidl");
  assert.equal(aanbieding.prijs, 0.99);
  assert.equal(aanbieding.url, "https://www.reclamefolder.nl/aanbiedingen/kwark");
});

test("aanbiedingenupdate bewaart merk, categorie en afbeelding wanneer de bron die velden levert", () => {
  const aanbieding = aanbiedingenUpdater.normaliseer({
    name: "Biologische kwark",
    brand: "Zuivelhoeve",
    category: { name: "Zuivel" },
    supermarket: "Dirk",
    price: 1.19,
    oldPrice: 1.79,
    image: "/images/kwark.png",
    url: "/kwark"
  }, "https://example.test/folder/");

  assert.equal(aanbieding.merk, "Zuivelhoeve");
  assert.equal(aanbieding.categorie, "Zuivel");
  assert.equal(aanbieding.afbeelding, "https://example.test/images/kwark.png");
});

test("zoektokens vangen eenvoudige meervouden op zonder vaste woorden te beschadigen", () => {
  assert.deepEqual(app.maakZoekTokens("blauwe bessen"), ["blauwe", "bes"]);
  assert.deepEqual(app.maakZoekTokens("mannen"), ["man"]);
  assert.deepEqual(app.maakZoekTokens("kussen"), ["kus"]);
  assert.deepEqual(app.maakZoekTokens("mais"), ["mais"]);
  assert.deepEqual(app.maakZoekTokens("tennis"), ["tennis"]);
});

test("categorie verslepen bewaart volgorde en behoudt itemgroepen", () => {
  const storage = {
    waarde: "",
    getItem() { return this.waarde; },
    setItem(_key, value) { this.waarde = value; }
  };
  const items = [
    app.normaliseerItem({ naam: "melk", categorie: "Zuivel", supermarkten: ["AH"] }),
    app.normaliseerItem({ naam: "water", categorie: "Dranken", supermarkten: ["AH"] })
  ];
  const route = app.bewaarRoute(storage, app.verplaatsInRoute(app.laadRoute(storage), 3, 0));
  const groepen = app.groepeerVoorRoute(items, "AH", route);

  assert.equal(JSON.parse(storage.waarde)[0], "Dranken");
  assert.deepEqual(Object.keys(groepen), ["Dranken", "Zuivel"]);
  assert.equal(groepen.Zuivel[0].naam, "melk");
});

test("categorieblokken zijn direct versleepbaar zonder itembediening te blokkeren", () => {
  const js = read("frontend/app.js");
  const css = read("frontend/styles.css");

  assert.match(js, /section\.draggable = true/);
  assert.match(js, /section\.tabIndex = 0/);
  assert.match(js, /if \(event\.pointerType === "mouse"\) \{[\s\S]*section\.draggable = magSlepen/);
  assert.match(js, /dragend[\s\S]*section\.draggable = true/);
  assert.match(js, /pointerup[\s\S]*section\.draggable = true/);
  assert.match(js, /pointercancel[\s\S]*section\.draggable = true/);
  assert.match(js, /section\.addEventListener\("keydown"[\s\S]*verplaatsZichtbareCategorie/);
  assert.match(js, /magCategorieblokSlepenVanaf\(event\.target\)/);
  assert.match(js, /target\.closest\(NIET_SLEEPBARE_CATEGORIE_ELEMENTEN\)/);
  assert.doesNotMatch(js, /Categorie verslepen/);
  assert.doesNotMatch(js, /categorie__greep/);
  assert.doesNotMatch(css, /\.categorie__greep/);
  const selectorConstante = js.match(/const NIET_SLEEPBARE_CATEGORIE_ELEMENTEN = "([^"]+)"/);
  assert.deepEqual(selectorConstante[1].split(",").map((selector) => selector.trim()), [
    ".boodschap",
    "input",
    "select",
    "textarea",
    "label",
    "button"
  ]);
  assert.match(css, /\.categorie \{[\s\S]*cursor: grab;/);
  assert.match(css, /\.categorie ul \{[\s\S]*cursor: default;/);
  assert.match(css, /\.categorie__kop \{[\s\S]*touch-action: none;/);
});

test("boodschappenlijst toont supermarktkeuzes per bestaand item", () => {
  const js = read("frontend/app.js");
  const css = read("frontend/styles.css");

  assert.match(js, /boodschap__supermarkten/);
  assert.match(js, /Supermarkt aanpassen/);
  assert.match(js, /Zoek artikel, merk of categorie/);
  assert.match(js, /koppelAanbiedingAanItem\(items, item\.id, aanbieding\)/);
  assert.match(js, /ontkoppelAanbiedingVanItem\(items, item\.id, sleutel\)/);
  assert.match(js, /aanbiedingen__afbeelding/);
  assert.match(js, /wijzigItemSupermarkten\(items, item\.id, gekozenSupermarkten, supermarkten\)/);
  assert.match(js, /bewaarItems\(localStorage, items, supermarkten\);/);
  assert.match(js, /row\.append\(checkbox, tekst, verwijderKnop, supermarktVeldset, aanbiedingenBlok\);/);
  assert.match(css, /\.boodschap__supermarkten/);
  assert.match(css, /\.aanbiedingen__zoeker/);
  assert.match(css, /\.aanbiedingen__afbeelding/);
});

test("HTML ondersteunt Nederlandse toegankelijkheid en bediening", () => {
  const html = read("frontend/index.html");
  assert.match(html, /<html lang="nl">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<nav class="app-tabs" role="tablist" aria-label="BoodschappenBaas onderdelen">/);
  assert.match(html, /data-tab-target="paneel-aanbiedingen">Aanbiedingen zoeken<\/button>/);
  assert.match(html, /data-tab-target="paneel-lijst">Boodschappenlijst<\/button>/);
  assert.match(html, /<section id="paneel-aanbiedingen" class="tab-paneel" role="tabpanel" aria-labelledby="tab-aanbiedingen">/);
  assert.match(html, /<section id="paneel-lijst" class="tab-paneel" role="tabpanel" aria-labelledby="tab-lijst" hidden>/);
  assert.match(html, /<form id="aanbiedingen-zoek-formulier"/);
  assert.match(html, /<input id="aanbiedingen-zoekterm" name="aanbiedingen-zoekterm" type="search"/);
  assert.match(html, /<select id="aanbiedingen-supermarkt-filter" name="aanbiedingen-supermarkt-filter"><\/select>/);
  assert.match(html, /<ul id="aanbiedingen-overzicht" class="aanbiedingen-overzicht" aria-label="Gevonden aanbiedingen"><\/ul>/);
  assert.match(html, /<label for="naam">Naam<\/label>/);
  const toevoegFormulierStart = html.indexOf('<form id="toevoeg-formulier"');
  const formulierActiesStart = html.indexOf('<div class="formulier-acties">', toevoegFormulierStart);
  const formulierActiesSubmit = html.indexOf('<button type="submit">Toevoegen</button>', formulierActiesStart);
  const formulierEinde = html.indexOf("</form>", formulierActiesStart);
  assert.notEqual(formulierActiesStart, -1);
  assert.notEqual(formulierActiesSubmit, -1);
  assert.notEqual(formulierEinde, -1);
  assert.ok(formulierActiesStart < formulierActiesSubmit);
  assert.ok(formulierActiesSubmit < formulierEinde);
  assert.match(html, /<button id="aanbiedingen-scannen" type="button">Scan aanbiedingen<\/button>/);
  const voorbereidingStart = html.indexOf('<details class="kaart instellingen"');
  assert.notEqual(voorbereidingStart, -1);
  assert.match(html, /<details class="kaart instellingen" open>/);
  assert.match(html, /<span id="voorbereiding-label" class="eyebrow">Voorbereiding<\/span>/);
  assert.match(html, /<h2 id="voorbereiding-titel" class="voorbereiding-toggle__titel">Optimale route<\/h2>/);
  const boodschappenlijstStart = html.indexOf('<section id="lijst"', voorbereidingStart);
  const voorbereidingSectie = html.slice(voorbereidingStart, boodschappenlijstStart);
  assert.doesNotMatch(voorbereidingSectie, /aanbiedingen-scannen/);
  assert.match(html, /<summary class="voorbereiding-toggle">/);
  assert.match(html, /<div id="voorbereiding-inhoud" class="voorbereiding-inhoud">/);
  assert.match(html, /<button id="alles-uitvinken" type="button">Alles uitvinken<\/button>/);
  assert.match(html, /<button id="route-aanpassen" type="button" aria-expanded="false" aria-controls="route-editor">Route aanpassen<\/button>/);
  assert.match(html, /<button id="route-opslaan" type="button">Opslaan<\/button>/);
  assert.match(html, /<button id="route-reset" type="button">Reset route<\/button>/);
  assert.match(html, /<select id="thema"/);
  assert.match(html, /<form id="supermarkt-formulier"/);
  assert.match(html, /<ul id="supermarkt-lijst"/);
});

test("tabs scheiden aanbiedingen zoeken van boodschappenbeheer zonder routes", () => {
  const js = read("frontend/app.js");
  const css = read("frontend/styles.css");

  assert.match(js, /tabs: document\.querySelectorAll\("\[data-tab-target\]"\)/);
  assert.match(js, /function activeerTab\(tab\)/);
  assert.match(js, /paneel\.hidden = paneel\.id !== tab\.dataset\.tabTarget/);
  assert.match(js, /skipLink: document\.querySelector\("\.skip-link"\)/);
  assert.match(js, /const LIJST_TAB_ID = "paneel-lijst"/);
  assert.match(js, /tab\.dataset\.tabTarget === LIJST_TAB_ID/);
  assert.match(js, /document\.querySelector\("#lijst"\)\.focus\(\)/);
  assert.match(js, /renderAanbiedingenOverzicht/);
  assert.match(js, /function selecteerAanbiedingenOverzicht\(zoekterm, supermarkt, aanbiedingen, maximum = MAX_AANBIEDINGEN_OVERZICHT\)/);
  assert.match(js, /function filterAanbiedingenOpSupermarkt\(aanbiedingen, supermarkt\)/);
  assert.match(js, /matchAanbiedingen\(zoekterm, gefilterdeAanbiedingen, \{ maximum \}\)/);
  assert.match(js, /formatteerAanbiedingenOverzichtStatus\(resultaten\.length, zoekterm, supermarkt, isAanbiedingenScanBezig\)/);
  assert.match(css, /\.app-tabs/);
  assert.match(css, /\.tab-paneel\[hidden\]/);
  assert.match(css, /@media \(max-width: 520px\) \{[\s\S]*\.app-tabs \{[\s\S]*position: fixed;/);
  assert.match(css, /\.aanbiedingen-overzicht/);
});

test("HTML bevat professionele dashboard-elementen", () => {
  const html = read("frontend/index.html");
  assert.match(html, /Professionele winkelplanning/);
  assert.match(html, /class="held__paneel" aria-label="App kenmerken"/);
  assert.match(html, /<span>supermarkten<\/span>/);
  assert.match(html, /<span>PWA gereed<\/span>/);
});

test("PWA bestanden bieden offline en commit-versie update ondersteuning", () => {
  const sw = read("frontend/service-worker.js");
  const manifest = JSON.parse(read("frontend/manifest.webmanifest"));

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.lang, "nl");
  assert.match(sw, /__COMMIT_SHA__/);
  assert.match(sw, /self\.skipWaiting\(\)/);
  assert.match(sw, /caches\.open\(CACHE_NAME\)/);
  assert.doesNotMatch(sw, /\.\/data\/aanbiedingen\.json/);
  assert.match(sw, /pathname\.endsWith\("\/data\/aanbiedingen\.json"\)/);
  assert.match(sw, /fetch\(event\.request, \{ cache: "reload" \}\)/);
});

test("aanbiedingenworkflow kan handmatig en dagelijks draaien", () => {
  const workflow = read(".github/workflows/aanbiedingen.yml");
  const data = JSON.parse(read("frontend/data/aanbiedingen.json"));

  assert.equal(data.bron, "https://www.reclamefolder.nl/aanbiedingen/");
  assert.deepEqual(data.bronnen, ["https://www.reclamefolder.nl/aanbiedingen/"]);
  assert.ok(data.aanbiedingen.length > 0);
  assert.ok(data.aanbiedingen.some((aanbieding) => aanbieding.productnaam.toLowerCase().includes("kwark")));
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /node scripts\/update-aanbiedingen\.js/);
  assert.match(workflow, /git diff --quiet -- frontend\/data\/aanbiedingen\.json/);
});
