/**
 * Theme Controller
 *
 * Small, single-purpose module that owns the global theme toggle button
 * (the "🌙/☀️" button in the header).
 *
 * Responsibilities:
 * - Cache and wire the #themeToggle button
 * - Update the emoji icon when the theme changes
 * - Delegate actual theme state + persistence + body[data-theme] application
 *   to the injected ThemeService
 *
 * This is the "view" for the global theme toggle. It makes it easy to later
 * evolve into a theme picker (when we support more than dark/light) without
 * touching App or the service.
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

  function initialize() {
    // Ensure the service has applied the persisted (or default) theme to the body
    const current = themeService.initialize();
    _updateIcon(current);

    toggle?.addEventListener('click', () => {
      const next = themeService.toggleTheme();
      _updateIcon(next);
    });
  }

  return {
    initialize,
  };
}
