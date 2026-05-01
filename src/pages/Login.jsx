import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  createOtpSession,
  verifyOtp,
  getResendCooldown,
  clearOtpSession,
  getOtpSessionInfo,
} from '../utils/otpEngine';
import { sanitizePhone, isValidPhone } from '../utils/security';

export default function Login() {
  const [step, setStep] = useState('phone'); // phone | otp
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const otpRefs = useRef([]);
  const navigate = useNavigate();
  const { login } = useApp();

  const showDevOtp = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEV_OTP === 'true';

  // Countdown timer for resend OTP
  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpTimer((t) => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

  // Lockout countdown
  useEffect(() => {
    if (lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer((t) => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toastVisible) return;
    const timer = setTimeout(() => {
      setToastVisible(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toastVisible]);

  const showToast = useCallback((message) => {
    setToastMessage(message);
    setToastVisible(true);
  }, []);

  const handleSendOtp = useCallback(() => {
    const clean = sanitizePhone(phone);
    const result = createOtpSession(clean);

    if (!result.success) {
      setError(result.error);
      return false;
    }

    setOtp(['', '', '', '', '', '']);
    setError('');
    setAttemptsRemaining(5);

    // Get actual cooldown from engine
    const cooldown = getResendCooldown(clean) || 30;
    setOtpTimer(cooldown);

    showToast(showDevOtp ? `OTP sent (dev): ${result._devCode}` : 'OTP sent to your mobile number.');
    return true;
  }, [phone, showToast, showDevOtp]);

  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    const clean = sanitizePhone(phone);

    if (!isValidPhone(clean)) {
      setError('Please enter a valid 10-digit Indian mobile number (starts with 6-9)');
      return;
    }

    setPhone(clean);
    setError('');

    if (handleSendOtp()) {
      setStep('otp');
    }
  };

  const handleResendOtp = () => {
    if (otpTimer > 0) return;
    handleSendOtp();
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste for OTP
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const digits = pasted.split('');
      setOtp(digits);
      otpRefs.current[5]?.focus();
    }
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();

    if (lockoutTimer > 0) {
      setError(`Account locked. Please wait ${lockoutTimer} seconds.`);
      return;
    }

    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    const clean = sanitizePhone(phone);
    const result = verifyOtp(clean, code);

    if (!result.success) {
      setError(result.error);

      if (result.locked) {
        setLockoutTimer(result.lockoutRemaining || 120);
      }

      if (result.attemptsRemaining !== undefined) {
        setAttemptsRemaining(result.attemptsRemaining);
      }

      // Clear OTP inputs on failure
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
      return;
    }

    // ✅ OTP verified - Automatically login as customer
    setError('');
    const userData = {
      phone,
      role: 'customer',
      id: `c_${phone}`,
    };
    login(userData);
    navigate('/customer/new-request');
  };

  const handleChangeNumber = () => {
    clearOtpSession(sanitizePhone(phone));
    setStep('phone');
    setOtp(['', '', '', '', '', '']);
    setError('');
    setLockoutTimer(0);
    setAttemptsRemaining(5);
  };

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
      {/* Toast Notification (simulates SMS) */}
      {toastVisible && (
        <div
          className="animate-slide-in"
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '420px',
            width: 'calc(100% - 32px)',
            padding: '14px 20px',
            background: 'linear-gradient(135deg, #1a2a1a, #1a3a1a)',
            border: '1px solid rgba(5, 150, 105, 0.4)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--success)',
            fontSize: '0.85rem',
            fontWeight: 600,
            textAlign: 'center',
            zIndex: 200,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            cursor: 'pointer',
          }}
          onClick={() => setToastVisible(false)}
        >
          {toastMessage}
        </div>
      )}

      {/* Logo */}
      <div className="text-center" style={{ marginBottom: '48px' }}>
        <div className="logo" style={{ justifyContent: 'center', marginBottom: '8px' }}>
          <span className="logo-icon">🍽️</span>
          <span className="logo-text">CaterNow</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Find the best caterers near you
        </p>
      </div>

      {/* Phone Step */}
      {step === 'phone' && (
        <form onSubmit={handlePhoneSubmit} className="animate-fade-in">
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>Login or Sign up 👋</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.9rem' }}>
            Enter your phone number to get started as a customer
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="phone-input">Phone Number</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{
                padding: '14px 12px',
                background: 'var(--bg-input)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font)',
                fontSize: '1rem',
                fontWeight: 600,
              }}>
                +91
              </div>
              <input
                id="phone-input"
                type="tel"
                className="form-input"
                placeholder="Enter 10-digit number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                autoFocus
                autoComplete="tel"
                aria-label="10-digit mobile number"
              />
            </div>
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px' }}>{error}</p>}

          <button type="submit" className="btn btn-primary btn-block btn-lg">
            Send OTP →
          </button>

          <p className="text-center mt-lg" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Are you a vendor? <Link to="/vendor/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Login here</Link>
          </p>
        </form>
      )}

      {/* OTP Step */}
      {step === 'otp' && (
        <form onSubmit={handleOtpSubmit} className="animate-fade-in">
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>Verify OTP 🔐</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.9rem' }}>
            We sent a code to <strong>+91 {phone}</strong>
          </p>

          {/* Security info bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            background: 'rgba(37, 99, 235, 0.08)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '16px',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}>
            <span>🛡️ {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining</span>
            {(() => {
              const info = getOtpSessionInfo(sanitizePhone(phone));
              return info ? <span>⏱️ Expires in {Math.floor(info.expiresIn / 60)}:{String(info.expiresIn % 60).padStart(2, '0')}</span> : null;
            })()}
          </div>

          <div className="otp-inputs" onPaste={handleOtpPaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (otpRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                className="otp-input"
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                autoFocus={i === 0}
                maxLength={1}
                disabled={lockoutTimer > 0}
                aria-label={`OTP digit ${i + 1}`}
              />
            ))}
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'center' }}>{error}</p>}

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            disabled={lockoutTimer > 0}
          >
            Verify →
          </button>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={handleChangeNumber}
            >
              ← Change Number
            </button>
            <button
              type="button"
              className={`btn btn-block ${otpTimer > 0 ? 'btn-secondary' : 'btn-primary'}`}
              onClick={handleResendOtp}
              disabled={otpTimer > 0}
              style={{ opacity: otpTimer > 0 ? 0.6 : 1 }}
            >
              {otpTimer > 0 ? `Resend (${otpTimer}s)` : '🔄 Resend OTP'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
