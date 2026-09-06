'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AuthSession, SecuritySettings, UserProfile } from '@/types';
import { adminService } from '@/services/adminService';
import {
  clearAuthSession,
  getAuthSession,
  getPinLockoutStatus,
  getSecuritySettings,
  recordFailedPinAttempt,
  saveAuthSession,
  saveSecuritySettings,
  touchSessionActivity,
} from '@/lib/security/session';

interface AuthContextType {
  user: UserProfile | null;
  session: AuthSession | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  loginWithPin: (pin: string, profileId?: string) => Promise<{ success: boolean; message?: string; lockoutSeconds?: number }>;
  logout: (reason?: string) => void;
  lockTerminal: () => void;
  switchStaff: (profile: UserProfile) => void;
  refreshUser: () => Promise<void>;
  securitySettings: SecuritySettings;
  updateSecuritySettings: (newSettings: Partial<SecuritySettings>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [securitySettings, setSecuritySettingsState] = useState<SecuritySettings>(getSecuritySettings());
  const [loading, setLoading] = useState<boolean>(true);

  const router = useRouter();
  const pathname = usePathname();
  const lastTouchRef = useRef<number>(Date.now());

  // 1. Check & restore valid session on mount
  useEffect(() => {
    try {
      const { session: validSession, expiredReason } = getAuthSession();
      if (validSession) {
        setSession(validSession);
        setUser(validSession.user);
      } else if (expiredReason) {
        // Redirect to login with reason
        router.push(`/login?reason=${expiredReason}`);
      }
    } catch (e) {
      console.warn('Session check error:', e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // 2. Listen to settings changes across tabs
  useEffect(() => {
    const handleSettingsChanged = () => {
      setSecuritySettingsState(getSecuritySettings());
    };
    window.addEventListener('security-settings-changed', handleSettingsChanged);
    return () => window.removeEventListener('security-settings-changed', handleSettingsChanged);
  }, []);

  // 3. User Activity Tracker (Throttled every 15s to update idle timeout)
  useEffect(() => {
    if (!user) return;

    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastTouchRef.current > 15_000) {
        lastTouchRef.current = now;
        touchSessionActivity();
      }
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Periodic session watchdog (runs every 10 seconds)
    const watchdogInterval = setInterval(() => {
      const { session: activeSession, expiredReason } = getAuthSession();
      if (!activeSession && expiredReason) {
        setUser(null);
        setSession(null);
        router.push(`/login?reason=${expiredReason}`);
      }
    }, 10_000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      clearInterval(watchdogInterval);
    };
  }, [user, router]);

  // 4. Route Protection & RBAC Guard
  useEffect(() => {
    if (loading) return;

    const isLoginPage = pathname === '/login';

    if (!user && !isLoginPage) {
      // Unauthenticated access attempt: route to login
      const redirectUrl = pathname ? `/login?redirect=${encodeURIComponent(pathname)}` : '/login';
      router.push(redirectUrl);
      return;
    }

    if (user && isLoginPage) {
      // Already authenticated visiting login: route to dashboard
      router.push('/');
      return;
    }

    // Role-based Access Control (RBAC): Protect admin and reports from cashiers
    if (user && user.role === 'cashier') {
      const adminOnlyPaths = ['/admin', '/reports', '/settings'];
      if (adminOnlyPaths.some((p) => pathname.startsWith(p))) {
        router.push('/sell?notice=restricted');
      }
    }
  }, [user, loading, pathname, router]);

  const loginWithPin = useCallback(
    async (
      pin: string,
      profileId?: string
    ): Promise<{ success: boolean; message?: string; lockoutSeconds?: number }> => {
      // Check brute force lockout state
      const lockout = getPinLockoutStatus();
      if (lockout.isLocked) {
        return {
          success: false,
          message: `Terminal is temporarily locked due to repeated failed attempts. Please wait ${lockout.remainingSeconds}s.`,
          lockoutSeconds: lockout.remainingSeconds,
        };
      }

      try {
        const res = await adminService.verifyPin(pin, profileId);
        if (res.success && res.profile) {
          const newSession = saveAuthSession(res.profile);
          setSession(newSession);
          setUser(res.profile);
          return { success: true };
        }

        // Record failed attempt and check if threshold reached
        const updatedLockout = recordFailedPinAttempt();
        if (updatedLockout.isLocked) {
          return {
            success: false,
            message: `Too many incorrect PIN attempts. Terminal locked for ${updatedLockout.remainingSeconds} seconds.`,
            lockoutSeconds: updatedLockout.remainingSeconds,
          };
        }

        const remainingAttempts = Math.max(0, securitySettings.max_failed_attempts - updatedLockout.attempts);
        const warning = remainingAttempts > 0 && remainingAttempts <= 2
          ? ` (${remainingAttempts} attempt${remainingAttempts > 1 ? 's' : ''} remaining before lockout)`
          : '';

        return {
          success: false,
          message: `${res.message || 'Invalid PIN.'}${warning}`,
        };
      } catch (err: any) {
        return { success: false, message: err.message || 'Authentication error.' };
      }
    },
    [securitySettings]
  );

  const logout = useCallback((reason?: string) => {
    setUser(null);
    setSession(null);
    clearAuthSession();
    const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    router.push(`/login${query}`);
  }, [router]);

  const lockTerminal = useCallback(() => {
    logout('locked');
  }, [logout]);

  const switchStaff = useCallback((profile: UserProfile) => {
    const newSession = saveAuthSession(profile);
    setSession(newSession);
    setUser(profile);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user) return;
    try {
      const profiles = await adminService.getStaffProfiles();
      const updated = profiles.find((p) => p.id === user.id);
      if (updated) {
        setUser(updated);
        saveAuthSession(updated);
      }
    } catch (e) {
      console.warn('Failed to refresh user profile:', e);
    }
  }, [user]);

  const updateSecuritySettings = useCallback((newSettings: Partial<SecuritySettings>) => {
    const saved = saveSecuritySettings(newSettings);
    setSecuritySettingsState(saved);
  }, []);

  const isAuthenticated = Boolean(user && session);
  const isAdmin = user?.role === 'owner';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated,
        isAdmin,
        loading,
        loginWithPin,
        logout,
        lockTerminal,
        switchStaff,
        refreshUser,
        securitySettings,
        updateSecuritySettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
