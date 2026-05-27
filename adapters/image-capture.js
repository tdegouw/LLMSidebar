/**
 * Image Capture Adapter.
 *
 * Responsible for capturing images from web pages and converting them
 * into base64 data URLs suitable for sending to vision LLMs.
 *
 * Uses chrome.scripting to reliably access image data directly from the
 * page context (avoids CORS and hotlinking issues that would occur from
 * background fetch).
 *
 * Designed to be small, focused, and reusable for future vision features.
 */

const MAX_DIMENSION = 1280; // Reasonable max for most local vision models
const JPEG_QUALITY = 0.85;

/**
 * @typedef {Object} ImageCapture
 * @property {(tabId: number, srcUrl: string) => Promise<string>} captureImage
 *   Captures either an <img> or a <video> (including .webm) element and returns a JPEG data URL.
 */

/**
 * Creates the image capture adapter.
 * @returns {ImageCapture}
 */
export function createImageCapture() {
  /**
   * Captures the image or video frame at srcUrl from the given tab.
   * Returns a JPEG data URL (downscaled if necessary).
   */
  async function captureImage(tabId, srcUrl) {
    if (!tabId || !srcUrl) {
      throw new Error('tabId and srcUrl are required to capture an image');
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: captureImageInPage,
        args: [srcUrl, MAX_DIMENSION, JPEG_QUALITY],
      });

      const injectionResult = results?.[0];

      // When the injected function rejects or throws, Chrome reports it here
      // instead of putting a value in .result.
      if (injectionResult?.error) {
        const errMsg = injectionResult.error.message || 'Unknown error during capture in page';
        throw new Error(errMsg);
      }

      const dataUrl = injectionResult?.result;

      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
        throw new Error('Failed to capture image data from page');
      }

      return dataUrl;
    } catch (error) {
      console.error('[image-capture] Failed to capture image:', error);
      throw new Error(`Could not capture image: ${error.message}`);
    }
  }

  return {
    captureImage,
  };
}

/**
 * This function runs in the page context via chrome.scripting.
 * It locates the target <img> or <video>, captures it (using a CORS-safe reload
 * for images), optionally downscales it, and returns a JPEG data URL.
 */
function captureImageInPage(srcUrl, maxDimension, quality) {
  return new Promise(async (resolve, reject) => {
    try {
      // Robust finder for <img> elements. The srcUrl from context menu frequently
      // does not exactly match the DOM element's src/currentSrc (srcset, <picture>,
      // query strings, lazy loading, CDNs). This is especially common with PNGs.
      function findImageElement(targetUrl) {
        // Fast path: exact match on currentSrc (best for responsive images)
        for (const img of document.images) {
          if (img.currentSrc === targetUrl || img.src === targetUrl) {
            return img;
          }
        }

        // Handle <picture> elements (very common for modern PNG + WebP/AVIF setups)
        for (const picture of document.querySelectorAll('picture')) {
          const img = picture.querySelector('img');
          if (!img) continue;
          if (img.currentSrc === targetUrl || img.src === targetUrl) {
            return img;
          }
          for (const source of picture.querySelectorAll('source')) {
            if (source.srcset && source.srcset.includes(targetUrl)) {
              return img;
            }
          }
        }

        // Tolerant fallback: match by pathname only (ignores cache-busters, width params, etc.)
        try {
          const target = new URL(targetUrl, location.href);
          const targetPath = target.pathname;
          for (const img of document.images) {
            try {
              const imgUrl = new URL(img.currentSrc || img.src, location.href);
              if (imgUrl.pathname === targetPath) {
                return img;
              }
            } catch {}
          }
        } catch {}

        return null;
      }

      // 1. Try to find an <img> element
      let element = findImageElement(srcUrl);

      // 2. If not found, try to find a <video> element (common for .webm, .mp4 "images")
      if (!element) {
        const videos = Array.from(document.querySelectorAll('video'));
        element = videos.find(v =>
          v.src === srcUrl ||
          v.currentSrc === srcUrl ||
          Array.from(v.querySelectorAll('source')).some(s => s.src === srcUrl)
        );
      }

      if (!element) {
        reject(new Error('Could not find a matching image or video element on the page'));
        return;
      }

      const isVideo = element.tagName === 'VIDEO';

      // Dimensions: for video we must use the live element to capture the current frame.
      // For images we take an initial reading but will use the freshly loaded version.
      let naturalWidth, naturalHeight;

      if (isVideo) {
        naturalWidth = element.videoWidth || element.clientWidth;
        naturalHeight = element.videoHeight || element.clientHeight;
      } else {
        // Initial size estimate only — the actual draw uses the freshly CORS-loaded image.
        naturalWidth = element.naturalWidth || element.width;
        naturalHeight = element.naturalHeight || element.height;
      }

      let width = naturalWidth;
      let height = naturalHeight;

      // Downscale if necessary while preserving aspect ratio
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d', { alpha: false });

      if (isVideo) {
        // For video (including .webm), draw the current frame from the page element.
        // This is the only reliable way to capture the exact frame the user right-clicked.
        const drawFrame = () => {
          ctx.drawImage(element, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };

        if (element.readyState >= 2) {
          if (element.currentTime < 0.1 && element.duration > 0.5) {
            const originalTime = element.currentTime;
            const onSeeked = () => {
              element.removeEventListener('seeked', onSeeked);
              drawFrame();
              element.currentTime = originalTime;
            };
            element.addEventListener('seeked', onSeeked, { once: true });
            element.currentTime = Math.min(0.1, element.duration / 4);
          } else {
            drawFrame();
          }
        } else {
          const onLoaded = () => {
            element.removeEventListener('loadeddata', onLoaded);
            drawFrame();
          };
          element.addEventListener('loadeddata', onLoaded, { once: true });
          if (element.readyState === 0) element.load();
        }
      } else {
        // Images: always load via a fresh CORS-enabled copy of the image.
        // This is the most reliable method for cross-origin CDN images.
        const img = new Image();
        img.crossOrigin = 'anonymous';

        try {
          await new Promise((res, rej) => {
            const timeoutId = setTimeout(() => {
              rej(new Error('Image load timed out'));
            }, 8000);

            img.onload = () => {
              clearTimeout(timeoutId);
              res();
            };
            img.onerror = () => {
              clearTimeout(timeoutId);
              rej(new Error('Failed to load the image (possible CORS restriction)'));
            };
            img.src = srcUrl;
          });
        } catch (loadErr) {
          reject(loadErr);
          return;
        }

        // Use dimensions from the freshly loaded (CORS) image
        let finalWidth = img.naturalWidth || img.width;
        let finalHeight = img.naturalHeight || img.height;

        if (!finalWidth || !finalHeight) {
          reject(new Error('Image has no usable dimensions'));
          return;
        }

        // Downscale if needed (re-apply using final loaded size)
        if (finalWidth > maxDimension || finalHeight > maxDimension) {
          const ratio = Math.min(maxDimension / finalWidth, maxDimension / finalHeight);
          finalWidth = Math.floor(finalWidth * ratio);
          finalHeight = Math.floor(finalHeight * ratio);
        }

        // Resize canvas if the loaded image differs from our initial estimate
        if (canvas.width !== finalWidth || canvas.height !== finalHeight) {
          canvas.width = finalWidth;
          canvas.height = finalHeight;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      }
    } catch (err) {
      reject(err);
    }
  });
}