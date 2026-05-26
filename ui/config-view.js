/**
 * Config View
 *
 * Owns the entire Config tab: DOM, event wiring, and user interactions.
 * This is the *only* module that should directly manipulate config-tab elements.
 *
 * Factory pattern with dependency injection.
 */

import { createPromptEditorView } from './prompt-editor-view.js';
import { createLanguageManagerView } from './language-manager-view.js';
import { createResetView } from './reset-view.js';
import { createTemperatureControlsView } from './temperature-controls-view.js';

export function createConfigView(deps = {}) {
  const {
    configService,
    onModelChange = () => {},
    onLanguageChange = () => {},
    onRefreshModels = () => {},
  } = deps;

  // Cache DOM elements
  const elements = {
    llmSelect: document.getElementById('llmSelect'),
    promptSelect: document.getElementById('promptSelect'),
    langSelect: document.getElementById('langSelect'),
    refreshModelsBtn: document.getElementById('refreshModelsBtn'),
  };

  // Create focused sub-view for the prompt editor section
  const promptEditor = createPromptEditorView({ configService });

  // Create focused sub-view for custom language management
  const languageManager = createLanguageManagerView({
    configService,
    onLanguagesChanged: () => {
      populateLanguageSelect(); // refresh the main language dropdown when languages change
    },
  });

  // Create focused sub-view for the Reset All section
  const resetView = createResetView({
    configService,
    onReset: () => {
      temperatureControls.refresh();
      promptEditor.loadPrompt('summarize');
      languageManager.refresh();
      populateLanguageSelect();
    },
  });

  // Create focused sub-view for temperature and general config inputs
  const temperatureControls = createTemperatureControlsView({ configService });

  // ────────────────────────────────────────────────────────────
  // Private methods
  // ────────────────────────────────────────────────────────────

  // (Prompt editor logic has been moved to prompt-editor-view.js)
  // (Temperature controls logic has been moved to temperature-controls-view.js)

  function _wireEvents() {
    // Delegate prompt editor to its own focused view
    promptEditor.wire();

    // Delegate language management to its own focused view
    languageManager.wire();

    // Delegate reset functionality to its own focused view
    resetView.wire();

    // Delegate temperature and config inputs to their own focused view
    temperatureControls.wire();

    // Language selector
    elements.langSelect?.addEventListener('change', () => {
      const code = elements.langSelect.value;
      const allLangs = configService?.getAllLangs?.() || {};
      const langName = allLangs[code] || 'English';
      configService?.setCurrentLanguage?.(langName);
      configService?.saveSelectedLanguage?.(code);
      onLanguageChange(langName);
    });

    // Model selector
    elements.llmSelect?.addEventListener('change', () => {
      onModelChange(elements.llmSelect.value);
    });

    // (Language management has been moved to language-manager-view.js)
    // (Reset logic has been moved to reset-view.js)

    // Refresh models button - fully owned here (callback lets App orchestrate the actual load)
    elements.refreshModelsBtn?.addEventListener('click', () => {
      onRefreshModels();
    });
  }

  // ────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────

  function initialize() {
    if (configService) {
      temperatureControls.refresh();
      promptEditor.loadPrompt('summarize');
      languageManager.refresh();
      populateLanguageSelect();
    }
  }

  /**
   * Populates the main language dropdown (#langSelect) with all available languages
   * (default + custom). This was missing after the refactor.
   */
  function populateLanguageSelect() {
    const langSelectEl = elements.langSelect;
    if (!langSelectEl || !configService) return;

    const allLangs = configService.getAllLangs?.() || {};
    const currentCode = Object.keys(allLangs).find(code =>
      allLangs[code] === configService.getCurrentLanguage?.()
    ) || 'en';

    langSelectEl.innerHTML = '';

    Object.entries(allLangs).forEach(([code, name]) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = name;
      langSelectEl.appendChild(opt);
    });

    langSelectEl.value = currentCode;
  }

  function populateTaskSelects() {
    const keys = configService?.getPromptKeys?.() || [];

    // Output tab prompt select
    if (elements.promptSelect) {
      elements.promptSelect.innerHTML = '';
      keys.forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        elements.promptSelect.appendChild(opt);
      });
    }

    // Delegate editor select population to sub-view
    promptEditor.populate(keys);
  }

  function populateModelSelect(models) {
    if (!elements.llmSelect) return;

    elements.llmSelect.innerHTML = '';
    const llmModels = models.filter(m => m.type === 'llm' || m.type === 'vlm');

    if (llmModels.length > 0) {
      llmModels.forEach(model => {
        const opt = document.createElement('option');
        opt.value = model.id;
        opt.textContent = `${model.id} (${model.state})`;
        elements.llmSelect.appendChild(opt);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No LLM models found';
      elements.llmSelect.appendChild(opt);
    }
  }

  function setCurrentLanguage(language) {
    if (configService) configService.setCurrentLanguage?.(language);
  }

  function getCurrentModel() {
    return elements.llmSelect?.value || '';
  }

  function getCurrentPromptType() {
    return elements.promptSelect?.value || 'summarize';
  }

  /**
   * Disables or enables the model and prompt selects (used during processing).
   */
  function setSelectionInputsDisabled(disabled) {
    if (elements.llmSelect) elements.llmSelect.disabled = disabled;
    if (elements.promptSelect) elements.promptSelect.disabled = disabled;
  }

  /**
   * Attempts to restore a previously selected model after the model list has been populated.
   * If the model is found in the dropdown, it selects it and notifies via onModelChange.
   */
  function restoreLastSelectedModel(lastModelId) {
    if (!lastModelId || !elements.llmSelect) return;

    const options = Array.from(elements.llmSelect.options);
    const found = options.some(opt => opt.value === lastModelId);

    if (found) {
      elements.llmSelect.value = lastModelId;
      // Reuse the existing change handler logic
      if (typeof onModelChange === 'function') {
        onModelChange(lastModelId);
      }
    }
  }

  // Initialize wiring
  _wireEvents();

  return {
    initialize,
    populateTaskSelects,
    populateModelSelect,
    setCurrentLanguage,

    // Thin query methods so external code (App) does not need to read the selects directly
    getCurrentModel,
    getCurrentPromptType,

    // Exposed so App or reset flows can force a refresh of the language dropdown
    populateLanguageSelect,

    // Model restoration (used after populateModelSelect)
    restoreLastSelectedModel,

    // Used by App to disable selects during processing (keeps ownership in ConfigView)
    setSelectionInputsDisabled,

    // Used by App for the rare catastrophic model load failure (LM Studio down etc.)
    // Keeps the last direct llmSelect write out of the composition root.
    setModelSelectError(message) {
      if (elements.llmSelect) {
        elements.llmSelect.innerHTML = `<option value="">${message || 'No models available'}</option>`;
      }
    },
  };
}
