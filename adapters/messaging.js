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
  function on(type, handler) {
    if (!listeners.has(type)) {
      listeners.set(type, new Set());
    }
    listeners.get(type).add(handler);

    // Ensure we have a single global listener
    if (!window.__llmSidebarMessagingListenerInstalled) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        const handlers = listeners.get(message?.type);
        if (handlers) {
          handlers.forEach((h) => h(message, sender, sendResponse));
        }
      });
      window.__llmSidebarMessagingListenerInstalled = true;
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
