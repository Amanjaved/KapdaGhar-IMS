'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, ShoppingCart, ReceiptText, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Overview', href: '/', icon: LayoutDashboard },
    { label: 'Stock', href: '/inventory', icon: Package },
    { label: 'POS', href: '/sell', icon: ShoppingCart, isSpecial: true },
    { label: 'Sales', href: '/sales', icon: ReceiptText },
    { label: 'Reports', href: '/reports', icon: BarChart3 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0d1322]/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800/80 md:hidden pb-safe transition-colors shadow-lg">
      <div className="flex items-center justify-around h-16 px-3 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          if (item.isSpecial) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative -top-4 flex flex-col items-center justify-center group focus:outline-none"
              >
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95 border',
                    isActive
                      ? 'bg-indigo-600 border-indigo-400/50 shadow-indigo-600/30 text-white'
                      : 'bg-gradient-to-tr from-indigo-600 to-indigo-500 border-indigo-400/30 shadow-indigo-600/25 text-white'
                  )}
                >
                  <ShoppingCart className="w-5 h-5 stroke-[2.4]" />
                </div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-1 uppercase tracking-wider">
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
                'flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-colors active:scale-95',
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              )}
            >
              <Icon className={cn('w-4 h-4 mb-1', isActive ? 'stroke-[2.4]' : 'stroke-[1.8]')} />
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
