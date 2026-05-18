/**
 * BoodschappenBaas – Hoofd applicatielogica
 * Grocery list app met supermarkt-filter, categorie-groepering en winkelmandje.
 */

import { parseYAML } from './yaml-parser.js';
import {
  getChecked,
  addChecked,
  removeChecked,
  clearChecked,
  getUserItems,
  addUserItem,
  getTheme,
  saveTheme,
  getActiveMarkt,
  saveActiveMarkt,
} from './store.js';

// ─── State ────────────────────────────────────────────────────────────────────

let state = {
  supermarkten: [],
  categorieen: [],
  items: [],        // basis items (YAML)
  userItems: [],    // gebruiker-toegevoegde items
  checked: [],      // IDs van afgevinkte items
  activeMarkt: 'alle',
};

// ─── Bootstrap ────────────────────────────────────────────────────────────────

export async function init() {
  applyTheme(getTheme());

  try {
    const response = await fetch('data/items.yaml');
    const text = await response.text();
    const data = parseYAML(text);
    state.supermarkten = data.supermarkten || [];
    state.categorieen = data.categorieen || [];
    state.items = data.items || [];
  } catch (err) {
    console.warn('Kon data/items.yaml niet laden, gebruik ingebouwde fallback.', err);
    state.supermarkten = FALLBACK.supermarkten;
    state.categorieen = FALLBACK.categorieen;
    state.items = FALLBACK.items;
  }

  state.userItems = getUserItems();
  state.checked = getChecked();
  state.activeMarkt = getActiveMarkt();

  render();
  bindGlobalEvents();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
  renderSupermarktFilter();
  renderLijst();
  renderMandje();
  updateMandjeCount();
}

function renderSupermarktFilter() {
  const container = document.getElementById('supermarkt-filter');
  if (!container) return;

  const markten = [{ id: 'alle', naam: 'Alle' }, ...state.supermarkten];
  container.innerHTML = markten
    .map(
      (m) => `<button
        class="markt-pill${state.activeMarkt === m.id ? ' active' : ''}"
        data-markt="${m.id}"
        aria-pressed="${state.activeMarkt === m.id}"
        aria-label="Filter op ${m.naam}"
      >${m.naam}</button>`
    )
    .join('');
}

function allItems() {
  return [...state.items, ...state.userItems];
}

function visibleUncheckedItems() {
  return allItems().filter((item) => {
    if (state.checked.includes(item.id)) return false;
    if (state.activeMarkt !== 'alle') {
      if (!item.supermarkten || !item.supermarkten.includes(state.activeMarkt)) return false;
    }
    return true;
  });
}

function renderLijst() {
  const container = document.getElementById('boodschappenlijst');
  if (!container) return;

  const items = visibleUncheckedItems();

  if (items.length === 0) {
    container.innerHTML = `<p class="leeg-melding" role="status">
      ${state.activeMarkt !== 'alle' ? 'Geen items voor deze supermarkt.' : 'Alle boodschappen zijn gedaan! 🎉'}
    </p>`;
    return;
  }

  // Groepeer per categorie
  const byCategorie = {};
  for (const item of items) {
    const cat = item.categorie || 'overig';
    if (!byCategorie[cat]) byCategorie[cat] = [];
    byCategorie[cat].push(item);
  }

  // Sorteer categorieën op volgorde uit de data
  const catOrder = state.categorieen.map((c) => c.id);
  const catIndex = (id) => { const i = catOrder.indexOf(id); return i === -1 ? 99 : i; };
  const sortedCats = Object.keys(byCategorie).sort((a, b) => catIndex(a) - catIndex(b));

  container.innerHTML = sortedCats
    .map((catId) => {
      const catMeta = state.categorieen.find((c) => c.id === catId) || {
        id: catId,
        naam: catId,
        emoji: '🛒',
        kleur: '#B2BEC3',
      };
      const itemsHtml = byCategorie[catId]
        .map((item) => renderItemHtml(item, catMeta))
        .join('');
      return `<section class="categorie-groep" aria-label="${catMeta.naam}">
        <h2 class="categorie-titel" style="--cat-kleur:${catMeta.kleur}">
          <span class="categorie-emoji" aria-hidden="true">${catMeta.emoji}</span>
          ${catMeta.naam}
        </h2>
        <ul class="item-lijst" role="list">${itemsHtml}</ul>
      </section>`;
    })
    .join('');
}

