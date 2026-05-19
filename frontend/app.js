const BoodschappenBaas = (() => {
  const SUPERMARKTEN = ["AH", "Jumbo", "Aldi", "Lidl", "Dirk"];
  const CATEGORIEEN = [
    "Zuivel",
    "Groente",
    "Fruit",
    "Dranken",
    "Brood",
    "Vlees & vis",
    "Diepvries",
    "Voorraadkast",
    "Huishouden",
    "Persoonlijke verzorging",
    "Snacks"
  ];
  const STORAGE_KEY = "boodschappenbaas-items-v1";
  const VERWIJDERDE_ITEMS_KEY = "boodschappenbaas-verwijderde-items-v1";
  const SUPERMARKTEN_KEY = "boodschappenbaas-supermarkten-v1";
  const ROUTE_KEY = "boodschappenbaas-route-v1";
  const THEME_KEY = "boodschappenbaas-theme";
  const GEEN_SUPERMARKT_FILTER = "__geen_supermarkt__";
  const ANIMATION_DURATION_MS = 700;
  const NIET_SLEEPBARE_CATEGORIE_ELEMENTEN = ".boodschap, input, select, textarea, label, button:not(.categorie__greep)";
  const AANBIEDINGEN_PAD = "data/aanbiedingen.json";
  const STOPWOORDEN = new Set(["de", "het", "een", "en", "of", "met", "voor", "bij", "van", "per", "stuk", "stuks"]);
  const EXACTE_SUBSTRING_BONUS = 0.3;
  const MINIMALE_MATCH_SCORE = 0.66;
  const MIN_EN_MEERVOUD_LENGTE = 5;
  const MIN_S_MEERVOUD_LENGTE = 4;
  const CACHE_SCHEIDINGSTEKEN = "\u0000";
  const EURO_FORMATTER = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
  const SUPERMARKT_ALIASSEN = {
    ah: "albert heijn"
  };

  function slugify(value) {
    return value
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function parseValue(value) {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^['\"]|['\"]$/g, ""))
        .filter(Boolean);
    }
    return trimmed.replace(/^['\"]|['\"]$/g, "");
  }

  function parseYamlItems(yaml) {
    const items = [];
    let current = null;

    yaml.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "items:") return;

      if (trimmed.startsWith("- ")) {
        if (current) items.push(current);
        current = {};
        const rest = trimmed.slice(2);
        if (rest.includes(":")) {
          const [key, ...parts] = rest.split(":");
          current[key.trim()] = parseValue(parts.join(":"));
        }
        return;
      }

      if (current && trimmed.includes(":")) {
        const [key, ...parts] = trimmed.split(":");
        current[key.trim()] = parseValue(parts.join(":"));
      }
    });

    if (current) items.push(current);
    return items.map(normaliseerItem).filter((item) => item.naam);
  }

  function normaliseerSupermarkten(supermarkten = SUPERMARKTEN) {
    return [...new Set((Array.isArray(supermarkten) ? supermarkten : SUPERMARKTEN)
      .map((supermarkt) => String(supermarkt || "").trim())
      .filter(Boolean))];
  }

  function laadSupermarkten(storage) {
    try {
      const opgeslagen = storage.getItem(SUPERMARKTEN_KEY);
      return opgeslagen === null ? [...SUPERMARKTEN] : normaliseerSupermarkten(JSON.parse(opgeslagen));
    } catch {
      return [...SUPERMARKTEN];
    }
  }

  function bewaarSupermarkten(storage, supermarkten) {
    const gekozenSupermarkten = normaliseerSupermarkten(supermarkten);
    storage.setItem(SUPERMARKTEN_KEY, JSON.stringify(gekozenSupermarkten));
    return gekozenSupermarkten;
  }

  function normaliseerItem(item, beschikbareSupermarkten = SUPERMARKTEN) {
    const naam = (item.naam || "").trim();
    const categorie = CATEGORIEEN.includes(item.categorie) ? item.categorie : "Voorraadkast";
    const toegestaneSupermarkten = normaliseerSupermarkten(beschikbareSupermarkten);
    const supermarkten = Array.isArray(item.supermarkten)
      ? item.supermarkten.filter((markt) => toegestaneSupermarkten.includes(markt))
      : toegestaneSupermarkten;

    return {
      id: item.id || slugify(`${naam}-${categorie}`),
      naam,
      categorie,
      supermarkten,
      afgevinkt: Boolean(item.afgevinkt),
      eigenItem: Boolean(item.eigenItem)
    };
  }

  function laadOpgeslagenItems(storage, beschikbareSupermarkten = SUPERMARKTEN) {
    try {
      return JSON.parse(storage.getItem(STORAGE_KEY) || "[]").map((item) => normaliseerItem(item, beschikbareSupermarkten));
    } catch {
      return [];
    }
  }

  function laadVerwijderdeItems(storage) {
    try {
      return JSON.parse(storage.getItem(VERWIJDERDE_ITEMS_KEY) || "[]").filter(Boolean);
    } catch {
      return [];
    }
  }

  function bewaarVerwijderdeItems(storage, ids) {
    storage.setItem(VERWIJDERDE_ITEMS_KEY, JSON.stringify([...new Set(ids.filter(Boolean))]));
  }

  function normaliseerRoute(route) {
    const opgeslagen = Array.isArray(route) ? route.filter((categorie) => CATEGORIEEN.includes(categorie)) : [];
    return [...opgeslagen, ...CATEGORIEEN.filter((categorie) => !opgeslagen.includes(categorie))];
  }

  function laadRoute(storage) {
    try {
      return normaliseerRoute(JSON.parse(storage.getItem(ROUTE_KEY) || "[]"));
    } catch {
      return [...CATEGORIEEN];
    }
  }

  function bewaarRoute(storage, route) {
    const volgorde = normaliseerRoute(route);
    storage.setItem(ROUTE_KEY, JSON.stringify(volgorde));
    return volgorde;
  }

  function verplaatsInRoute(route, vanIndex, naarIndex) {
    const volgorde = normaliseerRoute(route);
    if (vanIndex === naarIndex || vanIndex < 0 || naarIndex < 0 || vanIndex >= volgorde.length || naarIndex >= volgorde.length) {
      return volgorde;
    }
    const [categorie] = volgorde.splice(vanIndex, 1);
    volgorde.splice(naarIndex, 0, categorie);
    return volgorde;
  }

  function combineerItems(seedItems, opgeslagenItems, beschikbareSupermarkten = SUPERMARKTEN) {
    const perId = new Map();
    seedItems.map((item) => normaliseerItem(item, beschikbareSupermarkten)).forEach((item) => perId.set(item.id, item));
    opgeslagenItems.map((item) => normaliseerItem(item, beschikbareSupermarkten)).forEach((item) => {
      perId.set(item.id, { ...(perId.get(item.id) || {}), ...item });
    });
    return [...perId.values()].sort(maakRouteSorteerder());
  }

  function maakRouteSorteerder(route = CATEGORIEEN) {
    const routeVolgorde = normaliseerRoute(route);
    return (a, b) => {
      const categorieVerschil = routeVolgorde.indexOf(a.categorie) - routeVolgorde.indexOf(b.categorie);
      if (categorieVerschil !== 0) return categorieVerschil;
      return a.naam.localeCompare(b.naam, "nl", { sensitivity: "base" });
    };
  }

  function groepeerVoorRoute(items, supermarkt = "alle", route = CATEGORIEEN) {
    return [...items]
      .filter((item) => supermarkt === "alle" || (supermarkt === GEEN_SUPERMARKT_FILTER ? !item.supermarkten.length : item.supermarkten.includes(supermarkt)))
      .sort(maakRouteSorteerder(route))
      .reduce((groepen, item) => {
        if (!groepen[item.categorie]) groepen[item.categorie] = [];
        groepen[item.categorie].push(item);
        return groepen;
      }, {});
  }

  function nieuwEigenItem({ naam, categorie, supermarkten }, beschikbareSupermarkten = SUPERMARKTEN) {
    return normaliseerItem({
      id: `eigen-${slugify(naam)}-${Date.now()}`,
      naam,
      categorie,
      supermarkten,
      eigenItem: true
    }, beschikbareSupermarkten);
  }

  function bewaarItems(storage, items, beschikbareSupermarkten = SUPERMARKTEN) {
    storage.setItem(STORAGE_KEY, JSON.stringify(items.map((item) => normaliseerItem(item, beschikbareSupermarkten))));
  }

  function verwijderItem(items, id) {
    return items.filter((item) => item.id !== id);
  }

  function ontkoppelSupermarkt(items, supermarkt, beschikbareSupermarkten = SUPERMARKTEN) {
    return items.map((item) => normaliseerItem({
      ...item,
      supermarkten: item.supermarkten.filter((markt) => markt !== supermarkt)
    }, beschikbareSupermarkten));
  }

  function formatteerSupermarkten(item) {
    return item.supermarkten.length ? item.supermarkten.join(", ") : "Geen supermarkt";
  }

  function normaliseerZoektekst(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/&/g, " en ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function enkelvoudToken(token) {
    if (token.length > MIN_EN_MEERVOUD_LENGTE && token.endsWith("en")) {
      const basis = token.slice(0, -2);
      return /([^aeiou])\1$/i.test(basis) ? basis.slice(0, -1) : basis;
    }
    if (token.length > MIN_S_MEERVOUD_LENGTE && token.endsWith("s") && !token.endsWith("is")) return token.slice(0, -1);
    return token;
  }

  function maakZoekTokens(value) {
    return normaliseerZoektekst(value)
      .split(" ")
      .map(enkelvoudToken)
      .filter((token) => token.length > 1 && !STOPWOORDEN.has(token));
  }

  function normaliseerSupermarktZoeknaam(supermarkt) {
    const naam = normaliseerZoektekst(supermarkt);
    return SUPERMARKT_ALIASSEN[naam] || naam;
  }

  function parsePrijs(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const match = String(value || "").replace(",", ".").match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function normaliseerAanbieding(aanbieding) {
    const prijs = parsePrijs(aanbieding.prijs);
    return {
      productnaam: String(aanbieding.productnaam || aanbieding.naam || "").trim(),
      supermarkt: String(aanbieding.supermarkt || "").trim(),
      prijs,
      prijsTekst: aanbieding.prijsTekst || (prijs === null ? "" : EURO_FORMATTER.format(prijs)),
      oudePrijs: parsePrijs(aanbieding.oudePrijs),
      oudePrijsTekst: aanbieding.oudePrijsTekst || "",
      korting: aanbieding.korting || "",
      eenheidsprijs: aanbieding.eenheidsprijs || "",
      url: aanbieding.url || "",
      bijgewerktOp: aanbieding.bijgewerktOp || ""
    };
  }

  function formatteerDatumTijd(value) {
    return value ? new Date(value).toLocaleString("nl-NL") : "";
  }

  function formatteerAanbiedingBadge(aanbieding, index) {
    return index === 0 ? `Goedkoopste bij ${aanbieding.supermarkt}` : `In de aanbieding bij ${aanbieding.supermarkt}`;
  }

  function formatteerAanbiedingenTitel(aantal, isScanBezig = false) {
    if (isScanBezig) return "Bezig met scannen...";
    return aantal ? `${aantal} aanbieding${aantal === 1 ? "" : "en"} gevonden` : "Geen actuele aanbieding gevonden";
  }

  function matchAanbiedingen(zoekterm, aanbiedingen, opties = {}) {
    const queryTokens = maakZoekTokens(zoekterm);
    if (!queryTokens.length) return [];
    const toegestaneSupermarkten = normaliseerSupermarkten(opties.supermarkten || []);
    const filterSupermarkten = toegestaneSupermarkten.length ? new Set(toegestaneSupermarkten.map(normaliseerSupermarktZoeknaam)) : null;

    return (Array.isArray(aanbiedingen) ? aanbiedingen : [])
      .map(normaliseerAanbieding)
      .filter((aanbieding) => aanbieding.productnaam && aanbieding.supermarkt)
      .filter((aanbieding) => !filterSupermarkten || filterSupermarkten.has(normaliseerSupermarktZoeknaam(aanbieding.supermarkt)))
      .map((aanbieding) => {
        const tekst = normaliseerZoektekst(`${aanbieding.productnaam} ${aanbieding.supermarkt}`);
        const tokens = new Set(maakZoekTokens(tekst));
        const treffers = queryTokens.filter((token) => tokens.has(token) || tekst.includes(token));
        const dekking = treffers.length / queryTokens.length;
        const extraScore = normaliseerZoektekst(aanbieding.productnaam).includes(normaliseerZoektekst(zoekterm)) ? EXACTE_SUBSTRING_BONUS : 0;
        return { ...aanbieding, score: dekking + extraScore };
      })
      .filter((aanbieding) => aanbieding.score >= MINIMALE_MATCH_SCORE)
      .sort((a, b) => {
        if (a.prijs === null && b.prijs !== null) return 1;
        if (a.prijs !== null && b.prijs === null) return -1;
        const prijsVerschil = (a.prijs ?? Infinity) - (b.prijs ?? Infinity);
        if (prijsVerschil !== 0) return prijsVerschil;
        const kortingA = (a.oudePrijs || 0) - (a.prijs || 0);
        const kortingB = (b.oudePrijs || 0) - (b.prijs || 0);
        return kortingB - kortingA;
      })
      .slice(0, opties.maximum || 3);
  }

  async function laadAanbiedingenBestand(fetcher = fetch) {
    try {
      const response = await fetcher(`${AANBIEDINGEN_PAD}?t=${Date.now()}`, { cache: "reload" });
      if (!response.ok) throw new Error(`Aanbiedingenbestand gaf status ${response.status}`);
      const data = await response.json();
      return {
        aanbiedingen: Array.isArray(data.aanbiedingen) ? data.aanbiedingen.map(normaliseerAanbieding) : [],
        bijgewerktOp: data.bijgewerktOp || "",
        bron: data.bron || "https://allesupers.nl/catalog/all",
        fout: ""
      };
    } catch (fout) {
      return {
        aanbiedingen: [],
        bijgewerktOp: "",
        bron: "https://allesupers.nl/catalog/all",
        fout: fout.message || "Aanbiedingen konden niet worden geladen."
      };
    }
  }

  function maakLegeAanbiedingenData() {
    return {
      aanbiedingen: [],
      bijgewerktOp: "",
      bron: "",
      fout: ""
    };
  }

  function setTheme(theme, root = document.documentElement, storage = localStorage) {
    const gekozenThema = ["auto", "light", "dark"].includes(theme) ? theme : "auto";
    root.dataset.theme = gekozenThema;
    storage.setItem(THEME_KEY, gekozenThema);
    return gekozenThema;
  }

  function maakOptie(value, label = value) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  async function startApp() {
    const elementen = {
      formulier: document.querySelector("#toevoeg-formulier"),
      naam: document.querySelector("#naam"),
      categorie: document.querySelector("#categorie"),
      supermarkten: document.querySelector("#supermarkt-keuzes"),
      filter: document.querySelector("#supermarkt-filter"),
      supermarktFormulier: document.querySelector("#supermarkt-formulier"),
      supermarktNaam: document.querySelector("#supermarkt-naam"),
      supermarktLijst: document.querySelector("#supermarkt-lijst"),
      supermarktAantal: document.querySelector(".held__paneel strong"),
      lijst: document.querySelector("#boodschappenlijst"),
      mandje: document.querySelector("#mandje-lijst"),
      status: document.querySelector("#status"),
      allesUitvinken: document.querySelector("#alles-uitvinken"),
      routeAanpassen: document.querySelector("#route-aanpassen"),
      routeEditor: document.querySelector("#route-editor"),
      routeVolgorde: document.querySelector("#route-volgorde"),
      routeOpslaan: document.querySelector("#route-opslaan"),
      routeReset: document.querySelector("#route-reset"),
      aanbiedingenScannen: document.querySelector("#aanbiedingen-scannen"),
      thema: document.querySelector("#thema")
    };

    CATEGORIEEN.forEach((categorie) => elementen.categorie.append(maakOptie(categorie)));
    let supermarkten = laadSupermarkten(localStorage);

    const opgeslagenThema = localStorage.getItem(THEME_KEY) || "auto";
    elementen.thema.value = setTheme(opgeslagenThema);
    renderSupermarktOpties();
    renderSupermarktKeuzes();
    renderSupermarktBeheer();

    const response = await fetch("data/boodschappen.yml");
    const seedItems = parseYamlItems(await response.text());
    let verwijderdeItems = laadVerwijderdeItems(localStorage);
    let items = combineerItems(seedItems, laadOpgeslagenItems(localStorage, supermarkten), supermarkten)
      .filter((item) => !verwijderdeItems.includes(item.id));
    let route = laadRoute(localStorage);
    let routeConcept = [...route];
    let laatstAfgevinktId = null;
    let versleepteCategorie = null;
    let versleepteLijstCategorie = null;
    let touchCategorie = null;
    let touchDoelCategorie = null;
    let aanbiedingenData = await laadAanbiedingenBestand();
    let isAanbiedingenScanBezig = false;

    function status(bericht) {
      elementen.status.textContent = bericht;
    }

    async function scanAanbiedingen() {
      if (isAanbiedingenScanBezig) return;
      isAanbiedingenScanBezig = true;
      elementen.aanbiedingenScannen.disabled = true;
      aanbiedingenData = maakLegeAanbiedingenData();
      render();
      status("Bezig met scannen...");
      aanbiedingenData = await laadAanbiedingenBestand();
      isAanbiedingenScanBezig = false;
      elementen.aanbiedingenScannen.disabled = false;
      render();
      const aantal = aanbiedingenData.aanbiedingen.length;
      status(aanbiedingenData.fout ? "Aanbiedingen konden niet worden bijgewerkt; de lijst blijft bruikbaar." : `${aantal} aanbiedingen opnieuw geladen uit het statische bestand.`);
    }

    function renderSupermarktOpties() {
      const gekozenFilter = elementen.filter.value;
      elementen.filter.replaceChildren(maakOptie("alle", "Alle supermarkten"), maakOptie(GEEN_SUPERMARKT_FILTER, "Geen supermarkt"));
      supermarkten.forEach((supermarkt) => elementen.filter.append(maakOptie(supermarkt)));
      if ([...elementen.filter.options].some((option) => option.value === gekozenFilter)) {
        elementen.filter.value = gekozenFilter;
      }
    }

    function renderSupermarktKeuzes() {
      elementen.supermarkten.replaceChildren();
      if (!supermarkten.length) {
        const leeg = document.createElement("p");
        leeg.className = "leeg";
        leeg.textContent = "Geen supermarkten beschikbaar.";
        elementen.supermarkten.append(leeg);
        return;
      }
      supermarkten.forEach((supermarkt) => {
        const label = document.createElement("label");
        label.className = "chip";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = "supermarkten";
        checkbox.value = supermarkt;
        checkbox.checked = true;
        label.append(checkbox, document.createTextNode(supermarkt));
        elementen.supermarkten.append(label);
      });
    }

    function renderSupermarktBeheer() {
      elementen.supermarktLijst.replaceChildren();
      elementen.supermarktAantal.textContent = String(supermarkten.length);
      if (!supermarkten.length) {
        const leeg = document.createElement("li");
        leeg.className = "leeg";
        leeg.textContent = "Nog geen supermarkten.";
        elementen.supermarktLijst.append(leeg);
        return;
      }
      supermarkten.forEach((supermarkt) => {
        const item = document.createElement("li");
        const naam = document.createElement("span");
        naam.textContent = supermarkt;
        const knop = document.createElement("button");
        knop.type = "button";
        knop.textContent = "Verwijderen";
        knop.setAttribute("aria-label", `Verwijder supermarkt ${supermarkt}`);
        knop.addEventListener("click", () => {
          supermarkten = bewaarSupermarkten(localStorage, supermarkten.filter((markt) => markt !== supermarkt));
          items = ontkoppelSupermarkt(items, supermarkt, supermarkten);
          bewaarItems(localStorage, items, supermarkten);
          if (elementen.filter.value === supermarkt) elementen.filter.value = "alle";
          renderSupermarktOpties();
          renderSupermarktKeuzes();
          renderSupermarktBeheer();
          render();
          status(`${supermarkt} is verwijderd. Boodschappen blijven bestaan.`);
        });
        item.append(naam, knop);
        elementen.supermarktLijst.append(item);
      });
    }

    function routesZijnGelijk(eerste, tweede) {
      return eerste.length === tweede.length && eerste.every((categorie, index) => categorie === tweede[index]);
    }

    function verplaatsCategorie(vanIndex, naarIndex) {
      const categorie = routeConcept[vanIndex];
      const nieuweRoute = verplaatsInRoute(routeConcept, vanIndex, naarIndex);
      if (!categorie || routesZijnGelijk(nieuweRoute, routeConcept)) return;
      routeConcept = nieuweRoute;
      renderRouteEditor();
      [...elementen.routeVolgorde.children]
        .find((item) => item.dataset.categorie === categorie)
        ?.focus();
    }

    function bewaarNieuweRoute(nieuweRoute, bericht) {
      route = bewaarRoute(localStorage, nieuweRoute);
      routeConcept = [...route];
      items = [...items].sort(maakRouteSorteerder(route));
      render();
      if (!elementen.routeEditor.hidden) renderRouteEditor();
      status(bericht);
    }

    function verplaatsZichtbareCategorie(bronCategorie, doelCategorie) {
      const vanIndex = route.indexOf(bronCategorie);
      const naarIndex = route.indexOf(doelCategorie);
      const nieuweRoute = verplaatsInRoute(route, vanIndex, naarIndex);
      if (!bronCategorie || !doelCategorie || routesZijnGelijk(nieuweRoute, route)) return;
      bewaarNieuweRoute(nieuweRoute, `${bronCategorie} is verplaatst.`);
    }

    function schoonLijstVerslepenOp() {
      document.querySelectorAll(".categorie.is-versleept, .categorie.is-dropdoel").forEach((element) => {
        element.classList.remove("is-versleept", "is-dropdoel");
      });
      versleepteLijstCategorie = null;
      touchCategorie = null;
      touchDoelCategorie = null;
    }

    function markeerTouchDoel(event) {
      const doel = document.elementFromPoint(event.clientX, event.clientY)?.closest(".categorie[data-categorie]");
      const doelCategorie = doel && doel.dataset.categorie !== touchCategorie ? doel.dataset.categorie : null;
      if (doelCategorie === touchDoelCategorie) return;
      document.querySelector(".categorie.is-dropdoel")?.classList.remove("is-dropdoel");
      touchDoelCategorie = doelCategorie;
      if (doelCategorie) {
        doel.classList.add("is-dropdoel");
      }
    }

    function magCategorieblokSlepenVanaf(target) {
      return !target.closest(NIET_SLEEPBARE_CATEGORIE_ELEMENTEN);
    }

    function renderRouteEditor() {
      elementen.routeVolgorde.replaceChildren();
      routeConcept.forEach((categorie, index) => {
        const item = document.createElement("li");
        item.className = "route-volgorde__item";
        item.draggable = true;
        item.tabIndex = 0;
        item.dataset.categorie = categorie;
        item.setAttribute("aria-label", `${categorie}. Gebruik de knoppen omhoog en omlaag om deze categorie te verplaatsen.`);
        item.setAttribute("aria-roledescription", "Versleepbare categorie");

        const greep = document.createElement("span");
        greep.className = "route-volgorde__greep";
        greep.textContent = "↕";
        greep.setAttribute("aria-hidden", "true");

        const naam = document.createElement("span");
        naam.textContent = categorie;

        const acties = document.createElement("span");
        acties.className = "route-volgorde__knoppen";
        const omhoog = document.createElement("button");
        omhoog.type = "button";
        omhoog.textContent = "Omhoog";
        omhoog.disabled = index === 0;
        omhoog.setAttribute("aria-label", `Verplaats ${categorie} omhoog`);
        omhoog.addEventListener("click", () => verplaatsCategorie(index, index - 1));
        const omlaag = document.createElement("button");
        omlaag.type = "button";
        omlaag.textContent = "Omlaag";
        omlaag.disabled = index === routeConcept.length - 1;
        omlaag.setAttribute("aria-label", `Verplaats ${categorie} omlaag`);
        omlaag.addEventListener("click", () => verplaatsCategorie(index, index + 1));
        acties.append(omhoog, omlaag);

        item.addEventListener("dragstart", (event) => {
          versleepteCategorie = categorie;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", categorie);
          item.classList.add("is-versleept");
        });
        item.addEventListener("dragend", () => {
          versleepteCategorie = null;
          item.classList.remove("is-versleept");
        });
        item.addEventListener("dragover", (event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        });
        item.addEventListener("drop", (event) => {
          event.preventDefault();
          const bron = versleepteCategorie || event.dataTransfer.getData("text/plain");
          verplaatsCategorie(routeConcept.indexOf(bron), routeConcept.indexOf(categorie));
        });
        item.addEventListener("keydown", (event) => {
          if (event.key === "ArrowUp") {
            event.preventDefault();
            verplaatsCategorie(index, index - 1);
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            verplaatsCategorie(index, index + 1);
          }
        });

        item.append(greep, naam, acties);
        elementen.routeVolgorde.append(item);
      });
    }

    function render() {
      elementen.lijst.replaceChildren();
      elementen.mandje.replaceChildren();
      const filter = elementen.filter.value;
      const groepen = groepeerVoorRoute(items, filter, route);
      const categorieNamen = Object.keys(groepen);
      const aanbiedingenCache = new Map();

      if (!categorieNamen.length) {
        const leeg = document.createElement("p");
        leeg.className = "leeg";
        leeg.textContent = "Geen boodschappen voor deze supermarkt.";
        elementen.lijst.append(leeg);
      }

      categorieNamen.forEach((categorie) => {
        const section = document.createElement("section");
        section.className = "categorie";
        section.draggable = true;
        section.dataset.categorie = categorie;
        const kop = document.createElement("div");
        kop.className = "categorie__kop";
        const heading = document.createElement("h3");
        heading.textContent = categorie;
        const greep = document.createElement("button");
        greep.type = "button";
        greep.className = "categorie__greep";
        greep.draggable = true;
        greep.setAttribute("aria-label", `Versleep ${categorie}`);
        greep.title = "Categorie verslepen";
        const greepIcoon = document.createElement("span");
        greepIcoon.textContent = "↕";
        greepIcoon.setAttribute("aria-hidden", "true");
        greep.append(greepIcoon);
        const list = document.createElement("ul");

        section.addEventListener("dragstart", (event) => {
          if (!magCategorieblokSlepenVanaf(event.target)) {
            event.preventDefault();
            return;
          }
          versleepteLijstCategorie = categorie;
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", categorie);
          }
          section.classList.add("is-versleept");
        });
        section.addEventListener("dragend", () => {
          section.draggable = true;
          schoonLijstVerslepenOp();
        });
        section.addEventListener("pointerdown", (event) => {
          const magSlepen = magCategorieblokSlepenVanaf(event.target);
          if (event.pointerType === "mouse") {
            section.draggable = magSlepen;
            return;
          }
          if (!magSlepen) return;
          event.preventDefault();
          touchCategorie = categorie;
          section.classList.add("is-versleept");
          try {
            section.setPointerCapture?.(event.pointerId);
          } catch (fout) {
            schoonLijstVerslepenOp();
            console.warn("Kon aanwijzer niet vastleggen voor slepen.", fout);
          }
        });
        section.addEventListener("pointermove", (event) => {
          if (touchCategorie !== categorie) return;
          event.preventDefault();
          markeerTouchDoel(event);
        });
        section.addEventListener("pointerup", (event) => {
          section.draggable = true;
          if (touchCategorie !== categorie) return;
          event.preventDefault();
          const doelCategorie = touchDoelCategorie;
          schoonLijstVerslepenOp();
          if (doelCategorie) verplaatsZichtbareCategorie(categorie, doelCategorie);
        });
        section.addEventListener("pointercancel", () => {
          section.draggable = true;
          schoonLijstVerslepenOp();
        });
        greep.addEventListener("keydown", (event) => {
          const huidigeIndex = categorieNamen.indexOf(categorie);
          if (event.key === "ArrowUp") {
            event.preventDefault();
            const vorigeCategorie = categorieNamen[huidigeIndex - 1];
            if (vorigeCategorie) verplaatsZichtbareCategorie(categorie, vorigeCategorie);
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            const volgendeCategorie = categorieNamen[huidigeIndex + 1];
            if (volgendeCategorie) verplaatsZichtbareCategorie(categorie, volgendeCategorie);
          }
        });

        section.addEventListener("dragover", (event) => {
          if (!versleepteLijstCategorie || versleepteLijstCategorie === categorie) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
          document.querySelector(".categorie.is-dropdoel")?.classList.remove("is-dropdoel");
          section.classList.add("is-dropdoel");
        });
        section.addEventListener("drop", (event) => {
          event.preventDefault();
          const bron = versleepteLijstCategorie || event.dataTransfer?.getData("text/plain");
          schoonLijstVerslepenOp();
          verplaatsZichtbareCategorie(bron, categorie);
        });

        groepen[categorie].forEach((item) => {
          const row = document.createElement("li");
          row.className = `boodschap${item.afgevinkt ? " is-afgevinkt" : ""}${item.id === laatstAfgevinktId ? " naar-mandje" : ""}`;
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = item.afgevinkt;
          checkbox.id = `item-${item.id}`;
          checkbox.addEventListener("change", () => {
            item.afgevinkt = checkbox.checked;
            laatstAfgevinktId = checkbox.checked ? item.id : null;
            bewaarItems(localStorage, items, supermarkten);
            render();
            status(checkbox.checked ? `${item.naam} gaat naar het winkelmandje.` : `${item.naam} staat weer op de lijst.`);
            const animatieId = laatstAfgevinktId;
            window.setTimeout(() => {
              if (laatstAfgevinktId === animatieId) laatstAfgevinktId = null;
              document.getElementById(`item-${animatieId}`)?.closest(".boodschap")?.classList.remove("naar-mandje");
            }, ANIMATION_DURATION_MS);
          });

          const tekst = document.createElement("label");
          tekst.htmlFor = checkbox.id;
          const naam = document.createElement("span");
          naam.className = "boodschap__naam";
          naam.textContent = item.naam;
          const meta = document.createElement("span");
          meta.className = "boodschap__meta";
          meta.textContent = formatteerSupermarkten(item);
          tekst.append(naam, meta);
          const cacheKey = [item.naam, ...item.supermarkten].join(CACHE_SCHEIDINGSTEKEN);
          if (!aanbiedingenCache.has(cacheKey)) {
            aanbiedingenCache.set(cacheKey, matchAanbiedingen(item.naam, aanbiedingenData.aanbiedingen, { supermarkten: item.supermarkten, maximum: 3 }));
          }
          const itemAanbiedingen = aanbiedingenCache.get(cacheKey);
          const aanbiedingenBlok = document.createElement("div");
          aanbiedingenBlok.className = `aanbiedingen${itemAanbiedingen.length ? "" : " aanbiedingen--leeg"}`;
          const aanbiedingenTitel = document.createElement("strong");
          aanbiedingenTitel.textContent = formatteerAanbiedingenTitel(itemAanbiedingen.length, isAanbiedingenScanBezig);
          aanbiedingenBlok.append(aanbiedingenTitel);
          if (!isAanbiedingenScanBezig && itemAanbiedingen.length) {
            const lijst = document.createElement("ul");
            itemAanbiedingen.forEach((aanbieding, index) => {
              const aanbiedingItem = document.createElement("li");
              const badge = document.createElement("span");
              badge.className = "aanbiedingen__badge";
              badge.textContent = formatteerAanbiedingBadge(aanbieding, index);
              const prijs = document.createElement("span");
              prijs.className = "aanbiedingen__prijs";
              prijs.textContent = aanbieding.prijsTekst || "Prijs onbekend";
              const detail = document.createElement("span");
              detail.textContent = [
                aanbieding.productnaam,
                aanbieding.oudePrijsTekst || (aanbieding.oudePrijs ? `was ${EURO_FORMATTER.format(aanbieding.oudePrijs)}` : ""),
                aanbieding.korting,
                aanbieding.eenheidsprijs,
                aanbieding.bijgewerktOp ? `update ${formatteerDatumTijd(aanbieding.bijgewerktOp)}` : ""
              ].filter(Boolean).join(" · ");
              if (aanbieding.url) {
                const link = document.createElement("a");
                link.href = aanbieding.url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = "Bron";
                aanbiedingItem.append(badge, prijs, detail, link);
              } else {
                aanbiedingItem.append(badge, prijs, detail);
              }
              lijst.append(aanbiedingItem);
            });
            aanbiedingenBlok.append(lijst);
          }
          const verwijderKnop = document.createElement("button");
          verwijderKnop.type = "button";
          verwijderKnop.className = "boodschap__verwijderen";
          verwijderKnop.textContent = "Verwijderen";
          verwijderKnop.setAttribute("aria-label", `Verwijder ${item.naam}`);
          verwijderKnop.addEventListener("click", () => {
            items = verwijderItem(items, item.id);
            verwijderdeItems = [...new Set([...verwijderdeItems, item.id])];
            bewaarItems(localStorage, items, supermarkten);
            bewaarVerwijderdeItems(localStorage, verwijderdeItems);
            if (laatstAfgevinktId === item.id) laatstAfgevinktId = null;
            render();
            status(`${item.naam} is verwijderd.`);
          });
          row.append(checkbox, tekst, verwijderKnop, aanbiedingenBlok);
          list.append(row);
        });

        kop.append(heading, greep);
        section.append(kop, list);
        elementen.lijst.append(section);
      });

      const afgevinkt = items.filter((item) => item.afgevinkt).sort(maakRouteSorteerder(route));
      if (!afgevinkt.length) {
        const leeg = document.createElement("li");
        leeg.className = "leeg";
        leeg.textContent = "Nog niets afgevinkt.";
        elementen.mandje.append(leeg);
      } else {
        afgevinkt.forEach((item) => {
          const li = document.createElement("li");
          li.textContent = `${item.naam} · ${item.categorie}`;
          elementen.mandje.append(li);
        });
      }
    }

    elementen.formulier.addEventListener("submit", (event) => {
      event.preventDefault();
      const gekozenSupermarkten = [...elementen.formulier.querySelectorAll('input[name="supermarkten"]:checked')].map((input) => input.value);
      const item = nieuwEigenItem({
        naam: elementen.naam.value,
        categorie: elementen.categorie.value,
        supermarkten: gekozenSupermarkten
      }, supermarkten);
      if (!item.naam) return;
      verwijderdeItems = verwijderdeItems.filter((id) => id !== item.id);
      items = combineerItems(items, [item], supermarkten);
      bewaarItems(localStorage, items, supermarkten);
      bewaarVerwijderdeItems(localStorage, verwijderdeItems);
      elementen.formulier.reset();
      elementen.formulier.querySelectorAll('input[name="supermarkten"]').forEach((input) => { input.checked = true; });
      render();
      status(`${item.naam} is toegevoegd.`);
    });

    elementen.supermarktFormulier.addEventListener("submit", (event) => {
      event.preventDefault();
      const naam = elementen.supermarktNaam.value.trim();
      if (!naam) return;
      if (supermarkten.some((supermarkt) => supermarkt.toLocaleLowerCase("nl") === naam.toLocaleLowerCase("nl"))) {
        status(`${naam} bestaat al.`);
        return;
      }
      supermarkten = bewaarSupermarkten(localStorage, [...supermarkten, naam]);
      elementen.supermarktFormulier.reset();
      renderSupermarktOpties();
      renderSupermarktKeuzes();
      renderSupermarktBeheer();
      render();
      status(`${naam} is toegevoegd.`);
    });

    elementen.filter.addEventListener("change", render);
    elementen.aanbiedingenScannen.addEventListener("click", scanAanbiedingen);
    elementen.thema.addEventListener("change", () => setTheme(elementen.thema.value));
    elementen.routeAanpassen.addEventListener("click", () => {
      const wordtZichtbaar = elementen.routeEditor.hidden;
      elementen.routeEditor.hidden = !wordtZichtbaar;
      elementen.routeAanpassen.setAttribute("aria-expanded", String(wordtZichtbaar));
      if (wordtZichtbaar) {
        routeConcept = [...route];
        renderRouteEditor();
      }
    });
    elementen.routeOpslaan.addEventListener("click", () => {
      route = bewaarRoute(localStorage, routeConcept);
      items = [...items].sort(maakRouteSorteerder(route));
      render();
      renderRouteEditor();
      status("Supermarkt-route opgeslagen.");
    });
    elementen.routeReset.addEventListener("click", () => {
      route = bewaarRoute(localStorage, CATEGORIEEN);
      routeConcept = [...route];
      items = [...items].sort(maakRouteSorteerder(route));
      render();
      renderRouteEditor();
      status("Supermarkt-route teruggezet.");
    });
    elementen.allesUitvinken.addEventListener("click", () => {
      items = items.map((item) => ({ ...item, afgevinkt: false }));
      bewaarItems(localStorage, items, supermarkten);
      render();
      status("Alle boodschappen zijn weer uitgevinkt.");
    });

    renderSupermarktOpties();
    renderSupermarktKeuzes();
    renderSupermarktBeheer();
    renderRouteEditor();
    render();
    registreerServiceWorker();
    if (aanbiedingenData.fout) status("Aanbiedingen zijn tijdelijk niet beschikbaar.");
  }

  function registreerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    let herladen = false;
    navigator.serviceWorker.register("service-worker.js");
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (herladen) return;
      herladen = true;
      window.location.reload();
    });
  }

  return {
    SUPERMARKTEN,
    GEEN_SUPERMARKT_FILTER,
    CATEGORIEEN,
    parseYamlItems,
    normaliseerSupermarkten,
    laadSupermarkten,
    bewaarSupermarkten,
    normaliseerItem,
    normaliseerRoute,
    laadRoute,
    bewaarRoute,
    verplaatsInRoute,
    combineerItems,
    groepeerVoorRoute,
    nieuwEigenItem,
    verwijderItem,
    ontkoppelSupermarkt,
    formatteerSupermarkten,
    normaliseerZoektekst,
    maakZoekTokens,
    normaliseerAanbieding,
    formatteerAanbiedingenTitel,
    matchAanbiedingen,
    laadAanbiedingenBestand,
    maakLegeAanbiedingenData,
    setTheme,
    startApp
  };
})();

if (typeof module !== "undefined") {
  module.exports = BoodschappenBaas;
}

if (typeof window !== "undefined") {
  window.BoodschappenBaas = BoodschappenBaas;
  window.addEventListener("DOMContentLoaded", () => BoodschappenBaas.startApp());
}
