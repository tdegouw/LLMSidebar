/**
 * Prompt Editor View
 *
 * Owns the Prompt Editor section inside the Config tab:
 * - promptEditorSelect
 * - promptEditorTextarea
 * - savePromptBtn / resetPromptBtn
 * - editorHelp
 *
 * This is a focused sub-view. It is created and coordinated by ConfigView.
 * Follows the same factory + ownership pattern as the other UI modules.
 */

export function createPromptEditorView(deps = {}) {
  const { configService } = deps;

  const elements = {
    promptEditorSelect: document.getElementById('promptEditorSelect'),
    promptEditorTextarea: document.getElementById('promptEditorTextarea'),
    savePromptBtn: document.getElementById('savePromptBtn'),
    resetPromptBtn: document.getElementById('resetPromptBtn'),
    editorHelp: document.getElementById('editorHelp'),
  };

  function _loadPromptIntoEditor(key) {
    if (!elements.promptEditorTextarea) return;

    const custom = configService?.getCustomPrompts?.()?.[key];
    const template = custom || configService?.getDefaultPrompts?.()?.[key] || '';

    elements.promptEditorTextarea.value = template;

    if (elements.editorHelp) {
      elements.editorHelp.textContent = custom
        ? 'Custom prompt - changes saved to storage'
        : 'Default prompt loaded';
    }
  }

  function _wireEvents(onPromptChange) {
    elements.promptEditorSelect?.addEventListener('change', () => {
      _loadPromptIntoEditor(elements.promptEditorSelect.value);
    });

    elements.savePromptBtn?.addEventListener('click', () => {
      const key = elements.promptEditorSelect?.value;
      const value = elements.promptEditorTextarea?.value;
      if (key && configService) {
        configService.saveCustomPrompt?.(key, value);
        _loadPromptIntoEditor(key);
      }
    });

    elements.resetPromptBtn?.addEventListener('click', () => {
      const key = elements.promptEditorSelect?.value;
      if (key && configService?.isPromptCustomized?.(key)) {
        configService.removeCustomPrompt?.(key);
        _loadPromptIntoEditor(key);
      }
    });
  }

  function initialize() {
    // Called after configService is ready
  }

  function populate(keys) {
    if (!elements.promptEditorSelect) return;

    elements.promptEditorSelect.innerHTML = '';
    keys.forEach(key => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key;
      elements.promptEditorSelect.appendChild(opt);
    });
  }

  function loadPrompt(key) {
    _loadPromptIntoEditor(key);
  }

  function getCurrentKey() {
    return elements.promptEditorSelect?.value || '';
  }

  // Wire events (called once from parent ConfigView)
  function wire(onPromptChange = () => {}) {
    _wireEvents(onPromptChange);
  }

  return {
    initialize,
    populate,
    loadPrompt,
    getCurrentKey,
    wire,
  };
}
