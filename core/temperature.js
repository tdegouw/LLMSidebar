/**
 * Temperature resolution logic.
 * Pure function — no side effects, no DOM, no chrome.
 */

/**
 * Default temperature configuration.
 * @type {{ temperature: number, temperatureHigh: number, temperatureThreshold: number }}
 */
export const DEFAULT_TEMPERATURE_CONFIG = {
  temperature: 0.6,
  temperatureHigh: 0.8,
  temperatureThreshold: 1000,
};

/**
 * Resolves which temperature to use based on content length.
 *
 * @param {number} contentLength - Length of the input content in characters
 * @param {object} [config] - Temperature configuration
 * @param {number} [config.temperature] - Base/low temperature
 * @param {number} [config.temperatureHigh] - Temperature for longer content
 * @param {number} [config.temperatureThreshold] - Character threshold to switch to high temp
 * @returns {number} The temperature to use for the LLM request
 */
export function resolveTemperature(contentLength, config = {}) {
  const cfg = config ?? {};
  const low = cfg.temperature ?? DEFAULT_TEMPERATURE_CONFIG.temperature;
  const high = cfg.temperatureHigh ?? DEFAULT_TEMPERATURE_CONFIG.temperatureHigh;
  const threshold = cfg.temperatureThreshold ?? DEFAULT_TEMPERATURE_CONFIG.temperatureThreshold;

  return contentLength > threshold ? high : low;
}
