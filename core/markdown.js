/**
 * Secure Markdown → HTML converter.
 * Designed for LLM output (not full CommonMark).
 * Always escapes HTML first to prevent XSS.
 */

/**
 * Escapes a value for safe use inside an HTML attribute (double-quoted).
 * @param {string} value
 * @returns {string}
 */
function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Allowlist-checks a markdown link href.
 * Permits http:, https:, and same-document #anchors only.
 * Blocks javascript:, data:, vbscript:, protocol-relative URLs, and junk.
 *
 * @param {string} rawHref
 * @returns {string|null} Safe href, or null if disallowed
 */
function sanitizeHref(rawHref) {
  if (!rawHref || typeof rawHref !== 'string') return null;

  const href = rawHref.trim();
  if (!href) return null;

  // Reject control characters / whitespace that can aid attribute breakout
  if (/[\u0000-\u001F\u007F\s]/.test(href)) return null;

  // Same-document fragment anchors (e.g. #section)
  if (href.startsWith('#')) {
    return href;
  }

  const lower = href.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return null;
  }

  // Protocol-relative URLs (//evil.example) — not allowlisted
  if (href.startsWith('//')) return null;

  try {
    const parsed = new URL(href);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Builds a safe <a> tag, or falls back to plain (already-escaped) link text.
 * @param {string} text - Link text (already HTML-escaped by the pipeline)
 * @param {string} rawHref
 * @returns {string}
 */
function renderSafeLink(text, rawHref) {
  const safeHref = sanitizeHref(rawHref);
  if (!safeHref) {
    return text;
  }
  const attrHref = escapeHtmlAttribute(safeHref);
  return `<a href="${attrHref}" target="_blank" rel="noopener noreferrer">${text}</a>`;
}

/**
 * Converts markdown text to safe HTML.
 * Supports: headings, bold, italic, links, inline code, code blocks,
 * unordered/ordered lists, blockquotes, horizontal rules, paragraphs.
 *
 * @param {string} markdown
 * @returns {string}
 */
export function markdownToHtml(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  let html = markdown
    // Escape HTML first (XSS protection)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

    // Headings (h1-h3)
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')

    // Bold & Italic (order matters: ** before *)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')

    // Links — allowlisted schemes + attribute-safe href building
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => renderSafeLink(text, href))

    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')

    // Code blocks (```lang\ncode\n```)
    .replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>')

    // Unordered lists
    .replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/gs, '<ul>$1</ul>')

    // Ordered lists
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/gs, '<ol>$1</ol>')

    // Blockquotes
    .replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>')

    // Horizontal rule
    .replace(/^---$/gm, '<hr>')

    // Paragraphs (simple but effective)
    .replace(/\n\s*\n/g, '</p><p>')
    .replace(/^(.+?)$/gm, (match) => {
      if (!/^<\/?(h[1-6]|ul|ol|li|pre|blockquote|hr)/.test(match)) {
        return `<p>${match}</p>`;
      }
      return match;
    });

  // Cleanup empty paragraphs
  html = html.replace(/<p><\/p>/g, '');

  return html.trim();
}
