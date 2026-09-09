import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createContentExtractor } from '../../adapters/content-extractor.js';
import { installChromeMock, uninstallChromeMock } from '../helpers/mock-chrome.js';

describe('createContentExtractor', () => {
  afterEach(() => {
    uninstallChromeMock();
    vi.restoreAllMocks();
  });

  it('returns selection when present and truncates to maxLen', async () => {
    const long = 'x'.repeat(50);
    installChromeMock({
      scripting: {
        executeScript: vi.fn(async () => [{ result: long }]),
      },
    });
    const extract = createContentExtractor();
    const result = await extract(1, 10);
    expect(result).toBe('x'.repeat(10));
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
  });

  it('falls back to page content when selection empty', async () => {
    const executeScript = vi
      .fn()
      .mockResolvedValueOnce([{ result: '' }])
      .mockResolvedValueOnce([{ result: 'Main article text' }]);
    installChromeMock({ scripting: { executeScript } });
    const extract = createContentExtractor();
    expect(await extract(2, 8000)).toBe('Main article text');
    expect(executeScript).toHaveBeenCalledTimes(2);
  });

  it('returns empty string when both attempts fail', async () => {
    installChromeMock({
      scripting: {
        executeScript: vi.fn(async () => {
          throw new Error('cannot access');
        }),
      },
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const extract = createContentExtractor();
    expect(await extract(3)).toBe('');
    expect(errSpy).toHaveBeenCalled();
  });

  it('returns empty when page result missing', async () => {
    const executeScript = vi
      .fn()
      .mockResolvedValueOnce([{ result: null }])
      .mockResolvedValueOnce([{}]);
    installChromeMock({ scripting: { executeScript } });
    expect(await createContentExtractor()(4)).toBe('');
  });
});
