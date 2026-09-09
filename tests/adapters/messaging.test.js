import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createBackgroundMessaging,
  createSidepanelMessaging,
} from '../../adapters/messaging.js';
import { installChromeMock, uninstallChromeMock } from '../helpers/mock-chrome.js';

describe('createBackgroundMessaging', () => {
  let chromeMock;
  let messaging;

  beforeEach(() => {
    chromeMock = installChromeMock({
      sidePanel: { open: vi.fn(async () => undefined) },
      runtime: {
        sendMessage: vi.fn(async () => undefined),
        getURL: (p) => `chrome-extension://test/${p}`,
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    });
    // re-wire sendMessage on the installed mock
    chromeMock.runtime.sendMessage = vi.fn(async () => undefined);
    chromeMock.sidePanel.open = vi.fn(async () => undefined);
    messaging = createBackgroundMessaging();
  });

  afterEach(() => {
    uninstallChromeMock();
  });

  it('handleContextMenuMessage opens side panel and sends message', async () => {
    await messaging.handleContextMenuMessage(
      { selectionText: 'hi', pageUrl: 'https://a.test' },
      { id: 9 }
    );
    expect(chromeMock.sidePanel.open).toHaveBeenCalledWith({ tabId: 9 });
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LLMsidebarMessage',
        data: expect.objectContaining({
          selectionText: 'hi',
          pageUrl: 'https://a.test',
          tabId: 9,
          messageId: expect.any(String),
        }),
      })
    );
  });

  it('clears pending when sidePanel.open fails', async () => {
    chromeMock.sidePanel.open.mockRejectedValue(new Error('blocked'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await messaging.handleContextMenuMessage(
      { selectionText: 'x', pageUrl: 'https://a' },
      { id: 1 }
    );
    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
    messaging.onSidepanelReady();
    expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('handleImageAnalysisMessage includes imageSrcUrl', async () => {
    await messaging.handleImageAnalysisMessage(
      {
        srcUrl: 'https://cdn.test/a.png',
        pageUrl: 'https://page',
        mediaType: 'image',
      },
      { id: 3 }
    );
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imageSrcUrl: 'https://cdn.test/a.png',
          mediaType: 'image',
          tabId: 3,
        }),
      })
    );
  });

  it('onSidepanelReady re-delivers pending then clears it', async () => {
    // pending is set before open; _send does not clear it — ready re-sends once.
    await messaging.handleContextMenuMessage(
      { selectionText: 'pending', pageUrl: 'https://p' },
      { id: 5 }
    );
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledTimes(1);
    messaging.onSidepanelReady();
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledTimes(2);
    messaging.onSidepanelReady();
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });
});

describe('createSidepanelMessaging', () => {
  let chromeMock;
  let messaging;

  beforeEach(() => {
    chromeMock = installChromeMock();
    chromeMock.runtime.sendMessage = vi.fn(async () => undefined);
    const listeners = [];
    chromeMock.runtime.onMessage = {
      addListener(fn) {
        listeners.push(fn);
      },
      _emit(msg) {
        listeners.forEach((fn) => fn(msg, {}, () => {}));
      },
      _listeners: listeners,
    };
    messaging = createSidepanelMessaging();
  });

  afterEach(() => {
    uninstallChromeMock();
  });

  it('notifyReady sends SIDEPANEL_READY', () => {
    messaging.notifyReady();
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'SIDEPANEL_READY',
    });
  });

  it('on registers handler and delivers matching messages', () => {
    const handler = vi.fn();
    messaging.on('LLMsidebarMessage', handler);
    chromeMock.runtime.onMessage._emit({
      type: 'LLMsidebarMessage',
      data: { x: 1 },
    });
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LLMsidebarMessage' }),
      expect.anything(),
      expect.any(Function)
    );
  });

  it('off removes handler', () => {
    const handler = vi.fn();
    messaging.on('LLMsidebarMessage', handler);
    messaging.off('LLMsidebarMessage', handler);
    chromeMock.runtime.onMessage._emit({ type: 'LLMsidebarMessage' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('processPendingMessage invokes registered handlers', () => {
    const handler = vi.fn();
    messaging.on('LLMsidebarMessage', handler);
    messaging.processPendingMessage({ type: 'LLMsidebarMessage', data: {} });
    expect(handler).toHaveBeenCalled();
  });

  it('processPendingMessage no-ops for null', () => {
    expect(() => messaging.processPendingMessage(null)).not.toThrow();
  });
});
