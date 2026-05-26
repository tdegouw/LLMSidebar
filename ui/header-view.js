/**
 * Header View
 *
 * Tiny owner for the global header elements that are not tab-specific:
 * - #modelTitle (shows the currently selected model or default app name)
 *
 * This removes the last cross-boundary DOM access that lived in OutputView
 * (setCurrentModelName reaching into the header).
 *
 * Keeping this separate from ThemeController keeps both modules tiny and
 * focused. If the header grows (status indicator, provider badge, etc.)
 * this is the natural place.
 */

export function createHeaderView() {
  const modelTitle = document.getElementById('modelTitle');

  function setModelName(name) {
    if (modelTitle) {
      modelTitle.textContent = name || 'LMM Assistant';
    }
  }

  return {
    setModelName,
  };
}
