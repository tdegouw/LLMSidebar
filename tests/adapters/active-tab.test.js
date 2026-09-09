import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createActiveTabProvider } from '../../adapters/active-tab.js';
import { installChromeMock, uninstallChromeMock } from '../helpers/mock-chrome.js';

describe('createActiveTabProvider', () => {
  afterEach(() => {
    uninstallChromeMock();
  });

  it('returns active tab id', async () => {
    installChromeMock({
      tabs: {
        query: vi.fn(async () => [{ id: 55, active: true }]),
      },
    });
    const provider = createActiveTabProvider();
    expect(await provider.getActiveTabId()).toBe(55);
    expect(chrome.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
  });

  it('returns null when no tab', async () => {
    installChromeMock({
      tabs: { query: vi.fn(async () => []) },
    });
    expect(await createActiveTabProvider().getActiveTabId()).toBeNull();
  });

  it('returns null when query throws', async () => {
    installChromeMock({
      tabs: {
        query: vi.fn(async () => {
          throw new Error('no permission');
        }),
      },
    });
    expect(await createActiveTabProvider().getActiveTabId()).toBeNull();
  });
});
