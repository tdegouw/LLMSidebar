/**
 * Main Config Inputs View
 *
 * Owns the primary configuration selects in the Config tab:
 * - llmSelect (model)
 * - promptSelect (task type)
 * - langSelect (language)
 * - refreshModelsBtn
 *
 * Responsibilities:
 * - Caching and wiring these four elements
 * - Populating the three selects (models, tasks, languages)
 * - Handling change events for model and language
 * - Exposing thin query methods (getCurrentModel, getCurrentPromptType)
 * - Supporting model restoration and error states
 *
 * This is a focused sub-view extracted from config-view.js following
 * the established pattern (temperature-controls-view, prompt-editor-view, etc.).
 */

export function createMainConfigInputsView(deps = {}) {
  const {
    configService,
    onModelChange = () => {},
    onLanguageChange = () => {},
    onRefreshModels = () => {},
  } = deps;

  const elements = {
    llmSelect: document.getElementById('llmSelect'),
    promptSelect: document.getElementById('promptSelect'),
    langSelect: document.getElementById('langSelect'),
    refreshModelsBtn: document.getElementById('refreshModelsBtn'),
  };

  function _wireEvents() {
    elements.langSelect?.addEventListener('change', () => {
      const code = elements.langSelect.value;
      const allLangs = configService?.getAllLangs?.() || {};
      const langName = allLangs[code] || 'English';
      configService?.setCurrentLanguage?.(langName);
      configService?.saveSelectedLanguage?.(code);
      onLanguageChange(langName);
    });

    elements.llmSelect?.addEventListener('change', () => {
      onModelChange(elements.llmSelect.value);
    });

    elements.refreshModelsBtn?.addEventListener('click', () => {
      onRefreshModels();
    });
  }

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

    if (elements.promptSelect) {
      elements.promptSelect.innerHTML = '';
      keys.forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        elements.promptSelect.appendChild(opt);
      });
    }
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

  function setSelectionInputsDisabled(disabled) {
    if (elements.llmSelect) elements.llmSelect.disabled = disabled;
    if (elements.promptSelect) elements.promptSelect.disabled = disabled;
  }

  function restoreLastSelectedModel(lastModelId) {
    if (!lastModelId || !elements.llmSelect) return;

    const options = Array.from(elements.llmSelect.options);
    const found = options.some(opt => opt.value === lastModelId);

    if (found) {
      elements.llmSelect.value = lastModelId;
      if (typeof onModelChange === 'function') {
        onModelChange(lastModelId);
      }
    }
  }

  function setModelSelectError(message) {
    if (elements.llmSelect) {
      elements.llmSelect.innerHTML = `<option value="">${message || 'No models available'}</option>`;
    }
  }

  function getCurrentModel() {
    return elements.llmSelect?.value || '';
  }

  function getCurrentPromptType() {
    return elements.promptSelect?.value || 'summarize';
  }

  function wire() {
    _wireEvents();
  }

  function refresh() {
    // Called during initialization and reset flows
    populateLanguageSelect();
  }

  return {
    wire,
    refresh,
    populateLanguageSelect,
    populateTaskSelects,
    populateModelSelect,
    setSelectionInputsDisabled,
    restoreLastSelectedModel,
    setModelSelectError,
    getCurrentModel,
    getCurrentPromptType,
  };
}
