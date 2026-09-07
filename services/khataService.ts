import { getDB } from '@/lib/indexeddb/db';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateUUID } from '@/lib/utils/uuid';
import { Customer, CustomerTransaction, Sale } from '@/types';
import { formatCurrency, roundToTwo } from '@/lib/utils/currency';
import { broadcastLocalChange } from '@/lib/supabase/realtime';

const DEFAULT_BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'b0000000-0000-0000-0000-000000000001';

// In-Memory Customers Cache
let memoryCustomers: Customer[] | null = null;
let lastCustomerSync = 0;
const CUSTOMER_SYNC_TTL = 10_000; // 10s
let pendingCustomersSync: Promise<Customer[]> | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('khata-refreshed', () => {
    lastCustomerSync = 0;
  });
}

function notifyKhataUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('khata-refreshed'));
  }
  broadcastLocalChange('KHATA_UPDATED');
}

export const khataService = {
  clearMemoryCache() {
    memoryCustomers = null;
    lastCustomerSync = 0;
  },

  invalidateCache() {
    lastCustomerSync = 0;
  },

  /**
   * Fetch all customers with optional query and due status filter
   */
  async getCustomers(
    query?: string,
    filter: 'all' | 'due' | 'cleared' = 'all',
    forceRefresh: boolean = false
  ): Promise<Customer[]> {
    const now = Date.now();
    const isStale = !lastCustomerSync || now - lastCustomerSync >= CUSTOMER_SYNC_TTL;

    // 1. In-memory cache return if fresh
    if (!forceRefresh && !isStale && memoryCustomers && memoryCustomers.length > 0) {
      return this.filterCustomerList(memoryCustomers, query, filter);
    }

    // 2. Read from local IndexedDB
    const db = await getDB();
    if (!memoryCustomers && db) {
      try {
        const localCustomers = await db.getAll('customers');
        if (localCustomers && localCustomers.length > 0) {
          memoryCustomers = localCustomers;
        }
      } catch (err) {
        console.warn('IndexedDB customers read error:', err);
      }
    }

    // 3. Sync from cloud if online
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine && isSupabaseConfigured();
    if (isOnline && (forceRefresh || isStale || !memoryCustomers || memoryCustomers.length === 0)) {
      try {
        const cloudCustomers = await this.syncCustomersFromCloud();
        return this.filterCustomerList(cloudCustomers, query, filter);
      } catch (err) {
        console.warn('Cloud customer sync error, using local:', err);
      }
    }

    return this.filterCustomerList(memoryCustomers || [], query, filter);
  },

  /**
   * Search customers by phone or name (fast 0ms for POS autocomplete)
   */
  async searchCustomers(searchStr: string): Promise<Customer[]> {
    if (!searchStr || !searchStr.trim()) {
      return this.getCustomers('', 'all', false);
    }
    return this.getCustomers(searchStr.trim(), 'all', false);
  },

  /**
   * Filter customer list by text query and balance status
   */
  filterCustomerList(
    customers: Customer[],
    query?: string,
    filter: 'all' | 'due' | 'cleared' = 'all'
  ): Customer[] {
    let result = [...customers];

    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.address && c.address.toLowerCase().includes(q))
      );
    }

    if (filter === 'due') {
      result = result.filter((c) => (c.total_due || 0) > 0);
    } else if (filter === 'cleared') {
      result = result.filter((c) => (c.total_due || 0) <= 0);
    }

    // Sort by highest due balance first, then recently updated
    return result.sort((a, b) => {
      const dueDiff = (b.total_due || 0) - (a.total_due || 0);
      if (dueDiff !== 0) return dueDiff;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  },

  /**
   * Get single customer by ID
   */
  async getCustomerById(id: string): Promise<Customer | null> {
    const db = await getDB();
    if (db) {
      const cust = await db.get('customers', id);
      if (cust) return cust;
    }

    if (memoryCustomers) {
      const found = memoryCustomers.find((c) => c.id === id);
      if (found) return found;
    }

    return null;
  },

  /**
   * Create or update a customer record
   */
  async createCustomer(data: {
    name: string;
    phone: string;
    address?: string;
    notes?: string;
    initialDue?: number;
  }): Promise<Customer> {
    const cleanPhone = data.phone.trim().replace(/[^0-9+]/g, '');
    const now = new Date().toISOString();
    const id = generateUUID();
    const initialDue = Math.max(0, Number(data.initialDue) || 0);

    const newCustomer: Customer = {
      id,
      business_id: DEFAULT_BUSINESS_ID,
      name: data.name.trim(),
      phone: cleanPhone,
      address: data.address?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      total_due: roundToTwo(initialDue),
      created_at: now,
      updated_at: now,
    };
    (newCustomer as any)._is_pending_cloud_sync = true;

    // 1. Save to local IndexedDB
    const db = await getDB();
    if (db) {
      await db.put('customers', newCustomer);

      if (initialDue > 0) {
        const openingTx: CustomerTransaction = {
          id: generateUUID(),
          business_id: DEFAULT_BUSINESS_ID,
          customer_id: id,
          customer_name: newCustomer.name,
          customer_phone: newCustomer.phone,
          type: 'credit',
          amount: initialDue,
          notes: 'Opening Balance (Initial Credit)',
          balance_after: initialDue,
          created_at: now,
        };
        (openingTx as any)._is_pending_cloud_sync = true;
        await db.put('customer_transactions', openingTx);
      }
    }

    // 2. Update memory cache
    if (memoryCustomers) {
      memoryCustomers = [newCustomer, ...memoryCustomers.filter((c) => c.id !== id)];
    } else {
      memoryCustomers = [newCustomer];
    }

    notifyKhataUpdated();

    // 3. Sync to Supabase in background
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      (async () => {
        try {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { error: custErr } = await supabase.from('customers').insert({
              id: newCustomer.id,
              business_id: DEFAULT_BUSINESS_ID,
              name: newCustomer.name,
              phone: newCustomer.phone,
              address: newCustomer.address || null,
              notes: newCustomer.notes || null,
              total_due: newCustomer.total_due,
            });

            if (!custErr) {
              delete (newCustomer as any)._is_pending_cloud_sync;
              if (db) await db.put('customers', newCustomer);
            }

            if (initialDue > 0) {
              const { error: txErr } = await supabase.from('customer_transactions').insert({
                id: generateUUID(),
                business_id: DEFAULT_BUSINESS_ID,
                customer_id: newCustomer.id,
                type: 'credit',
                amount: initialDue,
                notes: 'Opening Balance (Initial Credit)',
                balance_after: initialDue,
              });
              if (!txErr && db) {
                const localOpeningTx = await db.get('customer_transactions', id);
                if (localOpeningTx) {
                  delete (localOpeningTx as any)._is_pending_cloud_sync;
                  await db.put('customer_transactions', localOpeningTx);
                }
              }
            }
          }
        } catch (err) {
          console.warn('Customer cloud creation deferred to auto-sync:', err);
        }
      })();
    }

    return newCustomer;
  },

  /**
   * Record an Udhar credit entry for a POS Sale (with optional partial payment)
   */
  async recordSaleCredit(params: {
    sale: Sale;
    customer: Customer;
    paidNow: number;
    creditAmount: number;
    notes?: string;
  }): Promise<{ success: boolean; customer?: Customer; error?: string }> {
    const { sale, customer, paidNow, creditAmount, notes } = params;
    const now = new Date().toISOString();

    const db = await getDB();
    if (!db) return { success: false, error: 'Database unavailable' };

    const currentDue = customer.total_due || 0;
    const newDue = roundToTwo(currentDue + creditAmount);

    const updatedCustomer: Customer = {
      ...customer,
      total_due: newDue,
      updated_at: now,
    };

    const txId = generateUUID();
    const creditTx: CustomerTransaction = {
      id: txId,
      business_id: DEFAULT_BUSINESS_ID,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      sale_id: sale.id,
      type: 'credit',
      amount: roundToTwo(creditAmount),
      payment_method: 'other',
      receipt_number: sale.receipt_number,
      notes: notes || `Bill #${sale.receipt_number} (Total: ${formatCurrency(sale.total)}, Paid: ${formatCurrency(paidNow)}, Due: ${formatCurrency(creditAmount)})`,
      balance_after: newDue,
      created_at: now,
    };

    (updatedCustomer as any)._is_pending_cloud_sync = true;
    (creditTx as any)._is_pending_cloud_sync = true;

    // Save locally
    const tx = db.transaction(['customers', 'customer_transactions'], 'readwrite');
    await tx.objectStore('customers').put(updatedCustomer);
    await tx.objectStore('customer_transactions').put(creditTx);
    await tx.done;

    // Update in-memory cache
    if (memoryCustomers) {
      memoryCustomers = memoryCustomers.map((c) => (c.id === customer.id ? updatedCustomer : c));
    }

    notifyKhataUpdated();

    // Background cloud sync
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      (async () => {
        try {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { error: custErr } = await supabase
              .from('customers')
              .update({ total_due: newDue, updated_at: now })
              .eq('id', customer.id);

            const { error: txErr } = await supabase.from('customer_transactions').insert({
              id: creditTx.id,
              business_id: DEFAULT_BUSINESS_ID,
              customer_id: customer.id,
              sale_id: sale.id,
              type: 'credit',
              amount: creditAmount,
              payment_method: 'other',
              receipt_number: sale.receipt_number,
              notes: creditTx.notes,
              balance_after: newDue,
              created_at: now,
            });

            if (!custErr && !txErr) {
              delete (updatedCustomer as any)._is_pending_cloud_sync;
              delete (creditTx as any)._is_pending_cloud_sync;
              const cleanTx = db.transaction(['customers', 'customer_transactions'], 'readwrite');
              await cleanTx.objectStore('customers').put(updatedCustomer);
              await cleanTx.objectStore('customer_transactions').put(creditTx);
              await cleanTx.done;
            }
          }
        } catch (err) {
          console.warn('Customer credit sync deferred to auto-sync:', err);
        }
      })();
    }

    return { success: true, customer: updatedCustomer };
  },

  /**
   * Record a Repayment ("Jama") from a customer
   */
  async recordPayment(params: {
    customerId: string;
    amount: number;
    paymentMethod: 'cash' | 'upi' | 'card' | 'bank';
    notes?: string;
  }): Promise<{
    success: boolean;
    customer?: Customer;
    transaction?: CustomerTransaction;
    error?: string;
  }> {
    const { customerId, amount, paymentMethod, notes } = params;

    if (amount <= 0) {
      return { success: false, error: 'Payment amount must be greater than zero.' };
    }

    const customer = await this.getCustomerById(customerId);
    if (!customer) {
      return { success: false, error: 'Customer not found.' };
    }

    const now = new Date().toISOString();
    const currentDue = customer.total_due || 0;
    const newDue = Math.max(0, roundToTwo(currentDue - amount));

    const updatedCustomer: Customer = {
      ...customer,
      total_due: newDue,
      updated_at: now,
    };

    const txId = generateUUID();
    const paymentTx: CustomerTransaction = {
      id: txId,
      business_id: DEFAULT_BUSINESS_ID,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone,
      type: 'payment',
      amount: roundToTwo(amount),
      payment_method: paymentMethod,
      notes: notes?.trim() || `Payment received via ${paymentMethod.toUpperCase()}`,
      balance_after: newDue,
      created_at: now,
    };

    (updatedCustomer as any)._is_pending_cloud_sync = true;
    (paymentTx as any)._is_pending_cloud_sync = true;

    const db = await getDB();
    if (db) {
      const tx = db.transaction(['customers', 'customer_transactions'], 'readwrite');
      await tx.objectStore('customers').put(updatedCustomer);
      await tx.objectStore('customer_transactions').put(paymentTx);
      await tx.done;
    }

    if (memoryCustomers) {
      memoryCustomers = memoryCustomers.map((c) => (c.id === customer.id ? updatedCustomer : c));
    }

    notifyKhataUpdated();

    // Sync to Supabase
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      (async () => {
        try {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { error: custErr } = await supabase
              .from('customers')
              .update({ total_due: newDue, updated_at: now })
              .eq('id', customer.id);

            const { error: txErr } = await supabase.from('customer_transactions').insert({
              id: paymentTx.id,
              business_id: DEFAULT_BUSINESS_ID,
              customer_id: customer.id,
              type: 'payment',
              amount: paymentTx.amount,
              payment_method: paymentMethod,
              notes: paymentTx.notes,
              balance_after: newDue,
              created_at: now,
            });

            if (!custErr && !txErr && db) {
              delete (updatedCustomer as any)._is_pending_cloud_sync;
              delete (paymentTx as any)._is_pending_cloud_sync;
              const cleanTx = db.transaction(['customers', 'customer_transactions'], 'readwrite');
              await cleanTx.objectStore('customers').put(updatedCustomer);
              await cleanTx.objectStore('customer_transactions').put(paymentTx);
              await cleanTx.done;
            }
          }
        } catch (err) {
          console.warn('Customer payment cloud sync deferred to auto-sync:', err);
        }
      })();
    }

    return { success: true, customer: updatedCustomer, transaction: paymentTx };
  },

  /**
   * Get complete transaction ledger history for a customer
   */
  async getCustomerLedger(customerId: string): Promise<CustomerTransaction[]> {
    const db = await getDB();
    let localTxs: CustomerTransaction[] = [];

    if (db) {
      try {
        const txIndex = db.transaction('customer_transactions').store.index('by-customer');
        localTxs = await txIndex.getAll(customerId);
      } catch (e) {
        console.warn('Failed reading local customer transactions:', e);
      }
    }

    // If online, fetch fresh ledger from cloud
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data, error } = await supabase
            .from('customer_transactions')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });

          if (!error && data) {
            const formatted: CustomerTransaction[] = data.map((t: any) => ({
              id: t.id,
              business_id: t.business_id,
              customer_id: t.customer_id,
              sale_id: t.sale_id,
              type: t.type,
              amount: Number(t.amount),
              payment_method: t.payment_method,
              receipt_number: t.receipt_number,
              notes: t.notes,
              balance_after: Number(t.balance_after),
              created_at: t.created_at,
            }));

            // Sync to local DB
            if (db) {
              const tx = db.transaction('customer_transactions', 'readwrite');
              await Promise.all(formatted.map((f) => tx.store.put(f)));
              await tx.done;
            }

            return formatted;
          }
        }
      } catch (err) {
        console.warn('Cloud ledger fetch error:', err);
      }
    }

    return localTxs.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  /**
   * Calculate high-level Khata statistics for KPIs
   */
  async getKhataSummaryStats(forceRefresh: boolean = false): Promise<{
    totalOutstanding: number;
    debtorCount: number;
    collectedThisMonth: number;
  }> {
    const customers = await this.getCustomers(undefined, 'all', forceRefresh);

    let totalOutstanding = 0;
    let debtorCount = 0;

    for (const c of customers) {
      const due = c.total_due || 0;
      if (due > 0) {
        totalOutstanding += due;
        debtorCount++;
      }
    }

    // Calculate month repayments
    let collectedThisMonth = 0;
    const db = await getDB();
    if (db) {
      try {
        const allTxs = await db.getAll('customer_transactions');
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

        for (const t of allTxs) {
          if (t.type === 'payment') {
            const time = new Date(t.created_at).getTime();
            if (time >= startOfMonth) {
              collectedThisMonth += t.amount || 0;
            }
          }
        }
      } catch (e) {}
    }

    return {
      totalOutstanding: Math.round(totalOutstanding),
      debtorCount,
      collectedThisMonth: Math.round(collectedThisMonth),
    };
  },

  /**
   * Background cloud synchronization for customers
   */
  async syncCustomersFromCloud(): Promise<Customer[]> {
    if (pendingCustomersSync) return pendingCustomersSync;

    pendingCustomersSync = (async () => {
      try {
        if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { data, error } = await supabase
              .from('customers')
              .select('*')
              .order('updated_at', { ascending: false });

            if (!error && data !== null) {
              const formatted: Customer[] = data.map((c: any) => ({
                id: c.id,
                business_id: c.business_id,
                name: c.name,
                phone: c.phone,
                address: c.address,
                notes: c.notes,
                total_due: Number(c.total_due || 0),
                created_at: c.created_at,
                updated_at: c.updated_at,
              }));

              memoryCustomers = formatted;
              lastCustomerSync = Date.now();

              // Batch save to IndexedDB, without overwriting local records with pending sync
              const db = await getDB();
              if (db) {
                try {
                  const existingLocal = await db.getAll('customers');
                  const pendingIds = new Set(
                    existingLocal
                      .filter((c) => (c as any)._is_pending_cloud_sync)
                      .map((c) => c.id)
                  );

                  const tx = db.transaction('customers', 'readwrite');
                  for (const c of formatted) {
                    if (!pendingIds.has(c.id)) {
                      await tx.store.put(c);
                    }
                  }
                  await tx.done;

                  const pendingList = existingLocal.filter((c) => pendingIds.has(c.id));
                  memoryCustomers = [
                    ...pendingList,
                    ...formatted.filter((c) => !pendingIds.has(c.id)),
                  ];
                } catch (dbErr) {
                  console.warn('Batch customers IndexedDB error:', dbErr);
                }
              }

              return formatted;
            }
          }
        }
      } catch (err) {
        console.warn('Customers cloud sync failed:', err);
      } finally {
        pendingCustomersSync = null;
      }

      return memoryCustomers || [];
    })();

    return pendingCustomersSync;
  },

  /**
   * Push any customers or customer transactions created/modified offline to Supabase
   */
  async pushLocalKhataToCloud(): Promise<{ uploaded: number; errors: number }> {
    if (!isSupabaseConfigured() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { uploaded: 0, errors: 0 };
    }

    const supabase = getSupabaseClient();
    if (!supabase) return { uploaded: 0, errors: 0 };

    const db = await getDB();
    if (!db) return { uploaded: 0, errors: 0 };

    let uploaded = 0;
    let errors = 0;

    try {
      const [localCustomers, localTxs] = await Promise.all([
        db.getAll('customers'),
        db.getAll('customer_transactions'),
      ]);

      const pendingCustomers = (localCustomers || []).filter(
        (c) => (c as any)._is_pending_cloud_sync === true
      );

      const pendingTxs = (localTxs || []).filter(
        (t) => (t as any)._is_pending_cloud_sync === true
      );

      if (pendingCustomers.length === 0 && pendingTxs.length === 0) {
        return { uploaded: 0, errors: 0 };
      }

      // 1. Push pending customers
      for (const cust of pendingCustomers) {
        try {
          const { error: custErr } = await supabase.from('customers').upsert({
            id: cust.id,
            business_id: DEFAULT_BUSINESS_ID,
            name: cust.name,
            phone: cust.phone,
            address: cust.address || null,
            notes: cust.notes || null,
            total_due: cust.total_due || 0,
            updated_at: cust.updated_at || new Date().toISOString(),
          }, { onConflict: 'id' });

          if (!custErr) {
            delete (cust as any)._is_pending_cloud_sync;
            await db.put('customers', cust);
            uploaded++;
          } else {
            console.error('Failed to sync offline customer to cloud:', cust.name, custErr);
            errors++;
          }
        } catch (e) {
          console.warn('Offline customer sync error:', e);
          errors++;
        }
      }

      // 2. Push pending transactions
      for (const tx of pendingTxs) {
        try {
          const { error: txErr } = await supabase.from('customer_transactions').upsert({
            id: tx.id,
            business_id: DEFAULT_BUSINESS_ID,
            customer_id: tx.customer_id,
            sale_id: tx.sale_id || null,
            type: tx.type,
            amount: tx.amount,
            payment_method: tx.payment_method || 'other',
            receipt_number: tx.receipt_number || null,
            notes: tx.notes || null,
            balance_after: tx.balance_after,
            created_at: tx.created_at,
          }, { onConflict: 'id' });

          if (!txErr) {
            delete (tx as any)._is_pending_cloud_sync;
            await db.put('customer_transactions', tx);
            uploaded++;
          } else {
            console.error('Failed to sync offline customer tx to cloud:', tx.id, txErr);
            errors++;
          }
        } catch (e) {
          console.warn('Offline customer transaction sync error:', e);
          errors++;
        }
      }

      if (uploaded > 0) {
        notifyKhataUpdated();
      }
    } catch (e) {
      console.warn('pushLocalKhataToCloud error:', e);
    }

    return { uploaded, errors };
  },

  /**
   * Generates a polite, professional WhatsApp reminder message
   */
  generateWhatsAppReminderMessage(
    customer: Customer,
    storeName: string = 'Kapda Ghar',
    storePhone: string = '+91 98765 43210'
  ): string {
    return (
      `*नमस्ते ${customer.name} जी,*\n\n` +
      `*${storeName}* की तरफ से सप्रेम नमस्कार। 🙏\n\n` +
      `आपके खाते का बकाया राशि (Pending Balance) विवरण:\n` +
      `📌 *कुल बकाया:* *${formatCurrency(customer.total_due)}*\n\n` +
      `कृपया सुविधानुसार यह राशि जमा करवाएं। आप दुकान पर नकद या UPI द्वारा भुगतान कर सकते हैं।\n\n` +
      `📞 संपर्क: ${storePhone}\n` +
      `धन्यवाद! आपका दिन शुभ हो।`
    );
  },
};