function renderItemHtml(item, catMeta) {
  const catKleur = catMeta ? catMeta.kleur : '#B2BEC3';
  const marktBadges = (item.supermarkten || [])
    .map((mid) => {
      const m = state.supermarkten.find((s) => s.id === mid);
      return m
        ? `<span class="markt-badge" style="--markt-kleur:${m.kleur}" title="${m.naam}">${m.naam}</span>`
        : '';
    })
    .join('');

  return `<li class="item-kaart" id="item-${item.id}" data-item-id="${item.id}" role="listitem">
    <label class="item-label" for="check-${item.id}">
      <input
        type="checkbox"
        id="check-${item.id}"
        class="item-checkbox"
        data-item-id="${item.id}"
        aria-label="${item.naam} toevoegen aan mandje"
      />
      <span class="checkmark" aria-hidden="true"></span>
      <span class="item-naam">${item.naam}</span>
    </label>
    <div class="item-meta">
      <span class="cat-badge" style="--cat-kleur:${catKleur}">${catMeta ? catMeta.emoji : ''}</span>
      <div class="markt-badges">${marktBadges}</div>
    </div>
  </li>`;
}

function renderMandje() {
  const container = document.getElementById('mandje-lijst');
  if (!container) return;

  const checkedItems = allItems().filter((item) => state.checked.includes(item.id));

  if (checkedItems.length === 0) {
    container.innerHTML = `<p class="leeg-melding" role="status">Je mandje is leeg.</p>`;
    return;
  }

  container.innerHTML = checkedItems
    .map((item) => {
      const catMeta = state.categorieen.find((c) => c.id === item.categorie) || {
        emoji: '🛒',
        kleur: '#B2BEC3',
      };
      return `<li class="mandje-item" id="mandje-${item.id}" role="listitem">
        <span class="mandje-emoji" aria-hidden="true">${catMeta.emoji}</span>
        <span class="mandje-naam">${item.naam}</span>
        <button
          class="uncheck-btn"
          data-item-id="${item.id}"
          aria-label="${item.naam} terugplaatsen op lijst"
          title="Terugplaatsen"
        >✕</button>
      </li>`;
    })
    .join('');
}

function updateMandjeCount() {
  const badge = document.getElementById('mandje-badge');
  if (badge) {
    badge.textContent = state.checked.length;
    badge.hidden = state.checked.length === 0;
  }
  // Update heading count
  const count = document.getElementById('mandje-count');
  if (count) count.textContent = state.checked.length;
}

// ─── Acties ───────────────────────────────────────────────────────────────────

function checkItem(id) {
  if (state.checked.includes(id)) return;

  const itemEl = document.getElementById(`item-${id}`);
  const cartBtn = document.getElementById('mandje-toggle');

  // Vlieg-animatie naar mandje
  if (itemEl && cartBtn) {
    animeerNaarMandje(itemEl, cartBtn);
  }

  state.checked = [...state.checked, id];
  addChecked(id);

  // Wacht tot animatie klaar is, render dan opnieuw
  setTimeout(() => {
    renderLijst();
    renderMandje();
    updateMandjeCount();
  }, 550);
}

function uncheckItem(id) {
  state.checked = state.checked.filter((c) => c !== id);
  removeChecked(id);
  renderLijst();
  renderMandje();
  updateMandjeCount();
}

function uncheckAll() {
  state.checked = [];
  clearChecked();
  renderLijst();
  renderMandje();
  updateMandjeCount();
}

function setActiveMarkt(marktId) {
  state.activeMarkt = marktId;
  saveActiveMarkt(marktId);
  renderSupermarktFilter();
  renderLijst();
}

function voegItemToe(naam, categorieId, supermarktenIds) {
  const id = `user-${Date.now()}-${naam.toLowerCase().replace(/\s+/g, '-')}`;
  const item = {
    id,
    naam,
    categorie: categorieId,
    supermarkten: supermarktenIds,
  };
  state.userItems.push(item);
  addUserItem(item);
  renderLijst();
  renderMandje();
}

// ─── Animatie ─────────────────────────────────────────────────────────────────

