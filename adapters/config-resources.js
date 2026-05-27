/**
 * Config Resources Adapter.
 *
 * Abstracts loading of the static, extension-bundled configuration JSON files
 * (system prompts and language definitions) via chrome.runtime.getURL + fetch.
 *
 * This is the single place that should ever perform these Chrome API + network
 * operations for config data, keeping services pure per the layered architecture.
 *
 * Follows the same factory pattern as content-extractor.js and llm-adapter.js.
 */

/**
 * @typedef {Object} ConfigResources
 * @property {() => Promise<Object>} loadSystemPrompts - Loads the default system prompts JSON.
 * @property {() => Promise<Object>} loadLanguages - Loads the language definitions JSON.
 */

/**
 * Creates the config resources loader.
 *
 * @returns {ConfigResources}
 */
export function createConfigResources() {
  async function loadSystemPrompts() {
    const url = chrome.runtime.getURL('config/system-prompts.json');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load prompts: ${res.status}`);
    return await res.json();
  }

  async function loadLanguages() {
    const url = chrome.runtime.getURL('config/lang.json');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load lang.json: ${res.status}`);
    return await res.json();
  }

  return {
    loadSystemPrompts,
    loadLanguages,
  };
}
