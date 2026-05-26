/**
 * Prompt template handling.
 * Pure functions — no side effects.
 */

/**
 * Creates a prompt generator function from a template string.
 * Replaces ${lang} placeholders with the provided language.
 *
 * @param {string} template - Prompt template (may contain ${lang})
 * @returns {(lang: string) => string} Function that returns the final prompt for a language
 */
export function createPromptFunction(template) {
  if (!template || typeof template !== 'string') {
    return () => '';
  }
  return (lang = 'English') => template.replace(/\${lang}/g, lang);
}

/**
 * Normalizes a raw prompt key into a human-friendly display name.
 * Example: "code_review" → "Code Review"
 *
 * @param {string} key
 * @returns {string}
 */
export function formatPromptKey(key) {
  if (!key) return '';
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
