/**
 * Prompt Service.
 *
 * Owns all prompt-related concerns:
 * - Default system prompts (loaded via ConfigResources)
 * - Custom user-edited prompts
 * - Rebuilding executable prompt functions (using core/prompts)
 * - getPrompt, save/remove custom prompts, etc.
 *
 * Extracted from the former monolithic ConfigService to reduce
 * cognitive load (AGENTS.md small files principle).
 */

import { createPromptFunction } from '../core/prompts.js';

export function createPromptService({ storage, configResources }) {
  /** @type {Object} */
  let defaultPrompts = {};
  /** @type {Object} */
  let prompts = {}; // compiled functions

  const CUSTOM_PROMPTS_KEY = 'customPrompts';
  const DEFAULT_PROMPTS_KEY = 'defaultPrompts';

  async function loadDefaultPrompts() {
    const raw = await configResources.loadSystemPrompts();
    defaultPrompts = { ...raw };

    // Cache defaults once
    if (!storage.get(DEFAULT_PROMPTS_KEY)) {
      storage.set(DEFAULT_PROMPTS_KEY, raw);
    }
  }

  function loadCustomPrompts() {
    const stored = storage.get(CUSTOM_PROMPTS_KEY);
    return stored || {};
  }

  function rebuildPrompts() {
    const custom = loadCustomPrompts();
    prompts = {};

    for (const key in defaultPrompts) {
      const template = custom[key] || defaultPrompts[key];
      prompts[key] = createPromptFunction(template); // from core/prompts
    }
  }

  function getPrompt(promptType, lang) {
    const fn = prompts[promptType];
    return fn ? fn(lang) : '';
  }

  function saveCustomPrompt(key, template) {
    const custom = loadCustomPrompts();
    custom[key] = template;
    storage.set(CUSTOM_PROMPTS_KEY, custom);
    rebuildPrompts();
  }

  function removeCustomPrompt(key) {
    const custom = loadCustomPrompts();
    delete custom[key];
    storage.set(CUSTOM_PROMPTS_KEY, custom);
    rebuildPrompts();
  }

  function isPromptCustomized(key) {
    const custom = loadCustomPrompts();
    return Object.prototype.hasOwnProperty.call(custom, key);
  }

  function getDefaultPrompts() {
    return { ...defaultPrompts };
  }

  function getCustomPrompts() {
    const stored = storage.get(CUSTOM_PROMPTS_KEY);
    return stored || {};
  }

  function getPromptKeys() {
    return Object.keys(defaultPrompts);
  }

  async function initialize() {
    await loadDefaultPrompts();
    rebuildPrompts();
  }

  function reset() {
    // Called during "Reset All"
    // The caller is responsible for clearing storage
  }

  return {
    initialize,
    getPrompt,
    saveCustomPrompt,
    removeCustomPrompt,
    isPromptCustomized,
    getDefaultPrompts,
    getCustomPrompts,
    getPromptKeys,
    reset,
    // Expose for internal use if needed during transition
    _rebuildPrompts: rebuildPrompts,
  };
}
