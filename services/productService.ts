import { getDB } from '@/lib/indexeddb/db';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateUUID } from '@/lib/utils/uuid';
import { Category, Product } from '@/types';
import { broadcastLocalChange } from '@/lib/supabase/realtime';

const DEFAULT_BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'b0000000-0000-0000-0000-000000000001';

// Fast In-Memory Cache for 0ms lag
let memoryProducts: Product[] | null = null;
let memoryCategories: Category[] | null = null;
let lastProductsSync = 0;
let lastCategoriesSync = 0;
const SYNC_TTL_MS = 20_000; // 20 seconds

let pendingProductsSync: Promise<Product[]> | null = null;
let pendingCategoriesSync: Promise<Category[]> | null = null;

export function extractQuantity(inv: any): number {
  if (inv === null || inv === undefined) return 0;
  if (Array.isArray(inv)) {
    return inv.length > 0 ? (Number(inv[0]?.quantity) || 0) : 0;
  }
  if (typeof inv === 'object') {
    return Number(inv.quantity) || 0;
  }
  return Number(inv) || 0;
}

export function extractCategoryName(cat: any): string {
  if (!cat) return 'General';
  if (Array.isArray(cat)) {
    return cat.length > 0 ? (cat[0]?.name || 'General') : 'General';
  }
  if (typeof cat === 'object') {
    return cat.name || 'General';
  }
  return 'General';
}

function notifyCatalogUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('catalog-refreshed'));
  }
  broadcastLocalChange('CATALOG_UPDATED');
}

