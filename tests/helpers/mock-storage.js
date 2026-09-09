/**
 * In-memory storage stand-in for adapters/storage.js API.
 */
export function createMockStorage(initial = {}) {
  const store = new Map(
    Object.entries(initial).map(([k, v]) => [k, structuredClone(v)])
  );

  return {
    get(key) {
      return store.has(key) ? structuredClone(store.get(key)) : null;
    },
    set(key, value) {
      store.set(key, structuredClone(value));
    },
    remove(key) {
      store.delete(key);
    },
    clearAll() {
      store.clear();
    },
    keys: {
      CONFIG: 'llmSidebarConfig',
      CUSTOM_PROMPTS: 'customPrompts',
      CUSTOM_LANGS: 'customLangs',
      SELECTED_LANG: 'selectedLang',
      LAST_MODEL: 'lastSelectedModel',
      THEME: 'theme',
      DEFAULT_PROMPTS: 'defaultPrompts',
    },
    _store: store,
  };
}
