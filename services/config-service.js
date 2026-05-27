/**
 * Config Service.
 *
 * Owns all runtime configuration, prompts (default + custom), languages,
 * and their persistence + derived state (prompt functions).
 *
 * Resource loading (chrome.runtime + fetch for the static JSONs) is
 * delegated to an injected ConfigResources adapter so this service
 * stays pure application logic per the layered architecture.
 */

import { createPromptFunction } from '../core/prompts.js';

/** @type {import('../services/storage.js').Storage['keys']} */
const KEYS = {
  CONFIG: 'llmSidebarConfig',
  CUSTOM_PROMPTS: 'customPrompts',
  CUSTOM_LANGS: 'customLangs',
  SELECTED_LANG: 'selectedLang',
  DEFAULT_PROMPTS: 'defaultPrompts',
};

/** Default runtime configuration */
const DEFAULT_CONFIG = {
  maxLen: 8000,
  temperature: 0.6,
  temperatureThreshold: 1000,
  temperatureHigh: 0.8,
};

/**
 * Creates the ConfigService.
 *
 * @param {{ storage: import('./storage.js').Storage, configResources: import('../adapters/config-resources.js').ConfigResources }} deps
 * @returns {ConfigService}
 */
export function createConfigService(deps = {}) {
  const { storage, configResources } = deps;

  if (!storage) throw new Error('createConfigService requires storage');
  if (!configResources) throw new Error('createConfigService requires configResources');

  /** @type {any} */
  let state = {
    CONFIG: { ...DEFAULT_CONFIG },
    PROMPTS: {},
    DEFAULT_PROMPTS: {},
    LANG: {},
    CUSTOM_LANGS: {},
    currentLang: 'English',
  };

  // ────────────────────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────────────────────

  function loadConfigFromStorage(setDefault = false) {
    if (setDefault) {
      state.CONFIG = { ...DEFAULT_CONFIG };
      return;
    }
    const stored = storage.get(KEYS.CONFIG);
    state.CONFIG = stored
      ? { ...DEFAULT_CONFIG, ...stored }
      : { ...DEFAULT_CONFIG };
  }

  function saveConfigToStorage() {
    storage.set(KEYS.CONFIG, state.CONFIG);
  }

  async function loadDefaultPrompts() {
    const raw = await configResources.loadSystemPrompts();
    state.DEFAULT_PROMPTS = { ...raw };

    // Cache defaults once (application concern, kept here)
    if (!storage.get(KEYS.DEFAULT_PROMPTS)) {
      storage.set(KEYS.DEFAULT_PROMPTS, raw);
    }
  }

  async function loadLanguages() {
    state.LANG = await configResources.loadLanguages();
  }

  function loadCustomLanguages() {
    const stored = storage.get(KEYS.CUSTOM_LANGS);
    state.CUSTOM_LANGS = stored || {};
  }

  function loadCustomPrompts() {
    const stored = storage.get(KEYS.CUSTOM_PROMPTS);
    return stored || {};
  }

  function rebuildPrompts() {
    const custom = loadCustomPrompts();
    state.PROMPTS = {};

    for (const key in state.DEFAULT_PROMPTS) {
      const template = custom[key] || state.DEFAULT_PROMPTS[key];
      state.PROMPTS[key] = createPromptFunction(template);
    }
  }

  // ────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────

  /**
   * Loads all configuration (prompts, languages, user config).
   * Call this once at startup.
   */
  async function initialize() {
    loadConfigFromStorage();
    loadCustomLanguages();

    await Promise.all([
      loadDefaultPrompts(),
      loadLanguages(),
    ]);

    rebuildPrompts();

    // Restore last selected language if valid
    const savedLangCode = storage.get(KEYS.SELECTED_LANG);
    const allLangs = getAllLangs();
    if (savedLangCode && allLangs[savedLangCode]) {
      state.currentLang = allLangs[savedLangCode];
    } else {
      const firstCode = Object.keys(allLangs)[0] || 'en';
      state.currentLang = allLangs[firstCode] || 'English';
    }
  }

  function getConfig() {
    return { ...state.CONFIG };
  }

  function updateConfig(partial) {
    state.CONFIG = { ...state.CONFIG, ...partial };
    saveConfigToStorage();
  }

  function getPrompt(promptType, lang = state.currentLang) {
    const fn = state.PROMPTS[promptType];
    return fn ? fn(lang) : '';
  }

  function getAllLangs() {
    return { ...state.LANG, ...state.CUSTOM_LANGS };
  }

  function getCurrentLanguage() {
    return state.currentLang;
  }

  function setCurrentLanguage(langName) {
    state.currentLang = langName;
  }

  function saveSelectedLanguage(code) {
    storage.set(KEYS.SELECTED_LANG, code);
  }

  // Custom languages
  function addCustomLang(code, name) {
    state.CUSTOM_LANGS[code.toLowerCase()] = name;
    storage.set(KEYS.CUSTOM_LANGS, state.CUSTOM_LANGS);
  }

  function removeCustomLang(code) {
    delete state.CUSTOM_LANGS[code.toLowerCase()];
    storage.set(KEYS.CUSTOM_LANGS, state.CUSTOM_LANGS);
  }

  // Custom prompts
  function saveCustomPrompt(key, template) {
    const custom = loadCustomPrompts();
    custom[key] = template;
    storage.set(KEYS.CUSTOM_PROMPTS, custom);
    rebuildPrompts(); // refresh prompt functions
  }

  function removeCustomPrompt(key) {
    const custom = loadCustomPrompts();
    delete custom[key];
    storage.set(KEYS.CUSTOM_PROMPTS, custom);
    rebuildPrompts();
  }

  function isPromptCustomized(key) {
    const custom = loadCustomPrompts();
    return Object.prototype.hasOwnProperty.call(custom, key);
  }

  function getDefaultPrompts() {
    return { ...state.DEFAULT_PROMPTS };
  }

  function getPromptKeys() {
    return Object.keys(state.DEFAULT_PROMPTS);
  }

  // Full reset (used by "Reset All")
  function resetAllToDefaults() {
    storage.clearAll();
    state.CUSTOM_LANGS = {};
    state.CUSTOM_PROMPTS = {}; // will be rebuilt
    loadConfigFromStorage(true);
    rebuildPrompts();
  }

  // Expose a few more helpers that the new ConfigView needs
  function getCustomPrompts() {
    const stored = storage.get(KEYS.CUSTOM_PROMPTS);
    return stored || {};
  }

  function getCustomLangs() {
    const stored = storage.get(KEYS.CUSTOM_LANGS);
    return stored || {};
  }

  return {
    initialize,
    getConfig,
    updateConfig,
    getPrompt,
    getAllLangs,
    getCurrentLanguage,
    setCurrentLanguage,
    saveSelectedLanguage,
    addCustomLang,
    removeCustomLang,
    saveCustomPrompt,
    removeCustomPrompt,
    isPromptCustomized,
    getDefaultPrompts,
    getCustomPrompts,
    getCustomLangs,
    getPromptKeys,
    resetAllToDefaults,
  };
}
