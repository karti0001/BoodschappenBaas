const fs = require("node:fs");
const path = require("node:path");

const BRONNEN = [
  "https://allesupers.nl/catalog/all",
  "https://www.reclamefolder.nl/aanbiedingen/"
];
const BRON = BRONNEN[0];
const root = path.resolve(__dirname, "..");
const doel = path.join(root, "frontend", "data", "aanbiedingen.json");
const collator = new Intl.Collator("nl", { sensitivity: "base" });

function vindVeldWaarde(object, delen) {
  if (object === undefined || object === null) return "";
  if (!delen.length) return object;
  if (Array.isArray(object)) {
    for (const item of object) {
      const waarde = vindVeldWaarde(item, delen);
      if (waarde !== undefined && waarde !== null && waarde !== "") return waarde;
    }
    return "";
  }
  return vindVeldWaarde(object[delen[0]], delen.slice(1));
}

function vindEersteVeldWaarde(object, velden) {
  for (const veld of velden) {
    const waarde = vindVeldWaarde(object, veld.split("."));
    if (waarde !== undefined && waarde !== null && waarde !== "") return waarde;
  }
  return "";
}

function parsePrijs(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = String(value || "").replace(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function formatPrijs(value) {
  return value === null ? "" : new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);
}

function absoluteUrl(url, bron = BRON) {
  if (!url) return "";
  try {
    return new URL(String(url), bron).toString();
  } catch {
    return "";
  }
}

function vindObjecten(node, gevonden = []) {
  if (!node || typeof node !== "object") return gevonden;
  if (Array.isArray(node)) {
    node.forEach((item) => vindObjecten(item, gevonden));
    return gevonden;
  }

  const naam = vindEersteVeldWaarde(node, ["productnaam", "productName", "name", "naam", "title", "description"]);
  const supermarkt = vindEersteVeldWaarde(node, ["supermarkt", "supermarket", "store", "shop", "retailer", "chain", "merchant", "supermarket.name", "store.name", "shop.name", "offers.seller.name"]);
  const prijs = vindEersteVeldWaarde(node, ["prijs", "price", "currentPrice", "current_price", "price.value", "pricing.price", "salesPrice", "offers.price", "offers.lowPrice"]);
  if (naam && supermarkt && prijs) gevonden.push(node);

  Object.values(node).forEach((waarde) => vindObjecten(waarde, gevonden));
  return gevonden;
}

function isAanbieding(node, prijs, oudePrijs) {
  if (oudePrijs && prijs && oudePrijs > prijs) return true;
  const tekst = JSON.stringify(node).toLowerCase();
  return /korting|aanbieding|actie|bonus|deal|%|gratis|voor/.test(tekst);
}

function normaliseer(node, bron = BRON) {
  const prijs = parsePrijs(vindEersteVeldWaarde(node, ["prijs", "price", "currentPrice", "current_price", "price.value", "pricing.price", "salesPrice", "offers.price", "offers.lowPrice"]));
  const oudePrijs = parsePrijs(vindEersteVeldWaarde(node, ["oudePrijs", "oldPrice", "originalPrice", "original_price", "beforePrice", "listPrice", "wasPrice", "offers.highPrice"]));
  if (!isAanbieding(node, prijs, oudePrijs)) return null;
  return {
    productnaam: String(vindEersteVeldWaarde(node, ["productnaam", "productName", "name", "naam", "title", "description"])).trim(),
    supermarkt: String(vindEersteVeldWaarde(node, ["supermarkt", "supermarket", "store", "shop", "retailer", "chain", "merchant", "supermarket.name", "store.name", "shop.name", "offers.seller.name"])).trim(),
    prijs,
    prijsTekst: String(vindEersteVeldWaarde(node, ["prijsTekst", "priceText", "price.text"])).trim() || formatPrijs(prijs),
    oudePrijs,
    oudePrijsTekst: String(vindEersteVeldWaarde(node, ["oudePrijsTekst", "oldPriceText", "originalPriceText"])).trim() || formatPrijs(oudePrijs),
    korting: String(vindEersteVeldWaarde(node, ["korting", "discount", "promotion", "offerText", "dealText"])).trim(),
    eenheidsprijs: String(vindEersteVeldWaarde(node, ["eenheidsprijs", "unitPrice", "unit_price", "unitPricing", "pricePerUnit"])).trim(),
    bijgewerktOp: String(vindEersteVeldWaarde(node, ["bijgewerktOp", "updatedAt", "updated_at", "lastUpdated", "modifiedAt"])).trim(),
    url: absoluteUrl(vindEersteVeldWaarde(node, ["url", "link", "productUrl", "product_url", "slug", "path", "offers.url"]), bron)
  };
}

function parseCatalogus(tekst, contentType = "") {
  if (contentType.includes("json")) return JSON.parse(tekst);
  // Allesupers draait als Next.js-site; bij HTML-responses staat de catalogusdata in __NEXT_DATA__.
  const nextData = tekst.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextData) return JSON.parse(nextData[1]);
  const jsonLd = [...tekst.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => {
      try {
        return [JSON.parse(match[1])];
      } catch {
        return [];
      }
    });
  if (jsonLd.length) return jsonLd;
  return JSON.parse(tekst);
}

