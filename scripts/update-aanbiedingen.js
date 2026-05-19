const fs = require("node:fs");
const path = require("node:path");
const ADAPTERS = require("./aanbiedingen-adapters");

const BRONNEN = ADAPTERS.flatMap((adapter) => adapter.bronnen.map((bron) => bron.url));
const BRON = BRONNEN[0];
const root = path.resolve(__dirname, "..");
const doel = path.join(root, "frontend", "data", "aanbiedingen.json");
const collator = new Intl.Collator("nl", { sensitivity: "base" });
const PRODUCTNAAM_VELDEN = ["productnaam", "productName", "name", "naam", "title", "description"];
const SUPERMARKT_VELDEN = ["supermarkt", "supermarket", "store", "shop", "retailer", "chain", "merchant", "supermarket.name", "store.name", "shop.name", "retailer.name", "offers.seller.name"];
const PRIJS_VELDEN = ["prijs", "price", "currentPrice", "current_price", "offerPrice", "salesPrice", "price.value", "pricing.price", "offers.price", "offers.lowPrice"];
const OUDE_PRIJS_VELDEN = ["oudePrijs", "oldPrice", "originalPrice", "original_price", "beforePrice", "normalPrice", "listPrice", "wasPrice", "offers.highPrice"];
const GELDIG_VAN_VELDEN = ["geldigVan", "validFrom", "valid_from", "startDate", "validity.from", "validity.start"];
const GELDIG_TOT_VELDEN = ["geldigTot", "validThrough", "validUntil", "valid_to", "endDate", "validity.to", "validity.end", "expires"];
const GELDIGHEID_VELDEN = ["geldigheidsperiode", "validityPeriod", "validity.period", "validity", "periode", "validityText"];
// OCR-/foldertekstregel: productnaam, aanbiedingsprijs en optioneel oude prijs.
const TEKST_AANBIEDING_REGEX = /^(.{2,}?)\s*(?:[-|:]\s*)?€?\s*(\d+[\.,]\d{1,2})(?:\s*(?:van|was|oude prijs)\s*€?\s*(\d+[\.,]\d{1,2}))?/i;
// Geldigheid uit foldertekst, bijvoorbeeld "geldig 20-05 t/m 26-05".
const TEKST_GELDIGHEID_REGEX = /(?:geldig|van)\s+(\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?)\s*(?:t\/m|tot|-)\s*(\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?)/i;
const MIN_TEKST_REGEL_LENGTE = 6;
const APP_CATEGORIEEN = [
  "AGF",
  "Bier",
  "Frisdrank & sap",
  "Wijn & sterke drank",
  "Zuivel & eieren",
  "Non-food",
  "Diepvries",
  "Brood & gebak",
  "Vlees",
  "Vleeswaren",
  "Vegetarisch/vegan",
  "Ontbijt & beleg",
  "Koffie/thee",
  "Huishoudelijk",
  "Drogisterij",
  "Huisdieren",
  "Snacks",
  "Voorraadkast"
];
const CATEGORIE_HINTS = [
  ["Bier", ["bier", "pils", "radler", "krat", "speciaalbier"]],
  ["Wijn & sterke drank", ["wijn", "prosecco", "champagne", "whisky", "rum", "gin", "vodka", "likeur", "jenever", "sterke drank"]],
  ["Frisdrank & sap", ["frisdrank", "cola", "sinas", "limonade", "sap", "juice", "water", "ice tea"]],
  ["AGF", ["agf", "aardbei", "aardbeien", "appel", "appels", "banaan", "bananen", "bes", "bessen", "groente", "fruit", "komkommer", "tomaat", "sla", "paprika"]],
  ["Zuivel & eieren", ["zuivel", "melk", "yoghurt", "kwark", "kaas", "eieren", "ei", "boter", "vla"]],
  ["Diepvries", ["diepvries", "ijs", "frozen", "vriesvers"]],
  ["Brood & gebak", ["brood", "gebak", "cake", "croissant", "bolletjes", "taart"]],
  ["Vleeswaren", ["vleeswaren", "ham", "salami", "worst", "kipfilet"]],
  ["Vegetarisch/vegan", ["vegetarisch", "vegan", "vega", "plantaardig"]],
  ["Vlees", ["vlees", "gehakt", "kip", "biefstuk", "schnitzel", "hamburger"]],
  ["Ontbijt & beleg", ["ontbijt", "beleg", "hagelslag", "pindakaas", "jam", "muesli", "cruesli", "cornflakes"]],
  ["Koffie/thee", ["koffie", "thee", "espresso", "cappuccino"]],
  ["Huishoudelijk", ["huishoud", "wasmiddel", "vaatwas", "schoonmaak", "toiletpapier", "keukenpapier"]],
  ["Drogisterij", ["drogist", "shampoo", "tandpasta", "deodorant", "luiers", "verzorging"]],
  ["Huisdieren", ["huisdier", "katten", "honden", "kattenvoer", "hondenvoer"]],
  ["Non-food", ["non-food", "non food", "kleding", "speelgoed", "tuin", "gereedschap"]]
];

