/**
 * Sidepanel Bootstrap
 *
 * Entry point when loaded as native ES module.
 * Bootstraps the application and sets up early message listeners.
 */

import { App } from './app.js';
import { createSidepanelMessaging } from './adapters/messaging.js';

// Single messaging instance for the whole sidepanel lifetime.
// Created at module top level so it can capture context menu messages that
// may arrive before the DOM is ready and before App.init() has run.
// This is a justified timing exception (see AGENTS.md).
const messaging = createSidepanelMessaging();

// Capture context menu messages as early as possible.
// The handler is temporary and removed after App.init() so there is
// exactly one delivery path (prevents duplicate analysis runs).
let pendingContextMenuMessage = null;

function earlyContextMenuHandler(message) {
  console.log('[Bootstrap] Captured early LLMsidebarMessage', message);
  pendingContextMenuMessage = message;
}

messaging.on('LLMsidebarMessage', earlyContextMenuHandler);

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Pass the same messaging instance into App so handlers share one listener map.
    await App.init({ messaging });

    // After init, App has registered its LLMsidebarMessage handler on this
    // same instance. Remove the temporary early listener, then replay any
    // message captured during bootstrap through App's public API.
    messaging.off('LLMsidebarMessage', earlyContextMenuHandler);

    if (pendingContextMenuMessage) {
      App.processPendingContextMessage(pendingContextMenuMessage);
      pendingContextMenuMessage = null;
    }

    // Announce ready exactly once. Background may replay a queued context
    // menu message on this READY (panel was closed when the user clicked).
    messaging.notifyReady();
  } catch (error) {
    console.error('[Sidepanel] Failed to initialize App:', error);
  }
});
