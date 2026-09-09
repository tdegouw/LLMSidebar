import { describe, it, expect, beforeEach } from 'vitest';
import { createThemeService } from '../../services/theme-service.js';
import { createMockStorage } from '../helpers/mock-storage.js';

describe('createThemeService', () => {
  let storage;
  let themeService;

  beforeEach(() => {
    storage = createMockStorage();
    themeService = createThemeService(storage);
  });

  it('defaults to dark when nothing stored', () => {
    expect(themeService.getCurrentTheme()).toBe('dark');
  });

  it('reads stored theme', () => {
    storage.set('theme', 'light');
    expect(themeService.getCurrentTheme()).toBe('light');
  });

  it('setTheme normalizes unknown values to dark', () => {
    expect(themeService.setTheme('neon')).toBe('dark');
    expect(storage.get('theme')).toBe('dark');
  });

  it('setTheme accepts light', () => {
    expect(themeService.setTheme('light')).toBe('light');
    expect(storage.get('theme')).toBe('light');
  });

  it('setTheme accepts dark', () => {
    expect(themeService.setTheme('dark')).toBe('dark');
  });

  it('toggleTheme switches dark -> light -> dark', () => {
    expect(themeService.toggleTheme()).toBe('light');
    expect(themeService.toggleTheme()).toBe('dark');
  });

  it('initialize returns current theme', () => {
    storage.set('theme', 'light');
    expect(themeService.initialize()).toBe('light');
  });

  it('initialize defaults to dark', () => {
    expect(themeService.initialize()).toBe('dark');
  });
});
