'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { syncEngine } from '@/lib/offline/syncEngine';
import { Wifi, WifiOff, RefreshCw, Store, Plus, ShoppingCart, ShieldCheck, LogOut, User, Settings, Lock } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useAuth } from '@/components/auth/AuthProvider';

export function TopHeader() {
  const pathname = usePathname();
  const { user, isAdmin, logout, lockTerminal } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [status, setStatus] = useState<{
    isOnline: boolean;
    isSyncing: boolean;
    pendingCount: number;
  }>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
  });

  useEffect(() => {
    if (!syncEngine) return;
    const unsubscribe = syncEngine.subscribe((s) => {
      setStatus({
        isOnline: s.isOnline,
        isSyncing: s.isSyncing,
        pendingCount: s.pendingCount,
      });
    });
    return () => unsubscribe();
  }, []);

  const handleManualSync = () => {
    if (syncEngine) {
      syncEngine.runFullAutoSync();
    }
  };

  const getPageTitle = () => {
    switch (pathname) {
      case '/':
        return { section: 'Overview', title: 'Dashboard' };
      case '/sell':
        return { section: 'Counter', title: 'Scan & Sell (POS)' };
      case '/inventory':
        return { section: 'Catalog', title: 'Inventory Stock' };
      case '/products/new':
        return { section: 'Catalog', title: 'New Product' };
      case '/sales':
        return { section: 'Finance', title: 'Sales History' };
      case '/reports':
        return { section: 'Finance', title: 'Reports & Margins' };
      case '/settings':
        return { section: 'Config', title: 'Settings' };
      case '/admin':
        return { section: 'Admin', title: 'Console & Database Hub' };
      default:
        return { section: 'Store', title: 'Kapda Ghar' };
    }
  };

  const pageInfo = getPageTitle();

  return (
    <>
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#0d1322]/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 px-3.5 sm:px-6 h-15 sm:h-16 flex items-center justify-between transition-colors shadow-2xs">
        {/* Left: Mobile Brand & Desktop Breadcrumbs */}
        <div className="flex items-center gap-3">
          {/* Mobile-only logo */}
          <Link href="/" className="md:hidden flex items-center gap-2.5 active:scale-95 transition-transform">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black text-xs shadow-md shadow-indigo-600/20 shrink-0">
              KG
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs font-extrabold text-slate-900 dark:text-white leading-tight tracking-tight">
                  Kapda Ghar
                </h1>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Retail POS & Stock</p>
            </div>
          </Link>

          {/* Desktop Breadcrumbs */}
          <div className="hidden md:flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">{pageInfo.section}</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="text-slate-900 dark:text-slate-200 font-semibold">{pageInfo.title}</span>
          </div>
        </div>

        {/* Right: Quick Actions & Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Add Product Shortcut on Desktop */}
          <Link
            href="/products/new"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Product</span>
          </Link>

          {/* Admin Console Shortcut (Desktop only - mobile opens via Profile Sheet) */}
          {isAdmin && (
            <Link
              href="/admin"
              className="hidden md:inline-flex p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Admin Console & Database Hub"
            >
              <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </Link>
          )}

          {/* Settings Button (Desktop only) */}
          <Link
            href="/settings"
            className={`hidden md:inline-flex p-2 rounded-lg transition-colors ${
              pathname === '/settings'
                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Store & Database Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Auto-Sync Live Indicator */}
          {status.isSyncing ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium border border-indigo-500/20 shadow-xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline font-semibold">Syncing</span>
            </div>
          ) : !status.isOnline ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium border border-amber-500/20">
              <WifiOff className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Offline</span>
            </div>
          ) : status.pendingCount > 0 ? (
            <button
              onClick={handleManualSync}
              title="Pending offline items — click to sync now"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-semibold border border-amber-500/30 transition-colors cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Sync ({status.pendingCount})</span>
            </button>
          ) : (
            <button
              onClick={handleManualSync}
              title="Auto-Sync active (tap to sync)"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20 hover:bg-emerald-500/15 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="hidden sm:inline font-semibold">Auto-Sync</span>
            </button>
          )}

          {/* Desktop User Session Actions */}
          {user && (
            <div className="hidden md:flex items-center gap-1.5 pl-1">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                  isAdmin
                    ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                }`}
              >
                {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                <span>{user.full_name}</span>
              </div>
              <button
                onClick={lockTerminal}
                title="Lock Terminal (Require PIN)"
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock</span>
              </button>
              <button
                onClick={() => logout()}
                title="Log Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Mobile Profile & Quick Actions Menu Trigger */}
          {user && (
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 active:scale-95 transition-all cursor-pointer"
              title="Open Staff Menu"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
            </button>
          )}
        </div>
      </header>

      {/* Mobile Staff Actions Sheet Modal */}
      {isMobileMenuOpen && user && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-white dark:bg-[#0f1523] rounded-t-3xl border-t border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-250 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          >
            {/* Sheet Handle */}
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto" />

            {/* Profile Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-base font-bold shadow-sm">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {user.full_name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                        isAdmin
                          ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                      }`}
                    >
                      {isAdmin ? 'Store Owner (Admin)' : 'POS Cashier'}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">PIN: {user.pin_code || '9044'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Action Links */}
            <div className="space-y-2">
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-800/40 text-purple-900 dark:text-purple-200 text-xs font-semibold active:scale-98 transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Admin Console & Database Hub</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-200/50 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300">
                    PIN 9044
                  </span>
                </Link>
              )}

              <Link
                href="/settings"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold active:scale-98 transition-all"
              >
                <Settings className="w-4 h-4 text-slate-500" />
                <span>Store & Tax Settings</span>
              </Link>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  lockTerminal();
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-xs font-semibold active:scale-98 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>Lock Register Terminal</span>
                </div>
                <span className="text-[10px] text-amber-700 dark:text-amber-300">Requires PIN</span>
              </button>

              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 text-xs font-semibold active:scale-98 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Log Out Completely</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
