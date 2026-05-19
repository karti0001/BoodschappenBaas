# Architectuur

## Doel

BoodschappenBaas is een dependency-vrije static web app. De MVP blijft klein zodat de site eenvoudig via GitHub Pages kan draaien en offline bruikbaar is.

## Onderdelen

- `frontend/index.html` bevat de Nederlandse, toegankelijke UI.
- `frontend/styles.css` bevat het professionele dashboard-thema met light/dark thema's en `prefers-color-scheme` als automatische standaard.
- `frontend/app.js` bevat parsing van YAML-seeddata, localStorage-synchronisatie, routegroepering en interactie.
- `frontend/data/boodschappen.yml` is de repository-bron voor de standaardboodschappen.
- `frontend/manifest.webmanifest` en `frontend/service-worker.js` maken de app installeerbaar en offline beschikbaar.
- `scripts/build.js` kopieert de statische site naar `dist/` en vervangt de service-worker versie door de commit-SHA.

## Datastromen

1. Bij opstarten laadt de browser `frontend/data/boodschappen.yml`.
2. De app combineert deze seed met opgeslagen items uit `localStorage`.
3. Alle gebruikersacties schrijven de complete genormaliseerde lijst terug naar `localStorage`.
4. De gekozen categorievolgorde voor de supermarkt-route wordt in `localStorage` bewaard.
5. De UI toont een route per gekozen supermarkt, gegroepeerd volgens de ingestelde categorievolgorde.
6. De browser laadt `frontend/data/aanbiedingen.json` met vooraf opgehaalde Reclamefolder-aanbiedingen en matcht die lokaal fuzzy op itemnaam.
7. De service worker cachet de app-shell en het aanbiedingenbestand voor offline gebruik en forceert activatie van nieuwe versies.

## Teststrategie

De tests gebruiken Node's ingebouwde test runner. Ze controleren unitgedrag (YAML parsing en routegroepering), toegankelijkheidskenmerken in HTML en PWA-integratiebestanden.
