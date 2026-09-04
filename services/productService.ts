import { getDB } from '@/lib/indexeddb/db';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateUUID } from '@/lib/utils/uuid';
import { Category, Product } from '@/types';

export const productService = {
  async getCategories(): Promise<Category[]> {
    const db = await getDB();
    const localCategories = db ? await db.getAll('categories') : [];

    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('is_active', true)
            .order('name');
          if (!error && data !== null) {
            // Synchronize local cache with remote state
            if (db) {
              const tx = db.transaction('categories', 'readwrite');
              await tx.store.clear();
              for (const cat of data) {
                await tx.store.put(cat);
              }
              await tx.done;
            }
            return data;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch categories from Supabase, falling back to local DB:', err);
      }
    }

    return localCategories.filter((c) => c.is_active);
  },

  async createCategory(name: string, description?: string): Promise<Category> {
    const newCategory: Category = {
      id: generateUUID(),
      name: name.trim(),
      description: description?.trim(),
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const db = await getDB();
    if (db) {
      await db.put('categories', newCategory);
    }

    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase.from('categories').insert(newCategory);
        }
      } catch (err) {
        console.warn('Failed to sync new category to Supabase:', err);
      }
    }

    return newCategory;
  },

  async getProducts(searchQuery?: string, categoryId?: string): Promise<Product[]> {
    const db = await getDB();
    let products: Product[] = [];

    if (db) {
      const allProducts = await db.getAll('products');
      const allInventory = await db.getAll('inventory');
      const allCategories = await db.getAll('categories');

      const invMap = new Map(allInventory.map((i) => [i.product_id, i.quantity]));
      const catMap = new Map(allCategories.map((c) => [c.id, c.name]));

      products = allProducts
        .filter((p) => p.is_active)
        .map((p) => ({
          ...p,
          quantity: invMap.get(p.id) ?? 0,
          category_name: catMap.get(p.category_id) || 'General',
        }));
    }

    // Try cloud if online and configured
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
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
              category_name: item.categories?.name || 'General',
              name: item.name,
              sku: item.sku,
              barcode: item.barcode,
              description: item.description,
              image_url: item.image_url,
              purchase_price: Number(item.purchase_price),
              selling_price: Number(item.selling_price),
              low_stock_threshold: item.low_stock_threshold || 5,
              is_active: item.is_active,
              quantity: item.inventory?.[0]?.quantity ?? 0,
              created_at: item.created_at,
              updated_at: item.updated_at,
            }));

            // Sync to local cache
            if (db) {
              const tx = db.transaction(['products', 'inventory'], 'readwrite');
              await tx.objectStore('products').clear();
              await tx.objectStore('inventory').clear();
              for (const p of cloudProducts) {
                await tx.objectStore('products').put(p);
                await tx.objectStore('inventory').put({
                  id: `inv-${p.id}`,
                  product_id: p.id,
                  quantity: p.quantity ?? 0,
                  updated_at: p.updated_at,
                });
              }
              await tx.done;
            }

            products = cloudProducts;
          }
        }
      } catch (err) {
        console.warn('Falling back to local IndexedDB product catalog:', err);
      }
    }

    // Filter by category
    if (categoryId && categoryId !== 'all') {
      products = products.filter((p) => p.category_id === categoryId);
    }

    // Filter by search query (instant debounced or typed)
    if (searchQuery && searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.includes(q) ||
          p.category_name?.toLowerCase().includes(q)
      );
    }

    return products;
  },

  async getProductById(id: string): Promise<Product | null> {
    const products = await this.getProducts();
    return products.find((p) => p.id === id) || null;
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
      created_at: now,
      updated_at: now,
      quantity: openingStock,
    };

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

    // Sync to Supabase if configured and online
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { error: prodErr } = await supabase.from('products').insert({
            id: newId,
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
            await supabase.from('inventory').insert({
              product_id: newId,
              quantity: openingStock,
            });

            if (openingStock > 0) {
              await supabase.from('inventory_movements').insert({
                product_id: newId,
                movement_type: 'purchase',
                quantity_change: openingStock,
                quantity_before: 0,
                quantity_after: openingStock,
                notes: 'Opening stock on product creation',
              });
            }
          }
        }
      } catch (err) {
        console.warn('Product created locally, Supabase cloud sync deferred:', err);
      }
    }

    return newProduct;
  },

  async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    const db = await getDB();
    if (db) {
      const existing = await db.get('products', id);
      if (existing) {
        const updated = {
          ...existing,
          ...updates,
          updated_at: new Date().toISOString(),
        };
        await db.put('products', updated);
      }
    }

    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { quantity, category_name, ...cloudUpdates } = updates as any;
          await supabase.from('products').update(cloudUpdates).eq('id', id);
        }
      } catch (err) {
        console.warn('Product updated locally, failed cloud sync:', err);
      }
    }
  },

  /**
   * Delete a product (soft delete: is_active = false) so active catalog excludes it
   * while historical sales records and receipts remain intact.
   */
  async deleteProduct(id: string): Promise<boolean> {
    return deleteProduct(id);
  },

  async deactivateProduct(id: string): Promise<void> {
    await deleteProduct(id);
  },
};

export async function deleteProduct(id: string): Promise<boolean> {
  try {
    await productService.updateProduct(id, { is_active: false });
    return true;
  } catch (err) {
    console.error('Failed to delete product:', err);
    return false;
  }
}

