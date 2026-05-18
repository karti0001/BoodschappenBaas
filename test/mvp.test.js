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

test("HTML ondersteunt Nederlandse toegankelijkheid en bediening", () => {
  const html = read("frontend/index.html");
  assert.match(html, /<html lang="nl">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<label for="naam">Naam<\/label>/);
  assert.match(html, /<button id="alles-uitvinken" type="button">Alles uitvinken<\/button>/);
  assert.match(html, /<button id="route-aanpassen" type="button" aria-expanded="false" aria-controls="route-editor">Route aanpassen<\/button>/);
  assert.match(html, /<button id="route-opslaan" type="button">Opslaan<\/button>/);
  assert.match(html, /<button id="route-reset" type="button">Reset route<\/button>/);
  assert.match(html, /<select id="thema"/);
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
});
