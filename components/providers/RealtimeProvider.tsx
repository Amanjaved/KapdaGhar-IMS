'use client';

import { useEffect } from 'react';
import { initRealtimeSync } from '@/lib/supabase/realtime';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initRealtimeSync();
  }, []);

  return <>{children}</>;
}
