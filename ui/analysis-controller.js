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
    imageCapture,
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
  async function _runAnalysis({ content = null, image = null, model, promptType = 'summarize' } = {}) {
    if (!model) {
      outputView?.showError('No model selected.');
      return;
    }

    let hasReceivedContent = false;

    try {
      await analysisService.run({
        model,
        promptType,
        content,
        image,
        onContent: (chunk) => {
          hasReceivedContent = true;
          outputView?.appendContent?.(chunk);
        },
        onReasoning: (chunk) => {
          hasReceivedContent = true;
          outputView?.renderReasoning?.(chunk);
        },
        onError: (msg) => {
          // Only show the big error overlay if we haven't received any content yet.
          // If content arrived, the error happened mid-stream; don't yank the UI out of processing.
          if (!hasReceivedContent) {
            outputView?.showError?.(msg);
          } else {
            console.warn('[AnalysisController] Error after content started arriving:', msg);
          }
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

  // Dedup for context menu payloads. Background may deliver the same
  // logical request twice (direct send + READY replay, or races during panel
  // bootstrap). Each user gesture gets a unique messageId; only duplicates
  // of the *same* id are suppressed. Legitimate repeated user actions use
  // different ids and are allowed.
  const seenContextMessageIds = new Map(); // messageId -> timestamp
  const MESSAGE_DEDUP_WINDOW_MS = 10000;

  function _isDuplicateContextMessage(messageId) {
    if (!messageId) return false;
    const now = Date.now();

    // Prune expired entries (keeps the map tiny)
    for (const [id, ts] of seenContextMessageIds) {
      if (now - ts > MESSAGE_DEDUP_WINDOW_MS) {
        seenContextMessageIds.delete(id);
      }
    }

    if (seenContextMessageIds.has(messageId)) {
      return true;
    }
    seenContextMessageIds.set(messageId, now);
    return false;
  }

  /**
   * Handler for messages coming from the background script
   * (right-click context menu → "Send to LLM").
   *
   * This path is special: it forces a tab switch to Output and uses the
   * provided selectionText directly instead of extracting from the page.
   */
  function handleContextMenuMessage(message) {
    const data = message?.data || {};

    if (data.messageId && _isDuplicateContextMessage(data.messageId)) {
      return;
    }

    // Image / video AI analysis path
    if (data.imageSrcUrl) {
      handleImageAnalysisMessage(message);
      return;
    }

    // Existing text selection path
    const selectionText = data.selectionText || '';
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
   * Handles the "Check if this image is AI-generated" flow (right-click on images/videos).
   */
  async function handleImageAnalysisMessage(message) {
    const data = message?.data || {};
    const srcUrl = data.imageSrcUrl;
    const tabId = data.tabId;

    if (!srcUrl || !tabId) {
      outputView?.showError('The selected image could not be accessed.');
      return;
    }

    // Only vision models (type 'vlm') can analyze images
    const modelType = configView?.getCurrentModelType?.();
    if (modelType !== 'vlm') {
      outputView?.showError('Please select a vision model (👁️ Vision) to analyze images.');
      return;
    }

    const selection = _getCurrentSelectionOrError();
    if (!selection) return;

    _prepareForNewAnalysis({ switchTab: true });

    try {
      // Capture the image as base64
      const imageDataUrl = await imageCapture?.captureImage?.(tabId, srcUrl);

      if (!imageDataUrl) {
        outputView?.showError('Failed to capture the image.');
        return;
      }

      // Use the special AI image detection prompt
      // The service will fully manage the processing button state (Stop / Process Page + dot)
      _runAnalysis({
        content: '', // not used for pure image analysis
        image: imageDataUrl,
        model: selection.model,
        promptType: 'detect_ai_image',
      });
    } catch (err) {
      console.error('[AnalysisController] Image capture failed', err);

      const raw = (err && err.message) || String(err);
      let userMsg = 'Could not capture the image for analysis.';

      if (raw.includes('CORS') || raw.includes('cross-origin') || raw.includes('block')) {
        userMsg = 'Could not load the image (the site may prevent access to it).';
      } else if (raw.includes('timed out') || raw.includes('timeout')) {
        userMsg = 'Image capture timed out.';
      } else if (raw.includes('not found') || raw.includes('element')) {
        userMsg = 'Could not locate the image on the page.';
      } else if (raw.includes('zero dimensions')) {
        userMsg = 'Could not read the image (it may still be loading).';
      }

      outputView?.showError(userMsg);
    }
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
