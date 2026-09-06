import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_SECURITY_SETTINGS,
  getSecuritySettings,
  saveSecuritySettings,
  saveAuthSession,
  getAuthSession,
  clearAuthSession,
  recordFailedPinAttempt,
  getPinLockoutStatus,
  clearPinLockout,
} from '../lib/security/session';
import { UserProfile } from '../types';

// Mock in-memory storage for node environment
const mockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = val.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

describe('Kapda Ghar - Security & Session Protection Tests', () => {
  const dummyUser: UserProfile = {
    id: 'usr-1',
    business_id: 'biz-1',
    full_name: 'Aman Owner',
    role: 'owner',
    phone: '9999999999',
    pin: '1234',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage());
    vi.stubGlobal('sessionStorage', mockStorage());
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
    });
  });

  it('loads default security settings with require_pin_on_close = true', () => {
    const settings = getSecuritySettings();
    expect(settings.require_pin_on_close).toBe(true);
    expect(settings.session_timeout_minutes).toBe(240); // 4 hours
    expect(settings.idle_timeout_minutes).toBe(15); // 15 mins
  });

  it('saves and persists custom security settings', () => {
    saveSecuritySettings({
      session_timeout_minutes: 120,
      idle_timeout_minutes: 5,
    });
    const updated = getSecuritySettings();
    expect(updated.session_timeout_minutes).toBe(120);
    expect(updated.idle_timeout_minutes).toBe(5);
  });

  it('stores session in sessionStorage by default when require_pin_on_close is true', () => {
    saveSecuritySettings({ require_pin_on_close: true });
    const session = saveAuthSession(dummyUser);

    expect(session.user.full_name).toBe('Aman Owner');
    expect(session.sessionToken).toBeDefined();
    expect(session.expiresAt).toBeGreaterThan(Date.now());

    // sessionStorage should have the session, localStorage must be clean
    expect(sessionStorage.getItem('kapda_ghar_auth_session')).not.toBeNull();
    expect(localStorage.getItem('kapda_ghar_auth_session')).toBeNull();
  });

  it('detects absolute session expiration (e.g. 1 day later) and rejects automatically', () => {
    saveSecuritySettings({ session_timeout_minutes: 240 });
    saveAuthSession(dummyUser);

    // Fast-forward time by 24 hours (simulating opening browser next day)
    const originalDateNow = Date.now;
    try {
      Date.now = () => originalDateNow() + 24 * 60 * 60 * 1000;

      const { session, expiredReason } = getAuthSession();
      expect(session).toBeNull();
      expect(expiredReason).toBe('session_expired');
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('detects idle timeout when terminal is left unattended', () => {
    saveSecuritySettings({ idle_timeout_minutes: 15 });
    saveAuthSession(dummyUser);

    // Fast-forward time by 20 minutes with zero activity
    const originalDateNow = Date.now;
    try {
      Date.now = () => originalDateNow() + 20 * 60 * 1000;

      const { session, expiredReason } = getAuthSession();
      expect(session).toBeNull();
      expect(expiredReason).toBe('idle_timeout');
    } finally {
      Date.now = originalDateNow;
    }
  });

  it('enforces anti-brute force lockout after 5 consecutive failed PIN attempts', () => {
    clearPinLockout();

    for (let i = 1; i <= 4; i++) {
      const status = recordFailedPinAttempt();
      expect(status.isLocked).toBe(false);
      expect(status.attempts).toBe(i);
    }

    // 5th failed attempt should trigger 60s lockout
    const fifth = recordFailedPinAttempt();
    expect(fifth.isLocked).toBe(true);
    expect(fifth.attempts).toBe(5);
    expect(fifth.remainingSeconds).toBeGreaterThan(0);

    // Check status check function reflects lockout
    const check = getPinLockoutStatus();
    expect(check.isLocked).toBe(true);
    expect(check.remainingSeconds).toBeGreaterThan(0);

    // Clearing lockout resets status
    clearPinLockout();
    const afterClear = getPinLockoutStatus();
    expect(afterClear.isLocked).toBe(false);
  });

  it('clears all session and staff tokens completely on clearAuthSession', () => {
    saveAuthSession(dummyUser);
    clearAuthSession();

    expect(sessionStorage.getItem('kapda_ghar_auth_session')).toBeNull();
    expect(localStorage.getItem('kapda_ghar_auth_session')).toBeNull();
    expect(localStorage.getItem('kapda_ghar_auth_user')).toBeNull();
  });
});
