/**
 * Store – lokale opslag (localStorage) voor BoodschappenBaas.
 * Beheert: checked items, gebruikersitems en themavoorkeur.
 */

const KEYS = {
  CHECKED: 'bb_checked',
  USER_ITEMS: 'bb_user_items',
  THEME: 'bb_theme',
  ACTIVE_MARKT: 'bb_active_markt',
};

// ─── Checked items ───────────────────────────────────────────────────────────

/** @returns {string[]} array of checked item IDs */
export function getChecked() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.CHECKED) || '[]');
  } catch {
    return [];
  }
}

/** @param {string[]} ids */
export function saveChecked(ids) {
  localStorage.setItem(KEYS.CHECKED, JSON.stringify(ids));
}

/** @param {string} id */
export function addChecked(id) {
  const checked = getChecked();
  if (!checked.includes(id)) {
    checked.push(id);
    saveChecked(checked);
  }
}

/** @param {string} id */
export function removeChecked(id) {
  saveChecked(getChecked().filter((c) => c !== id));
}

export function clearChecked() {
  saveChecked([]);
}

// ─── User-added items ─────────────────────────────────────────────────────────

/**
 * @returns {Array<{id:string,naam:string,categorie:string,supermarkten:string[]}>}
 */
export function getUserItems() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.USER_ITEMS) || '[]');
  } catch {
    return [];
  }
}

/**
 * @param {Array} items
 */
export function saveUserItems(items) {
  localStorage.setItem(KEYS.USER_ITEMS, JSON.stringify(items));
}

/**
 * Add a single user item.
 * @param {{id:string,naam:string,categorie:string,supermarkten:string[]}} item
 */
export function addUserItem(item) {
  const items = getUserItems();
  items.push(item);
  saveUserItems(items);
}

// ─── Theme ────────────────────────────────────────────────────────────────────

/** @returns {'auto'|'light'|'dark'} */
export function getTheme() {
  return localStorage.getItem(KEYS.THEME) || 'auto';
}

/** @param {'auto'|'light'|'dark'} theme */
export function saveTheme(theme) {
  localStorage.setItem(KEYS.THEME, theme);
}

// ─── Active supermarkt ────────────────────────────────────────────────────────

/** @returns {string|null} */
export function getActiveMarkt() {
  return localStorage.getItem(KEYS.ACTIVE_MARKT) || 'alle';
}

/** @param {string} markt */
export function saveActiveMarkt(markt) {
  localStorage.setItem(KEYS.ACTIVE_MARKT, markt);
}
