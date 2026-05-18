const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "frontend");
const target = path.join(root, "dist");
const version = process.env.GITHUB_SHA || new Date().toISOString();

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });

const serviceWorker = path.join(target, "service-worker.js");
const inhoud = fs.readFileSync(serviceWorker, "utf8").replace(/__COMMIT_SHA__/g, version);
fs.writeFileSync(serviceWorker, inhoud);
console.log(`Build klaar voor versie ${version}`);
