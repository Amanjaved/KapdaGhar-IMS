import { getDB } from '@/lib/indexeddb/db';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateUUID, isValidUUID, toValidUUID } from '@/lib/utils/uuid';

type SyncListener = (status: {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt?: Date;
  error?: string;
}) => void;

class SyncEngine {
  private listeners: Set<SyncListener> = new Set();
  private isSyncing = false;
  private lastSyncedAt?: Date;
  private pendingCount = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.notify());
      // Initial count check
      this.updatePendingCount();
    }
  }

  public subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    listener({
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(error?: string) {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    for (const listener of this.listeners) {
      listener({
        isOnline,
        isSyncing: this.isSyncing,
        pendingCount: this.pendingCount,
        lastSyncedAt: this.lastSyncedAt,
        error,
      });
    }
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

  private async handleOnline() {
    this.notify();
    await this.syncPendingTransactions();
  }

  public async syncPendingTransactions(): Promise<{ syncedCount: number; errors: number; lastError?: string }> {
    if (this.isSyncing) return { syncedCount: 0, errors: 0 };
    if (!isSupabaseConfigured() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      await this.updatePendingCount();
      this.notify();
      return { syncedCount: 0, errors: 0 };
    }

    const db = await getDB();
    if (!db) return { syncedCount: 0, errors: 0 };

    this.isSyncing = true;
    this.notify();

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
            pending.synced = true;
            pending.sync_error = undefined;
            await db.put('pending_sales', pending);
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
    } finally {
      this.isSyncing = false;
      await this.updatePendingCount();
      this.notify();
    }

    return { syncedCount, errors, lastError };
  }
}

export const syncEngine = typeof window !== 'undefined' ? new SyncEngine() : (null as unknown as SyncEngine);
