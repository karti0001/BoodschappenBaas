# BoodschappenBaas 🛒

**Slimme boodschappenlijst voor de Nederlandse supermarkt**

BoodschappenBaas is een gratis, offline-werkende Progressive Web App (PWA) waarmee je boodschappenlijsten beheert, filtert per supermarkt en sorteert per categorie voor een optimale winkelroute.

👉 **Live app:** [https://karti0001.github.io/BoodschappenBaas/](https://karti0001.github.io/BoodschappenBaas/)

---

## ✨ Functies

| Functie | Beschrijving |
|---------|-------------|
| 🏪 **Supermarktfilter** | Filter items per supermarkt: AH, Jumbo, Aldi, Lidl, Dirk |
| 🗂️ **Categorisering** | Items gegroepeerd per categorie (Zuivel, Groente, Fruit, ...) |
| 🧺 **Winkelmandje** | Aanvinken vliegt item met animatie naar het mandje |
| ↩️ **Alles uitvinken** | Reset alle items in één klik, of individueel terugplaatsen |
| ✏️ **Zelf toevoegen** | Voeg eigen boodschappen toe met categorie en supermarkt |
| 💾 **Lokale opslag** | Gegevens opgeslagen in de browser (geen account nodig) |
| 🌗 **Donker/licht thema** | Automatisch op basis van systeeminstellingen, handmatig te wisselen |
| 📱 **PWA / Offline** | Installeerbaar op telefoon, werkt zonder internet |
| 🔄 **Automatisch bijwerken** | App ververst automatisch na elke nieuwe versie |

---

## 🚀 Snel starten

### Als webapp (aanbevolen)

1. Ga naar de [live app](https://karti0001.github.io/BoodschappenBaas/)
2. Op mobiel: **Voeg toe aan beginscherm** (iOS: Deel → Zet op beginscherm; Android: menu → App installeren)
3. Klaar! De app werkt ook offline.

### Lokaal uitvoeren

```bash
# Kloon de repository
git clone https://github.com/karti0001/BoodschappenBaas.git
cd BoodschappenBaas

# Start een lokale server (kies één van onderstaande opties)
npx serve docs              # Met serve
python3 -m http.server 8080 --directory docs   # Met Python
```

Ga daarna naar `http://localhost:8080`.

> ⚠️ **Opmerking:** Open de app via een HTTP-server (niet via `file://`) voor correcte Service Worker ondersteuning.

---

## 📋 Gebruik

### Boodschappen beheren

1. **Supermarkt kiezen** – Klik op een supermarktknop bovenaan om de lijst te filteren
2. **Item aanvinken** – Klik op het selectievakje; het item vliegt naar je mandje
3. **Item terugplaatsen** – Klik op **✕** in het mandje, of gebruik **↩ Alles terugplaatsen**
4. **Mandje openen** – Klik op het mandje-icoon (🧺) rechtsboven

### Nieuw item toevoegen

1. Klik op de **+** knop rechtsonder
2. Vul de naam in
3. Kies een categorie
4. Selecteer de supermarkten waar het item te koop is
5. Klik **✅ Toevoegen aan lijst**

### Thema wisselen

Klik op het thema-icoon (🌗) rechtsboven om te schakelen tussen:
- 🌗 **Automatisch** – Volgt de systeeminstellingen
- ☀️ **Licht** – Altijd lichte modus
- 🌙 **Donker** – Altijd donkere modus

---

## 🗂️ Boodschappendata aanpassen

De brondata staat in [`docs/data/items.yaml`](docs/data/items.yaml). Je kunt hier direct items toevoegen:

```yaml
items:
  - id: mijn-item
    naam: Hagelslag
    categorie: brood          # zuivel, groente, fruit, dranken, brood, vlees, diepvries, snacks, overig
    supermarkten: [ah, jumbo] # ah, jumbo, aldi, lidl, dirk
```

Na een commit naar `main` wordt de app automatisch bijgewerkt.

---

## 🛠️ Ontwikkeling

### Vereisten

- Node.js 20 of hoger

### Tests uitvoeren

```bash
# Alle tests
npm test

# Specifieke testsuites
npm run test:unit          # YAML-parser en businesslogica
npm run test:accessibility # HTML-structuur en ARIA-attributen
npm run test:integration   # Bestandsintegriteit, Service Worker, CSS
```

### Projectstructuur

```
docs/                  ← GitHub Pages root (de app)
├── index.html         ← Hoofd HTML
├── manifest.json      ← PWA manifest
├── sw.js              ← Service Worker
├── css/styles.css     ← Stijlen (donker/licht thema, animaties)
├── js/
│   ├── app.js         ← Applicatielogica
│   ├── store.js       ← localStorage beheer
│   └── yaml-parser.js ← YAML-parser
├── data/items.yaml    ← Boodschappendata (bronbestand)
└── icons/             ← App-iconen
tests/                 ← Testsuites
.github/workflows/     ← GitHub Actions CI/CD
```

Zie [ARCHITECTURE.md](ARCHITECTURE.md) voor een uitgebreide architectuurbeschrijving.

---

## 🏪 Beschikbare supermarkten

| Afkorting | Naam |
|-----------|------|
| `ah` | Albert Heijn |
| `jumbo` | Jumbo |
| `aldi` | Aldi |
| `lidl` | Lidl |
| `dirk` | Dirk |

## 🗂️ Beschikbare categorieën

| ID | Naam | Emoji |
|----|------|-------|
| `zuivel` | Zuivel | 🥛 |
| `groente` | Groente | 🥦 |
| `fruit` | Fruit | 🍓 |
| `dranken` | Dranken | 🥤 |
| `brood` | Brood & Gebak | 🍞 |
| `vlees` | Vlees & Vis | 🥩 |
| `diepvries` | Diepvries | 🧊 |
| `snacks` | Snacks | 🍿 |
| `overig` | Overig | 🛒 |

---

## 🚢 Deployment

De app wordt automatisch gepubliceerd naar GitHub Pages na elke commit naar `main`:

```
push naar main → tests → versie-injectie in sw.js → GitHub Pages
```

Bij pull requests worden alleen de tests uitgevoerd (geen deployment).

**Instellen voor nieuwe repository:**
1. Ga naar repository **Settings → Pages**
2. Source: **GitHub Actions**
3. De workflow (`.github/workflows/deploy.yml`) regelt de rest automatisch

---

## 📄 Licentie

MIT – Zie [LICENSE](LICENSE) voor details.

---

## 💡 Ideeën voor de toekomst?

Maak een [issue aan](https://github.com/karti0001/BoodschappenBaas/issues) met het label `enhancement`!
