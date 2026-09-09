import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLLMAdapter } from '../../adapters/llm-adapter.js';

function makeSseResponse(chunks, { ok = true, status = 200, statusText } = {}) {
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i]));
      i += 1;
    },
  });
  return {
    ok,
    status,
    statusText,
    body: stream,
    async text() {
      return typeof chunks === 'string' ? chunks : chunks.join('');
    },
  };
}

describe('createLLMAdapter', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('loadModels fetches and returns data array', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'm1' }, { id: 'm2' }] }),
    });
    const adapter = createLLMAdapter({ baseUrl: 'http://llm.test' });
    const models = await adapter.loadModels();
    expect(fetchMock).toHaveBeenCalledWith('http://llm.test/api/v0/models');
    expect(models).toEqual([{ id: 'm1' }, { id: 'm2' }]);
  });

  it('loadModels returns empty array when data missing', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const adapter = createLLMAdapter();
    expect(await adapter.loadModels()).toEqual([]);
  });

  it('loadModels throws on HTTP error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const adapter = createLLMAdapter();
    await expect(adapter.loadModels()).rejects.toThrow(/503/);
  });

  it('streamChat posts chat completions and accumulates content', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n',
      'data: [DONE]\n',
    ];
    fetchMock.mockResolvedValue(makeSseResponse(sse));
    const adapter = createLLMAdapter({ baseUrl: 'http://llm.test' });
    const chunks = [];
    const result = await adapter.streamChat(
      'model-a',
      'sys',
      'user text',
      (c) => chunks.push(c)
    );
    expect(result).toBe('Hello world');
    expect(chunks).toEqual(['Hello', ' world']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://llm.test/v1/chat/completions');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('model-a');
    expect(body.stream).toBe(true);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'user text' });
  });

  it('streamChat uses low temperature for short text', async () => {
    fetchMock.mockResolvedValue(makeSseResponse(['data: [DONE]\n']));
    const adapter = createLLMAdapter();
    await adapter.streamChat('m', 'p', 'short', () => {}, null, null, {
      temperature: 0.2,
      temperatureHigh: 0.9,
      temperatureThreshold: 1000,
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.2);
  });

  it('streamChat uses high temperature estimate for vision arrays', async () => {
    fetchMock.mockResolvedValue(makeSseResponse(['data: [DONE]\n']));
    const adapter = createLLMAdapter();
    await adapter.streamChat(
      'm',
      'p',
      [{ type: 'text', text: 'hi' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,x' } }],
      () => {},
      null,
      null,
      { temperature: 0.2, temperatureHigh: 0.9, temperatureThreshold: 1000 }
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // vision path uses 2000-char estimate > 1000 threshold
    expect(body.temperature).toBe(0.9);
  });

  it('streamChat forwards reasoning chunks', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"reasoning_content":"think"}}]}\n',
      'data: {"choices":[{"delta":{"content":"ans"}}]}\n',
      'data: [DONE]\n',
    ];
    fetchMock.mockResolvedValue(makeSseResponse(sse));
    const adapter = createLLMAdapter();
    const reasoning = [];
    const content = [];
    const result = await adapter.streamChat(
      'm',
      'p',
      'u',
      (c) => content.push(c),
      (r) => reasoning.push(r)
    );
    expect(reasoning).toEqual(['think']);
    expect(content).toEqual(['ans']);
    expect(result).toBe('thinkans');
  });

  it('streamChat skips malformed JSON lines', async () => {
    const sse = [
      'data: {not-json\n',
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n',
      'data: [DONE]\n',
    ];
    fetchMock.mockResolvedValue(makeSseResponse(sse));
    const adapter = createLLMAdapter();
    expect(await adapter.streamChat('m', 'p', 'u', () => {})).toBe('ok');
  });

  it('streamChat throws with status and JSON error details', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      async text() {
        return JSON.stringify({ error: { message: 'bad request' } });
      },
    });
    const adapter = createLLMAdapter();
    await expect(adapter.streamChat('m', 'p', 'u')).rejects.toThrow(/400.*bad request/);
  });

  it('streamChat throws with plain text error body', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      async text() {
        return 'boom';
      },
    });
    const adapter = createLLMAdapter();
    await expect(adapter.streamChat('m', 'p', 'u')).rejects.toThrow(/500.*boom/);
  });

  it('defaults baseUrl to localhost:1234', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    const adapter = createLLMAdapter();
    await adapter.loadModels();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:1234/api/v0/models');
  });
});
