/**
 * Content Extractor Adapter.
 * Abstracts away chrome.scripting and page content heuristics.
 */

/**
 * @typedef {(tabId: number, maxLen?: number) => Promise<string>} ContentExtractor
 */

/**
 * Creates a content extractor that can pull text from a browser tab.
 *
 * @returns {ContentExtractor}
 */
export function createContentExtractor() {
  /**
   * Extracts the most relevant text content from the given tab.
   * First tries the current text selection, then falls back to semantic main content.
   */
  return async function extractPageContent(tabId, maxLen = 8000) {
    try {
      // 1. Try current selection first (highest signal)
      const selection = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => window.getSelection().toString().trim(),
      });

      if (selection?.[0]?.result) {
        return selection[0].result.substring(0, maxLen);
      }

      // 2. Fallback: extract main readable content
      const pageContent = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const main = document.querySelector(
            'main, article, [role="main"], #content, .content, .main-content'
          );
          if (main) return main.innerText.trim();

          // Remove obvious noise elements
          const body = document.body.cloneNode(true);
          body.querySelectorAll(
            'nav, header, footer, aside, menu, [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]'
          ).forEach((el) => el.remove());

          return body.innerText.trim();
        },
      });

      return pageContent?.[0]?.result?.substring(0, maxLen) || '';
    } catch (error) {
      console.error('[content-extractor] Failed to extract content:', error);
      return '';
    }
  };
}
