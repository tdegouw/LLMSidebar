/**
 * Analysis Service
 *
 * The central orchestrator for running a single LLM analysis.
 * Fully dependency-injected — no globals, no DOM, no chrome knowledge.
 *
 * Responsibilities:
 * - Lifecycle of one analysis run (including abort)
 * - Coordinating content retrieval, prompt selection, and LLM streaming
 * - Clean callbacks for progress / results / errors
 */

export function createAnalysisService(deps = {}) {
  const {
    llmAdapter,
    contentExtractor,
    configService,
    getActiveTabId,           // optional: () => Promise<number | null>
  } = deps;

  let abortController = null;

  /**
   * Abort the current in-flight analysis (if any).
   */
  function abort() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  /**
   * Run a new analysis.
   *
   * @param {object} options
   * @param {string} options.model - Model ID to use
   * @param {string} [options.promptType='summarize']
   * @param {string} [options.content] - Pre-extracted content (highest priority)
   * @param {number} [options.tabId] - If provided + no content, will try to extract
   * @param {(chunk: string) => void} [options.onContent]
   * @param {(chunk: string) => void} [options.onReasoning]
   * @param {(errorMessage: string) => void} [options.onError]
   * @param {(isProcessing: boolean) => void} [options.onProcessingChange]
   * @returns {Promise<string>} accumulated response
   */
  async function run(options = {}) {
    const {
      model,
      promptType = 'summarize',
      content: contentOverride,
      tabId: explicitTabId,
      onContent,
      onReasoning,
      onError,
      onProcessingChange,
    } = options;

    // Cancel any previous run from this service instance
    abort();

    abortController = new AbortController();
    const signal = abortController.signal;

    try {
      if (onProcessingChange) onProcessingChange(true);

      // 1. Resolve content
      let content = contentOverride;

      if (!content) {
        const tabId = explicitTabId || (getActiveTabId ? await getActiveTabId() : null);

        if (tabId && contentExtractor) {
          const cfg = configService ? configService.getConfig() : null;
          const maxLen = cfg?.maxLen || 8000;
          content = await contentExtractor(tabId, maxLen);
        }
      }

      if (!content || typeof content !== 'string' || content.trim() === '') {
        throw new Error('No text found to analyze.');
      }

      if (!model) {
        throw new Error('No model selected.');
      }

      // 2. Get system prompt
      const promptText = configService
        ? configService.getPrompt(promptType)
        : '';

      if (!promptText) {
        throw new Error(`Invalid or missing prompt for type: ${promptType}`);
      }

      // 3. Get config (for temperature, etc.)
      const cfg = configService ? configService.getConfig() : null;

      // 4. Stream from LLM
      const result = await llmAdapter.streamChat(
        model,
        promptText,
        content,
        onContent,
        onReasoning,
        signal,
        cfg
      );

      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        return '';
      }

      const message = error.message || String(error);
      if (onError) onError(message);
      throw error;
    } finally {
      if (onProcessingChange) onProcessingChange(false);
      abortController = null;
    }
  }

  return {
    run,
    abort,
  };
}
