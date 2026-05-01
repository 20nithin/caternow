// ============================================
// CaterNow — Security Utilities
// Input sanitization, XSS prevention,
// session management, and validation
// ============================================

// ===== HTML SANITIZATION =====
// Strips all HTML tags from a string
export function sanitizeText(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '')   // Strip HTML tags
    .replace(/[<>]/g, '')       // Remove stray angle brackets
    .trim()
    .slice(0, maxLength);
}

// ===== HTML ENTITY ESCAPING =====
// Escapes HTML special characters to prevent XSS injection
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return str.replace(/[&<>"'/]/g, char => escapeMap[char]);
}

// ===== PHONE VALIDATION =====
export function sanitizePhone(str) {
  if (typeof str !== 'string') return '';
  // Extract only digits, take last 10
  const digits = str.replace(/\D/g, '');
  return digits.slice(-10);
}

export function isValidPhone(phone) {
  const clean = sanitizePhone(phone);
  // Indian mobile: starts with 6-9, exactly 10 digits
  return /^[6-9]\d{9}$/.test(clean);
}

// ===== EVENT DATE VALIDATION =====
export function validateEventDate(dateStr) {
  if (!dateStr) return { valid: false, error: 'Please select an event date' };

  const eventDate = new Date(dateStr);
  const now = new Date();

  if (isNaN(eventDate.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }

  // Must be at least 2 hours in the future
  const minTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  if (eventDate < minTime) {
    return { valid: false, error: 'Event date must be at least 2 hours in the future' };
  }

  // Maximum 1 year ahead
  const maxTime = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  if (eventDate > maxTime) {
    return { valid: false, error: 'Event date cannot be more than 1 year away' };
  }

  return { valid: true };
}

// ===== SESSION TIMEOUT =====
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function createSessionTimer(logoutFn, timeoutMs = SESSION_TIMEOUT_MS) {
  let timer = null;
  const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];

  const resetTimer = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      logoutFn();
      cleanup();
    }, timeoutMs);
  };

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    events.forEach(evt => window.removeEventListener(evt, resetTimer));
  };

  // Start listening
  events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
  resetTimer(); // Start the timer

  return cleanup; // Return cleanup function for useEffect
}

// ===== SAFE JSON PARSE =====
export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// ===== PREVENT DOUBLE SUBMIT =====
export function createSubmitGuard() {
  let submitting = false;
  return {
    trySubmit: () => {
      if (submitting) return false;
      submitting = true;
      return true;
    },
    release: () => {
      submitting = false;
    },
    isSubmitting: () => submitting,
  };
}
