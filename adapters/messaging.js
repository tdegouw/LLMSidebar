/**
 * Chrome Messaging Adapter
 *
 * Provides a clean abstraction over chrome.runtime messaging
 * between the background service worker and the sidepanel.
 *
 * This centralizes the handshake protocol and pending message logic.
 */

// ============================================
// Background-side Messaging
// ============================================

export function createBackgroundMessaging() {
  let pendingMessage = null;

  function _createContextMessageId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `ctx_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  /**
   * Called when the user triggers "Send to LLM" via context menu.
   */
  async function handleContextMenuMessage(info, tab) {
    const message = {
      type: 'LLMsidebarMessage',
      data: {
        selectionText: info.selectionText,
        pageUrl: info.pageUrl,
        tabId: tab.id,
        messageId: _createContextMessageId(),
      },
    };

    pendingMessage = message;

    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (err) {
      console.error('[Messaging] Failed to open side panel', err);
      pendingMessage = null;
      return;
    }

    _send(message);
  }

  /**
   * Called when the user triggers image AI analysis via context menu on an image.
   */
  async function handleImageAnalysisMessage(info, tab) {
    const message = {
      type: 'LLMsidebarMessage',
      data: {
        imageSrcUrl: info.srcUrl,
        pageUrl: info.pageUrl,
        tabId: tab.id,
        mediaType: info.mediaType,
        messageId: _createContextMessageId(),
      },
    };

    pendingMessage = message;

    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (err) {
      console.error('[Messaging] Failed to open side panel', err);
      pendingMessage = null;
      return;
    }

    _send(message);
  }

  function _send(message) {
    if (!message) return;
    chrome.runtime.sendMessage(message).catch(() => {});
  }

  /**
   * Called when the sidepanel announces it is ready.
   */
  function onSidepanelReady() {
    if (pendingMessage) {
      _send(pendingMessage);
      pendingMessage = null;
    }
  }

  /**
   * Listen for domain messages (used in background).
   */
  function on(type, handler) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.type === type) {
        handler(message, sender, sendResponse);
      }
    });
  }

  return {
    handleContextMenuMessage,
    handleImageAnalysisMessage,
    onSidepanelReady,
    on,
  };
}

// ============================================
// Sidepanel-side Messaging
// ============================================

export function createSidepanelMessaging() {
  const listeners = new Map();

  /**
   * Send a message to the background.
   */
  function send(message) {
    chrome.runtime.sendMessage(message).catch(() => {});
  }

  /**
   * Notify background that the sidepanel is ready.
   * This triggers delivery of any pending context menu message.
   */
  function notifyReady() {
    send({ type: 'SIDEPANEL_READY' });
  }

  /**
   * Register a handler for a specific message type.
   */
  let messageListenerInstalled = false;

  function on(type, handler) {
    if (!listeners.has(type)) {
      listeners.set(type, new Set());
    }
    listeners.get(type).add(handler);

    // Install the shared listener only once (module-scoped, no globals)
    if (!messageListenerInstalled) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        const handlers = listeners.get(message?.type);
        if (handlers) {
          handlers.forEach((h) => h(message, sender, sendResponse));
        }
      });
      messageListenerInstalled = true;
    }
  }

  /**
   * Remove a handler.
   */
  function off(type, handler) {
    const handlers = listeners.get(type);
    if (handlers) handlers.delete(handler);
  }

  /**
   * Process a message that was captured before the app was ready.
   */
  function processPendingMessage(message) {
    if (!message) return;
    const handlers = listeners.get(message.type);
    if (handlers) {
      handlers.forEach((h) => h(message));
    }
  }

  return {
    send,
    notifyReady,
    on,
    off,
    processPendingMessage,
  };
}
