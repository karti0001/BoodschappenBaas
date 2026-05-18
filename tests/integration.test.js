/**
 * Integratietests voor BoodschappenBaas
 * Test: bestandsstructuur, YAML data, service worker, CSS thema
 * Gebruikt Node.js ingebouwde testrunner (node:test)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS = join(__dirname, '../docs');

// ── Bestandsstructuur ──────────────────────────────────────

describe('Vereiste bestanden aanwezig', () => {
  const vereisteBestanden = [
    'index.html',
    'manifest.json',
    'sw.js',
    'css/styles.css',
    'js/app.js',
    'js/store.js',
    'js/yaml-parser.js',
    'data/items.yaml',
    'icons/icon.svg',
    'icons/maskable.svg',
  ];

  for (const bestand of vereisteBestanden) {
    test(`${bestand} bestaat`, () => {
      assert.ok(existsSync(join(DOCS, bestand)), `${bestand} niet gevonden`);
    });
  }
});

// ── YAML Data Integriteit ──────────────────────────────────

describe('items.yaml data integriteit', () => {
  const yaml = readFileSync(join(DOCS, 'data/items.yaml'), 'utf8');

  test('bevat alle 5 supermarkten', () => {
    assert.ok(yaml.includes('id: ah'), 'AH aanwezig');
    assert.ok(yaml.includes('id: jumbo'), 'Jumbo aanwezig');
    assert.ok(yaml.includes('id: aldi'), 'Aldi aanwezig');
    assert.ok(yaml.includes('id: lidl'), 'Lidl aanwezig');
    assert.ok(yaml.includes('id: dirk'), 'Dirk aanwezig');
  });

  test('bevat verplichte startitems', () => {
    assert.ok(yaml.toLowerCase().includes('kwark'), 'Kwark aanwezig');
    assert.ok(yaml.toLowerCase().includes('sprite zero'), 'Sprite Zero aanwezig');
    assert.ok(yaml.toLowerCase().includes('aardbeien'), 'Aardbeien aanwezig');
    assert.ok(yaml.toLowerCase().includes('blauwe bessen'), 'Blauwe bessen aanwezig');
  });

  test('bevat alle vereiste categorieën', () => {
    const verplicht = ['zuivel', 'groente', 'fruit', 'dranken'];
    for (const cat of verplicht) {
      assert.ok(yaml.includes(`id: ${cat}`), `Categorie ${cat} aanwezig`);
    }
  });

  test('items hebben categorie-verwijzing', () => {
    assert.ok(yaml.includes('categorie: zuivel') || yaml.includes('categorie: fruit') ||
              yaml.includes('categorie: dranken'), 'Items hebben categorie');
  });

  test('supermarkten kleuren zijn hexadecimaal', () => {
    const kleurRegex = /#[0-9A-Fa-f]{6}/g;
    const kleuren = yaml.match(kleurRegex) || [];
    assert.ok(kleuren.length >= 5, `Minstens 5 kleurcodes aanwezig (gevonden: ${kleuren.length})`);
  });
});

// ── Service Worker ─────────────────────────────────────────

describe('Service Worker configuratie', () => {
  const sw = readFileSync(join(DOCS, 'sw.js'), 'utf8');

  test('bevat CACHE_NAME met versie placeholder', () => {
    assert.ok(sw.includes('CACHE_NAME'), 'CACHE_NAME aanwezig');
    assert.ok(sw.includes('%%VERSION%%') || sw.includes('boodschappenbaas-'), 'Versie placeholder aanwezig');
  });

  test('bevat install event handler', () => {
    assert.ok(sw.includes("'install'") || sw.includes('"install"'), 'install handler aanwezig');
  });

  test('bevat activate event handler', () => {
    assert.ok(sw.includes("'activate'") || sw.includes('"activate"'), 'activate handler aanwezig');
  });

  test('bevat fetch event handler', () => {
    assert.ok(sw.includes("'fetch'") || sw.includes('"fetch"'), 'fetch handler aanwezig');
  });

  test('pre-cached assets bevatten index.html', () => {
    assert.ok(sw.includes('index.html'), 'index.html in pre-cache');
  });

  test('pre-cached assets bevatten items.yaml', () => {
    assert.ok(sw.includes('items.yaml'), 'items.yaml in pre-cache');
  });

  test('roept skipWaiting aan voor directe activering', () => {
    assert.ok(sw.includes('skipWaiting'), 'skipWaiting aanwezig');
  });

  test('roept clients.claim aan', () => {
    assert.ok(sw.includes('clients.claim'), 'clients.claim aanwezig');
  });
});

// ── CSS Thema ──────────────────────────────────────────────

describe('CSS donker/licht thema', () => {
  const css = readFileSync(join(DOCS, 'css/styles.css'), 'utf8');

  test('bevat prefers-color-scheme: dark media query', () => {
    assert.ok(css.includes('prefers-color-scheme: dark'), 'dark mode media query aanwezig');
  });

  test('bevat data-theme attribuut voor expliciete thema-wisseling', () => {
    assert.ok(css.includes('[data-theme="dark"]'), 'data-theme dark aanwezig');
    assert.ok(css.includes('[data-theme="light"]'), 'data-theme light aanwezig');
  });

  test('bevat CSS variabelen voor kleuren', () => {
    assert.ok(css.includes('--bg:'), '--bg variabele aanwezig');
    assert.ok(css.includes('--text:'), '--text variabele aanwezig');
    assert.ok(css.includes('--primary:'), '--primary variabele aanwezig');
  });

  test('bevat prefers-reduced-motion media query', () => {
    assert.ok(css.includes('prefers-reduced-motion'), 'prefers-reduced-motion aanwezig');
  });

  test('bevat animaties voor vlieg-naar-mandje', () => {
    assert.ok(css.includes('@keyframes'), 'keyframes animaties aanwezig');
  });
});

// ── App.js Functionaliteit ─────────────────────────────────

describe('app.js vereiste functies', () => {
  const app = readFileSync(join(DOCS, 'js/app.js'), 'utf8');

  test('exporteert init functie', () => {
    assert.ok(app.includes('export async function init'), 'init functie geëxporteerd');
  });

  test('bevat checkItem functie', () => {
    assert.ok(app.includes('function checkItem'), 'checkItem aanwezig');
  });

  test('bevat uncheckItem functie', () => {
    assert.ok(app.includes('function uncheckItem'), 'uncheckItem aanwezig');
  });

  test('bevat uncheckAll functie', () => {
    assert.ok(app.includes('function uncheckAll'), 'uncheckAll aanwezig');
  });

  test('bevat voegItemToe functie', () => {
    assert.ok(app.includes('function voegItemToe'), 'voegItemToe aanwezig');
  });

  test('bevat vlieg-animatie functie', () => {
    assert.ok(app.includes('function animeerNaarMandje'), 'animeerNaarMandje aanwezig');
  });

  test('bevat YAML fetch', () => {
    assert.ok(app.includes("fetch('data/items.yaml')") || app.includes('fetch("data/items.yaml")'),
      'YAML fetch aanwezig');
  });

  test('bevat fallback data voor offline gebruik', () => {
    assert.ok(app.includes('FALLBACK'), 'FALLBACK data aanwezig');
  });

  test('bevat thema-schakelaar', () => {
    assert.ok(app.includes('applyTheme'), 'applyTheme aanwezig');
    assert.ok(app.includes('cycleTheme'), 'cycleTheme aanwezig');
  });

  test('registreert service worker (via index.html inline script)', () => {
    const indexHtml = readFileSync(join(DOCS, 'index.html'), 'utf8');
    assert.ok(indexHtml.includes('serviceWorker'), 'serviceWorker aanwezig in HTML');
    assert.ok(indexHtml.includes("register('./sw.js')") || indexHtml.includes('register("./sw.js")'),
      'sw.js geregistreerd');
  });

  test('luistert naar controllerchange voor automatisch herladen', () => {
    const indexHtml = readFileSync(join(DOCS, 'index.html'), 'utf8');
    assert.ok(app.includes('controllerchange') || indexHtml.includes('controllerchange'),
      'controllerchange listener aanwezig');
  });
});

// ── store.js ───────────────────────────────────────────────

describe('store.js localStorage beheer', () => {
  const store = readFileSync(join(DOCS, 'js/store.js'), 'utf8');

  test('exporteert getChecked', () => {
    assert.ok(store.includes('export function getChecked'), 'getChecked geëxporteerd');
  });

  test('exporteert saveChecked', () => {
    assert.ok(store.includes('export function saveChecked'), 'saveChecked geëxporteerd');
  });

  test('exporteert clearChecked', () => {
    assert.ok(store.includes('export function clearChecked'), 'clearChecked geëxporteerd');
  });

  test('exporteert getUserItems', () => {
    assert.ok(store.includes('export function getUserItems'), 'getUserItems geëxporteerd');
  });

  test('exporteert getTheme', () => {
    assert.ok(store.includes('export function getTheme'), 'getTheme geëxporteerd');
  });

  test('gebruikt try/catch bij localStorage lezen', () => {
    assert.ok(store.includes('try {'), 'try/catch aanwezig voor localStorage fouten');
  });

  test('standaard thema is auto', () => {
    assert.ok(store.includes("'auto'") || store.includes('"auto"'), 'auto thema standaard');
  });
});

// ── GitHub Actions workflow ────────────────────────────────

describe('GitHub Actions workflow', () => {
  const workflowPath = join(__dirname, '../.github/workflows/deploy.yml');

  test('workflow bestand bestaat', () => {
    assert.ok(existsSync(workflowPath), 'deploy.yml bestaat');
  });

  test('workflow deployt naar GitHub Pages', () => {
    const workflow = readFileSync(workflowPath, 'utf8');
    assert.ok(workflow.includes('deploy-pages'), 'deploy-pages actie aanwezig');
  });

  test('workflow wordt geactiveerd op push naar main', () => {
    const workflow = readFileSync(workflowPath, 'utf8');
    assert.ok(workflow.includes('branches: [main]') || workflow.includes("branches:\n    - main"),
      'push naar main trigger aanwezig');
  });

  test('workflow injecteert versie in service worker', () => {
    const workflow = readFileSync(workflowPath, 'utf8');
    assert.ok(workflow.includes('%%VERSION%%') || workflow.includes('sed -i'), 'versie injectie aanwezig');
  });

  test('workflow wordt ook geactiveerd op pull requests', () => {
    const workflow = readFileSync(workflowPath, 'utf8');
    assert.ok(workflow.includes('pull_request'), 'pull_request trigger aanwezig');
  });
});
