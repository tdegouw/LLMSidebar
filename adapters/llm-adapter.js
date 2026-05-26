/**
 * LLM Adapter — abstraction over the actual LLM provider (LM Studio compatible OpenAI API).
 * Returns a clean port so the rest of the app has no direct fetch or SSE knowledge.
 */

import { resolveTemperature } from '../core/temperature.js';

/**
 * @typedef {Object} LLMAdapter
 * @property {(model: string, promptText: string, content: string, onChunk: (chunk: string) => void, onReasoning?: (chunk: string) => void, signal?: AbortSignal, config?: object) => Promise<string>} streamChat
 * @property {() => Promise<Array>} loadModels
 */

/**
 * Creates an LLM adapter for LM Studio (or any compatible server).
 *
 * @param {object} [options]
 * @param {string} [options.baseUrl] - Base URL of the OpenAI-compatible server
 * @returns {LLMAdapter}
 */
export function createLLMAdapter(options = {}) {
  const baseUrl = options.baseUrl || 'http://localhost:1234';

  /**
   * Streams a chat completion using SSE.
   * Supports both regular content and reasoning_content (for reasoning models).
   */
  async function streamChat(model, promptText, content, onChunk, onReasoning, signal, config = null) {
    const temperature = resolveTemperature(content.length, config);

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: promptText },
          { role: 'user', content },
        ],
        temperature,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      let details = '';
      try {
        const text = await response.text();
        if (text) {
          // Try to parse as JSON for nicer errors from LM Studio
          try {
            const json = JSON.parse(text);
            details = json.error?.message || json.message || text;
          } catch {
            details = text;
          }
        }
      } catch {
        // ignore body read errors
      }
      throw new Error(`API request failed with status: ${response.status}${details ? ` – ${details}` : ''}`);
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
          const delta = data.choices?.[0]?.delta;
          if (!delta) continue;

          const reasoning = delta.reasoning || delta.reasoning_content;
          const chunk = delta.content;

          if (reasoning && typeof onReasoning === 'function') {
            fullText += reasoning;
            onReasoning(reasoning);
            // Small delay for smoother perceived streaming (preserves original UX)
            await new Promise((r) => setTimeout(r, 10));
          }

          if (chunk && typeof onChunk === 'function') {
            fullText += chunk;
            onChunk(chunk);
            await new Promise((r) => setTimeout(r, 10));
          }
        } catch {
          // Skip malformed JSON chunks (same behavior as original)
        }
      }
    }

    return fullText;
  }

  async function loadModels() {
    const response = await fetch(`${baseUrl}/api/v0/models`);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
  }

  return {
    streamChat,
    loadModels,
  };
}
