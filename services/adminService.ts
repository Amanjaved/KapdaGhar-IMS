import { getDB } from '@/lib/indexeddb/db';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateUUID, isValidUUID } from '@/lib/utils/uuid';
import { Business, DatabaseTableName, TableMetadata, UserProfile, UserRole } from '@/types';
import { productService } from '@/services/productService';
import { broadcastLocalChange } from '@/lib/supabase/realtime';

export const TABLE_CONFIGS: { name: DatabaseTableName; label: string; description: string }[] = [
  { name: 'products', label: 'Products Catalog', description: 'Product master data, SKUs, barcodes, cost & retail prices' },
  { name: 'categories', label: 'Categories', description: 'Catalog taxonomy and product classifications' },
  { name: 'inventory', label: 'Inventory Stock', description: 'Current available stock levels per product' },
  { name: 'sales', label: 'Sales Receipts', description: 'Customer transaction records, payment methods & totals' },
  { name: 'sale_items', label: 'Sale Line Items', description: 'Individual item snapshot records for sales receipts' },
  { name: 'inventory_movements', label: 'Inventory Audit Trail', description: 'Stock movement history (purchases, sales, adjustments)' },
  { name: 'businesses', label: 'Business & Store Profiles', description: 'Store identity, address, GSTIN and currency setup' },
  { name: 'profiles', label: 'Staff & User Profiles', description: 'Staff members, access roles, and register credentials' },
];

const DEFAULT_BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'b0000000-0000-0000-0000-000000000001';

