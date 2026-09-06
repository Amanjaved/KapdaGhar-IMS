'use client';

import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { productService } from '@/services/productService';
import { getDB } from '@/lib/indexeddb/db';
import { syncEngine } from '@/lib/offline/syncEngine';

let realtimeChannel: any = null;
let broadcastChannel: BroadcastChannel | null = null;

export type BroadcastChangeType =
  | 'CATALOG_UPDATED'
  | 'STOCK_UPDATED'
  | 'SALES_UPDATED'
  | 'CATALOG_WIPED'
  | 'SALES_WIPED';

async function handleCatalogWiped() {
  productService.clearMemoryCache();
  const db = await getDB();
  if (db) {
    try {
      for (const store of ['products', 'inventory', 'inventory_movements', 'categories']) {
        if (db.objectStoreNames.contains(store as any)) {
          await db.clear(store as any);
        }
      }
    } catch (e) {
      console.warn('Failed clearing local catalog stores on wipe:', e);
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('catalog-refreshed'));
  }
}

async function handleSalesWiped() {
  const db = await getDB();
  if (db) {
    try {
      for (const store of ['sales', 'sale_items', 'pending_sales', 'inventory_movements']) {
        if (db.objectStoreNames.contains(store as any)) {
          await db.clear(store as any);
        }
      }
    } catch (e) {
      console.warn('Failed clearing local sales stores on wipe:', e);
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sales-refreshed'));
  }
}

export function initRealtimeSync() {
  if (typeof window === 'undefined') return;

  // 1. Cross-tab BroadcastChannel for 0ms instant tab-to-tab sync
  if (!broadcastChannel && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      broadcastChannel = new BroadcastChannel('kapda-ghar-sync');
      broadcastChannel.onmessage = async (event) => {
        const { type, data } = event.data || {};
        if (type === 'CATALOG_WIPED') {
          await handleCatalogWiped();
        } else if (type === 'SALES_WIPED') {
          await handleSalesWiped();
        } else if (type === 'CATALOG_UPDATED') {
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
      .on('broadcast', { event: 'CATALOG_WIPED' }, async () => {
        await handleCatalogWiped();
      })
      .on('broadcast', { event: 'SALES_WIPED' }, async () => {
        await handleSalesWiped();
      })
      .on('broadcast', { event: 'CATALOG_UPDATED' }, () => {
        productService.invalidateCache();
        window.dispatchEvent(new CustomEvent('catalog-refreshed'));
      })
      .on('broadcast', { event: 'STOCK_UPDATED' }, (payload: any) => {
        if (payload?.payload?.productId) {
          productService.updateLocalProductStock(payload.payload.productId, payload.payload.newQuantity);
          window.dispatchEvent(new CustomEvent('catalog-refreshed'));
        }
      })
      .on('broadcast', { event: 'SALES_UPDATED' }, () => {
        window.dispatchEvent(new CustomEvent('sales-refreshed'));
      })
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
          if (syncEngine) {
            await syncEngine.runFullAutoSync();
          } else {
            await productService.syncProductsFromCloud();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        async () => {
          if (syncEngine) {
            await syncEngine.runFullAutoSync();
          } else {
            await productService.syncCategoriesFromCloud();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        async () => {
          if (syncEngine) {
            await syncEngine.runFullAutoSync();
          } else {
            window.dispatchEvent(new CustomEvent('sales-refreshed'));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('⚡ Realtime connected: live auto-sync active for stock, catalog, and sales.');
        }
      });
  } catch (err) {
    console.warn('Supabase Realtime subscription error:', err);
  }
}

export function broadcastLocalChange(
  type: BroadcastChangeType,
  data?: any
) {
  // 1. Cross-tab BroadcastChannel
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type, data });
    } catch (e) {}
  }

  // 2. Cross-device Supabase Realtime broadcast (Phone <-> Laptop <-> Desktop)
  if (realtimeChannel) {
    try {
      realtimeChannel.send({
        type: 'broadcast',
        event: type,
        payload: data || {},
      });
    } catch (e) {
      console.warn('Realtime broadcast error:', e);
    }
  }
}
