'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { syncEngine } from '@/lib/offline/syncEngine';
import { Wifi, WifiOff, RefreshCw, Store, Plus, ShoppingCart, ShieldCheck, LogOut, User } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useAuth } from '@/components/auth/AuthProvider';

export function TopHeader() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
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
      syncEngine.syncPendingTransactions();
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
    <header className="sticky top-0 z-20 bg-white/90 dark:bg-[#0d1322]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 h-16 flex items-center justify-between transition-colors">
      {/* Left: Mobile Brand & Desktop Breadcrumbs */}
      <div className="flex items-center gap-3">
        {/* Mobile-only logo */}
        <div className="md:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
            KG
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">Kapda Ghar</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Retail Suite</p>
          </div>
        </div>

        {/* Desktop Breadcrumbs */}
        <div className="hidden md:flex items-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">{pageInfo.section}</span>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-slate-900 dark:text-slate-200 font-semibold">{pageInfo.title}</span>
        </div>
      </div>

      {/* Right: Quick Actions, Theme Toggle & Connectivity Status */}
      <div className="flex items-center gap-2">
        {/* Quick Add Product Shortcut on Desktop */}
        <Link
          href="/products/new"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Product</span>
        </Link>

        {/* Admin Console Shortcut (Only visible to Admin / Store Owner) */}
        {isAdmin && (
          <Link
            href="/admin"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Admin Console & Database Hub"
          >
            <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </Link>
        )}

        {/* Theme Toggle Button */}
        <ThemeToggle />

        {/* User Session Pill with Logout */}
        {user && (
          <div className="flex items-center gap-1.5 pl-1">
            <div
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                isAdmin
                  ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
              }`}
            >
              {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              <span>{user.full_name}</span>
            </div>
            <button
              onClick={logout}
              title="Log Out / Lock Register"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Sync / Connectivity Status */}
        {status.isSyncing ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium border border-indigo-500/20">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="hidden sm:inline">Syncing...</span>
          </div>
        ) : !status.isOnline ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium border border-amber-500/20">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline ({status.pendingCount})</span>
          </div>
        ) : status.pendingCount > 0 ? (
          <button
            onClick={handleManualSync}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-medium border border-amber-500/30 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync ({status.pendingCount})</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Online</span>
          </div>
        )}
      </div>
    </header>
  );
}