function vindVeldWaarde(object, delen) {
  if (object === undefined || object === null) return "";
  if (!delen.length) return Array.isArray(object) || (typeof object === "object" && object !== null) ? "" : object;
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

function normaliseerZoektekst(value) {
  return normaliseerTekstWaarde(value)
    .toLocaleLowerCase("nl")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normaliseerCategorie(categorie, productnaam = "") {
  const tekst = normaliseerZoektekst(`${categorie} ${productnaam}`);
  if (!tekst) return "";
  const bestaandeCategorie = APP_CATEGORIEEN.find((naam) => normaliseerZoektekst(naam) === normaliseerZoektekst(categorie));
  if (bestaandeCategorie) return bestaandeCategorie;
  const match = CATEGORIE_HINTS.find(([, hints]) => hints.some((hint) => tekst.includes(hint)));
  return match ? match[0] : normaliseerTekstWaarde(categorie);
}

function formatGeldigheidsperiode(geldigVan, geldigTot) {
  return [geldigVan, geldigTot].filter(Boolean).join(" t/m ");
}

function absoluteUrl(url, bron = BRON) {
  if (!url) return "";
  try {
    return new URL(String(url), bron).toString();
  } catch {
    return "";
  }
}

function vindObjecten(node, gevonden = [], opties = {}) {
  if (!node || typeof node !== "object") return gevonden;
  if (Array.isArray(node)) {
    node.forEach((item) => vindObjecten(item, gevonden, opties));
    return gevonden;
  }

  const naam = vindEersteVeldWaarde(node, PRODUCTNAAM_VELDEN);
  const supermarkt = vindEersteVeldWaarde(node, SUPERMARKT_VELDEN) || opties.supermarkt;
  const prijs = vindEersteVeldWaarde(node, PRIJS_VELDEN);
  if (naam && supermarkt && prijs) gevonden.push(node);

  Object.values(node).forEach((waarde) => vindObjecten(waarde, gevonden, opties));
  return gevonden;
}

function isAanbieding(node, prijs, oudePrijs) {
  if (oudePrijs && prijs && oudePrijs > prijs) return true;
  const tekst = JSON.stringify(node).toLowerCase();
  return /korting|aanbieding|actie|bonus|deal|%|gratis|voor/.test(tekst);
}

function normaliseer(node, bron = BRON, opties = {}) {
  const prijs = parsePrijs(vindEersteVeldWaarde(node, PRIJS_VELDEN));
  const oudePrijs = parsePrijs(vindEersteVeldWaarde(node, OUDE_PRIJS_VELDEN));
  if (!isAanbieding(node, prijs, oudePrijs)) return null;
  const productnaam = normaliseerTekstWaarde(vindEersteVeldWaarde(node, PRODUCTNAAM_VELDEN));
  const categorie = normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["categorie.name", "category.name", "categorie", "category", "productCategory"]));
  const geldigVan = normaliseerTekstWaarde(vindEersteVeldWaarde(node, GELDIG_VAN_VELDEN));
  const geldigTot = normaliseerTekstWaarde(vindEersteVeldWaarde(node, GELDIG_TOT_VELDEN));
  const geldigheidsperiode = normaliseerTekstWaarde(vindEersteVeldWaarde(node, GELDIGHEID_VELDEN)) || formatGeldigheidsperiode(geldigVan, geldigTot);
  return {
    productnaam,
    supermarkt: normaliseerTekstWaarde(vindEersteVeldWaarde(node, SUPERMARKT_VELDEN)) || opties.supermarkt || "Meerdere winkels",
    merk: normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["merk", "brand", "manufacturer", "brand.name"])),
    categorie: opties.categoriseer ? normaliseerCategorie(categorie, productnaam) : categorie,
    prijs,
    prijsTekst: normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["prijsTekst", "priceText", "price.text"])) || formatPrijs(prijs),
    oudePrijs,
    oudePrijsTekst: normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["oudePrijsTekst", "oldPriceText", "originalPriceText"])) || formatPrijs(oudePrijs),
    korting: normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["korting", "discount", "promotion", "offerText", "dealText"])),
    eenheidsprijs: normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["eenheidsprijs", "unitPrice", "unit_price", "unitPricing", "pricePerUnit"])),
    geldigVan,
    geldigTot,
    geldigheidsperiode,
    bronType: opties.bronType || normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["bronType", "sourceType"])) || "scrape",
    betrouwbaarheid: opties.betrouwbaarheid || normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["betrouwbaarheid", "reliability"])) || "tekst",
    opgehaaldOp: opties.opgehaaldOp || "",
    bijgewerktOp: normaliseerTekstWaarde(vindEersteVeldWaarde(node, ["bijgewerktOp", "updatedAt", "updated_at", "lastUpdated", "modifiedAt", "validFrom"])),
    afbeelding: absoluteUrl(vindEersteVeldWaarde(node, ["afbeelding", "image.url", "image.imageUrl", "imageUrl", "thumbnail", "thumbnailUrl", "image"]), bron),
    url: absoluteUrl(vindEersteVeldWaarde(node, ["url", "link", "productUrl", "product_url", "slug", "path", "permaname", "offers.url"]), bron)
  };
}

