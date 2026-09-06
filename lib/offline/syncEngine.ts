import { getDB } from '@/lib/indexeddb/db';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateUUID, isValidUUID, toValidUUID } from '@/lib/utils/uuid';
import { productService } from '@/services/productService';
import { salesService } from '@/services/salesService';

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt?: Date;
  autoSyncEnabled: boolean;
  autoSyncIntervalSeconds: number;
  error?: string;
  lastSyncResult?: string;
}

export type SyncListener = (status: SyncStatus) => void;

class SyncEngine {
  private listeners: Set<SyncListener> = new Set();
  private isSyncing = false;
  private lastSyncedAt?: Date;
  private pendingCount = 0;
  private autoSyncTimer: any = null;
  private autoSyncEnabled = true;
  private autoSyncIntervalSeconds = 10;
  private lastSyncResult?: string;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedEnabled = localStorage.getItem('kapda_ghar_auto_sync_enabled');
        if (savedEnabled !== null) {
          this.autoSyncEnabled = savedEnabled === 'true';
        }
        const savedInterval = localStorage.getItem('kapda_ghar_auto_sync_interval');
        if (savedInterval) {
          const parsed = parseInt(savedInterval, 10);
          if (!isNaN(parsed) && parsed >= 5) {
            this.autoSyncIntervalSeconds = parsed;
          }
        }
      } catch {}

      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.notify());

      // Immediate auto-sync when waking screen or focusing tab on mobile / desktop
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.autoSyncEnabled) {
          this.runFullAutoSync();
        }
      });
      window.addEventListener('focus', () => {
        if (this.autoSyncEnabled) {
          this.runFullAutoSync();
        }
      });

      this.updatePendingCount();
      this.startAutoSync();
    }
  }

  public subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    listener({
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      autoSyncEnabled: this.autoSyncEnabled,
      autoSyncIntervalSeconds: this.autoSyncIntervalSeconds,
      lastSyncResult: this.lastSyncResult,
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(error?: string, result?: string) {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (result) this.lastSyncResult = result;
    const status: SyncStatus = {
      isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      autoSyncEnabled: this.autoSyncEnabled,
      autoSyncIntervalSeconds: this.autoSyncIntervalSeconds,
      error,
      lastSyncResult: this.lastSyncResult,
    };
    for (const listener of this.listeners) {
      listener(status);
    }
  }

  public startAutoSync() {
    if (typeof window === 'undefined') return;
    this.stopAutoSync();

    if (!this.autoSyncEnabled) return;

    // Run initial auto-sync after 1.5s
    setTimeout(() => {
      this.runFullAutoSync();
    }, 1500);

    this.autoSyncTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && this.autoSyncEnabled) {
        this.runFullAutoSync();
      }
    }, this.autoSyncIntervalSeconds * 1000);
  }

  public stopAutoSync() {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  public setAutoSyncEnabled(enabled: boolean) {
    this.autoSyncEnabled = enabled;
    try {
      localStorage.setItem('kapda_ghar_auto_sync_enabled', enabled ? 'true' : 'false');
    } catch {}
    if (enabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
    this.notify();
  }

  public setAutoSyncInterval(seconds: number) {
    this.autoSyncIntervalSeconds = Math.max(5, seconds);
    try {
      localStorage.setItem('kapda_ghar_auto_sync_interval', this.autoSyncIntervalSeconds.toString());
    } catch {}
    if (this.autoSyncEnabled) {
      this.startAutoSync();
    }
    this.notify();
  }

  public getAutoSyncSettings() {
    return {
      enabled: this.autoSyncEnabled,
      intervalSeconds: this.autoSyncIntervalSeconds,
      lastSyncedAt: this.lastSyncedAt,
      lastSyncResult: this.lastSyncResult,
    };
  }

  public async runFullAutoSync(force: boolean = false): Promise<{
    success: boolean;
    syncedCount: number;
    errors: number;
    message: string;
  }> {
    if (this.isSyncing) {
      return { success: false, syncedCount: 0, errors: 0, message: 'Sync already in progress' };
    }

    if (!isSupabaseConfigured() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      await this.updatePendingCount();
      this.notify();
      return { success: false, syncedCount: 0, errors: 0, message: 'Offline' };
    }

    this.isSyncing = true;
    this.notify();

    let totalUploaded = 0;
    let totalErrors = 0;
    let statusMsg = '';

    try {
      // 1. Push any local products created offline (e.g. map 2)
      const pushRes = await productService.pushLocalCatalogToCloud();
      totalUploaded += pushRes.uploaded;
      totalErrors += pushRes.errors;

      // 2. Push any offline pending sales directly
      const salesRes = await this.executePendingTransactionsSync();
      totalUploaded += salesRes.syncedCount;
      totalErrors += salesRes.errors;
      if (salesRes.lastError && !statusMsg) {
        statusMsg = salesRes.lastError;
      }

      // 3. Pull latest sales from Supabase (keeps multiple terminals and phones in sync)
      try {
        await salesService.syncSalesFromCloud();
      } catch (salesErr) {
        console.warn('Sync sales from cloud error:', salesErr);
      }

      // 4. Pull latest categories from Supabase
      await productService.syncCategoriesFromCloud();

      // 5. Pull latest products and inventory from Supabase (purges deleted items)
      await productService.syncProductsFromCloud();

      // 6. Notify all open tabs and UI pages
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('catalog-refreshed'));
        window.dispatchEvent(new CustomEvent('sales-refreshed'));
      }

      this.lastSyncedAt = new Date();
      if (totalErrors > 0) {
        statusMsg = `Sync warning: ${totalErrors} item(s) failed (${statusMsg || 'retry'})`;
      } else if (totalUploaded > 0) {
        statusMsg = `Synced ${totalUploaded} item(s) with cloud`;
      } else {
        statusMsg = `Up to date (${this.lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      }
    } catch (err: any) {
      console.warn('Auto-sync cycle warning:', err);
      totalErrors++;
      statusMsg = err?.message || 'Sync error';
    } finally {
      this.isSyncing = false;
      await this.updatePendingCount();
      this.notify(totalErrors > 0 ? statusMsg : undefined, statusMsg);
    }

    return {
      success: totalErrors === 0,
      syncedCount: totalUploaded,
      errors: totalErrors,
      message: statusMsg,
    };
  }

  private async updatePendingCount(): Promise<number> {
    const db = await getDB();
    if (!db) return 0;

    const allPending = await db.getAll('pending_sales');
    const unsynced = allPending.filter((p) => !p.synced);
    this.pendingCount = unsynced.length;
    return this.pendingCount;
  }

  public getPendingCount(): number {
    return this.pendingCount;
  }

  public async clearPendingQueue(): Promise<{ clearedCount: number }> {
    const db = await getDB();
    if (!db) return { clearedCount: 0 };

    let clearedCount = 0;
    if (db.objectStoreNames.contains('pending_sales')) {
      const all = await db.getAll('pending_sales');
      clearedCount = all.length;
      await db.clear('pending_sales');
    }

    await this.updatePendingCount();
    this.notify(undefined, `Cleared ${clearedCount} pending transaction(s)`);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sales-refreshed'));
    }
    return { clearedCount };
  }

  private async handleOnline() {
    this.notify();
    await this.runFullAutoSync();
  }

  public async syncPendingTransactions(): Promise<{ syncedCount: number; errors: number; lastError?: string }> {
    if (this.isSyncing) return { syncedCount: 0, errors: 0 };
    if (!isSupabaseConfigured() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      await this.updatePendingCount();
      this.notify();
      return { syncedCount: 0, errors: 0 };
    }

    this.isSyncing = true;
    this.notify();
    try {
      const res = await this.executePendingTransactionsSync();
      if (res.syncedCount > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sales-refreshed'));
      }
      return res;
    } finally {
      this.isSyncing = false;
      await this.updatePendingCount();
      this.notify();
    }
  }

  /**
   * Internal execution of pending sales sync (caller controls isSyncing guard)
   */
  private async executePendingTransactionsSync(): Promise<{ syncedCount: number; errors: number; lastError?: string }> {
    if (!isSupabaseConfigured() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      await this.updatePendingCount();
      return { syncedCount: 0, errors: 0 };
    }

    const db = await getDB();
    if (!db) return { syncedCount: 0, errors: 0 };

    let syncedCount = 0;
    let errors = 0;
    let lastError: string | undefined;

    const businessId = process.env.NEXT_PUBLIC_BUSINESS_ID || 'b0000000-0000-0000-0000-000000000001';
    const defaultCategory = 'c0000000-0000-0000-0000-000000000001';

    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase client uninitialized');

      const allPending = await db.getAll('pending_sales');
      const unsynced = allPending.filter((p) => !p.synced);

      if (unsynced.length === 0) {
        return { syncedCount: 0, errors: 0 };
      }

      const allLocalProducts = await db.getAll('products');

      // 1. Build migration map for any non-UUID product IDs (e.g. prod-17885... or p0000000-...)
      const idMap = new Map<string, string>();
      for (const p of allLocalProducts) {
        const validId = toValidUUID(p.id);
        if (validId !== p.id) {
          idMap.set(p.id, validId);
        }
      }

      for (const pending of unsynced) {
        for (const item of pending.items) {
          if (!isValidUUID(item.product_id)) {
            idMap.set(item.product_id, toValidUUID(item.product_id));
          }
        }
      }

      // If any IDs require normalization in local IndexedDB, migrate them safely
      if (idMap.size > 0) {
        try {
          const migTx = db.transaction(['products', 'inventory', 'pending_sales'], 'readwrite');
          for (const [oldId, newId] of idMap.entries()) {
            const oldProd = await migTx.objectStore('products').get(oldId);
            if (oldProd) {
              await migTx.objectStore('products').delete(oldId);
              await migTx.objectStore('products').put({ ...oldProd, id: newId });
            }
            const oldInv = await migTx.objectStore('inventory').get(`inv-${oldId}`);
            if (oldInv) {
              await migTx.objectStore('inventory').delete(`inv-${oldId}`);
              await migTx.objectStore('inventory').put({ ...oldInv, id: `inv-${newId}`, product_id: newId });
            }
          }
          for (const pending of unsynced) {
            let modified = false;
            for (const item of pending.items) {
              if (idMap.has(item.product_id)) {
                item.product_id = idMap.get(item.product_id)!;
                modified = true;
              }
            }
            if (modified) {
              await migTx.objectStore('pending_sales').put(pending);
            }
          }
          await migTx.done;
        } catch (migErr) {
          console.warn('Local ID migration warning:', migErr);
        }
      }

      // 2. Ensure every product involved in an unsynced transaction exists in Supabase
      for (const pending of unsynced) {
        for (const item of pending.items) {
          const targetProdId = toValidUUID(item.product_id);
          try {
            const { data: remoteProd } = await supabase
              .from('products')
              .select('id, is_active')
              .eq('id', targetProdId)
              .maybeSingle();

            if (!remoteProd) {
              // Fetch local product details
              const localProd = (await db.get('products', targetProdId)) || (await db.get('products', item.product_id));
              let catId = localProd && isValidUUID(localProd.category_id) ? localProd.category_id : defaultCategory;

              // Ensure the category exists in Supabase to respect foreign key constraint
              const { data: remoteCat } = await supabase.from('categories').select('id').eq('id', catId).maybeSingle();
              if (!remoteCat) {
                const localCat = await db.get('categories', catId);
                await supabase.from('categories').upsert({
                  id: catId,
                  business_id: businessId,
                  name: localCat?.name || 'General',
                  is_active: true,
                });
              }

              await supabase.from('products').insert({
                id: targetProdId,
                business_id: businessId,
                category_id: catId,
                name: localProd?.name || item.product_name || 'Custom Product',
                sku: localProd?.sku || null,
                barcode: localProd?.barcode || null,
                description: localProd?.description || null,
                image_url: localProd?.image_url || null,
                purchase_price: localProd?.purchase_price ?? item.purchase_price ?? 0,
                selling_price: localProd?.selling_price ?? item.selling_price ?? 0,
                low_stock_threshold: localProd?.low_stock_threshold || 5,
                is_active: true,
              });

              // Ensure inventory row exists with enough stock
              await supabase.from('inventory').upsert(
                {
                  business_id: businessId,
                  product_id: targetProdId,
                  quantity: Math.max(localProd?.quantity ?? 10, item.quantity + 10),
                },
                { onConflict: 'product_id' }
              );
            } else if (!remoteProd.is_active) {
              await supabase.from('products').update({ is_active: true }).eq('id', targetProdId);
            }
          } catch (prepErr) {
            console.warn('Product pre-sync check warning:', prepErr);
          }
        }
      }

      // 3. Process each unsynced sale atomically via complete_sale RPC
      for (const pending of unsynced) {
        try {
          const rpcItems = pending.items.map((i) => ({
            product_id: toValidUUID(i.product_id),
            quantity: i.quantity,
          }));

          const validTxId = toValidUUID(pending.client_transaction_id);

          const { data, error } = await supabase.rpc('complete_sale', {
            p_items: rpcItems,
            p_discount: pending.discount,
            p_payment_method: pending.payment_method,
            p_client_transaction_id: validTxId,
            p_receipt_number: pending.receipt_number,
            p_business_id: businessId,
            p_notes: pending.notes || null,
          });

          if (error) {
            console.warn(`Sync error for transaction ${pending.receipt_number}:`, error.message);
            errors++;
            lastError = error.message;
            pending.sync_error = error.message;
            await db.put('pending_sales', pending);
          } else if (data?.success || data?.is_duplicate) {
            // Remove from pending outbox queue
            try {
              await db.delete('pending_sales', pending.client_transaction_id);
              if (validTxId !== pending.client_transaction_id) {
                await db.delete('pending_sales', validTxId);
              }
            } catch {
              pending.synced = true;
              pending.sync_error = undefined;
              await db.put('pending_sales', pending);
            }
            syncedCount++;
          } else {
            const msg = data?.message || 'Transaction could not be confirmed';
            errors++;
            lastError = msg;
            pending.sync_error = msg;
            await db.put('pending_sales', pending);
          }
        } catch (err: any) {
          console.warn(`Exception syncing sale ${pending.receipt_number}:`, err);
          errors++;
          lastError = err?.message || 'Unknown network error';
        }
      }

      this.lastSyncedAt = new Date();
    } catch (err: any) {
      console.warn('Sync engine run failed:', err);
      lastError = err?.message || 'Sync engine error';
    }

    return { syncedCount, errors, lastError };
  }
}

export const syncEngine = typeof window !== 'undefined' ? new SyncEngine() : (null as unknown as SyncEngine);
