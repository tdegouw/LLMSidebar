import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStorage } from '../../adapters/storage.js';

describe('createStorage', () => {
  let storage;

  beforeEach(() => {
    localStorage.clear();
    storage = createStorage();
  });

  it('exposes known keys', () => {
    expect(storage.keys.CONFIG).toBe('llmSidebarConfig');
    expect(storage.keys.THEME).toBe('theme');
    expect(storage.keys.CUSTOM_PROMPTS).toBe('customPrompts');
  });

  it('get returns null for missing key', () => {
    expect(storage.get('missing')).toBeNull();
  });

  it('set then get round-trips objects', () => {
    storage.set('theme', 'light');
    expect(storage.get('theme')).toBe('light');
    storage.set('llmSidebarConfig', { maxLen: 100 });
    expect(storage.get('llmSidebarConfig')).toEqual({ maxLen: 100 });
  });

  it('remove deletes a key', () => {
    storage.set('theme', 'dark');
    storage.remove('theme');
    expect(storage.get('theme')).toBeNull();
  });

  it('clearAll removes known keys only', () => {
    storage.set('theme', 'light');
    storage.set('customPrompts', { a: 1 });
    localStorage.setItem('unrelated', '"keep"');
    storage.clearAll();
    expect(storage.get('theme')).toBeNull();
    expect(storage.get('customPrompts')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('"keep"');
  });

  it('get returns null on invalid JSON', () => {
    localStorage.setItem('broken', '{not-json');
    expect(storage.get('broken')).toBeNull();
  });

  it('set swallows quota errors without throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => storage.set('theme', 'x')).not.toThrow();
    expect(setItemSpy).toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
    setItemSpy.mockRestore();
    spy.mockRestore();
  });
});
