import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createConfigService } from '../../services/config-service.js';
import { createMockStorage } from '../helpers/mock-storage.js';

const DEFAULT_PROMPTS = {
  summarize: 'Summarize in ${lang}.',
};
const DEFAULT_LANGS = { en: 'English', nl: 'Dutch' };

function createDeps(storage) {
  return {
    storage,
    configResources: {
      loadSystemPrompts: async () => ({ ...DEFAULT_PROMPTS }),
      loadLanguages: async () => ({ ...DEFAULT_LANGS }),
    },
  };
}

describe('createConfigService', () => {
  let storage;
  let service;

  beforeEach(async () => {
    storage = createMockStorage();
    service = createConfigService(createDeps(storage));
    await service.initialize();
  });

  it('throws without storage', () => {
    expect(() =>
      createConfigService({
        configResources: createDeps(storage).configResources,
      })
    ).toThrow(/storage/);
  });

  it('throws without configResources', () => {
    expect(() => createConfigService({ storage })).toThrow(/configResources/);
  });

  it('exposes default temperature/maxLen config', () => {
    const cfg = service.getConfig();
    expect(cfg.maxLen).toBe(8000);
    expect(cfg.temperature).toBe(0.6);
    expect(cfg.temperatureHigh).toBe(0.8);
    expect(cfg.temperatureThreshold).toBe(1000);
  });

  it('merges stored config on initialize', async () => {
    storage.set('llmSidebarConfig', { maxLen: 4000, temperature: 0.1 });
    const s2 = createConfigService(createDeps(storage));
    await s2.initialize();
    const cfg = s2.getConfig();
    expect(cfg.maxLen).toBe(4000);
    expect(cfg.temperature).toBe(0.1);
    expect(cfg.temperatureHigh).toBe(0.8);
  });

  it('updateConfig merges and persists', () => {
    service.updateConfig({ maxLen: 12000 });
    expect(service.getConfig().maxLen).toBe(12000);
    expect(storage.get('llmSidebarConfig').maxLen).toBe(12000);
  });

  it('getConfig returns a shallow copy', () => {
    const a = service.getConfig();
    a.maxLen = 1;
    expect(service.getConfig().maxLen).toBe(8000);
  });

  it('getPrompt uses current language by default', () => {
    expect(service.getPrompt('summarize')).toBe('Summarize in English.');
  });

  it('getPrompt accepts explicit language', () => {
    expect(service.getPrompt('summarize', 'Dutch')).toBe('Summarize in Dutch.');
  });

  it('delegates language APIs', () => {
    expect(service.getAllLangs()).toEqual(DEFAULT_LANGS);
    service.setCurrentLanguage('Dutch');
    expect(service.getCurrentLanguage()).toBe('Dutch');
    service.saveSelectedLanguage('nl');
    expect(storage.get('selectedLang')).toBe('nl');
    service.addCustomLang('pl', 'Polish');
    expect(service.getCustomLangs().pl).toBe('Polish');
    service.removeCustomLang('pl');
    expect(service.getCustomLangs().pl).toBeUndefined();
  });

  it('delegates prompt APIs', () => {
    service.saveCustomPrompt('summarize', 'Custom ${lang}');
    expect(service.isPromptCustomized('summarize')).toBe(true);
    expect(service.getPrompt('summarize', 'X')).toBe('Custom X');
    expect(service.getPromptKeys()).toContain('summarize');
    expect(service.getDefaultPrompts().summarize).toContain('${lang}');
    service.removeCustomPrompt('summarize');
    expect(service.isPromptCustomized('summarize')).toBe(false);
  });

  it('resetAllToDefaults clears storage and restores defaults', () => {
    service.updateConfig({ maxLen: 1 });
    service.addCustomLang('pl', 'Polish');
    service.saveCustomPrompt('summarize', 'X');
    const clearSpy = vi.spyOn(storage, 'clearAll');
    service.resetAllToDefaults();
    expect(clearSpy).toHaveBeenCalled();
    expect(service.getConfig().maxLen).toBe(8000);
    expect(service.getCurrentLanguage()).toBe('English');
    expect(service.getCustomLangs()).toEqual({});
  });
});
