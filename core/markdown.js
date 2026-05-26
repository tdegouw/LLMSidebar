/**
 * Secure Markdown → HTML converter.
 * Designed for LLM output (not full CommonMark).
 * Always escapes HTML first to prevent XSS.
 */

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

    // Links (safe target + rel)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

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
