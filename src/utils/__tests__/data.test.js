// ============================================
// Data Utilities — Unit Tests
// Tests: haversine, case conversion, formatting
// ============================================
import { describe, it, expect, beforeEach } from 'vitest';
import { getDistance, formatEventDate, formatDateShort } from '../data';

describe('Data Utilities', () => {
  describe('getDistance (Haversine)', () => {
    it('returns 0 for same coordinates', () => {
      expect(getDistance(12.9716, 77.5946, 12.9716, 77.5946)).toBe(0);
    });

    it('calculates distance between Bangalore locations', () => {
      // MG Road to Whitefield (~16 km)
      const dist = getDistance(12.9716, 77.5946, 12.9698, 77.7500);
      expect(dist).toBeGreaterThan(14);
      expect(dist).toBeLessThan(18);
    });

    it('calculates long distance correctly', () => {
      // Bangalore to Chennai (~290 km)
      const dist = getDistance(12.9716, 77.5946, 13.0827, 80.2707);
      expect(dist).toBeGreaterThan(280);
      expect(dist).toBeLessThan(310);
    });

    it('is symmetric (a→b equals b→a)', () => {
      const d1 = getDistance(12.9716, 77.5946, 13.0827, 80.2707);
      const d2 = getDistance(13.0827, 80.2707, 12.9716, 77.5946);
      expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
    });
  });

  describe('formatEventDate', () => {
    it('formats valid ISO datetime', () => {
      const formatted = formatEventDate('2026-06-15T14:30');
      expect(formatted).toContain('15');
      expect(formatted).toContain('Jun');
      expect(formatted).toContain('2026');
    });

    it('returns fallback for undefined input', () => {
      expect(formatEventDate(undefined)).toBe('Date not set');
      expect(formatEventDate(null)).toBe('Date not set');
    });

    it('returns string for invalid date', () => {
      const result = formatEventDate('not-a-date');
      expect(typeof result).toBe('string');
    });
  });

  describe('formatDateShort', () => {
    it('formats valid date string', () => {
      const formatted = formatDateShort('2026-06-15');
      expect(formatted).toContain('15');
      expect(formatted).toContain('Jun');
      expect(formatted).toContain('2026');
    });

    it('returns N/A for empty input', () => {
      expect(formatDateShort('')).toBe('N/A');
      expect(formatDateShort(null)).toBe('N/A');
      expect(formatDateShort(undefined)).toBe('N/A');
    });
  });
});
