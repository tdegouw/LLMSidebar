/**
 * Language Manager View
 *
 * Owns the "Manage Languages" section in the Config tab:
 * - newLangCode / newLangName inputs
 * - addLangBtn
 * - langList (with remove buttons)
 *
 * This is a focused sub-view. It is created and coordinated by ConfigView.
 */

export function createLanguageManagerView(deps = {}) {
  const { configService, onLanguagesChanged = () => {} } = deps;

  const elements = {
    addLangBtn: document.getElementById('addLangBtn'),
    newLangCode: document.getElementById('newLangCode'),
    newLangName: document.getElementById('newLangName'),
    langList: document.getElementById('langList'),
  };

  function _renderLangList() {
    if (!elements.langList || !configService) return;

    elements.langList.innerHTML = '';

    // Only show custom languages in the management list (default languages cannot be removed)
    const customLangs = configService.getCustomLangs?.() || {};
    Object.entries(customLangs).forEach(([code, name]) => {
      const div = document.createElement('div');
      div.className = 'lang-list-item';
      div.innerHTML = `
        <span>${name}</span>
        <button class="remove-lang-btn" data-code="${code}">✕</button>
      `;
      elements.langList.appendChild(div);
    });

    // Wire remove buttons
    elements.langList.querySelectorAll('.remove-lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        configService.removeCustomLang?.(btn.dataset.code);
        _renderLangList();
        onLanguagesChanged(); // notify parent so it can refresh main dropdown
      });
    });
  }

  function _wireEvents() {
    elements.addLangBtn?.addEventListener('click', () => {
      const code = elements.newLangCode?.value.trim().toLowerCase();
      const name = elements.newLangName?.value.trim();

      if (code && name && configService) {
        configService.addCustomLang?.(code, name);
        elements.newLangCode.value = '';
        elements.newLangName.value = '';
        _renderLangList();
        onLanguagesChanged(); // notify parent
      }
    });
  }

  function initialize() {
    // nothing special needed yet
  }

  function refresh() {
    _renderLangList();
  }

  function wire() {
    _wireEvents();
  }

  return {
    initialize,
    refresh,
    wire,
  };
}
