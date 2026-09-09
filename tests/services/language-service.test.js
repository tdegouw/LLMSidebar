import { describe, it, expect, beforeEach } from 'vitest';
import { createLanguageService } from '../../services/language-service.js';
import { createMockStorage } from '../helpers/mock-storage.js';

const DEFAULT_LANGS = {
  en: 'English',
  nl: 'Dutch',
  de: 'German',
};

describe('createLanguageService', () => {
  let storage;
  let service;

  beforeEach(async () => {
    storage = createMockStorage();
    service = createLanguageService({
      storage,
      loadLanguages: async () => ({ ...DEFAULT_LANGS }),
    });
    await service.initialize();
  });

  it('loads default languages', () => {
    expect(service.getAll()).toEqual(DEFAULT_LANGS);
  });

  it('defaults current language to English (first/selected)', () => {
    expect(service.getCurrent()).toBe('English');
  });

  it('restores selected language from storage', async () => {
    storage.set('selectedLang', 'nl');
    const s2 = createLanguageService({
      storage,
      loadLanguages: async () => ({ ...DEFAULT_LANGS }),
    });
    await s2.initialize();
    expect(s2.getCurrent()).toBe('Dutch');
  });

  it('setCurrent updates in-memory language', () => {
    service.setCurrent('German');
    expect(service.getCurrent()).toBe('German');
  });

  it('saveSelected persists code', () => {
    service.saveSelected('de');
    expect(storage.get('selectedLang')).toBe('de');
  });

  it('addCustom lowercases code and persists', () => {
    service.addCustom('SW', 'Swedish');
    expect(service.getCustom()).toEqual({ sw: 'Swedish' });
    expect(storage.get('customLangs')).toEqual({ sw: 'Swedish' });
    expect(service.getAll().sw).toBe('Swedish');
  });

  it('removeCustom deletes and persists', () => {
    service.addCustom('sw', 'Swedish');
    service.removeCustom('SW');
    expect(service.getCustom()).toEqual({});
    expect(service.getAll().sw).toBeUndefined();
  });

  it('custom langs override defaults with same code', () => {
    service.addCustom('en', 'British English');
    expect(service.getAll().en).toBe('British English');
  });

  it('reset clears customs and sets English', () => {
    service.addCustom('sw', 'Swedish');
    service.setCurrent('Dutch');
    service.reset();
    expect(service.getCustom()).toEqual({});
    expect(service.getCurrent()).toBe('English');
  });

  it('loads custom langs from storage on init', async () => {
    storage.set('customLangs', { pl: 'Polish' });
    const s2 = createLanguageService({
      storage,
      loadLanguages: async () => ({ ...DEFAULT_LANGS }),
    });
    await s2.initialize();
    expect(s2.getAll().pl).toBe('Polish');
  });

  it('falls back when saved code is unknown', async () => {
    storage.set('selectedLang', 'xx');
    const s2 = createLanguageService({
      storage,
      loadLanguages: async () => ({ ...DEFAULT_LANGS }),
    });
    await s2.initialize();
    expect(s2.getCurrent()).toBe('English');
  });
});
