// ============================================
// CaterNow — Secure OTP Engine
// Cryptographically secure OTP generation,
// verification with expiry, brute-force lockout,
// and rate limiting. All state is in-memory only.
// ============================================

// ===== CONFIGURATION =====
const OTP_LENGTH = 6;
const OTP_TTL_MS = 5 * 60 * 1000;        // 5 minutes
const MAX_VERIFY_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 2 * 60 * 1000; // 2 minutes
const MAX_SEND_PER_WINDOW = 3;
const SEND_WINDOW_MS = 10 * 60 * 1000;     // 10 minutes
const BASE_RESEND_COOLDOWN_S = 30;          // 30 seconds

// In-memory stores (not accessible via devtools/localStorage)
const otpSessions = new Map();   // phone -> { code, createdAt, attempts, lockedUntil }
const sendHistory = new Map();   // phone -> [timestamp, timestamp, ...]
const resendCooldowns = new Map(); // phone -> { lastSentAt, consecutiveSends }

// ===== CRYPTO-SECURE OTP GENERATION =====
export function generateSecureOtp() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Produces a number in [100000, 999999]
  const code = (array[0] % 900000) + 100000;
  return code.toString();
}

// ===== RATE LIMITING: Can we send an OTP? =====
export function canRequestOtp(phone) {
  const history = sendHistory.get(phone) || [];
  const now = Date.now();
  // Filter to within the send window
  const recent = history.filter(ts => (now - ts) < SEND_WINDOW_MS);
  sendHistory.set(phone, recent);

  if (recent.length >= MAX_SEND_PER_WINDOW) {
    const oldestInWindow = Math.min(...recent);
    const waitMs = SEND_WINDOW_MS - (now - oldestInWindow);
    return {
      allowed: false,
      waitSeconds: Math.ceil(waitMs / 1000),
      reason: `Maximum OTP requests reached. Try again in ${Math.ceil(waitMs / 60000)} minute(s).`,
    };
  }
  return { allowed: true };
}

// ===== RESEND COOLDOWN =====
export function getResendCooldown(phone) {
  const info = resendCooldowns.get(phone);
  if (!info) return 0;

  const elapsed = (Date.now() - info.lastSentAt) / 1000;
  // Cooldown increases: 30s, 45s, 60s, etc.
  const cooldownSeconds = BASE_RESEND_COOLDOWN_S + (info.consecutiveSends - 1) * 15;
  const remaining = Math.max(0, Math.ceil(cooldownSeconds - elapsed));
  return remaining;
}

// ===== CREATE OTP SESSION =====
export function createOtpSession(phone) {
  // Check rate limit
  const rateCheck = canRequestOtp(phone);
  if (!rateCheck.allowed) {
    return { success: false, error: rateCheck.reason };
  }

  // Check resend cooldown
  const cooldown = getResendCooldown(phone);
  if (cooldown > 0) {
    return { success: false, error: `Please wait ${cooldown} seconds before requesting a new OTP.` };
  }

  // Generate OTP
  const code = generateSecureOtp();
  const now = Date.now();

  // Store session
  otpSessions.set(phone, {
    code,
    createdAt: now,
    attempts: 0,
    lockedUntil: 0,
  });

  // Track send history
  const history = sendHistory.get(phone) || [];
  history.push(now);
  sendHistory.set(phone, history);

  // Track resend cooldown
  const prevInfo = resendCooldowns.get(phone);
  resendCooldowns.set(phone, {
    lastSentAt: now,
    consecutiveSends: prevInfo ? prevInfo.consecutiveSends + 1 : 1,
  });

  return {
    success: true,
    // In production, this code would be sent via SMS (Twilio/MSG91/Supabase Auth)
    // For dev/demo, we return it so the UI can show a dismissible toast
    _devCode: code,
    expiresIn: OTP_TTL_MS / 1000,
    message: `OTP sent to +91 ${phone.slice(0, 2)}****${phone.slice(-2)}`,
  };
}

// ===== VERIFY OTP =====
export function verifyOtp(phone, inputCode) {
  const session = otpSessions.get(phone);

  if (!session) {
    return { success: false, error: 'No OTP session found. Please request a new OTP.' };
  }

  const now = Date.now();

  // Check lockout
  if (session.lockedUntil > now) {
    const waitSeconds = Math.ceil((session.lockedUntil - now) / 1000);
    return {
      success: false,
      error: `Too many failed attempts. Try again in ${waitSeconds} seconds.`,
      locked: true,
      lockoutRemaining: waitSeconds,
    };
  }

  // Check expiry
  if ((now - session.createdAt) > OTP_TTL_MS) {
    otpSessions.delete(phone);
    return { success: false, error: 'OTP has expired. Please request a new one.', expired: true };
  }

  // Check code
  if (inputCode !== session.code) {
    session.attempts += 1;
    const remaining = MAX_VERIFY_ATTEMPTS - session.attempts;

    if (session.attempts >= MAX_VERIFY_ATTEMPTS) {
      // Lock the session
      session.lockedUntil = now + LOCKOUT_DURATION_MS;
      session.attempts = 0; // Reset for after lockout
      return {
        success: false,
        error: `Too many failed attempts. Account locked for ${LOCKOUT_DURATION_MS / 60000} minutes.`,
        locked: true,
        lockoutRemaining: LOCKOUT_DURATION_MS / 1000,
      };
    }

    return {
      success: false,
      error: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      attemptsRemaining: remaining,
    };
  }

  // SUCCESS — invalidate OTP (one-time use)
  otpSessions.delete(phone);
  // Reset consecutive sends on successful verification
  resendCooldowns.delete(phone);

  return { success: true };
}

// ===== GET SESSION INFO (for UI state) =====
export function getOtpSessionInfo(phone) {
  const session = otpSessions.get(phone);
  if (!session) return null;

  const now = Date.now();
  const expired = (now - session.createdAt) > OTP_TTL_MS;
  const locked = session.lockedUntil > now;

  return {
    exists: true,
    expired,
    locked,
    lockoutRemaining: locked ? Math.ceil((session.lockedUntil - now) / 1000) : 0,
    attemptsUsed: session.attempts,
    attemptsRemaining: MAX_VERIFY_ATTEMPTS - session.attempts,
    expiresIn: Math.max(0, Math.ceil((OTP_TTL_MS - (now - session.createdAt)) / 1000)),
  };
}

// ===== CLEANUP =====
export function clearOtpSession(phone) {
  otpSessions.delete(phone);
  // Don't clear send history or cooldowns — those persist for rate limiting
}

export function clearAllOtpState(phone) {
  otpSessions.delete(phone);
  sendHistory.delete(phone);
  resendCooldowns.delete(phone);
}

// ===== EXPORT CONFIG FOR TESTING =====
export const OTP_CONFIG = {
  OTP_LENGTH,
  OTP_TTL_MS,
  MAX_VERIFY_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  MAX_SEND_PER_WINDOW,
  SEND_WINDOW_MS,
  BASE_RESEND_COOLDOWN_S,
};
