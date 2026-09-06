import { getDB } from '@/lib/indexeddb/db';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateUUID, isValidUUID } from '@/lib/utils/uuid';
import { CartItem, PaymentMethod, PendingSale, Sale, SaleItem } from '@/types';
import { calculateGrossProfit, calculateItemProfit, calculateNetProfit, roundToTwo } from '@/lib/utils/currency';
import { productService } from './productService';
import { broadcastLocalChange } from '@/lib/supabase/realtime';

const DEFAULT_BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'b0000000-0000-0000-0000-000000000001';

// Fast In-Memory Sales Cache
let memorySales: Sale[] | null = null;
let lastSalesSync = 0;
const SALES_SYNC_TTL = 15_000; // 15s
let pendingSalesSync: Promise<Sale[]> | null = null;

function generateReceiptNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `KG-${dateStr}-${randomSuffix}`;
}

function filterSalesByRange(sales: Sale[], filterRange: 'today' | 'yesterday' | 'week' | 'month' | 'all'): Sale[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOfWeek = startOfToday - now.getDay() * 86400000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let filtered = sales;
  if (filterRange === 'today') {
    filtered = sales.filter((s) => new Date(s.created_at).getTime() >= startOfToday);
  } else if (filterRange === 'yesterday') {
    filtered = sales.filter((s) => {
      const time = new Date(s.created_at).getTime();
      return time >= startOfYesterday && time < startOfToday;
    });
  } else if (filterRange === 'week') {
    filtered = sales.filter((s) => new Date(s.created_at).getTime() >= startOfWeek);
  } else if (filterRange === 'month') {
    filtered = sales.filter((s) => new Date(s.created_at).getTime() >= startOfMonth);
  }

  return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export const salesService = {
  async completeSale(params: {
    items: CartItem[];
    discount?: number;
    paymentMethod: PaymentMethod;
    notes?: string;
    clientTransactionId?: string;
  }): Promise<{ success: boolean; sale?: Sale; error?: string }> {
    const { items, discount = 0, paymentMethod, notes, clientTransactionId } = params;

    if (!items || items.length === 0) {
      return { success: false, error: 'Cannot complete sale with empty cart.' };
    }

    const transactionId = clientTransactionId || generateUUID();
    const receiptNumber = generateReceiptNumber();
    const now = new Date().toISOString();

    const db = await getDB();
    if (!db) {
      return { success: false, error: 'Database storage is unavailable.' };
    }

    // Step 1: Atomic validation on local inventory
    const localTx = db.transaction(['products', 'inventory', 'sales', 'sale_items', 'inventory_movements', 'pending_sales'], 'readwrite');
    const inventoryStore = localTx.objectStore('inventory');

    // Check available stock for each item before any deduction
    for (const item of items) {
      const inv = await inventoryStore.index('by-product').get(item.product.id);
      const availableQty = inv ? inv.quantity : 0;

      if (availableQty < item.quantity) {
        await localTx.done;
        return {
          success: false,
          error: `Not enough stock for "${item.product.name}". Available: ${availableQty}, Requested: ${item.quantity}`,
        };
      }
    }

    // Step 2: Compute totals and snapshot prices
    let subtotal = 0;
    let totalCost = 0;
    const saleId = generateUUID();
    const saleItemsList: SaleItem[] = [];

    for (const item of items) {
      const itemSubtotal = roundToTwo(item.selling_price * item.quantity);
      const itemCost = roundToTwo(item.purchase_price * item.quantity);
      const itemProfit = calculateItemProfit(item.selling_price, item.purchase_price, item.quantity);

      subtotal += itemSubtotal;
      totalCost += itemCost;

      // Update local inventory
      const inv = await inventoryStore.index('by-product').get(item.product.id);
      if (inv) {
        const prevQty = inv.quantity;
        const nextQty = prevQty - item.quantity;
        inv.quantity = nextQty;
        inv.updated_at = now;
        await inventoryStore.put(inv);

        // Record inventory movement
        await localTx.objectStore('inventory_movements').put({
          id: generateUUID(),
          product_id: item.product.id,
          product_name: item.product.name,
          movement_type: 'sale',
          quantity_change: -item.quantity,
          quantity_before: prevQty,
          quantity_after: nextQty,
          notes: `Sold in receipt #${receiptNumber}`,
          created_at: now,
        });

        // Immediately update in-memory product cache for 0ms lag
        productService.updateLocalProductStock(item.product.id, nextQty);
      }

      // Record snapshot sale item
      const saleItemRecord: SaleItem = {
        id: generateUUID(),
        sale_id: saleId,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        selling_price: item.selling_price,
        purchase_price: item.purchase_price,
        subtotal: itemSubtotal,
        profit: itemProfit,
        created_at: now,
      };

      saleItemsList.push(saleItemRecord);
      await localTx.objectStore('sale_items').put(saleItemRecord);
    }

    subtotal = roundToTwo(subtotal);
    totalCost = roundToTwo(totalCost);

    const safeDiscount = Math.min(Math.max(0, discount), subtotal);
    const tax = 0; // GST-exempt or included
    const total = roundToTwo(subtotal - safeDiscount + tax);
    const totalProfit = calculateNetProfit(total, totalCost);

    const completedSale: Sale = {
      id: saleId,
      receipt_number: receiptNumber,
      client_transaction_id: transactionId,
      business_id: DEFAULT_BUSINESS_ID,
      subtotal,
      discount: safeDiscount,
      tax,
      total,
      total_cost: totalCost,
      total_profit: totalProfit,
      payment_method: paymentMethod,
      status: 'completed',
      notes,
      items: saleItemsList,
      created_at: now,
    };

    await localTx.objectStore('sales').put(completedSale);

    // Record in pending_sales queue for reliable background sync
    const pendingRecord: PendingSale = {
      client_transaction_id: transactionId,
      receipt_number: receiptNumber,
      items: items.map((i) => ({
        product_id: i.product.id,
        product_name: i.product.name,
        quantity: i.quantity,
        selling_price: i.selling_price,
        purchase_price: i.purchase_price,
      })),
      subtotal,
      discount: safeDiscount,
      total,
      total_cost: totalCost,
      total_profit: totalProfit,
      payment_method: paymentMethod,
      notes,
      created_at: now,
      synced: false,
    };

    await localTx.objectStore('pending_sales').put(pendingRecord);
    await localTx.done;

    // Immediately update in-memory sales cache
    if (memorySales) {
      memorySales = [completedSale, ...memorySales];
    } else {
      memorySales = [completedSale];
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('catalog-refreshed'));
      window.dispatchEvent(new CustomEvent('sales-refreshed'));
    }
    broadcastLocalChange('SALES_UPDATED');
    broadcastLocalChange('CATALOG_UPDATED');

    // Step 3: Cloud Sync Attempt in background
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const rpcItems = items.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
          }));

          const { data, error } = await supabase.rpc('complete_sale', {
            p_items: rpcItems,
            p_discount: safeDiscount,
            p_payment_method: paymentMethod,
            p_client_transaction_id: transactionId,
            p_receipt_number: receiptNumber,
            p_business_id: DEFAULT_BUSINESS_ID,
            p_notes: notes || null,
          });

          if (!error && (data?.success || data?.is_duplicate)) {
            const updateTx = db.transaction('pending_sales', 'readwrite');
            const pending = await updateTx.store.get(transactionId);
            if (pending) {
              pending.synced = true;
              await updateTx.store.put(pending);
            }
            await updateTx.done;
          }
        }
      } catch (err) {
        console.warn('Cloud sync deferred; local sale registered successfully:', err);
      }
    }

    return { success: true, sale: completedSale };
  },

  async getSales(
    filterRange: 'today' | 'yesterday' | 'week' | 'month' | 'all' = 'all',
    forceRefresh: boolean = false
  ): Promise<Sale[]> {
    const now = Date.now();

    // 1. Return from in-memory cache if fresh
    if (!forceRefresh && memorySales && now - lastSalesSync < SALES_SYNC_TTL) {
      return filterSalesByRange(memorySales, filterRange);
    }

    // 2. Read from local IndexedDB if memory cache empty
    const db = await getDB();
    if (!memorySales && db) {
      const allSales = await db.getAll('sales');
      const allItems = await db.getAll('sale_items');

      const itemsBySale = new Map<string, SaleItem[]>();
      for (const item of allItems) {
        const list = itemsBySale.get(item.sale_id) || [];
        list.push(item);
        itemsBySale.set(item.sale_id, list);
      }

      memorySales = allSales.map((s) => ({
        ...s,
        items: s.items && s.items.length > 0 ? s.items : (itemsBySale.get(s.id) || []),
      }));
    }

    // 3. Trigger cloud sync (await if cold boot or forceRefresh, otherwise background)
    const shouldAwaitCloud = forceRefresh || !memorySales || memorySales.length === 0;
    const syncPromise = this.syncSalesFromCloud();

    if (shouldAwaitCloud) {
      const freshSales = await syncPromise;
      return filterSalesByRange(freshSales, filterRange);
    }

    // Background sync triggered, return local/cached immediately (0ms)
    return filterSalesByRange(memorySales || [], filterRange);
  },

  async syncSalesFromCloud(): Promise<Sale[]> {
    if (pendingSalesSync) return pendingSalesSync;

    pendingSalesSync = (async () => {
      try {
        if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { data: remoteSales, error } = await supabase
              .from('sales')
              .select(`
                *,
                sale_items (*)
              `)
              .order('created_at', { ascending: false });

            if (!error && remoteSales !== null) {
              const formattedSales: Sale[] = remoteSales.map((rSale: any) => {
                const { sale_items: remoteItems, ...saleRecord } = rSale;
                const formattedItems: SaleItem[] = (remoteItems || []).map((i: any) => ({
                  id: i.id,
                  sale_id: i.sale_id,
                  product_id: i.product_id,
                  product_name: i.product_name,
                  quantity: Number(i.quantity),
                  selling_price: Number(i.selling_price),
                  purchase_price: Number(i.purchase_price),
                  subtotal: Number(i.subtotal),
                  profit: Number(i.profit || 0),
                  created_at: i.created_at,
                }));

                return {
                  ...saleRecord,
                  subtotal: Number(saleRecord.subtotal),
                  discount: Number(saleRecord.discount || 0),
                  tax: Number(saleRecord.tax || 0),
                  total: Number(saleRecord.total),
                  total_cost: Number(saleRecord.total_cost || 0),
                  total_profit: Number(saleRecord.total_profit || 0),
                  items: formattedItems,
                };
              });

              memorySales = formattedSales;
              lastSalesSync = Date.now();

              // Batch save to IndexedDB asynchronously
              const db = await getDB();
              if (db) {
                try {
                  const pending = await db.getAll('pending_sales');
                  const hasUnsynced = pending.some((p) => !p.synced);

                  const tx = db.transaction(['sales', 'sale_items'], 'readwrite');
                  if (!hasUnsynced) {
                    await tx.objectStore('sales').clear();
                    await tx.objectStore('sale_items').clear();
                  }

                  const sStore = tx.objectStore('sales');
                  const siStore = tx.objectStore('sale_items');

                  await Promise.all([
                    ...formattedSales.map((s) => sStore.put(s)),
                    ...formattedSales.flatMap((s) => (s.items || []).map((i) => siStore.put(i))),
                  ]);
                  await tx.done;
                } catch (dbErr) {
                  console.warn('Sales IndexedDB sync warning:', dbErr);
                }
              }

              return formattedSales;
            }
          }
        }
      } catch (err) {
        console.warn('Sales cloud sync error, using local:', err);
      } finally {
        pendingSalesSync = null;
      }

      return memorySales || [];
    })();

    return pendingSalesSync;
  },

  async getSaleById(idOrReceipt: string): Promise<Sale | null> {
    // Check in-memory first
    if (memorySales) {
      const match = memorySales.find((s) => s.id === idOrReceipt || s.receipt_number === idOrReceipt);
      if (match) return match;
    }

    const db = await getDB();
    if (db) {
      let sale = await db.get('sales', idOrReceipt);
      if (!sale) {
        sale = await db.getFromIndex('sales', 'by-receipt', idOrReceipt);
      }

      if (sale) {
        const items = await db.getAllFromIndex('sale_items', 'by-sale', sale.id);
        sale.items = items && items.length > 0 ? items : sale.items;
        return sale;
      }
    }

    // Try Supabase if not found locally
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const req = isValidUUID(idOrReceipt)
            ? supabase.from('sales').select('*, sale_items(*)').eq('id', idOrReceipt).maybeSingle()
            : supabase.from('sales').select('*, sale_items(*)').eq('receipt_number', idOrReceipt).maybeSingle();

          const { data, error } = await req;
          if (!error && data) {
            const { sale_items: items, ...s } = data;
            const fullSale: Sale = {
              ...s,
              subtotal: Number(s.subtotal),
              discount: Number(s.discount || 0),
              tax: Number(s.tax || 0),
              total: Number(s.total),
              total_cost: Number(s.total_cost || 0),
              total_profit: Number(s.total_profit || 0),
              items: (items || []).map((i: any) => ({
                id: i.id,
                sale_id: i.sale_id,
                product_id: i.product_id,
                product_name: i.product_name,
                quantity: Number(i.quantity),
                selling_price: Number(i.selling_price),
                purchase_price: Number(i.purchase_price),
                subtotal: Number(i.subtotal),
                profit: Number(i.profit || 0),
                created_at: i.created_at,
              })),
            };

            if (db) {
              await db.put('sales', fullSale);
            }
            return fullSale;
          }
        }
      } catch (err) {
        console.warn('Could not fetch sale from Supabase:', err);
      }
    }

    return null;
  },
};
