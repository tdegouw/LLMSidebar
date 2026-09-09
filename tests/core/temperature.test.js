import { describe, it, expect } from 'vitest';
import {
  resolveTemperature,
  DEFAULT_TEMPERATURE_CONFIG,
} from '../../core/temperature.js';

describe('DEFAULT_TEMPERATURE_CONFIG', () => {
  it('exposes expected defaults', () => {
    expect(DEFAULT_TEMPERATURE_CONFIG.temperature).toBe(0.6);
    expect(DEFAULT_TEMPERATURE_CONFIG.temperatureHigh).toBe(0.8);
    expect(DEFAULT_TEMPERATURE_CONFIG.temperatureThreshold).toBe(1000);
  });
});

describe('resolveTemperature', () => {
  it('returns low temp when content is at or below threshold', () => {
    expect(resolveTemperature(0)).toBe(0.6);
    expect(resolveTemperature(1000)).toBe(0.6);
    expect(resolveTemperature(500)).toBe(0.6);
  });

  it('returns high temp when content exceeds threshold', () => {
    expect(resolveTemperature(1001)).toBe(0.8);
    expect(resolveTemperature(50000)).toBe(0.8);
  });

  it('uses custom temperature values', () => {
    const cfg = { temperature: 0.2, temperatureHigh: 0.9, temperatureThreshold: 100 };
    expect(resolveTemperature(50, cfg)).toBe(0.2);
    expect(resolveTemperature(101, cfg)).toBe(0.9);
  });

  it('falls back missing fields to defaults', () => {
    expect(resolveTemperature(50, { temperature: 0.3 })).toBe(0.3);
    expect(resolveTemperature(2000, { temperatureHigh: 1.0 })).toBe(1.0);
    expect(resolveTemperature(150, { temperatureThreshold: 100 })).toBe(0.8);
  });

  it('treats empty config as defaults', () => {
    expect(resolveTemperature(10, {})).toBe(0.6);
    expect(resolveTemperature(2000, {})).toBe(0.8);
  });

  it('uses defaults when config omitted', () => {
    expect(resolveTemperature(10)).toBe(0.6);
  });

  it('treats null config as defaults', () => {
    expect(resolveTemperature(10, null)).toBe(0.6);
    expect(resolveTemperature(2000, null)).toBe(0.8);
  });
});
