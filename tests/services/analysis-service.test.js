import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnalysisService } from '../../services/analysis-service.js';

function createMocks(overrides = {}) {
  const llmAdapter = {
    streamChat: vi.fn(async (_m, _p, content, onContent) => {
      if (onContent) onContent('chunk');
      return 'chunk';
    }),
  };
  const configService = {
    getConfig: vi.fn(() => ({ maxLen: 8000, temperature: 0.6 })),
    getPrompt: vi.fn((type) => (type === 'summarize' ? 'System prompt' : '')),
  };
  const contentExtractor = vi.fn(async () => 'extracted page text');
  const getActiveTabId = vi.fn(async () => 42);

  return {
    llmAdapter,
    configService,
    contentExtractor,
    getActiveTabId,
    ...overrides,
  };
}

describe('createAnalysisService', () => {
  let deps;
  let service;

  beforeEach(() => {
    deps = createMocks();
    service = createAnalysisService(deps);
  });

  it('runs with provided content and streams via llmAdapter', async () => {
    const onContent = vi.fn();
    const onProcessingChange = vi.fn();
    const result = await service.run({
      model: 'local-model',
      content: 'hello world',
      onContent,
      onProcessingChange,
    });
    expect(result).toBe('chunk');
    expect(onContent).toHaveBeenCalledWith('chunk');
    expect(onProcessingChange).toHaveBeenNthCalledWith(1, true);
    expect(onProcessingChange).toHaveBeenLastCalledWith(false);
    expect(deps.llmAdapter.streamChat).toHaveBeenCalledWith(
      'local-model',
      'System prompt',
      'hello world',
      onContent,
      undefined,
      expect.any(AbortSignal),
      expect.objectContaining({ maxLen: 8000 })
    );
    expect(deps.contentExtractor).not.toHaveBeenCalled();
  });

  it('extracts content via tabId when content missing', async () => {
    await service.run({ model: 'm', tabId: 7, promptType: 'summarize' });
    expect(deps.contentExtractor).toHaveBeenCalledWith(7, 8000);
  });

  it('uses getActiveTabId when no tabId or content', async () => {
    await service.run({ model: 'm' });
    expect(deps.getActiveTabId).toHaveBeenCalled();
    expect(deps.contentExtractor).toHaveBeenCalledWith(42, 8000);
  });

  it('throws when no content and no image', async () => {
    deps.contentExtractor.mockResolvedValue('   ');
    const onError = vi.fn();
    await expect(
      service.run({ model: 'm', content: '  ', onError })
    ).rejects.toThrow(/No text found/);
    expect(onError).toHaveBeenCalled();
  });

  it('throws when model missing', async () => {
    await expect(
      service.run({ content: 'text' })
    ).rejects.toThrow(/No model selected/);
  });

  it('throws when prompt missing', async () => {
    await expect(
      service.run({ model: 'm', content: 'text', promptType: 'unknown' })
    ).rejects.toThrow(/Invalid or missing prompt/);
  });

  it('supports vision: image without text content', async () => {
    const image = 'data:image/jpeg;base64,abc';
    await service.run({ model: 'vision', image });
    const userContent = deps.llmAdapter.streamChat.mock.calls[0][2];
    expect(Array.isArray(userContent)).toBe(true);
    expect(userContent[0]).toEqual({ type: 'text', text: 'Analyze this image.' });
    expect(userContent[1]).toEqual({
      type: 'image_url',
      image_url: { url: image },
    });
  });

  it('vision uses provided content as text part', async () => {
    await service.run({
      model: 'vision',
      content: 'Describe',
      image: 'data:image/png;base64,xx',
    });
    const userContent = deps.llmAdapter.streamChat.mock.calls[0][2];
    expect(userContent[0].text).toBe('Describe');
  });

  it('returns empty string on AbortError', async () => {
    deps.llmAdapter.streamChat.mockImplementation(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });
    const result = await service.run({ model: 'm', content: 'x' });
    expect(result).toBe('');
  });

  it('abort() cancels in-flight run', async () => {
    let resolveStream;
    deps.llmAdapter.streamChat.mockImplementation(
      (_m, _p, _c, _oc, _or, signal) =>
        new Promise((resolve, reject) => {
          resolveStream = resolve;
          signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        })
    );
    const p = service.run({ model: 'm', content: 'x' });
    // allow run to start
    await Promise.resolve();
    service.abort();
    await expect(p).resolves.toBe('');
    resolveStream?.('late');
  });

  it('passes onReasoning through', async () => {
    const onReasoning = vi.fn();
    deps.llmAdapter.streamChat.mockImplementation(
      async (_m, _p, _c, onContent, onR) => {
        onR?.('think');
        onContent?.('answer');
        return 'thinkanswer';
      }
    );
    await service.run({ model: 'm', content: 'x', onReasoning });
    expect(onReasoning).toHaveBeenCalledWith('think');
  });
});
