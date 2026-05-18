const fs = require("node:fs");
const path = require("node:path");

const BRON = "https://allesupers.nl/catalog/all";
const root = path.resolve(__dirname, "..");
const doel = path.join(root, "frontend", "data", "aanbiedingen.json");

function pakEerste(object, velden) {
  for (const veld of velden) {
    const waarde = veld.split(".").reduce((huidig, deel) => huidig && huidig[deel], object);
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

function absoluteUrl(url) {
  if (!url) return "";
  try {
    return new URL(String(url), BRON).toString();
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

  const naam = pakEerste(node, ["productnaam", "productName", "name", "naam", "title", "description"]);
  const supermarkt = pakEerste(node, ["supermarkt", "store", "shop", "retailer", "chain", "merchant", "supermarket.name", "store.name", "shop.name"]);
  const prijs = pakEerste(node, ["prijs", "price", "currentPrice", "current_price", "price.value", "pricing.price", "salesPrice"]);
  if (naam && supermarkt && prijs) gevonden.push(node);

  Object.values(node).forEach((waarde) => vindObjecten(waarde, gevonden));
  return gevonden;
}

function isAanbieding(node, prijs, oudePrijs) {
  if (oudePrijs && prijs && oudePrijs > prijs) return true;
  const tekst = JSON.stringify({
    discount: node.discount,
    korting: node.korting,
    promotion: node.promotion,
    aanbieding: node.aanbieding,
    offer: node.offer,
    deal: node.deal
  }).toLocaleLowerCase("nl");
  return /korting|aanbieding|actie|bonus|deal|%|gratis|voor/.test(tekst);
}

function normaliseer(node) {
  const prijs = parsePrijs(pakEerste(node, ["prijs", "price", "currentPrice", "current_price", "price.value", "pricing.price", "salesPrice"]));
  const oudePrijs = parsePrijs(pakEerste(node, ["oudePrijs", "oldPrice", "originalPrice", "original_price", "beforePrice", "listPrice", "wasPrice"]));
  if (!isAanbieding(node, prijs, oudePrijs)) return null;
  return {
    productnaam: String(pakEerste(node, ["productnaam", "productName", "name", "naam", "title", "description"])).trim(),
    supermarkt: String(pakEerste(node, ["supermarkt", "store", "shop", "retailer", "chain", "merchant", "supermarket.name", "store.name", "shop.name"])).trim(),
    prijs,
    prijsTekst: String(pakEerste(node, ["prijsTekst", "priceText", "price.text"])).trim() || formatPrijs(prijs),
    oudePrijs,
    oudePrijsTekst: String(pakEerste(node, ["oudePrijsTekst", "oldPriceText", "originalPriceText"])).trim() || formatPrijs(oudePrijs),
    korting: String(pakEerste(node, ["korting", "discount", "promotion", "offerText", "dealText"])).trim(),
    eenheidsprijs: String(pakEerste(node, ["eenheidsprijs", "unitPrice", "unit_price", "unitPricing", "pricePerUnit"])).trim(),
    bijgewerktOp: String(pakEerste(node, ["bijgewerktOp", "updatedAt", "updated_at", "lastUpdated", "modifiedAt"])).trim(),
    url: absoluteUrl(pakEerste(node, ["url", "link", "productUrl", "product_url", "slug", "path"]))
  };
}

function parseCatalogus(tekst, contentType = "") {
  if (contentType.includes("json")) return JSON.parse(tekst);
  const nextData = tekst.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextData) return JSON.parse(nextData[1]);
  return JSON.parse(tekst);
}

async function main() {
  const response = await fetch(BRON, {
    headers: {
      "accept": "application/json,text/html;q=0.9",
      "user-agent": "BoodschappenBaas GitHub Action (+https://github.com/karti0001/BoodschappenBaas)"
    }
  });
  if (!response.ok) throw new Error(`Allesupers gaf status ${response.status}`);

  const catalogus = parseCatalogus(await response.text(), response.headers.get("content-type") || "");
  const aanbiedingen = vindObjecten(catalogus)
    .map(normaliseer)
    .filter((aanbieding) => aanbieding && aanbieding.productnaam && aanbieding.supermarkt && aanbieding.prijs !== null)
    .sort((a, b) => a.productnaam.localeCompare(b.productnaam, "nl", { sensitivity: "base" }) || a.supermarkt.localeCompare(b.supermarkt, "nl"));

  const inhoud = `${JSON.stringify({
    bron: BRON,
    bijgewerktOp: new Date().toISOString(),
    aanbiedingen
  }, null, 2)}\n`;
  fs.mkdirSync(path.dirname(doel), { recursive: true });
  fs.writeFileSync(doel, inhoud);
  console.log(`${aanbiedingen.length} aanbiedingen opgeslagen in ${path.relative(root, doel)}.`);
}

main().catch((fout) => {
  console.error(`Kon aanbiedingen niet bijwerken vanaf ${BRON}: ${fout.message}`);
  process.exitCode = 1;
});
