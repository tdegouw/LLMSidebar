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

// Capture context menu messages as early as possible.
// The handler is temporary and removed after App.init() to ensure
// exactly one delivery path (prevents duplicate analysis runs).
let pendingContextMenuMessage = null;

function earlyContextMenuHandler(message) {
  console.log('[Bootstrap] Captured early LLMsidebarMessage', message);
  pendingContextMenuMessage = message;
}

messaging.on('LLMsidebarMessage', earlyContextMenuHandler);

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await App.init();

    // After init, replay any message captured during bootstrap through
    // the normal handler registered in _setupMessaging. Then remove the
    // temporary early listener so future messages have only one path.
    if (pendingContextMenuMessage) {
      messaging.processPendingMessage(pendingContextMenuMessage);
      pendingContextMenuMessage = null;
    }
    messaging.off('LLMsidebarMessage', earlyContextMenuHandler);

    // Now that App is ready, tell the background we're here.
    // Background may replay a queued context menu message on this READY.
    messaging.notifyReady();
  } catch (error) {
    console.error('[Sidepanel] Failed to initialize App:', error);
  }
});
