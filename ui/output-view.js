/**
 * Output View
 *
 * Owns the entire Output tab: DOM elements, event wiring, and rendering.
 * This is the *only* place that should touch output-related DOM nodes.
 *
 * Uses factory pattern for clean dependency injection of action callbacks.
 */

export function createOutputView(deps = {}) {
  const {
    onAnalyze = () => {},
    onStop = () => {},
    onClear = () => {},
  } = deps;

  // Cache all DOM elements this view owns
  const elements = {
    resultBody: document.getElementById('resultBody'),
    reasoningContainer: document.getElementById('reasoningContainer'),
    reasoningBody: document.getElementById('reasoningBody'),
    maximizeReasoningBtn: document.getElementById('maximizeReasoningBtn'),
    statusIndicator: document.getElementById('statusIndicator'),
    copyBtn: document.getElementById('copyBtn'),
    clearBtn: document.getElementById('clearBtn'),
    stopBtn: document.getElementById('stopBtn'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    errorOverlay: document.getElementById('errorOverlay'),
    errorMessage: document.getElementById('errorMessage'),
  };

  let reasoningMaximized = false;

  // ────────────────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────────────────

  function _renderEmptyState() {
    if (elements.resultBody) {
      elements.resultBody.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <p class="empty-state-text">Click "Process Page" to analyze content</p>
        </div>`;
    }
  }

  function _wireEvents() {
    // Action buttons
    elements.analyzeBtn?.addEventListener('click', () => onAnalyze());
    elements.stopBtn?.addEventListener('click', () => onStop());
    elements.clearBtn?.addEventListener('click', () => {
      _renderEmptyState();
      if (elements.reasoningContainer) elements.reasoningContainer.classList.remove('visible');
      if (elements.reasoningBody) {
        elements.reasoningBody.textContent = '';
        elements.reasoningBody.dataset.raw = '';
      }
      onClear();
    });

    // Copy button
    elements.copyBtn?.addEventListener('click', async () => {
      const text = elements.resultBody?.innerText || elements.resultBody?.textContent;
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
        const original = elements.copyBtn.textContent;
        elements.copyBtn.textContent = '✅';
        setTimeout(() => {
          if (elements.copyBtn) elements.copyBtn.textContent = original;
        }, 1400);
      } catch (err) {
        console.error('[output-view] Copy failed', err);
      }
    });

    // Maximize reasoning
    elements.maximizeReasoningBtn?.addEventListener('click', () => {
      reasoningMaximized = !reasoningMaximized;

      if (!elements.reasoningBody) return;

      if (reasoningMaximized) {
        elements.reasoningBody.classList.add('maximized');
        elements.maximizeReasoningBtn.textContent = '↙';
      } else {
        elements.reasoningBody.classList.remove('maximized');
        elements.maximizeReasoningBtn.textContent = '⛶';
      }
    });
  }

  // ────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────

  function setProcessing(isProcessing) {
    // Use class-based hiding instead of direct style.display manipulation
    if (elements.stopBtn) elements.stopBtn.classList.toggle('hidden', !isProcessing);
    if (elements.analyzeBtn) elements.analyzeBtn.classList.toggle('hidden', isProcessing);
    if (elements.statusIndicator) elements.statusIndicator.classList.toggle('active', isProcessing);
    if (elements.copyBtn) elements.copyBtn.classList.toggle('hidden', isProcessing);
  }

  function showError(message) {
    if (elements.errorMessage) elements.errorMessage.textContent = message;
    if (elements.errorOverlay) elements.errorOverlay.classList.add('active');
    setProcessing(false);
  }

  function clearError() {
    if (elements.errorMessage) elements.errorMessage.textContent = '';
    if (elements.errorOverlay) elements.errorOverlay.classList.remove('active');
  }

  // Make error overlay dismissible
  function _wireErrorDismiss() {
    if (!elements.errorOverlay) return;

    // Click anywhere on the overlay to dismiss
    elements.errorOverlay.addEventListener('click', (e) => {
      // Don't dismiss if clicking inside the card (except the close button)
      const card = elements.errorOverlay.querySelector('.error-card');
      if (card && card.contains(e.target)) {
        // Allow the close button to work via its own handler if present
        return;
      }
      clearError();
    });

    // Explicit close button (if present in HTML)
    const closeBtn = elements.errorOverlay.querySelector('.error-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearError();
      });
    }
  }

  function renderContent(html) {
    if (elements.resultBody) {
      elements.resultBody.innerHTML = html;
    }
  }

  function renderReasoning(rawText) {
    if (!elements.reasoningBody) return;

    const current = elements.reasoningBody.dataset.raw || '';
    elements.reasoningBody.dataset.raw = current + rawText;

    if (elements.reasoningContainer) {
      elements.reasoningContainer.classList.add('visible');
    }

    const renderer = deps.renderMarkdown || ((text) => text);
    elements.reasoningBody.innerHTML = renderer(elements.reasoningBody.dataset.raw);
    elements.reasoningBody.scrollTop = elements.reasoningBody.scrollHeight;
  }

  /**
   * Appends a new chunk to the results and re-renders.
   * The View now fully owns the accumulation logic.
   */
  function appendContent(chunk) {
    if (!elements.resultBody) return;

    const current = elements.resultBody.dataset.accumulated || '';
    const updated = current + chunk;
    elements.resultBody.dataset.accumulated = updated;

    const renderer = deps.renderMarkdown || ((text) => text);
    renderContent(renderer(updated));
  }

  /**
   * Clears the result area and resets the internal accumulator.
   */
  function clearResults() {
    _renderEmptyState();
    if (elements.reasoningContainer) elements.reasoningContainer.classList.remove('visible');
    if (elements.reasoningBody) {
      elements.reasoningBody.textContent = '';
      elements.reasoningBody.dataset.raw = '';
    }
    clearError();

    // Reset streaming accumulator
    if (elements.resultBody) {
      elements.resultBody.dataset.accumulated = '';
    }
  }

  // Initialize
  _wireEvents();
  _wireErrorDismiss();
  _renderEmptyState();

  return {
    setProcessing,
    showError,
    clearError,
    clearResults,
    renderContent,
    renderReasoning,
    appendContent,   // new preferred method for streaming
  };
}
