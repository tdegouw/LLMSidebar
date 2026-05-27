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
import { createMainConfigInputsView } from './main-config-inputs-view.js';

export function createConfigView(deps = {}) {
  const {
    configService,
    onModelChange = () => {},
    onLanguageChange = () => {},
    onRefreshModels = () => {},
  } = deps;

  // Note: Main select elements (llmSelect, promptSelect, langSelect, refreshModelsBtn)
  // are now owned by mainConfigInputsView.


  // Create focused sub-view for the prompt editor section
  const promptEditor = createPromptEditorView({ configService });

  // Create focused sub-view for custom language management.
  // The onLanguagesChanged callback is the parent coordinator's responsibility
  // (light, intentional coupling for cross-subview refresh).
  const languageManager = createLanguageManagerView({
    configService,
    onLanguagesChanged: () => {
      mainInputs.populateLanguageSelect?.();
    },
  });

  // Create focused sub-view for the Reset All section.
  // The onReset callback coordinates refresh across multiple sub-views.
  const resetView = createResetView({
    configService,
    onReset: () => {
      temperatureControls.refresh();
      promptEditor.loadPrompt('summarize');
      languageManager.refresh();
      mainInputs.populateLanguageSelect?.();
    },
  });

  // Create focused sub-view for temperature and general config inputs
  const temperatureControls = createTemperatureControlsView({ configService });

  // Create focused sub-view for the three main selects (model, task, language) + refresh button
  const mainInputs = createMainConfigInputsView({
    configService,
    onModelChange,
    onLanguageChange,
    onRefreshModels,
  });

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

    // Delegate the three main selects + refresh button to their focused view
    mainInputs.wire();

    // (Language selector, model selector, and refresh button logic
    //  have been moved to main-config-inputs-view.js)
  }

  // ────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────

  function initialize() {
    if (configService) {
      temperatureControls.refresh();
      promptEditor.loadPrompt('summarize');
      languageManager.refresh();
      mainInputs.refresh(); // includes populateLanguageSelect
    }
  }

  // populateLanguageSelect has been moved to main-config-inputs-view.js
  // (exposed via mainInputs.populateLanguageSelect if needed externally)

  function populateTaskSelects() {
    mainInputs.populateTaskSelects();
    // Delegate editor select population to sub-view
    const keys = configService?.getPromptKeys?.() || [];
    promptEditor.populate(keys);
  }

  function populateModelSelect(models) {
    mainInputs.populateModelSelect(models);
  }

  function setCurrentLanguage(language) {
    if (configService) configService.setCurrentLanguage?.(language);
  }

  function getCurrentModel() {
    return mainInputs.getCurrentModel();
  }

  function getCurrentPromptType() {
    return mainInputs.getCurrentPromptType();
  }

  /**
   * Disables or enables the model and prompt selects (used during processing).
   */
  function setSelectionInputsDisabled(disabled) {
    mainInputs.setSelectionInputsDisabled(disabled);
  }

  /**
   * Attempts to restore a previously selected model after the model list has been populated.
   * If the model is found in the dropdown, it selects it and notifies via onModelChange.
   */
  function restoreLastSelectedModel(lastModelId) {
    mainInputs.restoreLastSelectedModel(lastModelId);
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

    // Language refresh is now handled via mainInputs
    // (kept for backward compat during transition if anything external calls it)
    populateLanguageSelect() {
      mainInputs.populateLanguageSelect?.();
    },

    // Model restoration (used after populateModelSelect)
    restoreLastSelectedModel,

    // Used by App to disable selects during processing (keeps ownership in ConfigView)
    setSelectionInputsDisabled,

    // Used by App for the rare catastrophic model load failure (LM Studio down etc.)
    // Keeps the last direct llmSelect write out of the composition root.
    setModelSelectError(message) {
      mainInputs.setModelSelectError(message);
    },
  };
}
