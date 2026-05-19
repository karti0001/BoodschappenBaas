const fs = require("node:fs");
const path = require("node:path");

const BRONNEN = ["https://www.reclamefolder.nl/aanbiedingen/"];
const BRON = BRONNEN[0];
const root = path.resolve(__dirname, "..");
const doel = path.join(root, "frontend", "data", "aanbiedingen.json");
const collator = new Intl.Collator("nl", { sensitivity: "base" });
const PRODUCTNAAM_VELDEN = ["productnaam", "productName", "name", "naam", "title", "description"];
const SUPERMARKT_VELDEN = ["supermarket.name", "store.name", "shop.name", "retailer.name", "offers.seller.name", "supermarkt", "supermarket", "store", "shop", "retailer", "chain", "merchant"];
const PRIJS_VELDEN = ["prijs", "price", "currentPrice", "current_price", "offerPrice", "price.value", "pricing.price", "salesPrice", "offers.price", "offers.lowPrice"];
const OUDE_PRIJS_VELDEN = ["oudePrijs", "oldPrice", "originalPrice", "original_price", "beforePrice", "normalPrice", "listPrice", "wasPrice", "offers.highPrice"];

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

function normaliseerTekstWaarde(value) {
  return String(value || "")
    .replace(/\u0404/g, "E")
    .replace(/\u0454/g, "e")
    .trim();
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

  const naam = vindEersteVeldWaarde(node, PRODUCTNAAM_VELDEN);
  const supermarkt = vindEersteVeldWaarde(node, SUPERMARKT_VELDEN);
  const prijs = vindEersteVeldWaarde(node, PRIJS_VELDEN);
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
  const prijs = parsePrijs(vindEersteVeldWaarde(node, PRIJS_VELDEN));
  const oudePrijs = parsePrijs(vindEersteVeldWaarde(node, OUDE_PRIJS_VELDEN));
  if (!isAanbieding(node, prijs, oudePrijs)) return null;
  return {
    productnaam: normaliseerTekstWaarde(vindEersteVeldWaarde(node, PRODUCTNAAM_VELDEN)),
    supermarkt: normaliseerTekstWaarde(vindEersteVeldWaarde(node, SUPERMARKT_VELDEN)),
    merk: normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["merk", "brand", "manufacturer", "brand.name"])),
    categorie: normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["categorie.name", "category.name", "categorie", "category", "productCategory"])),
    prijs,
    prijsTekst: normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["prijsTekst", "priceText", "price.text"])) || formatPrijs(prijs),
    oudePrijs,
    oudePrijsTekst: normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["oudePrijsTekst", "oldPriceText", "originalPriceText"])) || formatPrijs(oudePrijs),
    korting: normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["korting", "discount", "promotion", "offerText", "dealText"])),
    eenheidsprijs: normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["eenheidsprijs", "unitPrice", "unit_price", "unitPricing", "pricePerUnit"])),
    bijgewerktOp: normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["bijgewerktOp", "updatedAt", "updated_at", "lastUpdated", "modifiedAt", "validFrom"])),
    afbeelding: absoluteUrl(vindEersteVeldWaarde(node, ["afbeelding", "image.url", "image.imageUrl", "imageUrl", "thumbnail", "thumbnailUrl", "image"]), bron),
    url: absoluteUrl(vindEersteVeldWaarde(node, ["url", "link", "productUrl", "product_url", "slug", "path", "permaname", "offers.url"]), bron)
  };
}

function haalJsonWaardeNaMarker(tekst, marker, vanaf = 0) {
  const markerIndex = tekst.indexOf(marker, vanaf);
  if (markerIndex === -1) return null;
  const start = tekst.slice(markerIndex + marker.length).search(/[\[{]/);
  if (start === -1) return null;
  const valueStart = markerIndex + marker.length + start;
  let diepte = 0;
  let inString = false;
  let escape = false;

  for (let index = valueStart; index < tekst.length; index++) {
    const teken = tekst[index];
    if (escape) {
      escape = false;
      continue;
    }
    if (teken === "\\") {
      escape = true;
      continue;
    }
    if (teken === "\"") {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (teken === "{" || teken === "[") diepte += 1;
    if (teken === "}" || teken === "]") {
      diepte -= 1;
      if (diepte === 0) {
        return {
          waarde: tekst.slice(valueStart, index + 1),
          eindIndex: index + 1
        };
      }
    }
  }
  return null;
}

function parseNextFlightAanbiedingen(tekst) {
  const aanbiedingen = [];
  const pushRegex = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g;
  for (const match of tekst.matchAll(pushRegex)) {
    let chunk;
    try {
      chunk = JSON.parse(`"${match[1]}"`);
    } catch {
      continue;
    }
    let vanaf = 0;
    while (chunk.indexOf("\"offersFromProps\":", vanaf) !== -1) {
      const resultaat = haalJsonWaardeNaMarker(chunk, "\"offersFromProps\":", vanaf);
      if (!resultaat) break;
      try {
        const parsed = JSON.parse(resultaat.waarde);
        if (Array.isArray(parsed)) aanbiedingen.push(...parsed);
      } catch {
        // Negeer kapotte flight-fragmenten; andere chunks kunnen nog bruikbaar zijn.
      }
      vanaf = resultaat.eindIndex;
    }
  }
  return aanbiedingen;
}

function parseCatalogus(tekst, contentType = "") {
  if (contentType.includes("json")) return JSON.parse(tekst);
  // Bij Next.js-sites staat catalogusdata soms in __NEXT_DATA__.
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
  const nextFlightAanbiedingen = parseNextFlightAanbiedingen(tekst);
  if (nextFlightAanbiedingen.length) return nextFlightAanbiedingen;
  return JSON.parse(tekst);
}

function uniekeAanbiedingen(aanbiedingen) {
  const gezien = new Set();
  return aanbiedingen.filter((aanbieding) => {
    const sleutel = [
      aanbieding.productnaam,
      aanbieding.supermarkt,
      aanbieding.prijs,
      aanbieding.oudePrijs,
      aanbieding.url
    ].map((waarde) => String(waarde || "").toLocaleLowerCase("nl")).join("\u0000");
    if (gezien.has(sleutel)) return false;
    gezien.add(sleutel);
    return true;
  });
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
  const { aanbiedingen, fouten } = await haalAanbiedingenVanBronnen();

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

async function haalAanbiedingenVanBronnen(fetcher = fetch, bronnen = BRONNEN) {
  const gevonden = [];
  const fouten = [];
  for (const bron of bronnen) {
    try {
      const response = await fetcher(bron, {
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

  const aanbiedingen = uniekeAanbiedingen(gevonden
    .filter((aanbieding) => aanbieding && aanbieding.productnaam && aanbieding.supermarkt && aanbieding.prijs !== null)
  ).sort((a, b) => collator.compare(a.productnaam, b.productnaam) || collator.compare(a.supermarkt, b.supermarkt));

  return { aanbiedingen, fouten };
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
  haalAanbiedingenVanBronnen,
  parseCatalogus,
  parseNextFlightAanbiedingen,
  vindObjecten,
  normaliseer
};
