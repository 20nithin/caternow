// ============================================
// Security Utilities — Unit Tests
// Tests: sanitization, escaping, validation
// ============================================
import { describe, it, expect } from 'vitest';
import {
  sanitizeText,
  escapeHtml,
  sanitizePhone,
  isValidPhone,
  validateEventDate,
  safeJsonParse,
  createSubmitGuard,
} from '../security';

describe('Security Utilities', () => {
  describe('sanitizeText', () => {
    it('strips HTML tags', () => {
      expect(sanitizeText('<script>alert("xss")</script>Hello')).toBe('alert("xss")Hello');
    });

    it('strips nested and complex HTML', () => {
      expect(sanitizeText('<div><b>Hello</b> <a href="evil">click</a></div>'))
        .toBe('Hello click');
    });

    it('removes stray angle brackets', () => {
      expect(sanitizeText('a > b < c')).toBe('a  b  c');
    });

    it('trims whitespace', () => {
      expect(sanitizeText('  hello  ')).toBe('hello');
    });

    it('enforces max length', () => {
      const long = 'a'.repeat(600);
      expect(sanitizeText(long, 100).length).toBe(100);
    });

    it('returns empty string for non-strings', () => {
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
      expect(sanitizeText(42)).toBe('');
    });
  });

  describe('escapeHtml', () => {
    it('escapes all HTML special characters', () => {
      expect(escapeHtml('<script>"hello" & \'world\'</script>'))
        .toBe('&lt;script&gt;&quot;hello&quot; &amp; &#x27;world&#x27;&lt;&#x2F;script&gt;');
    });

    it('leaves normal text unchanged', () => {
      expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
    });

    it('returns empty string for non-strings', () => {
      expect(escapeHtml(null)).toBe('');
    });
  });

  describe('sanitizePhone', () => {
    it('extracts digits from mixed input', () => {
      expect(sanitizePhone('+91 987-654-3210')).toBe('9876543210');
    });

    it('takes last 10 digits', () => {
      expect(sanitizePhone('919876543210')).toBe('9876543210');
    });

    it('returns empty for non-strings', () => {
      expect(sanitizePhone(null)).toBe('');
    });
  });

  describe('isValidPhone', () => {
    it('accepts valid Indian mobile numbers', () => {
      expect(isValidPhone('9876543210')).toBe(true);
      expect(isValidPhone('6123456789')).toBe(true);
      expect(isValidPhone('7000000000')).toBe(true);
      expect(isValidPhone('8999999999')).toBe(true);
    });

    it('rejects numbers not starting with 6-9', () => {
      expect(isValidPhone('1234567890')).toBe(false);
      expect(isValidPhone('5234567890')).toBe(false);
      expect(isValidPhone('0234567890')).toBe(false);
    });

    it('rejects wrong length', () => {
      expect(isValidPhone('987654321')).toBe(false);   // 9 digits — too short
      expect(isValidPhone('12345')).toBe(false);        // 5 digits — too short
    });
  });

  describe('validateEventDate', () => {
    it('rejects empty date', () => {
      const result = validateEventDate('');
      expect(result.valid).toBe(false);
    });

    it('rejects past dates', () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      const result = validateEventDate(past);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('future');
    });

    it('rejects dates less than 2 hours away', () => {
      const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min from now
      const result = validateEventDate(soon);
      expect(result.valid).toBe(false);
    });

    it('accepts dates more than 2 hours in the future', () => {
      const future = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(); // 3 hours
      const result = validateEventDate(future);
      expect(result.valid).toBe(true);
    });

    it('rejects dates more than 1 year away', () => {
      const far = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString();
      const result = validateEventDate(far);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('1 year');
    });

    it('rejects invalid date strings', () => {
      const result = validateEventDate('not-a-date');
      expect(result.valid).toBe(false);
    });
  });

  describe('safeJsonParse', () => {
    it('parses valid JSON', () => {
      expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
    });

    it('returns fallback for invalid JSON', () => {
      expect(safeJsonParse('invalid', [])).toEqual([]);
    });

    it('returns null by default for invalid JSON', () => {
      expect(safeJsonParse('invalid')).toBeNull();
    });
  });

  describe('createSubmitGuard', () => {
    it('allows first submit and blocks second', () => {
      const guard = createSubmitGuard();
      expect(guard.trySubmit()).toBe(true);
      expect(guard.trySubmit()).toBe(false);
      expect(guard.isSubmitting()).toBe(true);
    });

    it('allows submit after release', () => {
      const guard = createSubmitGuard();
      guard.trySubmit();
      guard.release();
      expect(guard.trySubmit()).toBe(true);
    });
  });
});
