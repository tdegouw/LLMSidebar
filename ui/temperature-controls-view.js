/**
 * Temperature Controls View
 *
 * Owns the general configuration inputs in the Config tab:
 * - maxLenInput
 * - temperatureInput, temperatureHighInput, temperatureThresholdInput
 *
 * Responsibilities:
 * - Filling the inputs with current config values
 * - Live saving when the user changes the values
 *
 * This is a focused sub-view. It is created and coordinated by ConfigView.
 */

export function createTemperatureControlsView(deps = {}) {
  const { configService } = deps;

  const elements = {
    maxLenInput: document.getElementById('maxLenInput'),
    temperatureInput: document.getElementById('temperatureInput'),
    temperatureHighInput: document.getElementById('temperatureHighInput'),
    temperatureThresholdInput: document.getElementById('temperatureThresholdInput'),
  };

  function _fillValues() {
    const cfg = configService?.getConfig?.() || {};
    if (elements.maxLenInput) elements.maxLenInput.value = cfg.maxLen ?? 8000;
    if (elements.temperatureInput) elements.temperatureInput.value = cfg.temperature ?? 0.6;
    if (elements.temperatureThresholdInput) elements.temperatureThresholdInput.value = cfg.temperatureThreshold ?? 1000;
    if (elements.temperatureHighInput) elements.temperatureHighInput.value = cfg.temperatureHigh ?? 0.8;
  }

  function _wireLiveSave() {
    const configInputs = [
      elements.maxLenInput,
      elements.temperatureInput,
      elements.temperatureHighInput,
      elements.temperatureThresholdInput,
    ];

    configInputs.forEach(input => {
      input?.addEventListener('input', () => {
        if (!configService) return;

        const current = configService.getConfig?.() || {};
        const updated = {
          ...current,
          maxLen: parseInt(elements.maxLenInput?.value) || current.maxLen,
          temperature: parseFloat(elements.temperatureInput?.value) || current.temperature,
          temperatureHigh: parseFloat(elements.temperatureHighInput?.value) || current.temperatureHigh,
          temperatureThreshold: parseInt(elements.temperatureThresholdInput?.value) || current.temperatureThreshold,
        };
        configService.updateConfig?.(updated);
      });
    });
  }

  function wire() {
    _wireLiveSave();
  }

  function refresh() {
    _fillValues();
  }

  return {
    wire,
    refresh,
  };
}
