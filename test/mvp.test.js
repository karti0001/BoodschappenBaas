const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = require("../frontend/app.js");
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
    { productnaam: "Coca-Cola Zero Sugar 1,5L", supermarkt: "Albert Heijn", prijs: 1.49, oudePrijs: 2.19, url: "https://allesupers.nl/product/cola-zero" },
    { productnaam: "Coca Cola Zero blikjes", supermarkt: "Jumbo", prijs: 1.29, korting: "2e halve prijs" },
    { productnaam: "Pepsi Max", supermarkt: "Dirk", prijs: 0.99 }
  ];

  const matches = app.matchAanbiedingen("Cola Zero", aanbiedingen, { supermarkten: ["AH", "Jumbo"] });

  assert.deepEqual(matches.map((aanbieding) => aanbieding.supermarkt), ["Jumbo", "Albert Heijn"]);
  assert.ok(matches.every((aanbieding) => aanbieding.productnaam.includes("Cola")));
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
  assert.match(js, /if \(event\.pointerType === "mouse"\) \{[\s\S]*section\.draggable = magSlepen/);
  assert.match(js, /dragend[\s\S]*section\.draggable = true/);
  assert.match(js, /pointerup[\s\S]*section\.draggable = true/);
  assert.match(js, /pointercancel[\s\S]*section\.draggable = true/);
  assert.match(js, /magCategorieblokSlepenVanaf\(event\.target\)/);
  assert.match(js, /target\.closest\(NIET_SLEEPBARE_CATEGORIE_ELEMENTEN\)/);
  const selectorConstante = js.match(/const NIET_SLEEPBARE_CATEGORIE_ELEMENTEN = "([^"]+)"/);
  assert.deepEqual(selectorConstante[1].split(",").map((selector) => selector.trim()), [
    ".boodschap",
    "input",
    "select",
    "textarea",
    "label",
    "button:not(.categorie__greep)"
  ]);
  assert.match(css, /\.categorie \{[\s\S]*cursor: grab;/);
  assert.match(css, /\.categorie ul \{[\s\S]*cursor: default;/);
  assert.match(css, /\.categorie__kop \{[\s\S]*touch-action: none;/);
});

test("HTML ondersteunt Nederlandse toegankelijkheid en bediening", () => {
  const html = read("frontend/index.html");
  assert.match(html, /<html lang="nl">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<label for="naam">Naam<\/label>/);
  assert.match(html, /<button id="alles-uitvinken" type="button">Alles uitvinken<\/button>/);
  assert.match(html, /<button id="route-aanpassen" type="button" aria-expanded="false" aria-controls="route-editor">Route aanpassen<\/button>/);
  assert.match(html, /<button id="aanbiedingen-scannen" type="button">Scan aanbiedingen<\/button>/);
  assert.match(html, /<button id="route-opslaan" type="button">Opslaan<\/button>/);
  assert.match(html, /<button id="route-reset" type="button">Reset route<\/button>/);
  assert.match(html, /<select id="thema"/);
  assert.match(html, /<form id="supermarkt-formulier"/);
  assert.match(html, /<ul id="supermarkt-lijst"/);
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
  assert.match(sw, /\.\/data\/aanbiedingen\.json/);
});

test("aanbiedingenworkflow kan handmatig en dagelijks draaien", () => {
  const workflow = read(".github/workflows/aanbiedingen.yml");
  const data = JSON.parse(read("frontend/data/aanbiedingen.json"));

  assert.equal(data.bron, "https://allesupers.nl/catalog/all");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /node scripts\/update-aanbiedingen\.js/);
  assert.match(workflow, /git diff --quiet -- frontend\/data\/aanbiedingen\.json/);
});
