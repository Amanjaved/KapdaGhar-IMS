'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ReceiptText,
  BarChart3,
  PlusCircle,
  Settings,
  Store,
  ShieldCheck,
  LogOut,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/components/auth/AuthProvider';

export function DesktopSidebar() {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  const links = [
    {
      label: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
    },
    {
      label: 'Scan & Sell',
      href: '/sell',
      icon: ShoppingCart,
      badge: 'POS',
      highlight: true,
    },
    {
      label: 'Inventory Stock',
      href: '/inventory',
      icon: Package,
    },
    {
      label: 'Add Product',
      href: '/products/new',
      icon: PlusCircle,
    },
    {
      label: 'Sales History',
      href: '/sales',
      icon: ReceiptText,
    },
    {
      label: 'Reports & Analytics',
      href: '/reports',
      icon: BarChart3,
    },
    ...(isAdmin
      ? [
          {
            label: 'Admin Console',
            href: '/admin',
            icon: ShieldCheck,
            badge: 'Admin',
          },
        ]
      : []),
    {
      label: 'Settings',
      href: '/settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white dark:bg-[#0d1322] border-r border-slate-200 dark:border-slate-800/80 z-30 transition-colors">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#090d16]/50">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-xs border border-indigo-400/30">
          <Store className="w-5 h-5 text-white stroke-[2.2]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-none truncate">
              Kapda Ghar
            </h2>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-500/30">
              PRO
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium truncate">
            Retail POS & Stock
          </p>
        </div>
      </div>

      {/* POS Button */}
      <div className="p-3">
        <Link
          href="/sell"
          className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-[0.98] border border-indigo-400/30"
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
            <span>Open Register</span>
          </div>
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-700/60 text-indigo-200 font-mono">
            F2
          </kbd>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Management
        </div>
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all',
                isActive
                  ? 'bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white font-semibold border border-slate-200 dark:border-slate-700/70 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/40'
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={cn(
                    'w-4 h-4 transition-colors',
                    isActive
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                  )}
                />
                <span>{link.label}</span>
              </div>
              {link.badge && (
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider',
                    isActive
                      ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-300'
                  )}
                >
                  {link.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer / User Profile & Terminal Info */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#090d16]/50 space-y-2">
        {user && (
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                  isAdmin
                    ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {user.full_name}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                  {isAdmin ? 'Store Owner' : 'POS Cashier'}
                </div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out / Switch Shift"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Terminal 01
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800/60 px-1.5 py-0.5 rounded">
            v1.0
          </span>
        </div>
      </div>
    </aside>
  );
}