'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { UserProfile } from '@/types';
import { adminService } from '@/services/adminService';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  loginWithPin: (pin: string, profileId?: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  switchStaff: (profile: UserProfile) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'kapda_ghar_auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  // Load existing session on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const parsed: UserProfile = JSON.parse(stored);
        if (parsed && parsed.id) {
          setUser(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached auth user:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Route protection listener
  useEffect(() => {
    if (loading) return;

    const isLoginPage = pathname === '/login';

    if (!user && !isLoginPage) {
      // Unauthenticated access attempt: route to login
      const redirectUrl = pathname ? `/login?redirect=${encodeURIComponent(pathname)}` : '/login';
      router.push(redirectUrl);
    } else if (user && isLoginPage) {
      // Already authenticated visiting login: route to dashboard
      router.push('/');
    }
  }, [user, loading, pathname, router]);

  const loginWithPin = async (
    pin: string,
    profileId?: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await adminService.verifyPin(pin, profileId);
      if (res.success && res.profile) {
        setUser(res.profile);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(res.profile));
        localStorage.setItem('kapda_ghar_active_staff_id', res.profile.id);
        localStorage.setItem('kapda_ghar_active_staff_name', res.profile.full_name);
        localStorage.setItem('kapda_ghar_active_staff_role', res.profile.role);
        return { success: true };
      }
      return { success: false, message: res.message || 'Invalid credentials' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Authentication failed' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('kapda_ghar_active_staff_id');
    localStorage.removeItem('kapda_ghar_active_staff_name');
    localStorage.removeItem('kapda_ghar_active_staff_role');
    router.push('/login');
  };

  const switchStaff = (profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
    localStorage.setItem('kapda_ghar_active_staff_id', profile.id);
    localStorage.setItem('kapda_ghar_active_staff_name', profile.full_name);
    localStorage.setItem('kapda_ghar_active_staff_role', profile.role);
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const profiles = await adminService.getStaffProfiles();
      const updated = profiles.find((p) => p.id === user.id);
      if (updated) {
        setUser(updated);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('Failed to refresh user:', e);
    }
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'owner';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isAdmin,
        loading,
        loginWithPin,
        logout,
        switchStaff,
        refreshUser,
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