function haalJsonWaardeNaMarker(tekst, markerIndex, markerLengte) {
  const start = tekst.slice(markerIndex + markerLengte).search(/[\[{]/);
  if (start === -1) return null;
  const valueStart = markerIndex + markerLengte + start;
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
  const marker = "\"offersFromProps\":";
  const pushRegex = /self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)/g;
  for (const match of tekst.matchAll(pushRegex)) {
    let chunk;
    try {
      chunk = JSON.parse(`"${match[1]}"`);
    } catch {
      continue;
    }
    let markerIndex = chunk.indexOf(marker);
    while (markerIndex !== -1) {
      const resultaat = haalJsonWaardeNaMarker(chunk, markerIndex, marker.length);
      if (!resultaat) break;
      try {
        const parsed = JSON.parse(resultaat.waarde);
        if (Array.isArray(parsed)) aanbiedingen.push(...parsed);
      } catch {
        // Negeer kapotte flight-fragmenten; andere chunks kunnen nog bruikbaar zijn.
      }
      markerIndex = chunk.indexOf(marker, resultaat.eindIndex);
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

function tekstZonderHtml(tekst) {
  return String(tekst || "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&euro;|&#8364;/gi, "€")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+\n/g, "\n");
}

function parseTekstAanbiedingen(tekst, adapter = {}, bron = {}) {
  return tekstZonderHtml(tekst)
    .split(/\r?\n/)
    .map((regel) => regel.replace(/\s+/g, " ").trim())
    .filter((regel) => regel.length >= MIN_TEKST_REGEL_LENGTE)
    .flatMap((regel) => {
      const match = regel.match(TEKST_AANBIEDING_REGEX);
      if (!match) return [];
      const periode = regel.match(TEKST_GELDIGHEID_REGEX);
      return [{
        productnaam: match[1].replace(/\s[-|:]+$/, "").trim(),
        supermarkt: adapter.supermarkt,
        prijs: match[2],
        oudePrijs: match[3] || "",
        categorie: normaliseerCategorie(regel, match[1]),
        geldigheidsperiode: periode ? `${periode[1]} t/m ${periode[2]}` : "",
        geldigVan: periode ? periode[1] : "",
        geldigTot: periode ? periode[2] : "",
        bronType: bron.type,
        betrouwbaarheid: bron.betrouwbaarheid,
        url: bron.url
      }];
    });
}

function uniekeAanbiedingen(aanbiedingen) {
  const gezien = new Set();
  return aanbiedingen.filter((aanbieding) => {
    // Uniekheidseis: productnaam + supermarkt + prijs + geldigheidsperiode.
    const sleutel = [
      aanbieding.productnaam,
      aanbieding.supermarkt,
      aanbieding.prijs,
      aanbieding.geldigheidsperiode || formatGeldigheidsperiode(aanbieding.geldigVan, aanbieding.geldigTot)
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

function normaliseerAdapters(bronnen) {
  return bronnen.map((bron, index) => {
    if (typeof bron === "string") {
      return {
        id: `bron-${index}`,
        supermarkt: "",
        bronnen: [{ url: bron, type: "scrape", betrouwbaarheid: "tekst", documentatie: "Losse bron zonder supermarktadapter." }]
      };
    }
    return bron;
  });
}

async function haalAanbiedingenVanBronnen(fetcher = fetch, bronnen = ADAPTERS) {
  const gevonden = [];
  const fouten = [];
  const opgehaaldOp = new Date().toISOString();
  for (const adapter of normaliseerAdapters(bronnen)) {
    for (const bron of adapter.bronnen) {
      try {
        const response = await fetcher(bron.url, {
          headers: {
            "accept": "application/json,text/html;q=0.9",
            "user-agent": "BoodschappenBaas GitHub Action (+https://github.com/karti0001/BoodschappenBaas)"
          }
        });
        if (!response.ok) throw new Error(`${bron.url} gaf status ${response.status}`);

        const tekst = await response.text();
        const contentType = response.headers.get("content-type") || "";
        let catalogus;
        let parseFout = null;
        try {
          catalogus = parseCatalogus(tekst, contentType);
        } catch (fout) {
          parseFout = fout;
          catalogus = [];
        }
        const opties = {
          supermarkt: adapter.supermarkt,
          bronType: bron.type,
          betrouwbaarheid: bron.betrouwbaarheid,
          opgehaaldOp,
          categoriseer: Boolean(adapter.supermarkt)
        };
        const objecten = vindObjecten(catalogus, [], opties);
        gevonden.push(...objecten.map((node) => normaliseer(node, bron.url, opties)));
        if (!objecten.length) {
          const tekstAanbiedingen = parseTekstAanbiedingen(tekst, adapter, bron);
          if (!tekstAanbiedingen.length && parseFout) {
            fouten.push(`${bron.url}: catalogusdata kon niet worden gelezen (${parseFout.message})`);
          }
          gevonden.push(...tekstAanbiedingen.map((node) => normaliseer(node, bron.url, opties)));
        }
      } catch (fout) {
        fouten.push(`${bron.url}: ${fout.message}`);
      }
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
  ADAPTERS,
  APP_CATEGORIEEN,
  BRON,
  BRONNEN,
  haalAanbiedingenVanBronnen,
  parseCatalogus,
  parseNextFlightAanbiedingen,
  parseTekstAanbiedingen,
  normaliseerCategorie,
  uniekeAanbiedingen,
  vindObjecten,
  normaliseer
};
