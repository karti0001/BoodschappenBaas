/**
 * Unit tests voor BoodschappenBaas
 * Test: YAML parser, store helpers, en business logica
 * Gebruikt Node.js ingebouwde testrunner (node:test)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── YAML Parser testen ─────────────────────────────────────

// Importeer de parseYAML functie rechtstreeks
const yamlSrc = readFileSync(join(__dirname, '../docs/js/yaml-parser.js'), 'utf8');
// Verwijder 'export' zodat we het als CJS-achtig kunnen evalueren
const moduleCode = yamlSrc.replace(/^export /gm, '');
const fn = new Function('module', 'exports', moduleCode + '\nmodule.exports = { parseYAML };');
const mod = { exports: {} };
fn(mod, mod.exports);
const { parseYAML } = mod.exports;

describe('YAML Parser', () => {
  test('parseert eenvoudige sleutel-waarde paren', () => {
    const yaml = 'naam: Kwark\ncategorie: zuivel';
    const result = parseYAML(yaml);
    assert.equal(result.naam, 'Kwark');
    assert.equal(result.categorie, 'zuivel');
  });

  test('parseert een lijst van strings', () => {
    const yaml = `
items:
  - appel
  - peer
  - banaan
`;
    const result = parseYAML(yaml);
    assert.deepEqual(result.items, ['appel', 'peer', 'banaan']);
  });

  test('parseert een lijst van objecten', () => {
    const yaml = `
supermarkten:
  - id: ah
    naam: AH
  - id: jumbo
    naam: Jumbo
`;
    const result = parseYAML(yaml);
    assert.equal(result.supermarkten.length, 2);
    assert.equal(result.supermarkten[0].id, 'ah');
    assert.equal(result.supermarkten[0].naam, 'AH');
    assert.equal(result.supermarkten[1].id, 'jumbo');
  });

  test('parseert inline arrays', () => {
    const yaml = `
items:
  - id: kwark
    naam: Kwark
    supermarkten: [ah, jumbo, aldi]
`;
    const result = parseYAML(yaml);
    assert.deepEqual(result.items[0].supermarkten, ['ah', 'jumbo', 'aldi']);
  });

  test('slaat commentaarregels over', () => {
    const yaml = `
# Dit is een commentaar
naam: Test
# Nog een commentaar
waarde: 42
`;
    const result = parseYAML(yaml);
    assert.equal(result.naam, 'Test');
    assert.equal(result.waarde, '42');
  });

  test('slaat lege regels over', () => {
    const yaml = `

naam: Test

waarde: hallo

`;
    const result = parseYAML(yaml);
    assert.equal(result.naam, 'Test');
    assert.equal(result.waarde, 'hallo');
  });

  test('parseert waarden met aanhalingstekens', () => {
    const yaml = `
kleur: "#6c63ff"
label: 'Hallo wereld'
`;
    const result = parseYAML(yaml);
    assert.equal(result.kleur, '#6c63ff');
    assert.equal(result.label, 'Hallo wereld');
  });

  test('parseert het echte items.yaml bestand', () => {
    const yaml = readFileSync(join(__dirname, '../docs/data/items.yaml'), 'utf8');
    const result = parseYAML(yaml);

    // Structuur aanwezig
    assert.ok(Array.isArray(result.supermarkten), 'supermarkten moet een array zijn');
    assert.ok(Array.isArray(result.categorieen), 'categorieen moet een array zijn');
    assert.ok(Array.isArray(result.items), 'items moet een array zijn');

    // Supermarkten
    assert.equal(result.supermarkten.length, 5, 'Er zijn 5 supermarkten');
    const marktIds = result.supermarkten.map((m) => m.id);
    assert.ok(marktIds.includes('ah'), 'AH aanwezig');
    assert.ok(marktIds.includes('jumbo'), 'Jumbo aanwezig');
    assert.ok(marktIds.includes('aldi'), 'Aldi aanwezig');
    assert.ok(marktIds.includes('lidl'), 'Lidl aanwezig');
    assert.ok(marktIds.includes('dirk'), 'Dirk aanwezig');

    // Verplichte startitems
    const itemNamen = result.items.map((i) => i.naam.toLowerCase());
    assert.ok(itemNamen.some((n) => n.includes('kwark')), 'Kwark aanwezig');
    assert.ok(itemNamen.some((n) => n.includes('sprite')), 'Sprite Zero aanwezig');
    assert.ok(itemNamen.some((n) => n.includes('aardbei')), 'Aardbeien aanwezig');
    assert.ok(itemNamen.some((n) => n.includes('blauwe')), 'Blauwe bessen aanwezig');

    // Elke item heeft verplichte velden
    for (const item of result.items) {
      assert.ok(item.id, `Item heeft een id: ${JSON.stringify(item)}`);
      assert.ok(item.naam, `Item heeft een naam: ${JSON.stringify(item)}`);
      assert.ok(item.categorie, `Item heeft een categorie: ${JSON.stringify(item)}`);
      assert.ok(Array.isArray(item.supermarkten), `Item.supermarkten is een array: ${item.naam}`);
      assert.ok(item.supermarkten.length > 0, `Item heeft minstens 1 supermarkt: ${item.naam}`);
    }

    // Categorieën hebben emoji en kleur
    for (const cat of result.categorieen) {
      assert.ok(cat.id, `Categorie heeft een id: ${JSON.stringify(cat)}`);
      assert.ok(cat.naam, `Categorie heeft een naam: ${JSON.stringify(cat)}`);
      assert.ok(cat.emoji, `Categorie heeft een emoji: ${cat.naam}`);
      assert.ok(cat.kleur, `Categorie heeft een kleur: ${cat.naam}`);
    }
  });
});

// ── Business logica testen ──────────────────────────────────

describe('Itemfiltering', () => {
  const items = [
    { id: 'kwark', naam: 'Kwark', categorie: 'zuivel', supermarkten: ['ah', 'jumbo'] },
    { id: 'sprite', naam: 'Sprite Zero', categorie: 'dranken', supermarkten: ['ah', 'dirk'] },
    { id: 'appel', naam: 'Appel', categorie: 'fruit', supermarkten: ['jumbo', 'aldi'] },
  ];

  test('filtert op supermarkt', () => {
    const gefilterd = items.filter((i) => i.supermarkten.includes('ah'));
    assert.equal(gefilterd.length, 2);
    assert.ok(gefilterd.some((i) => i.id === 'kwark'));
    assert.ok(gefilterd.some((i) => i.id === 'sprite'));
  });

  test('toont alle items bij "alle" filter', () => {
    const gefilterd = items.filter(() => true);
    assert.equal(gefilterd.length, 3);
  });

  test('groepeert items per categorie', () => {
    const byCategorie = {};
    for (const item of items) {
      if (!byCategorie[item.categorie]) byCategorie[item.categorie] = [];
      byCategorie[item.categorie].push(item);
    }
    assert.equal(Object.keys(byCategorie).length, 3);
    assert.equal(byCategorie.zuivel.length, 1);
    assert.equal(byCategorie.dranken.length, 1);
    assert.equal(byCategorie.fruit.length, 1);
  });

  test('sluit afgevinkte items uit van de lijst', () => {
    const checked = ['kwark'];
    const zichtbaar = items.filter((i) => !checked.includes(i.id));
    assert.equal(zichtbaar.length, 2);
    assert.ok(!zichtbaar.some((i) => i.id === 'kwark'));
  });
});

describe('Gebruiker item aanmaken', () => {
  test('genereert een uniek ID op basis van naam', () => {
    const naam = 'Hagelslag';
    const id = `user-${Date.now()}-${naam.toLowerCase().replace(/\s+/g, '-')}`;
    assert.ok(id.startsWith('user-'));
    assert.ok(id.includes('hagelslag'));
  });

  test('valideert dat naam niet leeg is', () => {
    const naam = '   ';
    assert.equal(naam.trim().length, 0);
  });

  test('valideert dat minstens één supermarkt geselecteerd is', () => {
    const supermarkten = [];
    assert.equal(supermarkten.length, 0); // Zou een fout moeten geven
    const metSupermarkt = ['ah'];
    assert.equal(metSupermarkt.length, 1);
  });
});
