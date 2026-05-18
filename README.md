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
- Aanbiedingen scannen tegen een lokaal JSON-bestand met Allesupers-data.
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

Aanbiedingen komen uit [`frontend/data/aanbiedingen.json`](frontend/data/aanbiedingen.json). De frontend leest alleen dit statische bestand, zodat GitHub Pages zonder server-side backend blijft werken. De workflow **Aanbiedingen bijwerken** haalt dagelijks en handmatig via `workflow_dispatch` data op uit `https://allesupers.nl/catalog/all` en commit alleen dit JSON-bestand wanneer de inhoud wijzigt. Als de bron tijdelijk niet bereikbaar is, blijft de app werken en toont zij subtiel dat er geen actuele aanbieding is gevonden.

## Deployment

De GitHub Pages workflow bouwt de statische bestanden op elke push naar `main` en op pull requests. Tijdens de build wordt de commit-SHA in de service worker gezet, waardoor de PWA bij elke commit een nieuwe cacheversie krijgt.

## Post-MVP ideeën

- Meerdere winkelsessies of vaste lijsttemplates, zoals weekboodschappen, feestje of meal prep.
- Export/import van lokale data als YAML of JSON voor back-ups.
- Optionele hoeveelheden en notities per item.
- Snelle herhaal-knop voor recent gekochte items.
