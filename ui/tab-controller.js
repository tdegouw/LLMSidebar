/**
 * Tab Controller
 *
 * Dedicated, small module that owns tab switching behavior.
 * This is the single place responsible for managing which tab is active.
 *
 * Follows the same factory + clean API pattern as the other UI modules.
 */

export function createTabController() {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const contents = Array.from(document.querySelectorAll('.tab-content'));

  let currentTab = null;

  function _activateTab(tabElement) {
    if (!tabElement) return;

    const targetId = tabElement.dataset.tab;
    if (!targetId) return;

    // Deactivate all
    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    // Activate target
    tabElement.classList.add('active');

    const targetContent = document.getElementById(targetId);
    if (targetContent) {
      targetContent.classList.add('active');
    }

    currentTab = targetId;
  }

  function _wireEvents() {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        _activateTab(tab);
      });
    });
  }

  // Public API
  function switchTo(tabId) {
    const tab = tabs.find(t => t.dataset.tab === tabId);
    if (tab) {
      _activateTab(tab);
    }
  }

  function getCurrentTab() {
    return currentTab;
  }

  function initialize(defaultTab = 'output') {
    _wireEvents();

    // Activate initial tab
    const initial = tabs.find(t => t.dataset.tab === defaultTab) || tabs[0];
    if (initial) {
      _activateTab(initial);
    }
  }

  return {
    initialize,
    switchTo,
    getCurrentTab,
  };
}
