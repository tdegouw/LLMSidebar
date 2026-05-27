/**
 * Theme Controller
 *
 * Small, single-purpose module that owns the global theme toggle button
 * (the "🌙/☀️" button in the header) **and** the cross-cutting
 * `body[data-theme]` attribute application.
 *
 * Responsibilities:
 * - Cache and wire the #themeToggle button
 * - Update the emoji icon when the theme changes
 * - Apply the persisted (or default) theme to <body> on init and toggle
 * - Delegate only persistence + normalization to the injected (pure) ThemeService
 *
 * This is the sole owner of all theme-related DOM. ThemeService is now a
 * pure model with zero DOM access.
 *
 * Factory pattern (consistent with tab-controller, config-view, etc.).
 */

export function createThemeController({ themeService }) {
  if (!themeService) {
    throw new Error('createThemeController requires a themeService');
  }

  const toggle = document.getElementById('themeToggle');

  function _updateIcon(theme) {
    if (toggle) {
      toggle.textContent = theme === 'light' ? '☀️' : '🌙';
      toggle.title = theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
    }
  }

  function _applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
  }

  function initialize() {
    // ThemeService is now pure (persistence only). This controller owns the DOM.
    const current = themeService.initialize();
    _applyTheme(current);
    _updateIcon(current);

    toggle?.addEventListener('click', () => {
      const next = themeService.toggleTheme();
      _applyTheme(next);
      _updateIcon(next);
    });
  }

  return {
    initialize,
  };
}
