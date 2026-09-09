import { describe, it, expect, beforeEach } from 'vitest';
import { createHeaderView } from '../../ui/header-view.js';

describe('createHeaderView', () => {
  beforeEach(() => {
    document.body.innerHTML = `<h1 id="modelTitle">LMM Assistant</h1>`;
  });

  it('setModelName updates title', () => {
    const view = createHeaderView();
    view.setModelName('gpt-local');
    expect(document.getElementById('modelTitle').textContent).toBe('gpt-local');
  });

  it('setModelName falls back to default for empty', () => {
    const view = createHeaderView();
    view.setModelName('');
    expect(document.getElementById('modelTitle').textContent).toBe('LMM Assistant');
  });

  it('setModelName no-ops safely when element missing', () => {
    document.body.innerHTML = '';
    expect(() => createHeaderView().setModelName('x')).not.toThrow();
  });
});
