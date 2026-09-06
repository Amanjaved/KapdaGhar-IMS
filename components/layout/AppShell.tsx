'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { DesktopSidebar } from '@/components/layout/DesktopSidebar';
import { TopHeader } from '@/components/layout/TopHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { AuthProvider } from '@/components/auth/AuthProvider';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <AuthProvider>
      {isLoginPage ? (
        <main className="flex-1 min-h-screen w-full flex flex-col">{children}</main>
      ) : (
        <>
          {/* Desktop Sidebar */}
          <DesktopSidebar />

          {/* Main Content Area */}
          <div className="flex-1 md:pl-64 flex flex-col min-h-screen transition-all">
            <TopHeader />
            <main className="flex-1 max-w-[1400px] w-full mx-auto p-3.5 sm:p-6 lg:p-8 pb-32 sm:pb-36 md:pb-12">
              {children}
            </main>
          </div>

          {/* Mobile Bottom Navigation */}
          <BottomNav />
        </>
      )}
    </AuthProvider>
  );
}
