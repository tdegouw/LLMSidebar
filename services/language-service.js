/**
 * Language Service.
 *
 * Owns everything related to languages:
 * - Default languages (from lang.json)
 * - Custom user-added languages
 * - Currently selected language
 * - Persistence of custom languages and selection
 *
 * This module was extracted from the former monolithic ConfigService
 * to keep responsibilities focused (per AGENTS.md small-files principle).
 */

const STORAGE_KEY_CUSTOM = 'customLangs';
const STORAGE_KEY_SELECTED = 'selectedLang';

export function createLanguageService({ storage, loadLanguages }) {
  /** @type {Object} */
  let defaultLangs = {};
  /** @type {Object} */
  let customLangs = {};
  /** @type {string} */
  let currentLang = 'English';

  async function loadDefaults() {
    if (typeof loadLanguages === 'function') {
      defaultLangs = await loadLanguages();
    } else {
      // Fallback (should not normally happen)
      const url = chrome.runtime.getURL('config/lang.json');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load lang.json: ${res.status}`);
      defaultLangs = await res.json();
    }
  }

  function loadCustom() {
    const stored = storage.get(STORAGE_KEY_CUSTOM);
    customLangs = stored || {};
  }

  function loadSelected() {
    const savedCode = storage.get(STORAGE_KEY_SELECTED);
    const all = getAll();
    if (savedCode && all[savedCode]) {
      currentLang = all[savedCode];
    } else {
      const firstCode = Object.keys(all)[0] || 'en';
      currentLang = all[firstCode] || 'English';
    }
  }

  function getAll() {
    return { ...defaultLangs, ...customLangs };
  }

  function getCurrent() {
    return currentLang;
  }

  function setCurrent(langName) {
    currentLang = langName;
  }

  function saveSelected(code) {
    storage.set(STORAGE_KEY_SELECTED, code);
  }

  function addCustom(code, name) {
    customLangs[code.toLowerCase()] = name;
    storage.set(STORAGE_KEY_CUSTOM, customLangs);
  }

  function removeCustom(code) {
    delete customLangs[code.toLowerCase()];
    storage.set(STORAGE_KEY_CUSTOM, customLangs);
  }

  function getCustom() {
    return { ...customLangs };
  }

  function reset() {
    customLangs = {};
    currentLang = 'English';
  }

  async function initialize() {
    await loadDefaults();
    loadCustom();
    loadSelected();
  }

  return {
    initialize,
    getAll,
    getCurrent,
    setCurrent,
    saveSelected,
    addCustom,
    removeCustom,
    getCustom,
    reset,
  };
}
