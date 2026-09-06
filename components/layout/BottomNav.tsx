'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, ShoppingCart, ReceiptText, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Home', href: '/', icon: LayoutDashboard },
    { label: 'Stock', href: '/inventory', icon: Package },
    { label: 'Sell', href: '/sell', icon: ShoppingCart, isSpecial: true },
    { label: 'Sales', href: '/sales', icon: ReceiptText },
    { label: 'Reports', href: '/reports', icon: BarChart3 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0d1322]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 md:hidden transition-colors shadow-lg pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around h-15 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.isSpecial) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative -top-3.5 flex flex-col items-center justify-center group focus:outline-none"
              >
                <div
                  className={cn(
                    'w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl ring-4 ring-white dark:ring-[#0d1322] transition-all duration-200 active:scale-90',
                    isActive
                      ? 'bg-indigo-600 shadow-indigo-600/40 text-white scale-105'
                      : 'bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-500 shadow-indigo-600/35 text-white'
                  )}
                >
                  <ShoppingCart className="w-5 h-5 stroke-[2.4]" />
                </div>
                <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5 uppercase tracking-wider">
                  Sell
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all active:scale-95 relative',
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-400 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              <div className="relative">
                <Icon className={cn('w-4.5 h-4.5 mb-0.5 transition-transform', isActive ? 'stroke-[2.4] scale-110' : 'stroke-[1.8]')} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                )}
              </div>
              <span className="text-[10px] tracking-tight leading-tight mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
