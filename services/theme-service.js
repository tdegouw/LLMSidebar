/**
 * Theme Service
 *
 * Handles dark/light theme persistence and application.
 * Small, single-responsibility module.
 */

import { createStorage } from './storage.js';

const THEME_KEY = 'theme';

export function createThemeService(storage = createStorage()) {
  function getCurrentTheme() {
    return storage.get(THEME_KEY) || 'dark';
  }

  function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
  }

  function setTheme(theme) {
    const normalized = theme === 'light' ? 'light' : 'dark';
    storage.set(THEME_KEY, normalized);
    applyTheme(normalized);
    return normalized;
  }

  function toggleTheme() {
    const current = getCurrentTheme();
    const next = current === 'light' ? 'dark' : 'light';
    return setTheme(next);
  }

  function initialize() {
    const saved = getCurrentTheme();
    applyTheme(saved);
    return saved;
  }

  return {
    getCurrentTheme,
    applyTheme,
    setTheme,
    toggleTheme,
    initialize,
  };
}
