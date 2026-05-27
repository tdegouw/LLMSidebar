/**
 * Theme Service
 *
 * Pure persistence service for the current theme name (dark/light).
 * Handles only storage + normalization. DOM application (body[data-theme])
 * is owned exclusively by ThemeController in the ui/ layer.
 *
 * Small, single-responsibility module. No globals, explicit DI required.
 */

const THEME_KEY = 'theme';

export function createThemeService(storage) {
  function getCurrentTheme() {
    return storage.get(THEME_KEY) || 'dark';
  }

  function setTheme(theme) {
    const normalized = theme === 'light' ? 'light' : 'dark';
    storage.set(THEME_KEY, normalized);
    return normalized;
  }

  function toggleTheme() {
    const current = getCurrentTheme();
    const next = current === 'light' ? 'dark' : 'light';
    return setTheme(next);
  }

  function initialize() {
    return getCurrentTheme();
  }

  return {
    getCurrentTheme,
    setTheme,
    toggleTheme,
    initialize,
  };
}
