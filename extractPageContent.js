/**
 * Extracts page content from a given tab.
 */
async function extractPageContent(tabId) {
    const maxLen = (typeof CONFIG !== 'undefined' && CONFIG.maxLen) || 8000;
    try {
        const selection = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => window.getSelection().toString().trim()
        });

        if (selection[0]?.result) {
            return selection[0].result.substring(0, maxLen);
        }

        const pageContent = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const main = document.querySelector('main, article, [role="main"], #content, .content, .main-content');
                if (main) return main.innerText.trim();
                
                const body = document.body.cloneNode(true);
                body.querySelectorAll('nav, header, footer, aside, menu, [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]').forEach(el => el.remove());
                return body.innerText.trim();
            }
        });

        return pageContent[0]?.result?.substring(0, maxLen) || '';
    } catch (error) {
        console.error('Error extracting page content:', error);
        return '';
    }
}
