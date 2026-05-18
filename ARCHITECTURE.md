# BoodschappenBaas – Architectuurdocumentatie

## Overzicht

BoodschappenBaas is een **Progressive Web App (PWA)** voor het beheren van een boodschappenlijst. De app is geoptimaliseerd voor gebruik in Nederlandse supermarkten (AH, Jumbo, Aldi, Lidl en Dirk) en biedt categorisering voor een optimale winkelroute.

---

## Technologiestack

| Laag | Technologie | Motivatie |
|------|-------------|-----------|
| Frontend | Vanilla HTML5 / CSS3 / JavaScript (ES Modules) | Minimale afhankelijkheden, geen build-stap vereist |
| Data | YAML (bronbestand) | Leesbaar, bewerkbaar in de repository |
| Opslag | localStorage | Offline-first, geen backend vereist |
| Offline | Service Worker (Cache API) | PWA-ondersteuning, werkt zonder internet |
| Deployment | GitHub Pages via GitHub Actions | Gratis hosting, CI/CD ingebouwd |
| Tests | Node.js `node:test` (ingebouwd) | Geen externe testframeworks nodig |

---

## Mapstructuur

```
BoodschappenBaas/
│
├── docs/                          # GitHub Pages root (de app)
│   ├── index.html                 # Hoofd HTML (één pagina app)
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service Worker (%%VERSION%% placeholder)
│   │
│   ├── css/
│   │   └── styles.css             # Alle stijlen: thema, animaties, layout
│   │
│   ├── js/
│   │   ├── app.js                 # Hoofd applicatielogica
│   │   ├── store.js               # localStorage abstractielaag
│   │   └── yaml-parser.js         # Minimale YAML-parser
│   │
│   ├── data/
│   │   └── items.yaml             # Canonieke databron (supermarkten, categorieën, items)
│   │
│   └── icons/
│       ├── icon.svg               # App-icoon (vectorformaat)
│       ├── maskable.svg           # Maskeerbaar icoon voor Android
│       ├── icon-192.png           # PWA icoon 192×192
│       ├── icon-512.png           # PWA icoon 512×512
│       └── apple-touch-icon.png   # iOS home screen icoon
│
├── tests/
│   ├── unit.test.js               # YAML-parser en businesslogica
│   ├── accessibility.test.js      # HTML-structuur en ARIA
│   └── integration.test.js        # Bestandsintegriteit, SW, CSS, workflows
│
├── .github/
│   └── workflows/
│       └── deploy.yml             # CI/CD: tests + GitHub Pages deployment
│
├── package.json                   # npm scripts voor tests
├── README.md                      # Gebruikershandleiding
└── ARCHITECTURE.md                # Dit bestand
```

---

## Applicatiearchitectuur

### Module-overzicht

```
index.html
│
├── <script> (inline)              # Service Worker registratie
│
└── <script type="module">
    └── app.js (ES module)
        ├── yaml-parser.js         # Importeer parseYAML()
        └── store.js               # Importeer localStorage helpers
```

### Dataflow

```
data/items.yaml
      │
      │ fetch() + parseYAML()
      ▼
  app.js (state)
  ┌────────────────────────────────┐
  │ state = {                      │
  │   supermarkten: [...],         │ ← Uit YAML
  │   categorieen: [...],          │ ← Uit YAML
  │   items: [...],                │ ← Uit YAML
  │   userItems: [...],            │ ← Uit localStorage
  │   checked: [...],              │ ← Uit localStorage
  │   activeMarkt: '...',          │ ← Uit localStorage
  │ }                              │
  └────────────────────────────────┘
      │
      │ render()
      ▼
   DOM (HTML)
```

### State Management (store.js)

Alle persistente staat wordt opgeslagen in `localStorage` met vaste sleutels:

| Sleutel | Type | Beschrijving |
|---------|------|--------------|
| `bb_checked` | `string[]` | IDs van afgevinkte items |
| `bb_user_items` | `object[]` | Door gebruiker toegevoegde items |
| `bb_theme` | `string` | Themavoorkeur (`auto`/`light`/`dark`) |
| `bb_active_markt` | `string` | Actieve supermarktfilter |

### YAML-parser (yaml-parser.js)

Een minimale, op maat gemaakte parser voor het specifieke YAML-formaat van `items.yaml`. Ondersteunt:
- Sleutel-waardeparen op het hoogste niveau
- Lijsten van objecten (`- id: ... naam: ...`)
- Eenvoudige tekenreekswaarden
- Inline arrays (`[ah, jumbo, aldi]`)
- Commentaarregels (`# ...`)
- Strings met aanhalingstekens

Ondersteunt **niet**: multi-line strings, ankers/aliassen, complexe nesting.

---

## Gebruikersinterface

### Schermindeling

