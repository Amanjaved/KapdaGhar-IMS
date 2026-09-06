'use client';

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { productService } from '@/services/productService';
import { getDB } from '@/lib/indexeddb/db';

let realtimeChannel: any = null;
let broadcastChannel: BroadcastChannel | null = null;

export function initRealtimeSync() {
  if (typeof window === 'undefined') return;

  // 1. Cross-tab BroadcastChannel for 0ms instant tab-to-tab sync
  if (!broadcastChannel && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      broadcastChannel = new BroadcastChannel('kapda-ghar-sync');
      broadcastChannel.onmessage = (event) => {
        const { type, data } = event.data || {};
        if (type === 'CATALOG_UPDATED') {
          productService.invalidateCache();
          window.dispatchEvent(new CustomEvent('catalog-refreshed'));
        } else if (type === 'STOCK_UPDATED' && data) {
          productService.updateLocalProductStock(data.productId, data.newQuantity);
          window.dispatchEvent(new CustomEvent('catalog-refreshed'));
        } else if (type === 'SALES_UPDATED') {
          window.dispatchEvent(new CustomEvent('sales-refreshed'));
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }

  // 2. Supabase Realtime WebSocket for live multi-device / multi-user sync
  if (realtimeChannel || !isSupabaseConfigured()) return;

  try {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    realtimeChannel = supabase
      .channel('kapda-ghar-live-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        async (payload) => {
          if (payload.new && (payload.new as any).product_id) {
            const pid = (payload.new as any).product_id;
            const qty = Number((payload.new as any).quantity) || 0;
            productService.updateLocalProductStock(pid, qty);

            // Update IndexedDB
            const db = await getDB();
            if (db) {
              try {
                const tx = db.transaction('inventory', 'readwrite');
                await tx.store.put({
                  id: (payload.new as any).id || `inv-${pid}`,
                  product_id: pid,
                  quantity: qty,
                  updated_at: (payload.new as any).updated_at || new Date().toISOString(),
                });
                await tx.done;
              } catch (dbErr) {
                console.warn('Realtime local DB update warning:', dbErr);
              }
            }

            window.dispatchEvent(new CustomEvent('catalog-refreshed'));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        async () => {
          await productService.syncProductsFromCloud();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        () => {
          window.dispatchEvent(new CustomEvent('sales-refreshed'));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('⚡ Realtime connected: live stock and sales updates active.');
        }
      });
  } catch (err) {
    console.warn('Supabase Realtime subscription error:', err);
  }
}

export function broadcastLocalChange(
  type: 'CATALOG_UPDATED' | 'STOCK_UPDATED' | 'SALES_UPDATED',
  data?: any
) {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type, data });
    } catch (e) {}
  }
}
