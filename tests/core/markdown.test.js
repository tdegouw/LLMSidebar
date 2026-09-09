import { describe, it, expect } from 'vitest';
import { markdownToHtml } from '../../core/markdown.js';

describe('markdownToHtml', () => {
  describe('empty / invalid inputs', () => {
    it('returns empty string for null', () => {
      expect(markdownToHtml(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(markdownToHtml(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(markdownToHtml('')).toBe('');
    });

    it('returns empty string for non-string number', () => {
      expect(markdownToHtml(42)).toBe('');
    });

    it('returns empty string for object', () => {
      expect(markdownToHtml({ text: 'hi' })).toBe('');
    });

    it('returns empty string for array', () => {
      expect(markdownToHtml(['# hi'])).toBe('');
    });
  });

  describe('XSS: HTML escaping', () => {
    it('escapes raw HTML tags', () => {
      const html = markdownToHtml('<script>alert(1)</script>');
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;/script&gt;');
    });

    it('escapes angle brackets in text', () => {
      const html = markdownToHtml('a < b > c');
      expect(html).toContain('&lt;');
      expect(html).toContain('&gt;');
    });

    it('escapes ampersands', () => {
      const html = markdownToHtml('Tom & Jerry');
      expect(html).toContain('&amp;');
    });

    it('does not allow img onerror injection', () => {
      const html = markdownToHtml('<img src=x onerror=alert(1)>');
      expect(html).not.toMatch(/<img\b/i);
      expect(html).toContain('&lt;img');
    });

    it('does not allow svg/onload injection', () => {
      const html = markdownToHtml('<svg onload=alert(1)>');
      expect(html).not.toMatch(/<svg\b/i);
    });
  });

  describe('XSS: javascript: / data: / dangerous hrefs', () => {
    it('strips javascript: links (keeps text only)', () => {
      const html = markdownToHtml('[click](javascript:alert(1))');
      expect(html).not.toContain('href=');
      expect(html).not.toContain('javascript:');
      expect(html).toContain('click');
    });

    it('strips javascript: with mixed case', () => {
      const html = markdownToHtml('[x](JaVaScRiPt:alert(1))');
      expect(html).not.toContain('href=');
      expect(html).not.toContain('javascript:');
    });

    it('strips data: URLs', () => {
      const html = markdownToHtml('[x](data:text/html,<script>alert(1)</script>)');
      expect(html).not.toContain('href=');
      expect(html).not.toMatch(/data:/i);
    });

    it('strips vbscript: URLs', () => {
      const html = markdownToHtml('[x](vbscript:msgbox(1))');
      expect(html).not.toContain('href=');
    });

    it('strips file: URLs', () => {
      const html = markdownToHtml('[x](file:///etc/passwd)');
      expect(html).not.toContain('href=');
    });

    it('strips protocol-relative URLs', () => {
      const html = markdownToHtml('[x](//evil.example/path)');
      expect(html).not.toContain('href=');
    });

    it('strips hrefs with whitespace (attribute breakout aid)', () => {
      const html = markdownToHtml('[x](https://example.com/ path)');
      expect(html).not.toContain('href=');
    });

    it('strips hrefs with control characters', () => {
      const html = markdownToHtml('[x](https://example.com/\u0000evil)');
      expect(html).not.toContain('href=');
    });

    it('strips malformed relative paths without scheme', () => {
      const html = markdownToHtml('[x](not-a-url)');
      expect(html).not.toContain('href=');
    });

    it('strips ftp: scheme', () => {
      const html = markdownToHtml('[x](ftp://files.example/a)');
      expect(html).not.toContain('href=');
    });
  });

  describe('XSS: attribute breakout in link href', () => {
    it('percent-encodes quotes in https href so attributes stay intact', () => {
      const html = markdownToHtml('[x](https://example.com/"onclick=alert(1))');
      expect(html).toContain('href="');
      expect(html).toContain('%22');
      expect(html).toMatch(/href="https:\/\/example\.com\/%22[^"]*"/);
      expect(html).not.toContain('"onclick=');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('escapes angle brackets if somehow present in href attribute', () => {
      const html = markdownToHtml('[ok](https://example.com/)');
      expect(html).toContain('href="https://example.com/"');
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain('target="_blank"');
    });
  });

  describe('allowlist: http / https / #anchors', () => {
    it('allows https links', () => {
      const html = markdownToHtml('[Docs](https://example.com/docs)');
      expect(html).toContain('<a href="https://example.com/docs"');
      expect(html).toContain('>Docs</a>');
    });

    it('allows http links', () => {
      const html = markdownToHtml('[Old](http://example.com/)');
      expect(html).toContain('href="http://example.com/"');
    });

    it('allows fragment anchors', () => {
      const html = markdownToHtml('[Jump](#section-1)');
      expect(html).toContain('href="#section-1"');
    });

    it('trims whitespace around href before allowlist check', () => {
      const html = markdownToHtml('[x](  https://example.com/  )');
      expect(html).toContain('href="https://example.com/"');
    });

    it('normalizes https URLs via URL parser', () => {
      const html = markdownToHtml('[x](https://EXAMPLE.com/path)');
      expect(html).toMatch(/href="https:\/\/example\.com\/path"/i);
    });
  });

  describe('headings', () => {
    it('renders h1', () => {
      expect(markdownToHtml('# Title')).toContain('<h1>Title</h1>');
    });

    it('renders h2', () => {
      expect(markdownToHtml('## Sub')).toContain('<h2>Sub</h2>');
    });

    it('renders h3', () => {
      expect(markdownToHtml('### Detail')).toContain('<h3>Detail</h3>');
    });

    it('escapes HTML inside headings', () => {
      const html = markdownToHtml('# <script>x</script>');
      expect(html).toContain('<h1>');
      expect(html).not.toContain('<script>');
    });
  });

  describe('bold and italic', () => {
    it('renders **bold**', () => {
      expect(markdownToHtml('**bold**')).toContain('<strong>bold</strong>');
    });

    it('renders __bold__', () => {
      expect(markdownToHtml('__bold__')).toContain('<strong>bold</strong>');
    });

    it('renders *italic*', () => {
      expect(markdownToHtml('*italic*')).toContain('<em>italic</em>');
    });

    it('renders _italic_', () => {
      expect(markdownToHtml('_italic_')).toContain('<em>italic</em>');
    });

    it('prefers bold over italic for **', () => {
      const html = markdownToHtml('**a** and *b*');
      expect(html).toContain('<strong>a</strong>');
      expect(html).toContain('<em>b</em>');
    });
  });

  describe('lists', () => {
    it('renders unordered list with dash', () => {
      const html = markdownToHtml('- one\n- two');
      expect(html).toContain('<li>one</li>');
      expect(html).toContain('<li>two</li>');
      expect(html).toMatch(/<(ul|ol)>/);
    });

    it('renders unordered list with asterisk', () => {
      const html = markdownToHtml('* alpha\n* beta');
      expect(html).toContain('<li>alpha</li>');
    });

    it('renders ordered list', () => {
      const html = markdownToHtml('1. first\n2. second');
      expect(html).toContain('<li>first</li>');
      expect(html).toContain('<li>second</li>');
    });
  });

  describe('code', () => {
    it('renders inline code', () => {
      expect(markdownToHtml('use `foo()`')).toContain('<code>foo()</code>');
    });

    it('keeps fenced code content escaped (inline-code runs before fences)', () => {
      const md = '```js\nconst x = 1;\n<script>bad()</script>\n```';
      const html = markdownToHtml(md);
      expect(html).toContain('const x = 1;');
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes HTML inside code fences', () => {
      const md = '```\n<script>alert(1)</script>\n```';
      const html = markdownToHtml(md);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('other formatting', () => {
    it('escapes leading > so bare blockquotes become text (escape-first pipeline)', () => {
      const html = markdownToHtml('> quoted');
      expect(html).toContain('&gt; quoted');
      expect(html).not.toContain('<blockquote>');
    });

    it('renders horizontal rules', () => {
      expect(markdownToHtml('---')).toContain('<hr>');
    });

    it('wraps plain paragraphs', () => {
      const html = markdownToHtml('Hello world');
      expect(html).toContain('<p>');
      expect(html).toContain('Hello world');
    });

    it('handles mixed safe content', () => {
      const md = '# Hello\n\n**bold** and [link](https://ok.example)\n\n- a\n- b';
      const html = markdownToHtml(md);
      expect(html).toContain('<h1>Hello</h1>');
      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('href="https://ok.example/"');
      expect(html).toContain('<li>a</li>');
    });
  });
});
