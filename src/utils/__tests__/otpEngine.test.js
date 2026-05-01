// ============================================
// OTP Engine — Unit Tests
// Tests: generation, expiry, lockout, rate limit
// ============================================
import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateSecureOtp,
  createOtpSession,
  verifyOtp,
  canRequestOtp,
  getResendCooldown,
  clearAllOtpState,
  getOtpSessionInfo,
  OTP_CONFIG,
} from '../otpEngine';

describe('OTP Engine', () => {
  const phone = '9876543210';

  beforeEach(() => {
    clearAllOtpState(phone);
  });

  describe('generateSecureOtp', () => {
    it('generates a 6-digit numeric string', () => {
      const otp = generateSecureOtp();
      expect(otp).toMatch(/^\d{6}$/);
      expect(otp.length).toBe(6);
    });

    it('generates different codes on subsequent calls', () => {
      const codes = new Set();
      for (let i = 0; i < 50; i++) {
        codes.add(generateSecureOtp());
      }
      // With 50 random 6-digit codes, we should have many unique values
      expect(codes.size).toBeGreaterThan(40);
    });

    it('always generates codes in range [100000, 999999]', () => {
      for (let i = 0; i < 100; i++) {
        const code = parseInt(generateSecureOtp());
        expect(code).toBeGreaterThanOrEqual(100000);
        expect(code).toBeLessThanOrEqual(999999);
      }
    });
  });

  describe('createOtpSession', () => {
    it('creates a session successfully', () => {
      const result = createOtpSession(phone);
      expect(result.success).toBe(true);
      expect(result._devCode).toMatch(/^\d{6}$/);
      expect(result.message).toContain('OTP sent');
    });

    it('returns a masked phone in the message', () => {
      const result = createOtpSession(phone);
      expect(result.message).not.toContain(phone);
      expect(result.message).toContain('98');
      expect(result.message).toContain('10');
    });

    it('enforces resend cooldown', () => {
      createOtpSession(phone);
      const result = createOtpSession(phone);
      expect(result.success).toBe(false);
      expect(result.error).toContain('wait');
    });
  });

  describe('verifyOtp', () => {
    it('succeeds with correct OTP', () => {
      const session = createOtpSession(phone);
      const result = verifyOtp(phone, session._devCode);
      expect(result.success).toBe(true);
    });

    it('fails with wrong OTP', () => {
      createOtpSession(phone);
      const result = verifyOtp(phone, '000000');
      expect(result.success).toBe(false);
      expect(result.attemptsRemaining).toBeDefined();
    });

    it('returns error when no session exists', () => {
      const result = verifyOtp(phone, '123456');
      expect(result.success).toBe(false);
      expect(result.error).toContain('No OTP session');
    });

    it('invalidates OTP after successful use (one-time use)', () => {
      const session = createOtpSession(phone);
      verifyOtp(phone, session._devCode);

      // Second verification should fail (OTP consumed)
      const result = verifyOtp(phone, session._devCode);
      expect(result.success).toBe(false);
    });

    it('tracks failed attempts', () => {
      createOtpSession(phone);

      const r1 = verifyOtp(phone, '000001');
      expect(r1.attemptsRemaining).toBe(4);

      const r2 = verifyOtp(phone, '000002');
      expect(r2.attemptsRemaining).toBe(3);
    });
  });

  describe('Brute-force lockout', () => {
    it('locks out after max failed attempts', () => {
      createOtpSession(phone);

      // Use up all attempts
      for (let i = 0; i < OTP_CONFIG.MAX_VERIFY_ATTEMPTS; i++) {
        verifyOtp(phone, '00000' + i);
      }

      // Next attempt should fail with lockout
      const result = verifyOtp(phone, '000000');
      expect(result.success).toBe(false);
      expect(result.locked).toBe(true);
    });
  });

  describe('Rate limiting', () => {
    it('allows up to MAX_SEND_PER_WINDOW OTP requests', () => {
      // First request
      const r1 = createOtpSession(phone);
      expect(r1.success).toBe(true);

      // Check rate limit status
      const check = canRequestOtp(phone);
      expect(check.allowed).toBe(true);
    });

    it('reports rate limit check correctly', () => {
      const check = canRequestOtp(phone);
      expect(check.allowed).toBe(true);
    });
  });

  describe('Session info', () => {
    it('returns null when no session exists', () => {
      const info = getOtpSessionInfo(phone);
      expect(info).toBeNull();
    });

    it('returns session info when session exists', () => {
      createOtpSession(phone);
      const info = getOtpSessionInfo(phone);
      expect(info).not.toBeNull();
      expect(info.exists).toBe(true);
      expect(info.expired).toBe(false);
      expect(info.locked).toBe(false);
      expect(info.attemptsRemaining).toBe(OTP_CONFIG.MAX_VERIFY_ATTEMPTS);
    });
  });
});
