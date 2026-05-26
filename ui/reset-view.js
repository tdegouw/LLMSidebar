/**
 * Reset View
 *
 * Owns the "Reset All" section at the bottom of the Config tab:
 * - resetAllBtn
 * - resetStatus (temporary success message)
 *
 * This is a focused sub-view. It is created and coordinated by ConfigView.
 */

export function createResetView(deps = {}) {
  const {
    configService,
    onReset = () => {},
  } = deps;

  const elements = {
    resetAllBtn: document.getElementById('resetAllBtn'),
    resetStatus: document.getElementById('resetStatus'),
  };

  function _wireEvents() {
    elements.resetAllBtn?.addEventListener('click', async () => {
      if (configService) {
        configService.resetAllToDefaults?.();
      }

      // Show temporary status message using class (cleaner than direct style manipulation)
      if (elements.resetStatus) {
        elements.resetStatus.classList.add('show');
        setTimeout(() => {
          if (elements.resetStatus) elements.resetStatus.classList.remove('show');
        }, 2800);
      }

      onReset(); // Notify parent so it can refresh sub-views
    });
  }

  function wire() {
    _wireEvents();
  }

  return {
    wire,
  };
}
