/**
 * Config Service.
 *
 * Thin coordinator for runtime configuration values.
 * Prompt and language concerns have been extracted into focused services
 * (PromptService and LanguageService) as part of P1-3 decomposition.
 *
 * Resource loading is delegated to ConfigResources adapter.
 */

import { createLanguageService } from './language-service.js';
import { createPromptService } from './prompt-service.js';

/** @type {import('../adapters/storage.js').Storage['keys']} */
const KEYS = {
  CONFIG: 'llmSidebarConfig',
  CUSTOM_PROMPTS: 'customPrompts',
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
 * @param {{ storage: import('../adapters/storage.js').Storage, configResources: import('../adapters/config-resources.js').ConfigResources }} deps
 * @returns {ConfigService}
 */
export function createConfigService(deps = {}) {
  const { storage, configResources } = deps;

  if (!storage) throw new Error('createConfigService requires storage');
  if (!configResources) throw new Error('createConfigService requires configResources');

  // Language and Prompt concerns are delegated to focused services (P1-3 decomposition).
  const languageService = createLanguageService({
    storage,
    loadLanguages: configResources.loadLanguages,
  });
  const promptService = createPromptService({ storage, configResources });

  /** @type {any} */
  let state = {
    CONFIG: { ...DEFAULT_CONFIG },
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

  // ────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────

  /**
   * Loads all configuration (prompts, languages, user config).
   * Call this once at startup.
   */
  async function initialize() {
    loadConfigFromStorage();

    // Delegate prompt and language initialization to focused services
    await Promise.all([
      promptService.initialize(),
      languageService.initialize(),
    ]);
  }

  function getConfig() {
    return { ...state.CONFIG };
  }

  function updateConfig(partial) {
    state.CONFIG = { ...state.CONFIG, ...partial };
    saveConfigToStorage();
  }

  function getPrompt(promptType, lang) {
    return promptService.getPrompt(promptType, lang || languageService.getCurrent());
  }

  // Language methods are now delegated to the focused LanguageService
  function getAllLangs() {
    return languageService.getAll();
  }

  function getCurrentLanguage() {
    return languageService.getCurrent();
  }

  function setCurrentLanguage(langName) {
    languageService.setCurrent(langName);
  }

  function saveSelectedLanguage(code) {
    languageService.saveSelected(code);
  }

  function addCustomLang(code, name) {
    languageService.addCustom(code, name);
  }

  function removeCustomLang(code) {
    languageService.removeCustom(code);
  }

  // Prompt methods delegated to focused PromptService
  function saveCustomPrompt(key, template) {
    promptService.saveCustomPrompt(key, template);
  }

  function removeCustomPrompt(key) {
    promptService.removeCustomPrompt(key);
  }

  function isPromptCustomized(key) {
    return promptService.isPromptCustomized(key);
  }

  function getDefaultPrompts() {
    return promptService.getDefaultPrompts();
  }

  function getPromptKeys() {
    return promptService.getPromptKeys();
  }

  // Full reset (used by "Reset All")
  function resetAllToDefaults() {
    storage.clearAll();
    languageService.reset();
    promptService.reset();
    loadConfigFromStorage(true);
  }

  // Expose a few more helpers that the new ConfigView needs
  function getCustomPrompts() {
    return promptService.getCustomPrompts();
  }

  function getCustomLangs() {
    return languageService.getCustom();
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
