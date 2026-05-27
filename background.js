/**
 * background.js
 *
 * Service worker (Manifest V3).
 * 
 * Philosophy: Keep this file extremely small and focused.
 * It only handles:
 *   - Extension installation / lifecycle
 *   - Context menu registration
 *   - Side panel behavior configuration
 *   - Delegating all messaging concerns to the messaging adapter
 *
 * Almost all intelligence around communication (pending messages, 
 * SIDEPANEL_READY handshake, etc.) lives in:
 *   → adapters/messaging.js
 */

import { createBackgroundMessaging } from './adapters/messaging.js';

// ------------------------------------------------------------------
// Messaging Adapter
// ------------------------------------------------------------------
// Created at module top level because background.js is a service worker
// that must be ready to handle chrome.contextMenus and runtime messages
// immediately on load. This is an intentional, documented exception to the
// "everything created in Composition Root" rule due to extension lifecycle.
const messaging = createBackgroundMessaging();

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------
const CONTEXT_MENU_ID = 'LLMsidebar';

// ------------------------------------------------------------------
// Extension Lifecycle
// ------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  // Create the right-click context menu items
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Send to LLM',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'LLMsidebarImageAnalysis',
    title: 'Check if this image is AI-generated',
    contexts: ['image', 'video'],
  });

  // Make clicking the extension icon open the side panel
  chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true,
  });
});

// ------------------------------------------------------------------
// Context Menu Handling
// ------------------------------------------------------------------
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID) {
    // Text selection path - existing behavior
    messaging.handleContextMenuMessage(info, tab);
  } else if (info.menuItemId === 'LLMsidebarImageAnalysis') {
    // Image analysis path - new vision feature
    messaging.handleImageAnalysisMessage(info, tab);
  }
});

// ------------------------------------------------------------------
// Side Panel Ready Handshake
// ------------------------------------------------------------------
// When the side panel has fully initialized, it sends a "SIDEPANEL_READY"
// message. The messaging adapter will then deliver any queued context
// menu message that was waiting for the panel to be ready.
messaging.on('SIDEPANEL_READY', () => {
  messaging.onSidepanelReady();
});


