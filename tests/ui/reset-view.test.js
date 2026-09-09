import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createResetView } from '../../ui/reset-view.js';

describe('createResetView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <button id="resetAllBtn">Reset</button>
      <div id="resetStatus"></div>
    `;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('click resets config and shows status briefly', () => {
    const configService = { resetAllToDefaults: vi.fn() };
    const onReset = vi.fn();
    createResetView({ configService, onReset }).wire();
    document.getElementById('resetAllBtn').click();
    expect(configService.resetAllToDefaults).toHaveBeenCalled();
    expect(onReset).toHaveBeenCalled();
    expect(document.getElementById('resetStatus').classList.contains('show')).toBe(true);
    vi.advanceTimersByTime(2800);
    expect(document.getElementById('resetStatus').classList.contains('show')).toBe(false);
  });
});