function animeerNaarMandje(itemEl, targetEl) {
  const itemRect = itemEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();

  const clone = itemEl.cloneNode(true);
  clone.style.cssText = `
    position: fixed;
    left: ${itemRect.left}px;
    top: ${itemRect.top}px;
    width: ${itemRect.width}px;
    height: ${itemRect.height}px;
    margin: 0;
    padding: ${getComputedStyle(itemEl).padding};
    border-radius: ${getComputedStyle(itemEl).borderRadius};
    background: ${getComputedStyle(itemEl).background};
    z-index: 9999;
    pointer-events: none;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 24px rgba(0,0,0,0.18);
  `;
  document.body.appendChild(clone);

  // Trigger reflow
  clone.getBoundingClientRect();

  const targetX = targetRect.left + targetRect.width / 2 - itemRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2 - itemRect.height / 2;

  clone.style.left = `${targetX}px`;
  clone.style.top = `${targetY}px`;
  clone.style.transform = 'scale(0.2)';
  clone.style.opacity = '0';

  setTimeout(() => clone.remove(), 550);

  // Bounce-effect op mandje icoon
  targetEl.classList.add('mandje-bounce');
  setTimeout(() => targetEl.classList.remove('mandje-bounce'), 600);
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindGlobalEvents() {
  // Supermarkt filter pills
  document.getElementById('supermarkt-filter')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.markt-pill');
    if (btn) setActiveMarkt(btn.dataset.markt);
  });

  // Check item
  document.getElementById('boodschappenlijst')?.addEventListener('change', (e) => {
    if (e.target.classList.contains('item-checkbox')) {
      checkItem(e.target.dataset.itemId);
    }
  });

  // Uncheck from mandje
  document.getElementById('mandje-lijst')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.uncheck-btn');
    if (btn) uncheckItem(btn.dataset.itemId);
  });

  // Alles uitvinken button
  document.getElementById('alles-uitvinken')?.addEventListener('click', uncheckAll);

  // Mandje toggle (open/close panel)
  document.getElementById('mandje-toggle')?.addEventListener('click', toggleMandjePanel);

  // Mandje sluiten
  document.getElementById('mandje-sluiten')?.addEventListener('click', () =>
    setMandjeOpen(false)
  );

  // Mandje overlay klik
  document.getElementById('mandje-overlay')?.addEventListener('click', () =>
    setMandjeOpen(false)
  );

  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', cycleTheme);

  // Item toevoegen (FAB)
  document.getElementById('toevoegen-fab')?.addEventListener('click', () =>
    setFormOpen(true)
  );

  // Formulier sluiten
  document.getElementById('form-sluiten')?.addEventListener('click', () =>
    setFormOpen(false)
  );
  document.getElementById('form-overlay')?.addEventListener('click', () =>
    setFormOpen(false)
  );

  // Formulier submit
  document.getElementById('item-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleFormSubmit(e.target);
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setMandjeOpen(false);
      setFormOpen(false);
    }
  });

  // Categorie selectie in formulier – update supermarkt opties
  document.getElementById('form-categorie')?.addEventListener('change', () => {
    // categorie change hoeft niets te doen (alle supermarkten zijn altijd beschikbaar)
  });

  // Vul formulier opties
  populeerFormulier();
}

function populeerFormulier() {
  const catSel = document.getElementById('form-categorie');
  const marktContainer = document.getElementById('form-supermarkten');

  if (catSel) {
    catSel.innerHTML = state.categorieen
      .map((c) => `<option value="${c.id}">${c.emoji} ${c.naam}</option>`)
      .join('');
  }

  if (marktContainer) {
    marktContainer.innerHTML = state.supermarkten
      .map(
        (m) => `<label class="markt-checkbox-label">
          <input type="checkbox" name="supermarkt" value="${m.id}" checked />
          <span>${m.naam}</span>
        </label>`
      )
      .join('');
  }
}

function handleFormSubmit(form) {
  const naam = form.querySelector('#form-naam')?.value?.trim();
  if (!naam) return;

  const categorie = form.querySelector('#form-categorie')?.value || 'overig';
  const supermarkten = [...form.querySelectorAll('input[name="supermarkt"]:checked')].map(
    (cb) => cb.value
  );

  if (supermarkten.length === 0) {
    showFormError('Selecteer minimaal één supermarkt.');
    return;
  }

  voegItemToe(naam, categorie, supermarkten);
  form.reset();
  setFormOpen(false);
  showToast(`"${naam}" toegevoegd aan je lijst!`);
}

