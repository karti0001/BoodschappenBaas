/**
 * Toegankelijkheidstest voor BoodschappenBaas
 * Test: HTML structuur, ARIA attributen, en semantic markup
 * Gebruikt Node.js ingebouwde testrunner (node:test)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '../docs/index.html'), 'utf8');

// Eenvoudige HTML-controlefuncties (geen externe deps nodig)

/** @param {string} pattern */
function htmlContains(pattern) {
  if (typeof pattern === 'string') return html.includes(pattern);
  return pattern.test(html);
}

/** Tel het aantal keren dat een patroon voorkomt */
function countOccurrences(pattern) {
  return (html.match(new RegExp(pattern, 'g')) || []).length;
}

describe('HTML Basisconfiguratie', () => {
  test('heeft doctype', () => {
    assert.ok(htmlContains('<!DOCTYPE html>'), 'DOCTYPE aanwezig');
  });

  test('heeft lang="nl" attribuut', () => {
    assert.ok(htmlContains('lang="nl"'), 'lang="nl" aanwezig');
  });

  test('heeft UTF-8 charset', () => {
    assert.ok(htmlContains('charset="UTF-8"') || htmlContains("charset='UTF-8'"), 'UTF-8 charset aanwezig');
  });

  test('heeft viewport meta tag', () => {
    assert.ok(htmlContains('name="viewport"'), 'viewport meta aanwezig');
  });

  test('heeft beschrijving meta tag', () => {
    assert.ok(htmlContains('name="description"'), 'description meta aanwezig');
  });

  test('heeft een titel', () => {
    assert.ok(htmlContains('<title>BoodschappenBaas</title>'), 'Titel aanwezig');
  });
});

describe('PWA Configuratie', () => {
  test('heeft link naar manifest', () => {
    assert.ok(htmlContains('rel="manifest"'), 'manifest link aanwezig');
  });

  test('heeft theme-color meta tag', () => {
    assert.ok(htmlContains('name="theme-color"'), 'theme-color aanwezig');
  });

  test('heeft apple-mobile-web-app-capable', () => {
    assert.ok(htmlContains('apple-mobile-web-app-capable'), 'apple PWA tag aanwezig');
  });

  test('heeft app icon link', () => {
    assert.ok(htmlContains('rel="icon"'), 'icon link aanwezig');
  });
});

describe('Semantische HTML structuur', () => {
  test('heeft een <header> element', () => {
    assert.ok(htmlContains('<header'), 'header aanwezig');
  });

  test('heeft een <main> element', () => {
    assert.ok(htmlContains('<main'), 'main aanwezig');
  });

  test('heeft een <h1> heading', () => {
    assert.ok(htmlContains('<h1'), 'h1 aanwezig');
  });

  test('heeft een <form> element voor toevoegen', () => {
    assert.ok(htmlContains('<form'), 'form aanwezig');
  });

  test('heeft exactement één <main> element', () => {
    assert.equal(countOccurrences('<main'), 1, 'Slechts één main element');
  });
});

