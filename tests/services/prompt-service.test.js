import { describe, it, expect, beforeEach } from 'vitest';
import { createPromptService } from '../../services/prompt-service.js';
import { createMockStorage } from '../helpers/mock-storage.js';

const DEFAULT_PROMPTS = {
  summarize: 'Summarize in ${lang}.',
  explain: 'Explain in ${lang}.',
};

function createConfigResources(prompts = DEFAULT_PROMPTS) {
  return {
    loadSystemPrompts: async () => ({ ...prompts }),
    loadLanguages: async () => ({ en: 'English' }),
  };
}

describe('createPromptService', () => {
  let storage;
  let service;

  beforeEach(async () => {
    storage = createMockStorage();
    service = createPromptService({
      storage,
      configResources: createConfigResources(),
    });
    await service.initialize();
  });

  it('caches default prompts in storage on first load', () => {
    expect(storage.get('defaultPrompts')).toEqual(DEFAULT_PROMPTS);
  });

  it('does not overwrite cached defaults if already present', async () => {
    storage.set('defaultPrompts', { summarize: 'cached' });
    const s2 = createPromptService({
      storage,
      configResources: createConfigResources(),
    });
    await s2.initialize();
    expect(storage.get('defaultPrompts')).toEqual({ summarize: 'cached' });
  });

  it('getPrompt interpolates language', () => {
    expect(service.getPrompt('summarize', 'Dutch')).toBe('Summarize in Dutch.');
  });

  it('getPrompt returns empty for unknown type', () => {
    expect(service.getPrompt('missing', 'English')).toBe('');
  });

  it('getPromptKeys returns default keys', () => {
    expect(service.getPromptKeys()).toEqual(['summarize', 'explain']);
  });

  it('getDefaultPrompts returns a copy', () => {
    const d = service.getDefaultPrompts();
    d.summarize = 'mutated';
    expect(service.getDefaultPrompts().summarize).toBe('Summarize in ${lang}.');
  });

  it('saveCustomPrompt overrides template', () => {
    service.saveCustomPrompt('summarize', 'Custom ${lang}');
    expect(service.getPrompt('summarize', 'French')).toBe('Custom French');
    expect(service.isPromptCustomized('summarize')).toBe(true);
    expect(service.getCustomPrompts().summarize).toBe('Custom ${lang}');
  });

  it('removeCustomPrompt restores default', () => {
    service.saveCustomPrompt('explain', 'X ${lang}');
    service.removeCustomPrompt('explain');
    expect(service.isPromptCustomized('explain')).toBe(false);
    expect(service.getPrompt('explain', 'English')).toBe('Explain in English.');
  });

  it('isPromptCustomized is false for untouched keys', () => {
    expect(service.isPromptCustomized('summarize')).toBe(false);
  });

  it('getCustomPrompts returns empty object when none', () => {
    expect(service.getCustomPrompts()).toEqual({});
  });

  it('reset is a no-op callable (storage cleared by caller)', () => {
    expect(() => service.reset()).not.toThrow();
  });
});