function zelfdeAanbiedingen(aanbiedingen) {
  if (!fs.existsSync(doel)) return false;
  try {
    const bestaand = JSON.parse(fs.readFileSync(doel, "utf8"));
    return JSON.stringify(bestaand.aanbiedingen || []) === JSON.stringify(aanbiedingen);
  } catch {
    return false;
  }
}

async function main() {
  const gevonden = [];
  const fouten = [];
  for (const bron of BRONNEN) {
    try {
      const response = await fetch(bron, {
        headers: {
          "accept": "application/json,text/html;q=0.9",
          "user-agent": "BoodschappenBaas GitHub Action (+https://github.com/karti0001/BoodschappenBaas)"
        }
      });
      if (!response.ok) throw new Error(`${bron} gaf status ${response.status}`);

      const catalogus = parseCatalogus(await response.text(), response.headers.get("content-type") || "");
      gevonden.push(...vindObjecten(catalogus).map((node) => normaliseer(node, bron)));
    } catch (fout) {
      fouten.push(`${bron}: ${fout.message}`);
    }
  }

  const aanbiedingen = gevonden
    .filter((aanbieding) => aanbieding && aanbieding.productnaam && aanbieding.supermarkt && aanbieding.prijs !== null)
    .sort((a, b) => collator.compare(a.productnaam, b.productnaam) || collator.compare(a.supermarkt, b.supermarkt));

  if (!aanbiedingen.length) {
    throw new Error(`Geen aanbiedingen gevonden; bestaand aanbiedingenbestand blijft behouden. ${fouten.join(" ")}`.trim());
  }

  if (zelfdeAanbiedingen(aanbiedingen)) {
    console.log("Aanbiedingen zijn ongewijzigd; JSON-bestand blijft gelijk.");
    return;
  }

  const inhoud = `${JSON.stringify({
    bron: BRON,
    bronnen: BRONNEN,
    bijgewerktOp: new Date().toISOString(),
    aanbiedingen
  }, null, 2)}\n`;
  fs.mkdirSync(path.dirname(doel), { recursive: true });
  fs.writeFileSync(doel, inhoud);
  console.log(`${aanbiedingen.length} aanbiedingen opgeslagen in ${path.relative(root, doel)}.`);
}

if (require.main === module) {
  main().catch((fout) => {
    console.error(`Kon aanbiedingen niet bijwerken vanaf ${BRONNEN.join(", ")}: ${fout.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  BRON,
  BRONNEN,
  parseCatalogus,
  vindObjecten,
  normaliseer
};
