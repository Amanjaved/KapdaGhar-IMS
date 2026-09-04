import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Category, Product, Inventory, Sale, SaleItem, InventoryMovement, PendingSale } from '@/types';

interface KapdaGharDB extends DBSchema {
  categories: {
    key: string;
    value: Category;
    indexes: { 'by-name': string };
  };
  products: {
    key: string;
    value: Product;
    indexes: {
      'by-category': string;
      'by-barcode': string;
      'by-sku': string;
      'by-name': string;
    };
  };
  inventory: {
    key: string;
    value: Inventory;
    indexes: { 'by-product': string };
  };
  sales: {
    key: string;
    value: Sale;
    indexes: { 'by-date': string; 'by-receipt': string };
  };
  sale_items: {
    key: string;
    value: SaleItem;
    indexes: { 'by-sale': string; 'by-product': string };
  };
  inventory_movements: {
    key: string;
    value: InventoryMovement;
    indexes: { 'by-product': string; 'by-date': string };
  };
  pending_sales: {
    key: string; // client_transaction_id
    value: PendingSale;
    indexes: { 'by-synced': number };
  };
  profiles: {
    key: string;
    value: import('@/types').UserProfile;
    indexes: { 'by-role': string };
  };
  businesses: {
    key: string;
    value: import('@/types').Business;
  };
}

const DB_NAME = 'kapda_ghar_db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<KapdaGharDB>> | null = null;

export function getDB() {
  if (typeof window === 'undefined') return null;

  if (!dbPromise) {
    dbPromise = openDB<KapdaGharDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Categories
        if (!db.objectStoreNames.contains('categories')) {
          const categoryStore = db.createObjectStore('categories', { keyPath: 'id' });
          categoryStore.createIndex('by-name', 'name');
        }

        // Products
        if (!db.objectStoreNames.contains('products')) {
          const productStore = db.createObjectStore('products', { keyPath: 'id' });
          productStore.createIndex('by-category', 'category_id');
          productStore.createIndex('by-barcode', 'barcode');
          productStore.createIndex('by-sku', 'sku');
          productStore.createIndex('by-name', 'name');
        }

        // Inventory
        if (!db.objectStoreNames.contains('inventory')) {
          const inventoryStore = db.createObjectStore('inventory', { keyPath: 'id' });
          inventoryStore.createIndex('by-product', 'product_id', { unique: true });
        }

        // Sales
        if (!db.objectStoreNames.contains('sales')) {
          const salesStore = db.createObjectStore('sales', { keyPath: 'id' });
          salesStore.createIndex('by-date', 'created_at');
          salesStore.createIndex('by-receipt', 'receipt_number', { unique: true });
        }

        // Sale Items
        if (!db.objectStoreNames.contains('sale_items')) {
          const saleItemsStore = db.createObjectStore('sale_items', { keyPath: 'id' });
          saleItemsStore.createIndex('by-sale', 'sale_id');
          saleItemsStore.createIndex('by-product', 'product_id');
        }

        // Inventory Movements
        if (!db.objectStoreNames.contains('inventory_movements')) {
          const movementsStore = db.createObjectStore('inventory_movements', { keyPath: 'id' });
          movementsStore.createIndex('by-product', 'product_id');
          movementsStore.createIndex('by-date', 'created_at');
        }

        // Pending Sales Queue
        if (!db.objectStoreNames.contains('pending_sales')) {
          const pendingStore = db.createObjectStore('pending_sales', { keyPath: 'client_transaction_id' });
          pendingStore.createIndex('by-synced', 'synced');
        }

        // Staff / User Profiles
        if (!db.objectStoreNames.contains('profiles')) {
          const profileStore = db.createObjectStore('profiles', { keyPath: 'id' });
          profileStore.createIndex('by-role', 'role');
        }

        // Business Store
        if (!db.objectStoreNames.contains('businesses')) {
          db.createObjectStore('businesses', { keyPath: 'id' });
        }
      },
    });
  }

  return dbPromise;
}

