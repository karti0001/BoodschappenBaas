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

test("HTML ondersteunt Nederlandse toegankelijkheid en bediening", () => {
  const html = read("frontend/index.html");
  assert.match(html, /<html lang="nl">/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<label for="naam">Naam<\/label>/);
  assert.match(html, /<button id="alles-uitvinken" type="button">Alles uitvinken<\/button>/);
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