```
┌─────────────────────────────────────┐
│ HEADER: Logo | Thema | 🧺 Mandje    │  ← Sticky
├─────────────────────────────────────┤
│ FILTER: [Alle] [AH] [Jumbo] ...     │
├─────────────────────────────────────┤
│ CATEGORIE: 🥛 Zuivel                │
│  ☐ Kwark              AH Jumbo...   │
│                                     │
│ CATEGORIE: 🍓 Fruit                 │
│  ☐ Aardbeien          AH Jumbo...   │
│  ☐ Blauwe bessen      AH Jumbo...   │
├─────────────────────────────────────┤
│                              [+ FAB]│
└─────────────────────────────────────┘
```

### Mandje-panel (schuifpaneel rechts)

```
┌─────────────────────┐
│ 🧺 Mandje (2)    ✕  │
├─────────────────────┤
│ ↩ Alles terugplaatsen│
├─────────────────────┤
│ 🥛 Kwark        ✕  │
│ 🥤 Sprite Zero  ✕  │
└─────────────────────┘
```

### Animatie (vlieg naar mandje)

Wanneer een gebruiker een item aanvinkt:
1. Een gekloond DOM-element wordt boven het originele item geplaatst (vaste positie)
2. Via CSS-transitie vliegt het kloon naar het mandje-icoon in de header
3. Het kloon vervaagt en krimpt (`transform: scale(0)`, `opacity: 0`)
4. Na 550ms wordt het kloon verwijderd en de lijst opnieuw gerenderd
5. Het mandje-icoon krijgt een bounce-animatie

---

## PWA en Offline

### Service Worker strategie

**Cache-first** strategie voor alle GET-verzoeken:
1. Controleer of het verzoek in de cache staat → geef gecachte versie terug
2. Zo niet → haal op uit het netwerk en sla op in cache

### Automatisch verversen bij nieuwe commit

1. GitHub Actions vervangt `%%VERSION%%` in `sw.js` door `{commit-sha}-{timestamp}`
2. Bij elke nieuwe paginalading detecteert de browser een gewijzigd `sw.js`
3. De nieuwe SW installeert zichzelf (`skipWaiting()` → direct activeren)
4. `clients.claim()` laat de nieuwe SW alle open tabbladen overnemen
5. De pagina luistert naar `controllerchange` en herlaadt zichzelf

### Pre-cached assets

Alle app-bestanden worden bij installatie in de cache gezet:
`index.html`, `manifest.json`, `sw.js`, CSS, JS-modules, `data/items.yaml`, iconen.

---

## Thema

| Modus | Triggermechanisme |
|-------|-------------------|
| Automatisch (standaard) | `@media (prefers-color-scheme: dark)` in CSS |
| Licht | `data-theme="light"` attribuut op `<html>` |
| Donker | `data-theme="dark"` attribuut op `<html>` |

De voorkeur wordt opgeslagen in `localStorage` (`bb_theme`).

---

## Deployment

### GitHub Actions workflow (`.github/workflows/deploy.yml`)

```
push naar main
      │
      ▼
  [job: test]
      │ node --test tests/
      ▼
  [job: deploy]
      │ Versie injecteren in sw.js
      │ actions/configure-pages
      │ actions/upload-pages-artifact (docs/)
      │ actions/deploy-pages
      ▼
  https://{gebruiker}.github.io/BoodschappenBaas/
```

Bij pull requests draait alleen de `test`-job (geen deployment).

---

## Toegankelijkheid

De app voldoet aan de volgende toegankelijkheidsprincipes:

- **Semantische HTML**: `<header>`, `<main>`, `<aside>`, `<section>`, `<form>`, `<ul>`/`<li>`
- **ARIA-rollen en -attributen**: `role="banner"`, `role="main"`, `role="complementary"`, `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-live`, `aria-label`, `aria-pressed`, `aria-hidden`
- **Toetsenbordnavigatie**: Alle interactieve elementen zijn bereikbaar via Tab; Escape sluit panelen/modals
- **Focus management**: Panelen en modals geven focus aan de sluitknop bij openen
- **Kleurcontrast**: Voldoende contrast in zowel lichte als donkere modus
- **Beweging reduceren**: `@media (prefers-reduced-motion: reduce)` schakelt animaties uit
- **Taal**: `lang="nl"` op `<html>`

---

## Toekomstige uitbreidingen (Post-MVP)

- [ ] Barcode-scanner voor snelle invoer
- [ ] Recepten importeren (ingrediënten automatisch toevoegen)
- [ ] Boodschappenlijst delen via URL/QR-code
- [ ] Prijsvergelijking tussen supermarkten
- [ ] Winkelroute-optimalisatie op basis van supermarktplattegrond
- [ ] Synchronisatie via een backend (optioneel)
- [ ] Push-notificaties voor herinnering aan boodschappen
- [ ] Import/export van lijsten als YAML of JSON
