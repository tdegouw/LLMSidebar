import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createThemeController } from '../../ui/theme-controller.js';

describe('createThemeController', () => {
  beforeEach(() => {
    document.body.innerHTML = `<button id="themeToggle"></button>`;
    document.body.removeAttribute('data-theme');
  });

  it('requires themeService', () => {
    expect(() => createThemeController({})).toThrow(/themeService/);
  });

  it('initialize applies theme and icon for dark', () => {
    const themeService = {
      initialize: vi.fn(() => 'dark'),
      toggleTheme: vi.fn(() => 'light'),
    };
    createThemeController({ themeService }).initialize();
    expect(document.body.getAttribute('data-theme')).toBe('dark');
    expect(document.getElementById('themeToggle').textContent).toBe('🌙');
  });

  it('initialize applies light icon', () => {
    const themeService = {
      initialize: vi.fn(() => 'light'),
      toggleTheme: vi.fn(() => 'dark'),
    };
    createThemeController({ themeService }).initialize();
    expect(document.body.getAttribute('data-theme')).toBe('light');
    expect(document.getElementById('themeToggle').textContent).toBe('☀️');
  });

  it('click toggles theme via service and updates DOM', () => {
    const themeService = {
      initialize: vi.fn(() => 'dark'),
      toggleTheme: vi.fn(() => 'light'),
    };
    createThemeController({ themeService }).initialize();
    document.getElementById('themeToggle').click();
    expect(themeService.toggleTheme).toHaveBeenCalled();
    expect(document.body.getAttribute('data-theme')).toBe('light');
    expect(document.getElementById('themeToggle').textContent).toBe('☀️');
  });
});
