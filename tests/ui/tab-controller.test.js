import { describe, it, expect, beforeEach } from 'vitest';
import { createTabController } from '../../ui/tab-controller.js';

describe('createTabController', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button class="tab" data-tab="output">Output</button>
      <button class="tab" data-tab="config">Config</button>
      <div id="output" class="tab-content"></div>
      <div id="config" class="tab-content"></div>
    `;
  });

  it('initialize activates default tab', () => {
    const ctrl = createTabController();
    ctrl.initialize('output');
    expect(ctrl.getCurrentTab()).toBe('output');
    expect(document.querySelector('[data-tab="output"]').classList.contains('active')).toBe(true);
    expect(document.getElementById('output').classList.contains('active')).toBe(true);
    expect(document.querySelector('[data-tab="config"]').classList.contains('active')).toBe(false);
  });

  it('switchTo changes active tab', () => {
    const ctrl = createTabController();
    ctrl.initialize('output');
    ctrl.switchTo('config');
    expect(ctrl.getCurrentTab()).toBe('config');
    expect(document.getElementById('config').classList.contains('active')).toBe(true);
    expect(document.getElementById('output').classList.contains('active')).toBe(false);
  });

  it('click handler switches tabs', () => {
    const ctrl = createTabController();
    ctrl.initialize('output');
    document.querySelector('[data-tab="config"]').click();
    expect(ctrl.getCurrentTab()).toBe('config');
  });

  it('switchTo ignores unknown tab id', () => {
    const ctrl = createTabController();
    ctrl.initialize('output');
    ctrl.switchTo('missing');
    expect(ctrl.getCurrentTab()).toBe('output');
  });

  it('falls back to first tab when default missing', () => {
    const ctrl = createTabController();
    ctrl.initialize('nope');
    expect(ctrl.getCurrentTab()).toBe('output');
  });
});