// Initial seed data for offline / immediate out-of-the-box experience
export async function initializeDefaultCatalog(force: boolean = false) {
  if (!force) return; // Prevent accidental auto-seeding unless explicitly requested by admin
  const db = await getDB();
  if (!db) return;

  const existingProducts = await db.getAll('products');
  if (existingProducts.length > 0) return; // already initialized

  const defaultCategories: Category[] = [
    {
      id: 'c0000000-0000-0000-0000-000000000001',
      name: 'Clothes',
      description: 'Kurtis, Suits, Sarees & Ethnic Wear',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c0000000-0000-0000-0000-000000000002',
      name: 'Ladies Purses',
      description: 'Handbags, Clutches, Shoulder Bags & Wallets',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c0000000-0000-0000-0000-000000000003',
      name: 'Footwear',
      description: 'Sandals, Heels, Slippers, Flats & Mojaris',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c0000000-0000-0000-0000-000000000004',
      name: 'Accessories',
      description: 'Dupattas, Belts, Scarves & Jewellery',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const defaultProducts: (Product & { opening_stock: number })[] = [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      category_id: 'c0000000-0000-0000-0000-000000000001',
      category_name: 'Clothes',
      name: 'Blue Cotton Kurti',
      sku: 'KG-CL-001',
      barcode: '8901001001',
      description: 'Comfortable pure cotton daily wear kurti with hand embroidery',
      image_url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=500&auto=format&fit=crop&q=60',
      purchase_price: 350,
      selling_price: 699,
      low_stock_threshold: 5,
      is_active: true,
      opening_stock: 15,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'a0000000-0000-0000-0000-000000000002',
      category_id: 'c0000000-0000-0000-0000-000000000001',
      category_name: 'Clothes',
      name: 'Embroidered Anarkali Suit',
      sku: 'KG-CL-002',
      barcode: '8901001002',
      description: 'Festive royal anarkali suit set with heavy dupatta',
      image_url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=60',
      purchase_price: 850,
      selling_price: 1699,
      low_stock_threshold: 5,
      is_active: true,
      opening_stock: 8,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'a0000000-0000-0000-0000-000000000003',
      category_id: 'c0000000-0000-0000-0000-000000000002',
      category_name: 'Ladies Purses',
      name: 'Black Ladies Handbag',
      sku: 'KG-PR-001',
      barcode: '8901002001',
      description: 'Premium faux leather handbag with zip compartments',
      image_url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&auto=format&fit=crop&q=60',
      purchase_price: 450,
      selling_price: 999,
      low_stock_threshold: 5,
      is_active: true,
      opening_stock: 6,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'a0000000-0000-0000-0000-000000000004',
      category_id: 'c0000000-0000-0000-0000-000000000002',
      category_name: 'Ladies Purses',
      name: 'Golden Party Clutch',
      sku: 'KG-PR-002',
      barcode: '8901002002',
      description: 'Glittery party wear clutch with detachable sling chain',
      image_url: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=500&auto=format&fit=crop&q=60',
      purchase_price: 250,
      selling_price: 549,
      low_stock_threshold: 5,
      is_active: true,
      opening_stock: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'a0000000-0000-0000-0000-000000000005',
      category_id: 'c0000000-0000-0000-0000-000000000003',
      category_name: 'Footwear',
      name: 'Black Casual Sandal',
      sku: 'KG-FW-001',
      barcode: '8901003001',
      description: 'Comfortable cushioned flat casual sandal for ladies',
      image_url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=500&auto=format&fit=crop&q=60',
      purchase_price: 300,
      selling_price: 650,
      low_stock_threshold: 5,
      is_active: true,
      opening_stock: 12,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'a0000000-0000-0000-0000-000000000006',
      category_id: 'c0000000-0000-0000-0000-000000000003',
      category_name: 'Footwear',
      name: 'Ethnic Mojari Footwear',
      sku: 'KG-FW-002',
      barcode: '8901003002',
      description: 'Traditional handcrafted Rajasthani jutti / mojari',
      image_url: 'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?w=500&auto=format&fit=crop&q=60',
      purchase_price: 280,
      selling_price: 599,
      low_stock_threshold: 5,
      is_active: true,
      opening_stock: 2, // Low stock!
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'a0000000-0000-0000-0000-000000000007',
      category_id: 'c0000000-0000-0000-0000-000000000004',
      category_name: 'Accessories',
      name: 'Banarasi Silk Dupatta',
      sku: 'KG-AC-001',
      barcode: '8901004001',
      description: 'Rich zari woven Banarasi art silk dupatta with tassels',
      image_url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=60',
      purchase_price: 200,
      selling_price: 499,
      low_stock_threshold: 5,
      is_active: true,
      opening_stock: 20,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const tx = db.transaction(['categories', 'products', 'inventory', 'inventory_movements', 'profiles'], 'readwrite');

  for (const cat of defaultCategories) {
    await tx.objectStore('categories').put(cat);
  }

  for (const prod of defaultProducts) {
    const { opening_stock, ...productData } = prod;
    await tx.objectStore('products').put(productData);

    const inv: Inventory = {
      id: `inv-${prod.id}`,
      product_id: prod.id,
      quantity: opening_stock,
      updated_at: new Date().toISOString(),
    };
    await tx.objectStore('inventory').put(inv);

    const movement: InventoryMovement = {
      id: `mov-${prod.id}`,
      product_id: prod.id,
      product_name: prod.name,
      movement_type: 'purchase',
      quantity_change: opening_stock,
      quantity_before: 0,
      quantity_after: opening_stock,
      notes: 'Initial opening stock',
      created_at: new Date().toISOString(),
    };
    await tx.objectStore('inventory_movements').put(movement);
  }

  // Seed default Admin (PIN: 9044)
  const defaultAdmin = {
    id: 'e0000000-0000-0000-0000-000000000001',
    business_id: 'b0000000-0000-0000-0000-000000000001',
    full_name: 'Admin',
    phone: '+91 98765 43210',
    role: 'owner' as const,
    pin_code: '9044',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await tx.objectStore('profiles').put(defaultAdmin);

  await tx.done;
}
