/**
 * Storage Service.
 * Single source of truth for all extension persistence (localStorage).
 * All other code should go through this service.
 */

const STORAGE_KEYS = {
  CONFIG: 'llmSidebarConfig',
  CUSTOM_PROMPTS: 'customPrompts',
  CUSTOM_LANGS: 'customLangs',
  SELECTED_LANG: 'selectedLang',
  LAST_MODEL: 'lastSelectedModel',
  THEME: 'theme',
  DEFAULT_PROMPTS: 'defaultPrompts', // old key, kept for potential data migration
};

/**
 * @typedef {Object} Storage
 * @property {(key: string) => any} get
 * @property {(key: string, value: any) => void} set
 * @property {(key: string) => void} remove
 * @property {() => void} clearAll
 */

/**
 * Creates a storage service instance.
 * @returns {Storage & { keys: typeof STORAGE_KEYS }}
 */
export function createStorage() {
  function get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error('[storage] Failed to save', key, err);
    }
  }

  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.error('[storage] Failed to remove', key, err);
    }
  }

  function clearAll() {
    Object.values(STORAGE_KEYS).forEach((k) => remove(k));
  }

  return {
    get,
    set,
    remove,
    clearAll,
    keys: STORAGE_KEYS,
  };
}

// Default export for convenience when importing the factory
export default createStorage;