export const productService = {
  /**
   * Fast categories fetch with in-memory caching and background sync
   */
  async getCategories(forceRefresh: boolean = false): Promise<Category[]> {
    const now = Date.now();

    // 1. Instant return from in-memory cache if fresh
    if (!forceRefresh && memoryCategories && now - lastCategoriesSync < SYNC_TTL_MS) {
      return memoryCategories;
    }

    // 2. Read from local IndexedDB if memory cache empty
    const db = await getDB();
    if (!memoryCategories && db) {
      const localCats = await db.getAll('categories');
      if (localCats.length > 0) {
        memoryCategories = localCats.filter((c) => c.is_active);
      }
    }

    // 3. Trigger background or synchronous cloud sync
    const shouldAwaitCloud = forceRefresh || !memoryCategories || memoryCategories.length === 0;

    const syncPromise = this.syncCategoriesFromCloud();
    if (shouldAwaitCloud) {
      return syncPromise;
    }

    return memoryCategories || [];
  },

  async syncCategoriesFromCloud(): Promise<Category[]> {
    if (pendingCategoriesSync) return pendingCategoriesSync;

    pendingCategoriesSync = (async () => {
      try {
        if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { data, error } = await supabase
              .from('categories')
              .select('*')
              .eq('is_active', true)
              .order('name');

            if (!error && data !== null) {
              memoryCategories = data;
              lastCategoriesSync = Date.now();

              // Batch save to IndexedDB asynchronously
              const db = await getDB();
              if (db) {
                const tx = db.transaction('categories', 'readwrite');
                await Promise.all(data.map((c) => tx.store.put(c)));
                await tx.done;
              }

              notifyCatalogUpdated();
              return data;
            }
          }
        }
      } catch (err) {
        console.warn('Categories cloud sync failed, using cached state:', err);
      } finally {
        pendingCategoriesSync = null;
      }

      const db = await getDB();
      const local = db ? await db.getAll('categories') : [];
      memoryCategories = local.filter((c) => c.is_active);
      return memoryCategories;
    })();

    return pendingCategoriesSync;
  },

  async createCategory(name: string, description?: string): Promise<Category> {
    const newCategory: Category = {
      id: generateUUID(),
      business_id: DEFAULT_BUSINESS_ID,
      name: name.trim(),
      description: description?.trim(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Update in-memory cache immediately
    if (memoryCategories) {
      memoryCategories = [...memoryCategories, newCategory];
    } else {
      memoryCategories = [newCategory];
    }

    const db = await getDB();
    if (db) {
      await db.put('categories', newCategory);
    }

    notifyCatalogUpdated();

    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      (async () => {
        try {
          const supabase = getSupabaseClient();
          if (supabase) {
            await supabase.from('categories').insert({
              id: newCategory.id,
              business_id: DEFAULT_BUSINESS_ID,
              name: newCategory.name,
              description: newCategory.description || null,
              is_active: true,
            });
          }
        } catch (err) {
          console.warn('Failed to sync new category to Supabase:', err);
        }
      })();
    }

    return newCategory;
  },

  /**
   * Fast products fetch with instant cache return and non-blocking background sync
   */
  async getProducts(
    searchQuery?: string,
    categoryId?: string,
    forceRefresh: boolean = false
  ): Promise<Product[]> {
    const now = Date.now();

    // 1. Fast in-memory check (0ms)
    if (!forceRefresh && memoryProducts && now - lastProductsSync < SYNC_TTL_MS) {
      return this.applyProductFilters(memoryProducts, searchQuery, categoryId);
    }

    // 2. Fast IndexedDB read if memory is empty (5ms)
    const db = await getDB();
    if (!memoryProducts && db) {
      const [allProducts, allInventory, allCategories] = await Promise.all([
        db.getAll('products'),
        db.getAll('inventory'),
        db.getAll('categories'),
      ]);

      if (allProducts.length > 0) {
        const invMap = new Map(allInventory.map((i) => [i.product_id, i.quantity]));
        const catMap = new Map(allCategories.map((c) => [c.id, c.name]));

        memoryProducts = allProducts
          .filter((p) => p.is_active)
          .map((p) => ({
            ...p,
            quantity: invMap.get(p.id) ?? p.quantity ?? 0,
            category_name: catMap.get(p.category_id) || p.category_name || 'General',
          }));
      }
    }

    const hasLocal = memoryProducts && memoryProducts.length > 0;

    // Trigger cloud sync
    const syncPromise = this.syncProductsFromCloud();

    // Only block if forceRefresh requested or completely empty local state
    if (forceRefresh || !hasLocal) {
      const freshProducts = await syncPromise;
      return this.applyProductFilters(freshProducts, searchQuery, categoryId);
    }

    // Return local/cached products immediately (0ms delay)
    return this.applyProductFilters(memoryProducts || [], searchQuery, categoryId);
  },

  async syncProductsFromCloud(): Promise<Product[]> {
    if (pendingProductsSync) return pendingProductsSync;

    pendingProductsSync = (async () => {
      try {
        if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { data, error } = await supabase
              .from('products')
              .select(`
                *,
                inventory (quantity),
                categories (name)
              `)
              .eq('is_active', true)
              .order('name');

            if (!error && data !== null) {
              const cloudProducts: Product[] = data.map((item: any) => ({
                id: item.id,
                business_id: item.business_id,
                category_id: item.category_id,
                category_name: extractCategoryName(item.categories),
                name: item.name,
                sku: item.sku,
                barcode: item.barcode,
                description: item.description,
                image_url: item.image_url,
                purchase_price: Number(item.purchase_price),
                selling_price: Number(item.selling_price),
                low_stock_threshold: item.low_stock_threshold || 5,
                is_active: item.is_active,
                quantity: extractQuantity(item.inventory),
                created_at: item.created_at,
                updated_at: item.updated_at,
              }));

              // Preserve any locally created products that aren't yet in the cloud snapshot
              const cloudIds = new Set(cloudProducts.map((p) => p.id));
              const localUnsynced = (memoryProducts || []).filter((p) => !cloudIds.has(p.id));

              // If a product had quantity set locally, but cloud snapshot still shows 0 due to in-flight upsert, preserve local quantity
              const mergedProducts: Product[] = [
                ...cloudProducts.map((cp) => {
                  const lp = (memoryProducts || []).find((p) => p.id === cp.id);
                  if (cp.quantity === 0 && lp && (lp.quantity ?? 0) > 0) {
                    return { ...cp, quantity: lp.quantity };
                  }
                  return cp;
                }),
                ...localUnsynced,
              ];

              memoryProducts = mergedProducts;
              lastProductsSync = Date.now();

              // Batch save to IndexedDB asynchronously
              const db = await getDB();
              if (db) {
                try {
                  const tx = db.transaction(['products', 'inventory'], 'readwrite');
                  const pStore = tx.objectStore('products');
                  const iStore = tx.objectStore('inventory');
                  await Promise.all([
                    ...mergedProducts.map((p) => pStore.put(p)),
                    ...mergedProducts.map((p) =>
                      iStore.put({
                        id: `inv-${p.id}`,
                        product_id: p.id,
                        quantity: p.quantity ?? 0,
                        updated_at: p.updated_at,
                      })
                    ),
                  ]);
                  await tx.done;
                } catch (dbErr) {
                  console.warn('Batch IndexedDB sync warning:', dbErr);
                }
              }

              notifyCatalogUpdated();
              return mergedProducts;
            } else if (error) {
              console.error('Supabase products fetch error:', error);
            }
          }
        }
      } catch (err) {
        console.warn('Products cloud sync failed, using cached state:', err);
      } finally {
        pendingProductsSync = null;
      }

      // Fallback to local DB
      const db = await getDB();
      if (db) {
        const [allProducts, allInventory, allCategories] = await Promise.all([
          db.getAll('products'),
          db.getAll('inventory'),
          db.getAll('categories'),
        ]);

        const invMap = new Map(allInventory.map((i) => [i.product_id, i.quantity]));
        const catMap = new Map(allCategories.map((c) => [c.id, c.name]));

        memoryProducts = allProducts
          .filter((p) => p.is_active)
          .map((p) => ({
            ...p,
            quantity: invMap.get(p.id) ?? p.quantity ?? 0,
            category_name: catMap.get(p.category_id) || p.category_name || 'General',
          }));
      }

      return memoryProducts || [];
    })();

    return pendingProductsSync;
  },

  applyProductFilters(
    products: Product[],
    searchQuery?: string,
    categoryId?: string
  ): Product[] {
    let result = products;

    if (categoryId && categoryId !== 'all') {
      result = result.filter((p) => p.category_id === categoryId);
    }

    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.includes(q) ||
          p.category_name?.toLowerCase().includes(q)
      );
    }

    return result;
  },

  async getProductById(id: string): Promise<Product | null> {
    const products = await this.getProducts();
    return products.find((p) => p.id === id) || null;
  },

  /**
   * Update stock quantity in local cache immediately (0ms lag)
   */
  updateLocalProductStock(productId: string, newQuantity: number) {
    if (memoryProducts) {
      const idx = memoryProducts.findIndex((p) => p.id === productId);
      if (idx !== -1) {
        memoryProducts[idx] = {
          ...memoryProducts[idx],
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        };
      }
    }
  },

  async createProduct(
    productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>,
    openingStock: number = 0
  ): Promise<Product> {
    const newId = generateUUID();
    const now = new Date().toISOString();

    const newProduct: Product = {
      ...productData,
      id: newId,
      business_id: DEFAULT_BUSINESS_ID,
      created_at: now,
      updated_at: now,
      quantity: openingStock,
    };

    // 1. Immediately store in in-memory cache (0ms lag)
    if (memoryProducts) {
      memoryProducts = [newProduct, ...memoryProducts.filter((p) => p.id !== newId)];
    } else {
      memoryProducts = [newProduct];
    }

    // 2. Persist to local IndexedDB (5ms)
    const db = await getDB();
    if (db) {
      const tx = db.transaction(['products', 'inventory', 'inventory_movements'], 'readwrite');
      await tx.objectStore('products').put(newProduct);
      await tx.objectStore('inventory').put({
        id: `inv-${newId}`,
        product_id: newId,
        quantity: openingStock,
        updated_at: now,
      });

      if (openingStock > 0) {
        await tx.objectStore('inventory_movements').put({
          id: `mov-${Date.now()}`,
          product_id: newId,
          product_name: newProduct.name,
          movement_type: 'purchase',
          quantity_change: openingStock,
          quantity_before: 0,
          quantity_after: openingStock,
          notes: 'Opening stock on product creation',
          created_at: now,
        });
      }
      await tx.done;
    }

    // Notify UI and other tabs immediately
    notifyCatalogUpdated();

    // 3. Sync to Supabase in background without blocking the UI
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      (async () => {
        try {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { error: prodErr } = await supabase.from('products').insert({
              id: newId,
              business_id: DEFAULT_BUSINESS_ID,
              category_id: newProduct.category_id,
              name: newProduct.name,
              sku: newProduct.sku || null,
              barcode: newProduct.barcode || null,
              description: newProduct.description || null,
              image_url: newProduct.image_url || null,
              purchase_price: newProduct.purchase_price,
              selling_price: newProduct.selling_price,
              low_stock_threshold: newProduct.low_stock_threshold,
              is_active: true,
            });

            if (!prodErr) {
              await Promise.all([
                supabase.from('inventory').upsert(
                  {
                    business_id: DEFAULT_BUSINESS_ID,
                    product_id: newId,
                    quantity: openingStock,
                    updated_at: now,
                  },
                  { onConflict: 'product_id' }
                ),
                openingStock > 0
                  ? supabase.from('inventory_movements').insert({
                      business_id: DEFAULT_BUSINESS_ID,
                      product_id: newId,
                      movement_type: 'purchase',
                      quantity_change: openingStock,
                      quantity_before: 0,
                      quantity_after: openingStock,
                      notes: 'Opening stock on product creation',
                    })
                  : Promise.resolve(),
              ]);
            } else {
              console.error('Failed to create product in Supabase:', prodErr);
            }
          }
        } catch (err) {
          console.warn('Product created locally, Supabase cloud sync deferred:', err);
        }
      })();
    }

    return newProduct;
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    const now = new Date().toISOString();

    // 1. Update in-memory cache immediately
    if (memoryProducts) {
      const idx = memoryProducts.findIndex((p) => p.id === id);
      if (idx !== -1) {
        memoryProducts[idx] = {
          ...memoryProducts[idx],
          ...updates,
          updated_at: now,
        };
      }
    }

    // 2. Update local IndexedDB
    const db = await getDB();
    if (db) {
      const existing = await db.get('products', id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          updated_at: now,
        };
        await db.put('products', updated);
      }
    }

    notifyCatalogUpdated();

    // 3. Update Supabase
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      (async () => {
        try {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { quantity, category_name, ...cloudUpdates } = updates as any;
            await supabase.from('products').update(cloudUpdates).eq('id', id);
          }
        } catch (err) {
          console.warn('Product updated locally, failed cloud sync:', err);
        }
      })();
    }
  },

  /**
   * Delete a product (soft delete: is_active = false)
   */
  async deleteProduct(id: string): Promise<boolean> {
    return deleteProduct(id);
  },

  async deactivateProduct(id: string): Promise<void> {
    await deleteProduct(id);
  },

  invalidateCache() {
    memoryProducts = null;
    memoryCategories = null;
    lastProductsSync = 0;
    lastCategoriesSync = 0;
  },
};

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    // Remove from in-memory cache
    if (memoryProducts) {
      memoryProducts = memoryProducts.filter((p) => p.id !== id);
    }
    await productService.updateProduct(id, { is_active: false });
    notifyCatalogUpdated();
    return true;
  } catch (err) {
    console.error('Failed to delete product:', err);
    return false;
  }
}
