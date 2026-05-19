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

test("items worden per categorie gegroepeerd en lokaal gecombineerd", () => {
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

test("aangepaste categorievolgorde stuurt de lijstvolgorde", () => {
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

test("categorieblokken blijven direct versleepbaar op desktop en mobiel", () => {
  const js = read("frontend/app.js");
  const css = read("frontend/styles.css");

  assert.match(js, /section\.draggable = true/);
  assert.match(js, /section\.tabIndex = 0/);
  assert.match(js, /if \(event\.pointerType === "mouse"\) \{[\s\S]*section\.draggable = magSlepen/);
  assert.match(js, /pointermove[\s\S]*markeerTouchDoel\(event\)/);
  assert.match(js, /pointerup[\s\S]*verplaatsZichtbareCategorie\(categorie, doelCategorie\)/);
  assert.match(js, /section\.addEventListener\("keydown"[\s\S]*verplaatsZichtbareCategorie/);
  assert.match(js, /magCategorieblokSlepenVanaf\(event\.target\)/);
  assert.match(js, /target\.closest\(NIET_SLEEPBARE_CATEGORIE_ELEMENTEN\)/);
  assert.match(css, /\.categorie \{[\s\S]*cursor: grab;/);
  assert.match(css, /\.categorie ul \{[\s\S]*cursor: default;/);
  assert.match(css, /\.categorie__kop \{[\s\S]*touch-action: none;/);
});

test("HTML is één duidelijke boodschappenlijstpagina", () => {
  const html = read("frontend/index.html");
  const removedFeature = new RegExp("aanbied", "i");

  assert.match(html, /<html lang="nl">/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, removedFeature);
  assert.doesNotMatch(html, /tab-paneel|tablist|data-tab-target/);
  assert.doesNotMatch(html, /Voorbereiding|voorbereiding|Optimale route|route-editor|route-aanpassen/);
  assert.match(html, /<main>[\s\S]*<section class="kaart formulier-kaart"/);
  assert.match(html, /<section id="lijst" class="kaart lijst-kaart"/);
});

test("supermarkt kiezen en toevoegen staan bij boodschap toevoegen", () => {
  const html = read("frontend/index.html");
  const formStart = html.indexOf('<form id="toevoeg-formulier"');
  const filterStart = html.indexOf('<label for="supermarkt-filter">Kies supermarkt</label>', formStart);
  const addSubmit = html.indexOf('<button type="submit">Toevoegen</button>', formStart);
  const formEnd = html.indexOf("</form>", formStart);
  const cardEnd = html.indexOf("</section>", formEnd);
  const supermarketForm = html.indexOf('<form id="supermarkt-formulier"', formEnd);

  assert.ok(formStart !== -1);
  assert.ok(filterStart > formStart && filterStart < formEnd);
  assert.ok(addSubmit > filterStart && addSubmit < formEnd);
  assert.ok(supermarketForm > formEnd && supermarketForm < cardEnd);
  assert.match(html, /<ul id="supermarkt-lijst" class="supermarkt-lijst" aria-label="Beschikbare supermarkten"><\/ul>/);
});

test("boodschappenlijst toont compacte supermarktkeuzes per bestaand item", () => {
  const js = read("frontend/app.js");
  const css = read("frontend/styles.css");
  const removedFeature = new RegExp("aanbied", "i");

  assert.match(js, /boodschap__supermarkten/);
  assert.match(js, /supermarktKeuzes\.className = "chips chips--compact"/);
  assert.match(js, /supermarktLabel\.className = "chip chip--compact"/);
  assert.match(js, /wijzigItemSupermarkten\(items, item\.id, gekozenSupermarkten, supermarkten\)/);
  assert.match(js, /row\.append\(checkbox, tekst, verwijderKnop, supermarktVeldset\);/);
  assert.doesNotMatch(js, removedFeature);
  assert.match(css, /\.chip--compact \{[\s\S]*font-size: 0\.78rem;/);
  assert.match(css, /\.boodschap__meta \{[\s\S]*font-size: 0\.78rem;/);
  assert.match(css, /\.boodschap__verwijderen[\s\S]*font-size: 0\.84rem;/);
  assert.doesNotMatch(css, removedFeature);
});

test("PWA bestanden bieden offline en commit-versie update ondersteuning", () => {
  const sw = read("frontend/service-worker.js");
  const manifest = JSON.parse(read("frontend/manifest.webmanifest"));
  const removedFeature = new RegExp("aanbied", "i");

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.lang, "nl");
  assert.match(sw, /__COMMIT_SHA__/);
  assert.match(sw, /self\.skipWaiting\(\)/);
  assert.match(sw, /caches\.open\(CACHE_NAME\)/);
  assert.doesNotMatch(sw, removedFeature);
});

test("documentatie en package scripts verwijzen alleen naar de boodschappenlijst-MVP", () => {
  const packageJson = JSON.parse(read("package.json"));
  const readme = read("README.md");
  const architecture = read("docs/architecture.md");
  const removedFeature = new RegExp("aanbied", "i");

  assert.equal(packageJson.scripts.lint, "node --check frontend/app.js && node --check scripts/build.js && node --check test/mvp.test.js");
  assert.doesNotMatch(readme, removedFeature);
  assert.doesNotMatch(architecture, removedFeature);
});
