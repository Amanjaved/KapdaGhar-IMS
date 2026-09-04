'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Store,
  ShieldCheck,
  User,
  Delete,
  Lock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { adminService } from '@/services/adminService';
import { UserProfile } from '@/types';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/';

  const { loginWithPin, isAuthenticated } = useAuth();

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // If already authenticated, push to redirect
  useEffect(() => {
    if (isAuthenticated) {
      router.push(redirectTarget);
    }
  }, [isAuthenticated, redirectTarget, router]);

  // Load available profiles for rapid avatar switching
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
      if (pinToTest.length < 4 || isSubmitting) return;

      setIsSubmitting(true);
      setErrorMsg('');

      try {
        const res = await loginWithPin(pinToTest, selectedProfileId || undefined);
        if (res.success) {
          router.push(redirectTarget);
        } else {
          triggerError(res.message || 'Incorrect PIN. Please try again.');
        }
      } catch (err: any) {
        triggerError(err.message || 'Authentication failed.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, loginWithPin, selectedProfileId, redirectTarget, router]
  );

  const handleKeyPress = useCallback(
    (digit: string) => {
      if (pin.length >= 4) return;
      setErrorMsg('');
      const updated = pin + digit;
      setPin(updated);

      if (updated.length === 4) {
        handleAuthenticate(updated);
      }
    },
    [pin, handleAuthenticate]
  );

  const handleDelete = useCallback(() => {
    setErrorMsg('');
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setErrorMsg('');
    setPin('');
  }, []);

  // Physical keyboard listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
  }, [handleKeyPress, handleDelete, handleClear, handleAuthenticate, pin]);

  const selectedStaff = profiles.find((p) => p.id === selectedProfileId);

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-slate-50 dark:bg-[#070b13] text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 transition-colors">
      {/* Top Header Controls */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <Store className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white">
                Kapda Ghar
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/30">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              फैशन और स्टाइल का संगम
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      {/* Main Login Card Container */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-900/5 dark:shadow-black/40 space-y-6">
          {/* Header Title */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
              <Lock className="w-3.5 h-3.5" />
              <span>POS Terminal Authorization</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Staff Shift Sign-In
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Select your staff role and enter your 4-digit security PIN.
            </p>
          </div>

          {/* Staff Profile Switcher Pills */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center">
              Active User Selection
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {profiles.map((p) => {
                const isSelected = p.id === selectedProfileId;
                const isOwner = p.role === 'owner';

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProfileId(p.id);
                      setPin('');
                      setErrorMsg('');
                    }}
                    className={`relative flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-600 dark:border-indigo-500 shadow-xs ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                        isOwner
                          ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {isOwner ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {p.full_name}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                        {isOwner ? 'Admin' : 'POS Cashier'}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4-Digit Masked Indicators */}
          <div className="space-y-3 pt-1">
            <div
              className={`flex items-center justify-center gap-4 py-3 transition-transform ${
                isShaking ? 'animate-shake' : ''
              }`}
            >
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = pin.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                      isFilled
                        ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 scale-125 shadow-md shadow-indigo-500/40'
                        : 'border-slate-300 dark:border-slate-700 bg-transparent'
                    }`}
                  />
                );
              })}
            </div>

            {/* Error Message */}
            {errorMsg ? (
              <div className="flex items-center justify-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            ) : (
              <div className="text-center text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                {selectedStaff?.role === 'owner' ? 'Admin Access' : `${selectedStaff?.full_name || 'Cashier'} Access`}
              </div>
            )}
          </div>

          {/* Numeric Keypad (Touchscreen POS Ready) */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit)}
                disabled={isSubmitting}
                className="h-13 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 active:bg-indigo-100 dark:active:bg-indigo-900/60 border border-slate-200/80 dark:border-slate-700/60 text-lg font-bold text-slate-800 dark:text-slate-100 transition-all active:scale-95 flex items-center justify-center cursor-pointer select-none"
              >
                {digit}
              </button>
            ))}

            {/* Clear Button */}
            <button
              type="button"
              onClick={handleClear}
              disabled={isSubmitting || pin.length === 0}
              className="h-13 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200/80 dark:border-slate-700/60 transition-all active:scale-95 flex items-center justify-center cursor-pointer select-none disabled:opacity-40"
            >
              CLEAR
            </button>

            {/* Zero (0) */}
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              disabled={isSubmitting}
              className="h-13 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 active:bg-indigo-100 dark:active:bg-indigo-900/60 border border-slate-200/80 dark:border-slate-700/60 text-lg font-bold text-slate-800 dark:text-slate-100 transition-all active:scale-95 flex items-center justify-center cursor-pointer select-none"
            >
              0
            </button>

            {/* Backspace Button */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting || pin.length === 0}
              className="h-13 rounded-2xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60 transition-all active:scale-95 flex items-center justify-center cursor-pointer select-none disabled:opacity-40"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Helper Badge & 1-Click Fill Chips */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="font-semibold flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-indigo-500" />
                Quick PIN Fill:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const owner = profiles.find((p) => p.role === 'owner');
                    if (owner) setSelectedProfileId(owner.id);
                    setPin('9044');
                    handleAuthenticate('9044');
                  }}
                  className="px-2 py-0.5 rounded-md bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 font-mono text-[10px] font-bold border border-purple-500/30 cursor-pointer transition-colors"
                >
                  Admin (9044)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const salman = profiles.find((p) => p.full_name.toLowerCase().includes('salman'));
                    if (salman) setSelectedProfileId(salman.id);
                    setPin('1234');
                    handleAuthenticate('1234');
                  }}
                  className="px-2 py-0.5 rounded-md bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 font-mono text-[10px] font-bold border border-sky-500/30 cursor-pointer transition-colors"
                >
                  Salman (1234)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cashier = profiles.find((p) => p.role === 'cashier' && !p.full_name.toLowerCase().includes('salman')) || profiles[1];
                    if (cashier) setSelectedProfileId(cashier.id);
                    setPin('1234');
                    handleAuthenticate('1234');
                  }}
                  className="px-2 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30 cursor-pointer transition-colors"
                >
                  Cashier (1234)
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
              Admin unlocks full system administration & database tables.
            </p>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-md mx-auto text-center space-y-1">
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Protected by Row-Level Security & Encrypted Offline Storage
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-[#070b13] text-slate-500 text-xs font-medium">
          Loading terminal security...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

