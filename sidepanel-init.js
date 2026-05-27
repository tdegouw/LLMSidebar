/**
 * Sidepanel Bootstrap
 *
 * Entry point when loaded as native ES module.
 * Bootstraps the application and sets up early message listeners.
 */

import { App } from './app.js';
import { createSidepanelMessaging } from './adapters/messaging.js';

// Create the messaging adapter at module top level so it can capture
// context menu messages that may arrive before the DOM is ready and
// before App.init() has run. This is a justified timing exception.
const messaging = createSidepanelMessaging();

// Capture context menu messages as early as possible
let pendingContextMenuMessage = null;

messaging.on('LLMsidebarMessage', (message) => {
  console.log('[Bootstrap] Captured early LLMsidebarMessage', message);
  pendingContextMenuMessage = message;

  // If App is already initialized, process it immediately
  if (App && typeof App.processPendingContextMessage === 'function') {
    App.processPendingContextMessage(pendingContextMenuMessage);
    pendingContextMenuMessage = null;
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await App.init();

    // After init, process any message that arrived while loading
    if (pendingContextMenuMessage) {
      if (typeof App.processPendingContextMessage === 'function') {
        App.processPendingContextMessage(pendingContextMenuMessage);
      }
      pendingContextMenuMessage = null;
    }

    // Now that App is ready, tell the background we're here
    messaging.notifyReady();
  } catch (error) {
    console.error('[Sidepanel] Failed to initialize App:', error);
  }
});
