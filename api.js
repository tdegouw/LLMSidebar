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

/**
 * Streams a response from the LM Studio API.
 * @param {string} model - The model ID
 * @param {string} promptText - The system prompt
 * @param {string} content - The user content
 * @param {function} onChunk - Callback for each streamed content chunk
 * @param {function} onReasoning - Callback for each streamed reasoning chunk
 * @returns {Promise<string>} The full accumulated response
 */
async function streamChatCompletion(model, promptText, content, onChunk, onReasoning) {
    // Use higher temperature for longer content to maintain quality with more context
    const temperature = (typeof CONFIG !== 'undefined' && CONFIG.temperature) || 0.6;
    const threshold = (typeof CONFIG !== 'undefined' && CONFIG.temperatureThreshold) || 1000;
    const highTemp = (typeof CONFIG !== 'undefined' && CONFIG.temperatureHigh) || 0.8;
    const resolvedTemp = content.length > threshold ? highTemp : temperature;

    const response = await fetch('http://localhost:1234/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: "system", content: promptText },
                { role: "user", content: content }
            ],
            temperature: resolvedTemp,
            stream: true
        })
    });

    if (!response.ok) {
        throw new Error(`API request failed with status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
                const data = JSON.parse(dataStr);
                const choices = data.choices;
                if (!choices || !choices[0]) continue;
                
                const delta = choices[0].delta;
                
                const reasoning = delta?.reasoning || delta?.reasoning_content;
                const chunk = delta?.content;
                
                if (reasoning && onReasoning) {
                    fullText += reasoning;
                    onReasoning(reasoning);
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                if (chunk && onChunk) {
                    fullText += chunk;
                    onChunk(chunk);
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            } catch (e) {
                // Skip malformed JSON
            }
        }
    }

    return fullText;
}
