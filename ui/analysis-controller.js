/**
 * Analysis Controller
 *
 * Thin, single-purpose coordinator for the two user-initiated analysis flows:
 *   1. "Process Page" button (Output tab)
 *   2. Context menu → "Send to LLM" (with pre-selected text)
 *
 * This module owns all the session-level orchestration that previously lived
 * as private methods inside the Composition Root (app.js). It keeps the root
 * honest: app.js only creates and wires; behavior lives in focused modules.
 *
 * Responsibilities:
 * - Translate the two entry points into AnalysisService.run() calls
 * - Perform the shared "prepare for new analysis" work (reset results, clear errors, abort previous, optional tab switch)
 * - Propagate processing state changes to the two views that need to react (OutputView + ConfigView)
 * - Centralize the guard + error handling around model selection
 *
 * Design notes:
 * - Follows the exact same factory + explicit DI pattern as TabController and ThemeController.
 * - No DOM access. No direct storage. Pure coordination via injected collaborators.
 * - Keeps the public surface of App stable for sidepanel-init.js.
 *
 * Created as part of the deliberate effort to keep app.js extremely thin
 * (see AGENTS.md §3.3 and the App.js Lightening plan in plan.md).
 */

export function createAnalysisController(deps = {}) {
  const {
    analysisService,
    outputView,
    configView,
    tabController,
  } = deps;

  if (!analysisService) {
    throw new Error('createAnalysisController requires an analysisService');
  }

  // ────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────

  /**
   * Reads the current model + prompt selection via the ConfigView query methods.
   * Returns null (and shows a user error) when no model is selected.
   */
  function _getCurrentSelectionOrError() {
    const model = configView?.getCurrentModel?.() || '';
    const promptType = configView?.getCurrentPromptType?.() || 'summarize';

    if (!model) {
      outputView?.showError('Please select a model first.');
      return null;
    }

    return { model, promptType };
  }

  /**
   * Common preparation steps before starting any new analysis run.
   * Centralizes the repetitive "reset + clear + abort" sequence that
   * used to be duplicated in app.js.
   */
  function _prepareForNewAnalysis({ switchTab = false } = {}) {
    if (switchTab) {
      tabController?.switchTo('output');
    }

    outputView?.clearResults?.();
    outputView?.clearError?.();
    analysisService?.abort?.();
  }

  /**
   * The actual delegation to AnalysisService with all streaming + state callbacks wired.
   * The error handling here is intentionally minimal (service already calls onError;
   * we only log non-abort errors for diagnostics).
   */
  async function _runAnalysis({ content = null, model, promptType = 'summarize' } = {}) {
    if (!model) {
      outputView?.showError('No model selected.');
      return;
    }

    try {
      await analysisService.run({
        model,
        promptType,
        content,
        onContent: (chunk) => {
          outputView?.appendContent?.(chunk);
        },
        onReasoning: (chunk) => {
          outputView?.renderReasoning?.(chunk);
        },
        onError: (msg) => {
          outputView?.showError?.(msg);
        },
        onProcessingChange: (isProcessing) => {
          outputView?.setProcessing?.(isProcessing);
          configView?.setSelectionInputsDisabled?.(isProcessing);
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[AnalysisController] Analysis failed', err);
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────

  /**
   * Triggered by the "Process Page" button in the Output tab.
   * Content is not passed → AnalysisService will extract from the active tab.
   */
  function handleAnalyze() {
    const selection = _getCurrentSelectionOrError();
    if (!selection) return;

    _prepareForNewAnalysis({ switchTab: false });

    _runAnalysis({
      content: null,
      model: selection.model,
      promptType: selection.promptType,
    });
  }

  /**
   * Handler for messages coming from the background script
   * (right-click context menu → "Send to LLM").
   *
   * This path is special: it forces a tab switch to Output and uses the
   * provided selectionText directly instead of extracting from the page.
   */
  function handleContextMenuMessage(message) {
    console.log('[AnalysisController] Handling context menu message', message);

    const selectionText = message?.data?.selectionText || '';
    if (!selectionText.trim()) {
      outputView?.showError('No text was selected.');
      return;
    }

    const selection = _getCurrentSelectionOrError();
    if (!selection) return;

    _prepareForNewAnalysis({ switchTab: true });

    _runAnalysis({
      content: selectionText,
      model: selection.model,
      promptType: selection.promptType,
    });
  }

  /**
   * Abort the currently running analysis (if any).
   * Exposed so the Composition Root can wire the Stop button cleanly if desired.
   */
  function abort() {
    analysisService?.abort?.();
  }

  return {
    handleAnalyze,
    handleContextMenuMessage,
    abort,
  };
}
