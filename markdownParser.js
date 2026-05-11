// markdownParser.js 

/**
 * Converts markdown text to HTML.
 * @param {string} markdown - The markdown string to convert.
 * @returns {string} The resulting HTML string.
 */
function markdownToHtml(markdown) {
    if (!markdown || typeof markdown !== 'string') {
        return '';
    }

    let html = markdown
        // Escape HTML first (protect against XSS)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

        // Headings
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')

        // Bold & Italic
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')

        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')

        // Code blocks
        .replace(/```(\w*)\n([\s\S]*?)\n```/g, '<pre><code>$2</code></pre>')

        // Unordered lists: first convert list markers to <li>, then wrap consecutive <li> in <ul>
        // The negative lookahead (?!\s*<li>) ensures we only wrap the last <li> of a group,
        // preventing nested <ul> tags for each item.
        .replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>')
        .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/gs, '<ul>$1</ul>')

        // Ordered lists: same approach as unordered, but wraps in <ol>
        .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')
        .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/gs, '<ol>$1</ol>')

        // Blockquotes
        .replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>')

        // Horizontal rule
        .replace(/^---$/gm, '<hr>')

        // Paragraphs (simple)
        .replace(/\n\s*\n/g, '</p><p>')
        .replace(/^(.+?)$/gm, (match) => {
            if (!/^<\/?(h[1-6]|ul|ol|li|pre|blockquote|hr)/.test(match)) {
                return `<p>${match}</p>`;
            }
            return match;
        });

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');

    return html.trim();
}