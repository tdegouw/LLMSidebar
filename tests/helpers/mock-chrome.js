/**
 * Minimal chrome.* mock for adapter unit tests.
 */
export function installChromeMock(overrides = {}) {
  const listeners = [];

  const chromeMock = {
    runtime: {
      getURL: (path) => `chrome-extension://test-id/${path}`,
      sendMessage: async () => undefined,
      onMessage: {
        addListener(fn) {
          listeners.push(fn);
        },
        removeListener(fn) {
          const i = listeners.indexOf(fn);
          if (i >= 0) listeners.splice(i, 1);
        },
        _emit(message, sender = {}, sendResponse = () => {}) {
          for (const fn of [...listeners]) {
            fn(message, sender, sendResponse);
          }
        },
        _listeners: listeners,
      },
      ...(overrides.runtime || {}),
    },
    sidePanel: {
      open: async () => undefined,
      ...(overrides.sidePanel || {}),
    },
    tabs: {
      query: async () => [],
      ...(overrides.tabs || {}),
    },
    scripting: {
      executeScript: async () => [{ result: '' }],
      ...(overrides.scripting || {}),
    },
    ...(overrides.root || {}),
  };

  globalThis.chrome = chromeMock;
  return chromeMock;
}

export function uninstallChromeMock() {
  delete globalThis.chrome;
}
