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
  const ROUTE_KEY = "boodschappenbaas-route-v1";
  const THEME_KEY = "boodschappenbaas-theme";
  const ANIMATION_DURATION_MS = 700;

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

  function normaliseerItem(item) {
    const naam = (item.naam || "").trim();
    const categorie = CATEGORIEEN.includes(item.categorie) ? item.categorie : "Voorraadkast";
    const supermarkten = Array.isArray(item.supermarkten)
      ? item.supermarkten.filter((markt) => SUPERMARKTEN.includes(markt))
      : SUPERMARKTEN;

    return {
      id: item.id || slugify(`${naam}-${categorie}`),
      naam,
      categorie,
      supermarkten: supermarkten.length ? supermarkten : SUPERMARKTEN,
      afgevinkt: Boolean(item.afgevinkt),
      eigenItem: Boolean(item.eigenItem)
    };
  }

  function laadOpgeslagenItems(storage) {
    try {
      return JSON.parse(storage.getItem(STORAGE_KEY) || "[]").map(normaliseerItem);
    } catch {
      return [];
    }
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

  function combineerItems(seedItems, opgeslagenItems) {
    const perId = new Map();
    seedItems.map(normaliseerItem).forEach((item) => perId.set(item.id, item));
    opgeslagenItems.map(normaliseerItem).forEach((item) => {
      perId.set(item.id, { ...(perId.get(item.id) || {}), ...item });
    });
    return [...perId.values()].sort(sorteerMetRoute());
  }

  function sorteerMetRoute(route = CATEGORIEEN) {
    const routeVolgorde = normaliseerRoute(route);
    return (a, b) => {
      const categorieVerschil = routeVolgorde.indexOf(a.categorie) - routeVolgorde.indexOf(b.categorie);
      if (categorieVerschil !== 0) return categorieVerschil;
      return a.naam.localeCompare(b.naam, "nl", { sensitivity: "base" });
    };
  }

  function sorteerVoorRoute(a, b, route = CATEGORIEEN) {
    return sorteerMetRoute(route)(a, b);
  }

  function groepeerVoorRoute(items, supermarkt = "alle", route = CATEGORIEEN) {
    return [...items]
      .filter((item) => supermarkt === "alle" || item.supermarkten.includes(supermarkt))
      .sort(sorteerMetRoute(route))
      .reduce((groepen, item) => {
        if (!groepen[item.categorie]) groepen[item.categorie] = [];
        groepen[item.categorie].push(item);
        return groepen;
      }, {});
  }

  function nieuwEigenItem({ naam, categorie, supermarkten }) {
    return normaliseerItem({
      id: `eigen-${slugify(naam)}-${Date.now()}`,
      naam,
      categorie,
      supermarkten,
      eigenItem: true
    });
  }

  function bewaarItems(storage, items) {
    storage.setItem(STORAGE_KEY, JSON.stringify(items.map(normaliseerItem)));
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
      lijst: document.querySelector("#boodschappenlijst"),
      mandje: document.querySelector("#mandje-lijst"),
      status: document.querySelector("#status"),
      allesUitvinken: document.querySelector("#alles-uitvinken"),
      routeAanpassen: document.querySelector("#route-aanpassen"),
      routeEditor: document.querySelector("#route-editor"),
      routeVolgorde: document.querySelector("#route-volgorde"),
      routeOpslaan: document.querySelector("#route-opslaan"),
      routeReset: document.querySelector("#route-reset"),
      thema: document.querySelector("#thema")
    };

    CATEGORIEEN.forEach((categorie) => elementen.categorie.append(maakOptie(categorie)));
    elementen.filter.append(maakOptie("alle", "Alle supermarkten"));
    SUPERMARKTEN.forEach((supermarkt) => elementen.filter.append(maakOptie(supermarkt)));
    SUPERMARKTEN.forEach((supermarkt) => {
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

    const opgeslagenThema = localStorage.getItem(THEME_KEY) || "auto";
    elementen.thema.value = setTheme(opgeslagenThema);

    const response = await fetch("data/boodschappen.yml");
    const seedItems = parseYamlItems(await response.text());
    let items = combineerItems(seedItems, laadOpgeslagenItems(localStorage));
    let route = laadRoute(localStorage);
    let routeConcept = [...route];
    let laatstAfgevinktId = null;
    let versleepteCategorie = null;

    function status(bericht) {
      elementen.status.textContent = bericht;
    }

    function verplaatsCategorie(van, naar) {
      if (van === naar || naar < 0 || naar >= routeConcept.length) return;
      const [categorie] = routeConcept.splice(van, 1);
      routeConcept.splice(naar, 0, categorie);
      renderRouteEditor();
      [...elementen.routeVolgorde.children]
        .find((item) => item.dataset.categorie === categorie)
        ?.focus();
    }

    function renderRouteEditor() {
      elementen.routeVolgorde.replaceChildren();
      routeConcept.forEach((categorie, index) => {
        const item = document.createElement("li");
        item.className = "route-volgorde__item";
        item.draggable = true;
        item.tabIndex = 0;
        item.dataset.categorie = categorie;
        item.setAttribute("aria-label", `${categorie}. versleep of gebruik de knoppen om deze categorie te verplaatsen.`);
        item.setAttribute("aria-roledescription", "versleepbare categorie");

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

      if (!categorieNamen.length) {
        const leeg = document.createElement("p");
        leeg.className = "leeg";
        leeg.textContent = "Geen boodschappen voor deze supermarkt.";
        elementen.lijst.append(leeg);
      }

      categorieNamen.forEach((categorie) => {
        const section = document.createElement("section");
        section.className = "categorie";
        const heading = document.createElement("h3");
        heading.textContent = categorie;
        const list = document.createElement("ul");

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
            bewaarItems(localStorage, items);
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
          meta.textContent = item.supermarkten.join(", ");
          tekst.append(naam, meta);
          row.append(checkbox, tekst);
          list.append(row);
        });

        section.append(heading, list);
        elementen.lijst.append(section);
      });

      const afgevinkt = items.filter((item) => item.afgevinkt).sort(sorteerMetRoute(route));
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
      });
      if (!item.naam) return;
      items = combineerItems(items, [item]);
      bewaarItems(localStorage, items);
      elementen.formulier.reset();
      elementen.formulier.querySelectorAll('input[name="supermarkten"]').forEach((input) => { input.checked = true; });
      render();
      status(`${item.naam} is toegevoegd.`);
    });

    elementen.filter.addEventListener("change", render);
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
      items = [...items].sort(sorteerMetRoute(route));
      render();
      renderRouteEditor();
      status("Supermarkt-route opgeslagen.");
    });
    elementen.routeReset.addEventListener("click", () => {
      route = bewaarRoute(localStorage, CATEGORIEEN);
      routeConcept = [...route];
      items = [...items].sort(sorteerMetRoute(route));
      render();
      renderRouteEditor();
      status("Supermarkt-route teruggezet.");
    });
    elementen.allesUitvinken.addEventListener("click", () => {
      items = items.map((item) => ({ ...item, afgevinkt: false }));
      bewaarItems(localStorage, items);
      render();
      status("Alle boodschappen zijn weer uitgevinkt.");
    });

    renderRouteEditor();
    render();
    registreerServiceWorker();
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
    CATEGORIEEN,
    parseYamlItems,
    normaliseerItem,
    normaliseerRoute,
    laadRoute,
    bewaarRoute,
    combineerItems,
    groepeerVoorRoute,
    nieuwEigenItem,
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
