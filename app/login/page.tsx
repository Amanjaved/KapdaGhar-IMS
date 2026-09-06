'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Store,
  ShieldCheck,
  User,
  Delete,
  Lock,
  AlertCircle,
  Shield,
  RotateCcw,
  Clock,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { adminService } from '@/services/adminService';
import { UserProfile } from '@/types';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { getPinLockoutStatus } from '@/lib/security/session';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/';
  const reason = searchParams.get('reason');

  const { loginWithPin, isAuthenticated } = useAuth();

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Check lockout status on mount
  useEffect(() => {
    const status = getPinLockoutStatus();
    if (status.isLocked) {
      setLockoutSeconds(status.remainingSeconds);
    }
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push(redirectTarget);
    }
  }, [isAuthenticated, redirectTarget, router]);

  // Load available staff profiles
  useEffect(() => {
    let mounted = true;
    adminService.getStaffProfiles().then((list) => {
      if (mounted && list.length > 0) {
        setProfiles(list);
        const owner = list.find((p) => p.role === 'owner');
        if (owner) {
          setSelectedProfileId(owner.id);
        } else {
          setSelectedProfileId(list[0].id);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setIsShaking(true);
    setPin('');
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleAuthenticate = useCallback(
    async (pinToTest: string) => {
      if (pinToTest.length < 4 || isSubmitting || lockoutSeconds > 0) return;

      setIsSubmitting(true);
      setErrorMsg('');

      try {
        const res = await loginWithPin(pinToTest, selectedProfileId || undefined);
        if (res.success) {
          router.push(redirectTarget);
        } else {
          if (res.lockoutSeconds) {
            setLockoutSeconds(res.lockoutSeconds);
          }
          triggerError(res.message || 'Incorrect PIN. Please try again.');
        }
      } catch (err: any) {
        triggerError(err.message || 'Authentication failed.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, lockoutSeconds, loginWithPin, selectedProfileId, redirectTarget, router]
  );

  const handleKeyPress = useCallback(
    (digit: string) => {
      if (pin.length >= 4 || lockoutSeconds > 0) return;
      setErrorMsg('');
      const updated = pin + digit;
      setPin(updated);

      if (updated.length === 4) {
        handleAuthenticate(updated);
      }
    },
    [pin, lockoutSeconds, handleAuthenticate]
  );

  const handleDelete = useCallback(() => {
    if (lockoutSeconds > 0) return;
    setErrorMsg('');
    setPin((prev) => prev.slice(0, -1));
  }, [lockoutSeconds]);

  const handleClear = useCallback(() => {
    if (lockoutSeconds > 0) return;
    setErrorMsg('');
    setPin('');
  }, [lockoutSeconds]);

  // Physical keyboard support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (lockoutSeconds > 0) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pin.length === 4) {
          handleAuthenticate(pin);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleKeyPress, handleDelete, handleClear, handleAuthenticate, pin, lockoutSeconds]);

  const selectedStaff = profiles.find((p) => p.id === selectedProfileId);

  // Security reason banner
  const getSecurityBanner = () => {
    if (reason === 'session_expired') {
      return {
        icon: <Clock className="w-4 h-4 text-amber-500 shrink-0" />,
        title: 'Shift Session Expired',
        desc: 'Your login session expired for store security. Enter PIN to continue.',
        color: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300',
      };
    }
    if (reason === 'idle_timeout') {
      return {
        icon: <Lock className="w-4 h-4 text-amber-500 shrink-0" />,
        title: 'Terminal Auto-Locked',
        desc: 'Register was locked after inactivity. Enter your PIN to resume.',
        color: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300',
      };
    }
    if (reason === 'locked') {
      return {
        icon: <KeyRound className="w-4 h-4 text-indigo-500 shrink-0" />,
        title: 'Terminal Secured',
        desc: 'Register locked manually. Enter PIN to unlock.',
        color: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-indigo-800 dark:text-indigo-300',
      };
    }
    return null;
  };

  const securityBanner = getSecurityBanner();

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 transition-colors overflow-hidden select-none">
      {/* Ambient background decoration */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-indigo-400/15 dark:bg-indigo-600/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 bg-sky-400/15 dark:bg-violet-600/10 rounded-full blur-3xl" />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/25 border border-indigo-400/30">
            <Store className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                Kapda Ghar
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-500/30">
                SECURE POS
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              कपड़ा घर — रिटेल इन्वेंट्री & सुरक्षित बिलिंग
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 shadow-xs text-xs font-medium text-slate-600 dark:text-slate-300 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Terminal 01 • Security Active</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="relative z-10 w-full max-w-md mx-auto my-auto py-4 sm:py-6">
        <div className="bg-white/95 dark:bg-[#0d1322]/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-900/5 dark:shadow-black/50 space-y-5">
          {/* Card Header */}
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto shadow-inner">
              <Lock className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Staff Authentication
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select your account and enter your 4-digit security PIN.
              </p>
            </div>
          </div>

          {/* Security Banner (if session expired or idle timeout) */}
          {securityBanner && (
            <div className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${securityBanner.color}`}>
              {securityBanner.icon}
              <div className="space-y-0.5">
                <p className="font-bold leading-tight">{securityBanner.title}</p>
                <p className="opacity-90">{securityBanner.desc}</p>
              </div>
            </div>
          )}

          {/* Anti-Brute Force Lockout Banner */}
          {lockoutSeconds > 0 && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 animate-bounce" />
              <div>
                <p className="font-bold">Terminal Temporarily Locked</p>
                <p className="text-[11px] opacity-90 font-normal">
                  Too many incorrect PIN attempts. Unlocking in <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{lockoutSeconds}s</span>.
                </p>
              </div>
            </div>
          )}

          {/* Staff Selection Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Select User
              </span>
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                {profiles.length} Staff Profile{profiles.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {profiles.map((p) => {
                const isSelected = p.id === selectedProfileId;
                const isOwner = p.role === 'owner';

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={lockoutSeconds > 0}
                    onClick={() => {
                      setSelectedProfileId(p.id);
                      setPin('');
                      setErrorMsg('');
                    }}
                    className={`group relative flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-600 dark:border-indigo-500 shadow-md shadow-indigo-600/10 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50/80 hover:bg-slate-100/80 dark:bg-slate-800/30 dark:hover:bg-slate-800/60 border-slate-200/80 dark:border-slate-800'
                    } ${lockoutSeconds > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-transform group-hover:scale-105 ${
                        isOwner
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                      }`}
                    >
                      {isOwner ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {p.full_name}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize font-medium">
                        {isOwner ? 'Store Owner' : 'POS Cashier'}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0 ring-4 ring-indigo-200 dark:ring-indigo-900/60" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4-Digit PIN Indicators */}
          <div className="space-y-3 pt-1">
            <div
              className={`flex items-center justify-center gap-4 py-2 transition-transform ${
                isShaking ? 'animate-shake' : ''
              }`}
            >
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = pin.length > idx;
                const isCurrent = pin.length === idx;

                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full transition-all duration-200 flex items-center justify-center ${
                      isFilled
                        ? 'bg-indigo-600 dark:bg-indigo-500 scale-125 shadow-md shadow-indigo-600/30 ring-4 ring-indigo-100 dark:ring-indigo-950'
                        : isCurrent
                        ? 'border-2 border-indigo-400 dark:border-indigo-500 bg-transparent animate-pulse scale-105'
                        : 'border-2 border-slate-300 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50'
                    }`}
                  />
                );
              })}
            </div>

            {/* Error or Active Role Message */}
            {errorMsg ? (
              <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-600 dark:text-rose-400 font-medium animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            ) : isSubmitting ? (
              <div className="flex items-center justify-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent dark:border-indigo-400 dark:border-t-transparent rounded-full animate-spin" />
                <span>Verifying security credentials...</span>
              </div>
            ) : (
              <div className="text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                Logging into shift as <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedStaff?.full_name || 'Staff'}</span>
              </div>
            )}
          </div>

          {/* Touch-Screen POS Keypad */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {[
              { num: '1', letters: '' },
              { num: '2', letters: 'ABC' },
              { num: '3', letters: 'DEF' },
              { num: '4', letters: 'GHI' },
              { num: '5', letters: 'JKL' },
              { num: '6', letters: 'MNO' },
              { num: '7', letters: 'PQRS' },
              { num: '8', letters: 'TUV' },
              { num: '9', letters: 'WXYZ' },
            ].map(({ num, letters }) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(num)}
                disabled={isSubmitting || lockoutSeconds > 0}
                className="h-14 sm:h-15 rounded-2xl bg-slate-100/90 hover:bg-indigo-50/80 active:bg-indigo-100 dark:bg-slate-800/70 dark:hover:bg-indigo-950/40 dark:active:bg-indigo-900/60 text-slate-800 dark:text-slate-100 transition-all duration-150 active:scale-95 border border-slate-200/70 dark:border-slate-700/50 shadow-xs flex flex-col items-center justify-center cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="font-mono text-xl sm:text-2xl font-bold leading-none">{num}</span>
                {letters && (
                  <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider mt-0.5">
                    {letters}
                  </span>
                )}
              </button>
            ))}

            {/* Clear Button */}
            <button
              type="button"
              onClick={handleClear}
              disabled={isSubmitting || pin.length === 0 || lockoutSeconds > 0}
              className="h-14 sm:h-15 rounded-2xl bg-slate-100/90 hover:bg-rose-50 dark:bg-slate-800/70 dark:hover:bg-rose-950/30 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-all duration-150 active:scale-95 border border-slate-200/70 dark:border-slate-700/50 shadow-xs flex flex-col items-center justify-center cursor-pointer select-none disabled:opacity-40"
              title="Clear PIN"
            >
              <RotateCcw className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] font-bold tracking-wider uppercase">CLEAR</span>
            </button>

            {/* Zero (0) */}
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              disabled={isSubmitting || lockoutSeconds > 0}
              className="h-14 sm:h-15 rounded-2xl bg-slate-100/90 hover:bg-indigo-50/80 active:bg-indigo-100 dark:bg-slate-800/70 dark:hover:bg-indigo-950/40 dark:active:bg-indigo-900/60 text-slate-800 dark:text-slate-100 transition-all duration-150 active:scale-95 border border-slate-200/70 dark:border-slate-700/50 shadow-xs flex flex-col items-center justify-center cursor-pointer select-none disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="font-mono text-xl sm:text-2xl font-bold leading-none">0</span>
              <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider mt-0.5">
                +
              </span>
            </button>

            {/* Backspace Button */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting || pin.length === 0 || lockoutSeconds > 0}
              className="h-14 sm:h-15 rounded-2xl bg-slate-100/90 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all duration-150 active:scale-95 border border-slate-200/70 dark:border-slate-700/50 shadow-xs flex flex-col items-center justify-center cursor-pointer select-none disabled:opacity-40"
              title="Delete Digit"
            >
              <Delete className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold tracking-wider uppercase">DEL</span>
            </button>
          </div>
        </div>
      </main>

      {/* Security Info Footer */}
      <footer className="relative z-10 w-full max-w-md mx-auto text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-xs">
          <Shield className="w-3.5 h-3.5" />
          <span>Encrypted Session • Auto-Lock & Brute-Force Protected</span>
        </div>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#070b13] text-slate-500 text-xs font-medium">
          Loading POS terminal security...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