export const adminService = {
  /**
   * Get row counts across all 8 database tables
   */
  async getTableCounts(): Promise<TableMetadata[]> {
    const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
    const db = await getDB();

    const results: TableMetadata[] = [];

    for (const config of TABLE_CONFIGS) {
      let count = 0;

      if (supabase && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const { count: remoteCount, error } = await supabase
            .from(config.name)
            .select('*', { count: 'exact', head: true });

          if (!error && remoteCount !== null) {
            count = remoteCount;
          }
        } catch (_) { }
      }

      // Fallback to local DB if remote is 0 or offline
      if (count === 0 && db) {
        try {
          if (db.objectStoreNames.contains(config.name as any)) {
            const all = await db.getAll(config.name as any);
            count = all.length;
          }
        } catch (_) { }
      }

      results.push({
        ...config,
        rowCount: count,
      });
    }

    return results;
  },

  /**
   * Fetch rows from a specified table with optional search keyword filtering
   */
  async fetchTableRows(
    tableName: DatabaseTableName,
    searchQuery?: string,
    limit: number = 50
  ): Promise<{ rows: any[]; totalCount: number }> {
    const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
    const db = await getDB();
    const query = searchQuery?.toLowerCase().trim() || '';

    // 1. Try Supabase if configured & online
    if (supabase && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        let req = supabase.from(tableName).select('*').limit(limit);

        // Sort by created_at or updated_at if exists
        if (['sales', 'inventory_movements', 'products', 'categories', 'profiles'].includes(tableName)) {
          req = req.order('created_at', { ascending: false });
        }

        const { data, error } = await req;

        if (!error && data) {
          let filtered = data;
          if (query) {
            filtered = data.filter((row: any) =>
              JSON.stringify(row).toLowerCase().includes(query)
            );
          }
          return { rows: filtered, totalCount: filtered.length };
        }
      } catch (err) {
        console.warn(`Failed to fetch ${tableName} from Supabase:`, err);
      }
    }

    // 2. Fallback to local IndexedDB
    if (db && db.objectStoreNames.contains(tableName as any)) {
      try {
        const localRows = await db.getAll(tableName as any);
        let filtered = localRows;
        if (query) {
          filtered = localRows.filter((row: any) =>
            JSON.stringify(row).toLowerCase().includes(query)
          );
        }
        return { rows: filtered.slice(0, limit), totalCount: filtered.length };
      } catch (err) {
        console.warn(`Failed to fetch ${tableName} from local DB:`, err);
      }
    }

    return { rows: [], totalCount: 0 };
  },

  /**
   * Get all registered staff/user profiles
   */
  async getStaffProfiles(): Promise<UserProfile[]> {
    const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
    const db = await getDB();
    let profiles: UserProfile[] = [];

    // 1. Try server-side file API first (synced across all local browsers/tabs)
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/staff');
        if (res.ok) {
          const apiProfiles = await res.json();
          if (Array.isArray(apiProfiles) && apiProfiles.length > 0) {
            profiles = apiProfiles;
            // Synchronize local IndexedDB cache with server profiles
            if (db && db.objectStoreNames.contains('profiles')) {
              const localProfiles = await db.getAll('profiles');
              const apiIds = new Set(apiProfiles.map((p) => p.id));
              for (const lp of localProfiles) {
                if (!apiIds.has(lp.id)) {
                  await db.delete('profiles', lp.id);
                }
              }
              for (const p of apiProfiles) {
                await db.put('profiles', p);
              }
            }
          }
        }
      } catch (_) { }
    }

    // 2. Try Supabase cloud if still empty
    if (profiles.length === 0 && supabase && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
        if (!error && data && data.length > 0) {
          profiles = data.map((d: any) => ({
            id: d.id,
            business_id: d.business_id,
            full_name: d.full_name === 'Store Owner' ? 'Admin' : d.full_name,
            phone: d.phone,
            role: d.role,
            pin_code: d.pin_code || (d.role === 'owner' ? '9044' : '1234'),
            created_at: d.created_at,
            updated_at: d.updated_at,
            is_active: true,
          }));
        }
      } catch (_) { }
    }

    // 3. Fallback/merge with local DB
    if (profiles.length === 0 && db && db.objectStoreNames.contains('profiles')) {
      const localProfiles = await db.getAll('profiles');
      if (localProfiles.length > 0) {
        profiles = localProfiles;
      }
    }

    // 4. Ensure master Admin (PIN 9044) exists if empty
    if (profiles.length === 0) {
      const defaultAdmin: UserProfile = {
        id: 'e0000000-0000-0000-0000-000000000001',
        business_id: DEFAULT_BUSINESS_ID,
        full_name: 'Admin',
        phone: '+91 98765 43210',
        role: 'owner',
        pin_code: '9044',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      profiles.push(defaultAdmin);
      if (db && db.objectStoreNames.contains('profiles')) {
        await db.put('profiles', defaultAdmin);
      }
    }

    // Guarantee Admin is named 'Admin' with PIN '9044'
    profiles = profiles.map((p) => {
      if (p.role === 'owner' || p.full_name === 'Store Owner') {
        return { ...p, full_name: 'Admin', pin_code: '9044' };
      }
      return p;
    });

    return profiles;
  },

  /**
   * Create a new staff profile
   */
  async createStaffProfile(params: {
    full_name: string;
    phone?: string;
    role: UserRole;
    pin_code?: string;
  }): Promise<UserProfile> {
    const newProfile: UserProfile = {
      id: generateUUID(),
      business_id: DEFAULT_BUSINESS_ID,
      full_name: params.full_name.trim(),
      phone: params.phone?.trim() || undefined,
      role: params.role,
      pin_code: params.pin_code?.trim() || '1234',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const db = await getDB();
    if (db && db.objectStoreNames.contains('profiles')) {
      await db.put('profiles', newProfile);
    }

    const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
    if (supabase && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await supabase.from('profiles').insert({
          id: newProfile.id,
          business_id: newProfile.business_id,
          full_name: newProfile.full_name,
          phone: newProfile.phone || null,
          role: newProfile.role,
        });
      } catch (err) {
        console.warn('Could not insert profile to Supabase (pending auth user link):', err);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProfile),
        });
      } catch (err) {
        console.warn('Could not sync profile to /api/staff:', err);
      }
    }

    return newProfile;
  },

  /**
   * Update a staff profile
   */
  async updateStaffProfile(id: string, updates: Partial<UserProfile>): Promise<void> {
    const db = await getDB();
    if (db && db.objectStoreNames.contains('profiles')) {
      const existing = await db.get('profiles', id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          updated_at: new Date().toISOString(),
        };
        await db.put('profiles', updated);
      }
    }

    const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
    if (supabase && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { pin_code, is_active, ...remoteFields } = updates;
        await supabase.from('profiles').update(remoteFields).eq('id', id);
      } catch (err) {
        console.warn('Could not update profile on Supabase:', err);
      }
    }
  },

  /**
   * Delete or deactivate a staff profile
   */
  async deleteStaffProfile(id: string): Promise<boolean> {
    const db = await getDB();
    if (db && db.objectStoreNames.contains('profiles')) {
      await db.delete('profiles', id);
    }

    const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
    if (supabase && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await supabase.from('profiles').delete().eq('id', id);
      } catch (err) {
        console.warn('Could not delete profile on Supabase:', err);
      }
    }

    if (typeof window !== 'undefined') {
      try {
        await fetch(`/api/staff?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Could not delete profile via /api/staff:', err);
      }
    }

    return true;
  },

  /**
   * Get store business metadata
   */
  async getBusinessProfile(): Promise<Business> {
    const defaultBusiness: Business = {
      id: DEFAULT_BUSINESS_ID,
      name: 'Kapda Ghar',
      tagline: 'फैशन और स्टाइल का संगम • Clothes, Purses & Footwear',
      phone: '+91 98765 43210',
      address: 'Main Market Road, Chandni Chowk',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110006',
      gstin: '07AAAAA0000A1Z5',
      currency: 'INR',
      created_at: new Date().toISOString(),
    };

    const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
    if (supabase && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', DEFAULT_BUSINESS_ID)
          .maybeSingle();

        if (!error && data) {
          return data as Business;
        }
      } catch (_) { }
    }

    const db = await getDB();
    if (db && db.objectStoreNames.contains('businesses')) {
      const localBiz = await db.get('businesses', DEFAULT_BUSINESS_ID);
      if (localBiz) return localBiz;
    }

    return defaultBusiness;
  },

  /**
   * Update store business metadata
   */
  async updateBusinessProfile(updates: Partial<Business>): Promise<void> {
    const current = await this.getBusinessProfile();
    const updated: Business = {
      ...current,
      ...updates,
      id: DEFAULT_BUSINESS_ID,
    };

    const db = await getDB();
    if (db && db.objectStoreNames.contains('businesses')) {
      await db.put('businesses', updated);
    }

    // Persist to localStorage for immediate thermal receipt synchrony
    try {
      if (updates.name) localStorage.setItem('kapda_ghar_store_name', updates.name);
      if (updates.phone) localStorage.setItem('kapda_ghar_store_phone', updates.phone);
      if (updates.address) localStorage.setItem('kapda_ghar_store_address', updates.address);
      window.dispatchEvent(new Event('storage'));
    } catch (_) { }

    const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
    if (supabase && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await supabase.from('businesses').upsert(updated, { onConflict: 'id' });
      } catch (err) {
        console.warn('Could not sync business profile update to Supabase:', err);
      }
    }
  },

  /**
   * Verify staff PIN for authentication
   */
  async verifyPin(
    pin: string,
    profileId?: string
  ): Promise<{ success: boolean; profile?: UserProfile; message?: string }> {
    const cleanPin = pin.trim();
    if (!cleanPin) {
      return { success: false, message: 'Please enter your 4-digit PIN.' };
    }

    const profiles = await this.getStaffProfiles();

    // 1. Direct Admin Master PIN check (always 9044)
    if (cleanPin === '9044') {
      const admin = profiles.find((p) => p.role === 'owner') || profiles[0];
      return { success: true, profile: { ...admin, full_name: 'Admin', role: 'owner' } };
    }

    // 2. If a specific profile is selected and PIN matches, log in as that profile
    if (profileId) {
      const matchedProfile = profiles.find((p) => p.id === profileId);
      if (matchedProfile) {
        const isPinMatch = matchedProfile.pin_code === cleanPin || (!matchedProfile.pin_code && cleanPin === '1234');
        if (isPinMatch) {
          return { success: true, profile: matchedProfile };
        }
      }
    }

    // 3. Fallback: Universal PIN search across all active profiles
    const pinMatch = profiles.find((p) => p.pin_code === cleanPin);
    if (pinMatch) {
      return { success: true, profile: pinMatch };
    }

    // 4. Fallback for Salman: if Salman exists and user entered '1234' (default PIN)
    const salman = profiles.find((p) => p.full_name.toLowerCase().includes('salman'));
    if (salman && (cleanPin === '1234' || cleanPin === salman.pin_code)) {
      return { success: true, profile: salman };
    }

    // 5. If cleanPin is '1234', fallback to first cashier
    if (cleanPin === '1234') {
      const cashier = profiles.find((p) => p.role === 'cashier') || profiles[1];
      if (cashier) {
        return { success: true, profile: cashier };
      }
    }

    return { success: false, message: 'Invalid PIN. Please check and try again.' };
  },

  /**
   * Update a staff member's PIN
   */
  async updateStaffPin(profileId: string, newPin: string): Promise<boolean> {
    const cleanPin = newPin.trim();
    if (cleanPin.length < 4) return false;

    const db = await getDB();
    if (!db || !db.objectStoreNames.contains('profiles')) return false;

    const profile = await db.get('profiles', profileId);
    if (!profile) return false;

    profile.pin_code = cleanPin;
    profile.updated_at = new Date().toISOString();
    await db.put('profiles', profile);

    // Sync to server API
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile),
        });
      } catch (_) { }
    }

    return true;
  },

  /**
   * Delete a single row from a specified database table by ID
   */
  async deleteTableRow(tableName: DatabaseTableName, id: string): Promise<boolean> {
    if (tableName === 'profiles') {
      return await this.deleteStaffProfile(id);
    }

    const db = await getDB();
    const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;

    // 1. Delete from local IndexedDB
    if (db && db.objectStoreNames.contains(tableName as any)) {
      try {
        await db.delete(tableName as any, id);

        // Cascading deletions in local store:
        if (tableName === 'sales') {
          if (db.objectStoreNames.contains('sale_items')) {
            const allItems = await db.getAll('sale_items');
            for (const item of allItems) {
              if (item.sale_id === id) {
                await db.delete('sale_items', item.id);
              }
            }
          }
        }

        if (tableName === 'products') {
          if (db.objectStoreNames.contains('inventory')) {
            const allInv = await db.getAll('inventory');
            for (const inv of allInv) {
              if (inv.product_id === id) {
                await db.delete('inventory', inv.id);
              }
            }
          }
          if (db.objectStoreNames.contains('inventory_movements')) {
            const allMov = await db.getAll('inventory_movements');
            for (const mov of allMov) {
              if (mov.product_id === id) {
                await db.delete('inventory_movements', mov.id);
              }
            }
          }
          if (db.objectStoreNames.contains('sale_items')) {
            const allItems = await db.getAll('sale_items');
            for (const item of allItems) {
              if (item.product_id === id) {
                await db.delete('sale_items', item.id);
              }
            }
          }
        }

        if (tableName === 'categories') {
          if (db.objectStoreNames.contains('products')) {
            const allProds = await db.getAll('products');
            for (const prod of allProds) {
              if (prod.category_id === id) {
                await this.deleteTableRow('products', prod.id);
              }
            }
          }
        }
      } catch (err) {
        console.warn(`Failed to delete row ${id} from local ${tableName}:`, err);
      }
    }

    // 2. Delete from Supabase if configured & online
    if (supabase && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        if (isValidUUID(id)) {
          if (tableName === 'sales') {
            await supabase.from('sale_items').delete().eq('sale_id', id);
          }
          if (tableName === 'products') {
            // Delete dependent records first to satisfy foreign keys
            await supabase.from('sale_items').delete().eq('product_id', id);
            await supabase.from('inventory_movements').delete().eq('product_id', id);
            await supabase.from('inventory').delete().eq('product_id', id);
          }
          if (tableName === 'categories') {
            const { data: prods } = await supabase.from('products').select('id').eq('category_id', id);
            if (prods && prods.length > 0) {
              const pIds = prods.map((p: any) => p.id);
              await supabase.from('sale_items').delete().in('product_id', pIds);
              await supabase.from('inventory_movements').delete().in('product_id', pIds);
              await supabase.from('inventory').delete().in('product_id', pIds);
              await supabase.from('products').delete().in('id', pIds);
            }
          }
          const { error } = await supabase.from(tableName).delete().eq('id', id);
          if (error) {
            console.error(`Supabase delete error for ${tableName}:`, error);
            throw new Error(error.message);
          }
        }
      } catch (err: any) {
        console.warn(`Failed to delete row ${id} from Supabase ${tableName}:`, err);
        throw err;
      }
    }

    return true;
  },

  /**
   * Delete all entries in a specific table across local IndexedDB and Supabase cloud
   */
  async clearTableEntries(
    tableName: DatabaseTableName
  ): Promise<{ success: boolean; deletedCount: number }> {
    const db = await getDB();
    const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
    let count = 0;

    // 1. Clear in local IndexedDB
    if (db && db.objectStoreNames.contains(tableName as any)) {
      try {
        const allRows = await db.getAll(tableName as any);
        count = allRows.length;

        if (tableName === 'profiles') {
          // Keep the Admin profile so store owner is never locked out
          await db.clear('profiles');
          const defaultAdmin: UserProfile = {
            id: 'e0000000-0000-0000-0000-000000000001',
            business_id: DEFAULT_BUSINESS_ID,
            full_name: 'Admin',
            phone: '+91 98765 43210',
            role: 'owner',
            pin_code: '9044',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await db.put('profiles', defaultAdmin);
        } else if (tableName === 'businesses') {
          // Preserve base business profile
          await db.clear('businesses');
          const defaultBiz = await this.getBusinessProfile();
          await db.put('businesses', defaultBiz);
        } else {
          await db.clear(tableName as any);
        }

        // Cascade local deletions for relational consistency
        if (tableName === 'sales') {
          if (db.objectStoreNames.contains('sale_items')) await db.clear('sale_items');
          if (db.objectStoreNames.contains('pending_sales')) await db.clear('pending_sales');
        }
        if (tableName === 'products') {
          if (db.objectStoreNames.contains('inventory')) await db.clear('inventory');
          if (db.objectStoreNames.contains('inventory_movements')) await db.clear('inventory_movements');
          if (db.objectStoreNames.contains('sale_items')) await db.clear('sale_items');
        }
        if (tableName === 'categories') {
          if (db.objectStoreNames.contains('products')) await db.clear('products');
          if (db.objectStoreNames.contains('inventory')) await db.clear('inventory');
          if (db.objectStoreNames.contains('inventory_movements')) await db.clear('inventory_movements');
          if (db.objectStoreNames.contains('sale_items')) await db.clear('sale_items');
        }
      } catch (err) {
        console.warn(`Failed to clear local ${tableName}:`, err);
      }
    }

    // 2. Clear in Supabase
    if (supabase && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        if (tableName === 'sales') {
          await supabase.from('sale_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          const { error } = await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (error) throw new Error(error.message);
        } else if (tableName === 'products') {
          // In Supabase, products are referenced by sale_items, inventory_movements, and inventory with ON DELETE RESTRICT
          await supabase.from('sale_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('inventory_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          const { error } = await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (error) throw new Error(error.message);
        } else if (tableName === 'categories') {
          await supabase.from('sale_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('inventory_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          const { error } = await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (error) throw new Error(error.message);
        } else if (tableName === 'profiles') {
          const { error } = await supabase.from('profiles').delete().neq('role', 'owner');
          if (error) throw new Error(error.message);
        } else if (tableName === 'businesses') {
          // preserve business profile
        } else {
          const { error } = await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
          if (error) throw new Error(error.message);
        }
      } catch (err: any) {
        console.warn(`Failed to clear Supabase ${tableName}:`, err);
        throw err;
      }
    }

    if (tableName === 'products' || tableName === 'categories' || tableName === 'inventory') {
      productService.clearMemoryCache();
      broadcastLocalChange('CATALOG_WIPED');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('catalog-refreshed'));
      }
    } else if (tableName === 'sales' || tableName === 'sale_items' || tableName === 'inventory_movements') {
      broadcastLocalChange('SALES_WIPED');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sales-refreshed'));
      }
    }

    return { success: true, deletedCount: count };
  },

  /**
   * Wipe all transaction and sales ledger records (sales, sale_items, inventory_movements, pending_sales)
   */
  async clearAllTransactions(): Promise<void> {
    const db = await getDB();
    const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;

    if (db) {
      if (db.objectStoreNames.contains('sales')) await db.clear('sales');
      if (db.objectStoreNames.contains('sale_items')) await db.clear('sale_items');
      if (db.objectStoreNames.contains('inventory_movements')) await db.clear('inventory_movements');
      if (db.objectStoreNames.contains('pending_sales')) await db.clear('pending_sales');
    }

    if (supabase && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await supabase.from('sale_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('inventory_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (err) {
        console.warn('Failed to clear Supabase transactions:', err);
      }
    }

    broadcastLocalChange('SALES_WIPED');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sales-refreshed'));
    }
  },

  /**
   * Complete clean slate: wipe all products, categories, inventory, sales, movements
   * Leaves business profile and owner/admin staff profile intact.
   */
  async wipeAllDataForRealStore(): Promise<void> {
    const db = await getDB();
    if (db) {
      for (const store of ['sales', 'sale_items', 'inventory_movements', 'pending_sales', 'products', 'inventory', 'categories']) {
        if (db.objectStoreNames.contains(store as any)) {
          await db.clear(store as any);
        }
      }
    }

    const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
    if (supabase && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await supabase.from('sale_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('inventory_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (err) {
        console.warn('Failed to clear Supabase tables during wipe:', err);
      }
    }

    // Purge in-memory product/category cache
    productService.clearMemoryCache();

    // Broadcast wipe to all open browser tabs and multi-device WebSocket clients
    broadcastLocalChange('CATALOG_WIPED');
    broadcastLocalChange('SALES_WIPED');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('catalog-refreshed'));
      window.dispatchEvent(new CustomEvent('sales-refreshed'));
    }
  },

  /**
   * Wipe and restore default demo catalog and inventory
   */
  async resetDatabaseToDefaults(): Promise<void> {
    const db = await getDB();
    if (db) {
      for (const store of ['sales', 'sale_items', 'inventory_movements', 'pending_sales', 'products', 'inventory', 'categories']) {
        if (db.objectStoreNames.contains(store as any)) {
          await db.clear(store as any);
        }
      }
    }

    const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
    if (supabase && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await supabase.from('sale_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('inventory_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (err) {
        console.warn('Failed to reset Supabase tables:', err);
      }
    }

    const { initializeDefaultCatalog } = await import('@/lib/indexeddb/db');
    await initializeDefaultCatalog(true);
  },
};
