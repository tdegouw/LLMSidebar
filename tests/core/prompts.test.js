import { describe, it, expect } from 'vitest';
import { createPromptFunction, formatPromptKey } from '../../core/prompts.js';

describe('createPromptFunction', () => {
  it('replaces ${lang} with provided language', () => {
    const fn = createPromptFunction('Reply in ${lang}.');
    expect(fn('Dutch')).toBe('Reply in Dutch.');
  });

  it('defaults lang to English', () => {
    const fn = createPromptFunction('Speak ${lang}');
    expect(fn()).toBe('Speak English');
  });

  it('replaces multiple ${lang} occurrences', () => {
    const fn = createPromptFunction('${lang} then ${lang}');
    expect(fn('French')).toBe('French then French');
  });

  it('returns empty string factory for null template', () => {
    expect(createPromptFunction(null)('x')).toBe('');
  });

  it('returns empty string factory for undefined template', () => {
    expect(createPromptFunction(undefined)()).toBe('');
  });

  it('returns empty string factory for non-string', () => {
    expect(createPromptFunction(123)('en')).toBe('');
  });

  it('returns empty string factory for empty string', () => {
    expect(createPromptFunction('')('en')).toBe('');
  });

  it('leaves templates without placeholder unchanged', () => {
    const fn = createPromptFunction('No placeholder here');
    expect(fn('Spanish')).toBe('No placeholder here');
  });
});

describe('formatPromptKey', () => {
  it('formats snake_case to Title Case', () => {
    expect(formatPromptKey('code_review')).toBe('Code Review');
  });

  it('formats single word', () => {
    expect(formatPromptKey('summarize')).toBe('Summarize');
  });

  it('returns empty for falsy', () => {
    expect(formatPromptKey('')).toBe('');
    expect(formatPromptKey(null)).toBe('');
    expect(formatPromptKey(undefined)).toBe('');
  });

  it('handles multiple underscores', () => {
    expect(formatPromptKey('explain_like_im_five')).toBe('Explain Like Im Five');
  });
});
