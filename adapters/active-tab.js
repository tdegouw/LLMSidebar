/**
 * Active Tab Adapter.
 *
 * Provides the currently active tab ID in the browser.
 * This is the single place that should perform chrome.tabs queries
 * for the purpose of content extraction during analysis.
 *
 * Follows the same small, focused factory pattern as content-extractor.js.
 */

/**
 * @typedef {Object} ActiveTabProvider
 * @property {() => Promise<number|null>} getActiveTabId
 */

/**
 * Creates a provider that can return the ID of the active tab.
 *
 * @returns {ActiveTabProvider}
 */
export function createActiveTabProvider() {
  /**
   * Returns the ID of the currently active tab in the current window,
   * or null if none can be determined.
   */
  async function getActiveTabId() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.id ?? null;
    } catch {
      return null;
    }
  }

  return {
    getActiveTabId,
  };
}