function showFormError(msg) {
  const err = document.getElementById('form-error');
  if (err) {
    err.textContent = msg;
    err.hidden = false;
    setTimeout(() => {
      err.hidden = true;
    }, 3000);
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function toggleMandjePanel() {
  const panel = document.getElementById('mandje-panel');
  setMandjeOpen(!panel?.classList.contains('open'));
}

function setMandjeOpen(open) {
  const panel = document.getElementById('mandje-panel');
  const overlay = document.getElementById('mandje-overlay');
  panel?.classList.toggle('open', open);
  overlay?.classList.toggle('visible', open);
  document.body.classList.toggle('panel-open', open);
  if (open) {
    document.getElementById('mandje-sluiten')?.focus();
  }
}

function setFormOpen(open) {
  const modal = document.getElementById('toevoegen-modal');
  const overlay = document.getElementById('form-overlay');
  modal?.classList.toggle('open', open);
  overlay?.classList.toggle('visible', open);
  document.body.classList.toggle('modal-open', open);
  if (open) {
    document.getElementById('form-naam')?.focus();
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

// ─── Thema ────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  if (theme === 'light') root.setAttribute('data-theme', 'light');
  else if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  // 'auto' = geen attribuut, CSS gebruikt prefers-color-scheme
  updateThemeIcon(theme);
}

function cycleTheme() {
  const current = getTheme();
  const next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
  saveTheme(next);
  applyTheme(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const icons = { auto: '🌗', light: '☀️', dark: '🌙' };
  const labels = { auto: 'Thema: automatisch', light: 'Thema: licht', dark: 'Thema: donker' };
  btn.textContent = icons[theme] || '🌗';
  btn.setAttribute('aria-label', labels[theme] || 'Thema wisselen');
}

// ─── Fallback data ────────────────────────────────────────────────────────────

const FALLBACK = {
  supermarkten: [
    { id: 'ah', naam: 'AH', kleur: '#00A2E8' },
    { id: 'jumbo', naam: 'Jumbo', kleur: '#FFD200' },
    { id: 'aldi', naam: 'Aldi', kleur: '#00529B' },
    { id: 'lidl', naam: 'Lidl', kleur: '#0050AA' },
    { id: 'dirk', naam: 'Dirk', kleur: '#E2001A' },
  ],
  categorieen: [
    { id: 'zuivel', naam: 'Zuivel', emoji: '🥛', kleur: '#74B9FF' },
    { id: 'groente', naam: 'Groente', emoji: '🥦', kleur: '#55EFC4' },
    { id: 'fruit', naam: 'Fruit', emoji: '🍓', kleur: '#FDCB6E' },
    { id: 'dranken', naam: 'Dranken', emoji: '🥤', kleur: '#A29BFE' },
    { id: 'brood', naam: 'Brood & Gebak', emoji: '🍞', kleur: '#FAB1A0' },
    { id: 'vlees', naam: 'Vlees & Vis', emoji: '🥩', kleur: '#FD79A8' },
    { id: 'diepvries', naam: 'Diepvries', emoji: '🧊', kleur: '#81ECEC' },
    { id: 'snacks', naam: 'Snacks', emoji: '🍿', kleur: '#FFEAA7' },
    { id: 'overig', naam: 'Overig', emoji: '🛒', kleur: '#B2BEC3' },
  ],
  items: [
    { id: 'kwark', naam: 'Kwark', categorie: 'zuivel', supermarkten: ['ah', 'jumbo', 'aldi', 'lidl', 'dirk'] },
    { id: 'sprite-zero', naam: 'Sprite Zero', categorie: 'dranken', supermarkten: ['ah', 'jumbo', 'lidl', 'dirk'] },
    { id: 'aardbeien', naam: 'Aardbeien', categorie: 'fruit', supermarkten: ['ah', 'jumbo', 'aldi', 'lidl', 'dirk'] },
    { id: 'blauwe-bessen', naam: 'Blauwe bessen', categorie: 'fruit', supermarkten: ['ah', 'jumbo', 'aldi', 'lidl'] },
  ],
};

// ─── Start ────────────────────────────────────────────────────────────────────
// De service worker registratie staat in index.html
