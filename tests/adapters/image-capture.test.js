import { describe, it, expect, afterEach, vi } from 'vitest';
import { createImageCapture } from '../../adapters/image-capture.js';
import { installChromeMock, uninstallChromeMock } from '../helpers/mock-chrome.js';

describe('createImageCapture', () => {
  afterEach(() => {
    uninstallChromeMock();
    vi.restoreAllMocks();
  });

  it('throws when tabId or srcUrl missing', async () => {
    installChromeMock();
    const cap = createImageCapture();
    await expect(cap.captureImage(null, 'https://x')).rejects.toThrow(/required/);
    await expect(cap.captureImage(1, '')).rejects.toThrow(/required/);
  });

  it('returns data URL from scripting result', async () => {
    const dataUrl = 'data:image/jpeg;base64,abc';
    installChromeMock({
      scripting: {
        executeScript: vi.fn(async () => [{ result: dataUrl }]),
      },
    });
    const result = await createImageCapture().captureImage(9, 'https://img/a.png');
    expect(result).toBe(dataUrl);
  });

  it('throws when injection reports error', async () => {
    installChromeMock({
      scripting: {
        executeScript: vi.fn(async () => [
          { error: { message: 'CORS blocked' } },
        ]),
      },
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      createImageCapture().captureImage(1, 'https://img/a.png')
    ).rejects.toThrow(/CORS blocked/);
    errSpy.mockRestore();
  });

  it('throws when result is not an image data URL', async () => {
    installChromeMock({
      scripting: {
        executeScript: vi.fn(async () => [{ result: 'not-an-image' }]),
      },
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      createImageCapture().captureImage(1, 'https://img/a.png')
    ).rejects.toThrow(/Failed to capture image data/);
    errSpy.mockRestore();
  });
});
