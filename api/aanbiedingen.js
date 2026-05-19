const { BRON, BRONNEN, haalAanbiedingenVanBronnen } = require("../scripts/update-aanbiedingen.js");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ fout: "Alleen GET wordt ondersteund." }));
    return;
  }

  try {
    const { aanbiedingen, fouten } = await haalAanbiedingenVanBronnen(req.fetch || fetch);
    if (!aanbiedingen.length) {
      throw new Error(`Geen live aanbiedingen gevonden. ${fouten.join(" ")}`.trim());
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({
      bron: "live",
      bronnen: BRONNEN,
      bijgewerktOp: new Date().toISOString(),
      aanbiedingen
    }));
  } catch (fout) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({
      bron: BRON,
      bronnen: BRONNEN,
      bijgewerktOp: "",
      aanbiedingen: [],
      fout: fout.message || "Live aanbiedingen konden niet worden opgehaald."
    }));
  }
};
