import { AuthSession, SecuritySettings, UserProfile } from '@/types';
import { generateUUID } from '@/lib/utils/uuid';

const SETTINGS_KEY = 'kapda_ghar_security_settings';
const SESSION_KEY = 'kapda_ghar_auth_session';
const LOCKOUT_KEY = 'kapda_ghar_pin_lockout';

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  session_timeout_minutes: 240, // 4 hours maximum session duration
  idle_timeout_minutes: 15, // 15 minutes of inactivity auto-locks terminal
  require_pin_on_close: true, // Default: closing browser/tab requires PIN on next visit
  max_failed_attempts: 5,
  lockout_duration_seconds: 60,
};

export function getSecuritySettings(): SecuritySettings {
  if (typeof window === 'undefined') return DEFAULT_SECURITY_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SECURITY_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SECURITY_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_SECURITY_SETTINGS;
  }
}

export function saveSecuritySettings(updates: Partial<SecuritySettings>): SecuritySettings {
  const current = getSecuritySettings();
  const updated: SecuritySettings = { ...current, ...updates };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('security-settings-changed', { detail: updated }));
    } catch (e) {
      console.warn('Failed to save security settings:', e);
    }
  }
  return updated;
}

export function saveAuthSession(user: UserProfile): AuthSession {
  const settings = getSecuritySettings();
  const now = Date.now();
  const maxDurationMs = Math.max(15, settings.session_timeout_minutes) * 60 * 1000;
  const expiresAt = now + maxDurationMs;

  const session: AuthSession = {
    user,
    loginTime: now,
    lastActiveTime: now,
    expiresAt,
    sessionToken: generateUUID(),
  };

  if (typeof window !== 'undefined') {
    const serialized = JSON.stringify(session);
    if (settings.require_pin_on_close) {
      // Session storage is automatically wiped when browser/tab is closed
      sessionStorage.setItem(SESSION_KEY, serialized);
      localStorage.removeItem(SESSION_KEY);
    } else {
      localStorage.setItem(SESSION_KEY, serialized);
    }

    // Reset failed attempts on successful login
    clearPinLockout();
  }

  return session;
}

export function getAuthSession(): { session: AuthSession | null; expiredReason?: 'session_expired' | 'idle_timeout' } {
  if (typeof window === 'undefined') return { session: null };

  const settings = getSecuritySettings();
  let raw = sessionStorage.getItem(SESSION_KEY);

  if (!raw && !settings.require_pin_on_close) {
    raw = localStorage.getItem(SESSION_KEY);
  }

  // Backward compatibility migration: remove raw user object stored indefinitely
  localStorage.removeItem('kapda_ghar_auth_user');

  if (!raw) return { session: null };

  try {
    const session: AuthSession = JSON.parse(raw);
    if (!session || !session.user || !session.expiresAt) {
      clearAuthSession();
      return { session: null };
    }

    const now = Date.now();

    // 1. Check absolute session expiration
    if (now > session.expiresAt) {
      clearAuthSession();
      return { session: null, expiredReason: 'session_expired' };
    }

    // 2. Check idle / inactivity timeout
    if (settings.idle_timeout_minutes > 0) {
      const idleLimitMs = settings.idle_timeout_minutes * 60 * 1000;
      if (now - (session.lastActiveTime || session.loginTime) > idleLimitMs) {
        clearAuthSession();
        return { session: null, expiredReason: 'idle_timeout' };
      }
    }

    return { session };
  } catch {
    clearAuthSession();
    return { session: null };
  }
}

export function touchSessionActivity(): void {
  if (typeof window === 'undefined') return;

  const settings = getSecuritySettings();
  let storage: Storage | null = null;
  let raw = sessionStorage.getItem(SESSION_KEY);

  if (raw) {
    storage = sessionStorage;
  } else if (!settings.require_pin_on_close) {
    raw = localStorage.getItem(SESSION_KEY);
    if (raw) storage = localStorage;
  }

  if (!raw || !storage) return;

  try {
    const session: AuthSession = JSON.parse(raw);
    session.lastActiveTime = Date.now();
    storage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('kapda_ghar_auth_user');
    localStorage.removeItem('kapda_ghar_active_staff_id');
    localStorage.removeItem('kapda_ghar_active_staff_name');
    localStorage.removeItem('kapda_ghar_active_staff_role');
  } catch {}
}

// Anti-Brute Force PIN Rate Limiting & Lockout
export interface LockoutStatus {
  isLocked: boolean;
  remainingSeconds: number;
  attempts: number;
}

export function getPinLockoutStatus(): LockoutStatus {
  if (typeof window === 'undefined') return { isLocked: false, remainingSeconds: 0, attempts: 0 };
  try {
    const raw = sessionStorage.getItem(LOCKOUT_KEY);
    if (!raw) return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    const data = JSON.parse(raw);
    const now = Date.now();
    if (data.lockedUntil && data.lockedUntil > now) {
      const remainingSeconds = Math.ceil((data.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds, attempts: data.attempts || 0 };
    }
    return { isLocked: false, remainingSeconds: 0, attempts: data.attempts || 0 };
  } catch {
    return { isLocked: false, remainingSeconds: 0, attempts: 0 };
  }
}

export function recordFailedPinAttempt(): LockoutStatus {
  if (typeof window === 'undefined') return { isLocked: false, remainingSeconds: 0, attempts: 1 };
  const settings = getSecuritySettings();
  const current = getPinLockoutStatus();
  const newAttempts = current.attempts + 1;
  const now = Date.now();

  let lockedUntil: number | null = null;
  let remainingSeconds = 0;

  if (newAttempts >= settings.max_failed_attempts) {
    // Lock out for configured seconds (or 5 minutes if >= 10 attempts)
    const lockoutSecs = newAttempts >= 10 ? 300 : settings.lockout_duration_seconds;
    lockedUntil = now + lockoutSecs * 1000;
    remainingSeconds = lockoutSecs;
  }

  const record = {
    attempts: newAttempts,
    lockedUntil,
  };

  try {
    sessionStorage.setItem(LOCKOUT_KEY, JSON.stringify(record));
  } catch {}

  return {
    isLocked: Boolean(lockedUntil && lockedUntil > now),
    remainingSeconds,
    attempts: newAttempts,
  };
}

export function clearPinLockout(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(LOCKOUT_KEY);
  } catch {}
}