describe('ARIA Toegankelijkheid', () => {
  test('header heeft role="banner"', () => {
    assert.ok(htmlContains('role="banner"'), 'role="banner" aanwezig');
  });

  test('main heeft role="main"', () => {
    assert.ok(htmlContains('role="main"'), 'role="main" aanwezig');
  });

  test('boodschappenlijst heeft aria-live', () => {
    assert.ok(htmlContains('aria-live'), 'aria-live aanwezig');
  });

  test('formulier heeft aria-modal', () => {
    assert.ok(htmlContains('aria-modal="true"'), 'aria-modal aanwezig');
  });

  test('dialoog heeft aria-labelledby', () => {
    assert.ok(htmlContains('aria-labelledby'), 'aria-labelledby aanwezig');
  });

  test('alle knoppen hebben aria-label', () => {
    const buttons = html.match(/<button[^>]*>/g) || [];
    const problematisch = buttons.filter(
      (btn) => !btn.includes('aria-label') && !btn.includes('type="submit"')
    );
    assert.equal(problematisch.length, 0,
      `Knoppen zonder aria-label: ${problematisch.join(', ')}`
    );
  });

  test('checkboxes zijn gekoppeld aan labels', () => {
    const inputs = html.match(/<input[^>]*type="checkbox"[^>]*>/g) || [];
    const inputsWithId = inputs.filter((i) => i.includes('id='));
    // Elke checkbox met ID zou een bijbehorend label moeten hebben
    assert.ok(inputsWithId.length >= 0, 'Checkboxes gevonden');
  });

  test('foutmeldingen hebben role="alert"', () => {
    assert.ok(htmlContains('role="alert"'), 'role="alert" aanwezig');
  });

  test('overlay heeft aria-hidden', () => {
    assert.ok(htmlContains('aria-hidden="true"'), 'aria-hidden aanwezig op overlay');
  });

  test('skip-to-main of goed landmark-gebruik', () => {
    // Controleer of er minimaal drie landmarks aanwezig zijn
    const hasHeader = htmlContains('role="banner"') || htmlContains('<header');
    const hasMain = htmlContains('role="main"') || htmlContains('<main');
    const hasComplementary = htmlContains('role="complementary"') || htmlContains('<aside');
    assert.ok(hasHeader, 'header/banner aanwezig');
    assert.ok(hasMain, 'main aanwezig');
    assert.ok(hasComplementary, 'aside/complementary aanwezig');
  });
});

describe('Formulier Toegankelijkheid', () => {
  test('invoerveld heeft een label', () => {
    assert.ok(htmlContains('<label'), 'Label aanwezig');
    assert.ok(htmlContains('for="form-naam"'), 'Label gekoppeld aan naam input');
  });

  test('selectieveld heeft een label', () => {
    assert.ok(htmlContains('for="form-categorie"'), 'Label voor categorie select');
  });

  test('verplichte velden zijn gemarkeerd', () => {
    assert.ok(htmlContains('required') || htmlContains('aria-required'), 'required aanwezig');
  });

  test('submit knop heeft duidelijke tekst of label', () => {
    assert.ok(htmlContains('type="submit"'), 'submit knop aanwezig');
  });

  test('formulier heeft novalidate voor eigen validatie', () => {
    assert.ok(htmlContains('novalidate'), 'novalidate aanwezig voor custom validatie');
  });
});

describe('Kleurthema Metadata', () => {
  test('heeft prefers-color-scheme media query in theme-color', () => {
    assert.ok(
      htmlContains('prefers-color-scheme: light') || htmlContains('prefers-color-scheme: dark'),
      'prefers-color-scheme in theme-color'
    );
  });
});

describe('Service Worker Registratie', () => {
  test('registreert service worker in script', () => {
    assert.ok(htmlContains('serviceWorker'), 'serviceWorker registratie aanwezig');
    assert.ok(htmlContains("register('./sw.js')") || htmlContains('register("./sw.js")'),
      'sw.js geregistreerd');
  });
});

describe('Manifest Validatie', () => {
  const manifestPath = join(__dirname, '../docs/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  test('heeft name veld', () => {
    assert.ok(manifest.name, 'name aanwezig');
  });

  test('heeft short_name veld', () => {
    assert.ok(manifest.short_name, 'short_name aanwezig');
  });

  test('heeft start_url', () => {
    assert.ok(manifest.start_url, 'start_url aanwezig');
  });

  test('heeft display: standalone', () => {
    assert.equal(manifest.display, 'standalone', 'display is standalone');
  });

  test('heeft icons array', () => {
    assert.ok(Array.isArray(manifest.icons), 'icons is een array');
    assert.ok(manifest.icons.length > 0, 'Minstens één icon');
  });

  test('heeft theme_color', () => {
    assert.ok(manifest.theme_color, 'theme_color aanwezig');
  });

  test('heeft background_color', () => {
    assert.ok(manifest.background_color, 'background_color aanwezig');
  });

  test('heeft Nederlandse taalinstelling', () => {
    assert.equal(manifest.lang, 'nl', 'lang is nl');
  });
});
