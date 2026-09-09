import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createConfigResources } from '../../adapters/config-resources.js';
import { installChromeMock, uninstallChromeMock } from '../helpers/mock-chrome.js';

describe('createConfigResources', () => {
  let fetchMock;

  beforeEach(() => {
    installChromeMock();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    uninstallChromeMock();
    vi.restoreAllMocks();
  });

  it('loadSystemPrompts fetches extension URL and returns JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ summarize: 'x' }),
    });
    const res = createConfigResources();
    await expect(res.loadSystemPrompts()).resolves.toEqual({ summarize: 'x' });
    expect(fetchMock).toHaveBeenCalledWith(
      'chrome-extension://test-id/config/system-prompts.json'
    );
  });

  it('loadSystemPrompts throws on non-ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404 });
    await expect(createConfigResources().loadSystemPrompts()).rejects.toThrow(
      /Failed to load prompts: 404/
    );
  });

  it('loadLanguages fetches lang.json', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ en: 'English' }),
    });
    await expect(createConfigResources().loadLanguages()).resolves.toEqual({
      en: 'English',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'chrome-extension://test-id/config/lang.json'
    );
  });

  it('loadLanguages throws on non-ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await expect(createConfigResources().loadLanguages()).rejects.toThrow(
      /Failed to load lang.json: 500/
    );
  });
});
