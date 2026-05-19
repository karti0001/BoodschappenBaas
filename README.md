# BoodschappenBaas

BoodschappenBaas is een kleine Nederlandse PWA om boodschappen per supermarkt en categorie voor te bereiden. De MVP gebruikt bewust alleen plain HTML, CSS en JavaScript.

## Functionaliteit

- Startlijst uit YAML met Kwark, Sprite Zero, aardbeien en blauwe bessen.
- Supermarkten: AH, Jumbo, Aldi, Lidl en Dirk.
- Categorieën zoals Zuivel, Groente, Fruit, Dranken en meer voor een logische winkelroute.
- Supermarkt-route aanpassen door categorieën te verslepen; de volgorde blijft lokaal bewaard.
- Zelf boodschappen toevoegen; wijzigingen worden lokaal in de browser opgeslagen.
- Items individueel afvinken of alles tegelijk uitvinken.
- Afgevinkte items bewegen visueel richting het winkelmandje.
- Aanbiedingen zoeken in een lokaal JSON-bestand, zoeken op artikel/merk/categorie en gevonden aanbiedingen aan items koppelen.
- Licht, donker en automatisch thema op basis van het apparaatprofiel.
- PWA met offline cache en automatische verversing wanneer een nieuwe service worker per commit wordt uitgerold.

## Ontwikkelen

```bash
npm run lint
npm test
npm run build
```

De gebouwde site staat na `npm run build` in `dist/`.

## Data aanpassen

De repository-seed staat in [`frontend/data/boodschappen.yml`](frontend/data/boodschappen.yml). Nieuwe browser-items worden niet naar de repository geschreven, maar in `localStorage` bewaard zodat de app offline en privacyvriendelijk blijft.

Aanbiedingen komen uit [`frontend/data/aanbiedingen.json`](frontend/data/aanbiedingen.json). De GitHub Pages-versie leest alleen dit statische, vooraf gegenereerde bestand en haalt bij zoeken of verversen geen live data op bij supermarkten. De workflow **Aanbiedingen bijwerken** haalt dagelijks en handmatig via `workflow_dispatch` data op voor AH (Albert Heijn), Jumbo, Hoogvliet, Dirk, Dirck3, Aldi en PLUS, filtert andere winkels weg en commit alleen dit JSON-bestand wanneer de inhoud wijzigt. Als ophalen of scrapen mislukt, faalt de workflow zonder het bestaande JSON-bestand te overschrijven; de app blijft de laatst bekende lokale aanbiedingen tonen.

## Deployment

De GitHub Pages workflow bouwt de statische bestanden op elke push naar `main` en op pull requests. Tijdens de build wordt de commit-SHA in de service worker gezet, waardoor de PWA bij elke commit een nieuwe cacheversie krijgt.

Wil je buiten GitHub Pages toch experimenteren met een runtime API, dan kun je vóór `app.js` een globale variabele zetten: `window.BOODSCHAPPENBAAS_LIVE_AANBIEDINGEN_API_PAD = "api/aanbiedingen"` (of een ander API-pad). De standaard UI-knoppen blijven bedoeld voor het lokale `data/aanbiedingen.json`-bestand.

## Post-MVP ideeën

- Meerdere winkelsessies of vaste lijsttemplates, zoals weekboodschappen, feestje of meal prep.
- Export/import van lokale data als YAML of JSON voor back-ups.
- Optionele hoeveelheden en notities per item.
- Snelle herhaal-knop voor recent gekochte items.
