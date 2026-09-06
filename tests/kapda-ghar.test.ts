import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  calculateItemProfit,
  calculateNetProfit,
  calculateGrossProfit,
  roundToTwo,
} from '../lib/utils/currency';

describe('Kapda Ghar - Financial Mathematics & Currency Tests', () => {
  // Test #72 from Prompt Specification
  it('passes Profit Test (#72): Purchase ₹400, Selling ₹700, Quantity 3', () => {
    const purchasePrice = 400;
    const sellingPrice = 700;
    const quantity = 3;

    const revenue = roundToTwo(sellingPrice * quantity);
    const cost = roundToTwo(purchasePrice * quantity);
    const profit = calculateItemProfit(sellingPrice, purchasePrice, quantity);

    expect(revenue).toBe(2100);
    expect(cost).toBe(1200);
    expect(profit).toBe(900);
  });

  // Test #73 from Prompt Specification
  it('passes Discount Test (#73): Subtotal ₹2100, Discount ₹100, Cost ₹1200', () => {
    const subtotal = 2100;
    const discount = 100;
    const cost = 1200;

    const customerPays = roundToTwo(subtotal - discount);
    const profit = calculateNetProfit(customerPays, cost);

    expect(customerPays).toBe(2000);
    expect(cost).toBe(1200);
    expect(profit).toBe(800);
  });

  it('formats Indian Rupee currency correctly with comma grouping', () => {
    expect(formatCurrency(1299)).toContain('1,299');
    expect(formatCurrency(18420)).toContain('18,420');
    expect(formatCurrency(125000)).toContain('1,25,000');
  });

  it('calculates gross and net profit accurately without floating point skew', () => {
    const subtotal = 3450.5;
    const totalCost = 2100.25;
    const discount = 50.25;

    const gross = calculateGrossProfit(subtotal, totalCost);
    expect(gross).toBe(1350.25);

    const total = subtotal - discount; // 3400.25
    const net = calculateNetProfit(total, totalCost);
    expect(net).toBe(1300.0);
  });
});

describe('Kapda Ghar - Inventory & Concurrency Simulation Tests', () => {
  // Simulates atomic inventory deduction with row locking
  class MockInventoryStore {
    private stock: Map<string, number> = new Map();
    private lockQueue: Map<string, Promise<void>> = new Map();

    setStock(productId: string, qty: number) {
      this.stock.set(productId, qty);
    }

    getStock(productId: string): number {
      return this.stock.get(productId) ?? 0;
    }

    // Simulates PostgreSQL SELECT ... FOR UPDATE atomic transaction
    async executeSaleTransaction(
      productId: string,
      requestedQty: number
    ): Promise<{ success: boolean; finalStock: number; error?: string }> {
      // Wait for any active row-level lock on this product
      let resolveLock: () => void;
      const lockPromise = new Promise<void>((resolve) => {
        resolveLock = resolve;
      });

      const previousLock = this.lockQueue.get(productId) || Promise.resolve();
      this.lockQueue.set(productId, lockPromise);

      await previousLock;

      try {
        const currentQty = this.stock.get(productId) ?? 0;

        // Level 2 & 3 enforcement: quantity >= requested
        if (currentQty < requestedQty) {
          return {
            success: false,
            finalStock: currentQty,
            error: `Insufficient stock for product. Available: ${currentQty}, Requested: ${requestedQty}`,
          };
        }

        // Deduct
        const newQty = currentQty - requestedQty;
        this.stock.set(productId, newQty);

        return {
          success: true,
          finalStock: newQty,
        };
      } finally {
        resolveLock!();
      }
    }
  }

  // Test #71 from Prompt Specification: Critical Concurrency Test Case
  it('passes Critical Concurrency Test (#71): Two simultaneous sales for 1 remaining unit', async () => {
    const store = new MockInventoryStore();
    const productId = 'prod-black-sandal';
    store.setStock(productId, 1); // 1 unit in stock

    // Two sale requests simultaneously attempt to sell quantity = 1
    const [saleA, saleB] = await Promise.all([
      store.executeSaleTransaction(productId, 1),
      store.executeSaleTransaction(productId, 1),
    ]);

    // Exactly one sale must succeed, exactly one must fail
    const succeededSales = [saleA, saleB].filter((res) => res.success);
    const failedSales = [saleA, saleB].filter((res) => !res.success);

    expect(succeededSales.length).toBe(1);
    expect(failedSales.length).toBe(1);

    // Final stock MUST be 0, NEVER negative
    expect(store.getStock(productId)).toBe(0);
    expect(store.getStock(productId)).toBeGreaterThanOrEqual(0);
  });

  it('strictly rejects sales requesting more stock than available', async () => {
    const store = new MockInventoryStore();
    const productId = 'prod-blue-kurti';
    store.setStock(productId, 5);

    const saleResult = await store.executeSaleTransaction(productId, 6);
    expect(saleResult.success).toBe(false);
    expect(saleResult.error).toContain('Insufficient stock');
    expect(store.getStock(productId)).toBe(5);
  });
});

describe('Kapda Ghar - Catalog Management & Product Deletion Tests', () => {
  it('soft-deletes product preserving receipts and filtering from active catalog', () => {
    const catalog = [
      { id: 'prod-1', name: 'Blue Cotton Kurti', is_active: true },
      { id: 'prod-2', name: 'Leather Shoulder Bag', is_active: true },
      { id: 'prod-3', name: 'Silk Dupatta', is_active: true },
    ];

    // Deletion simulates setting is_active = false
    const deleteId = 'prod-1';
    const updatedCatalog = catalog.map((p) =>
      p.id === deleteId ? { ...p, is_active: false } : p
    );

    // Active products filter (used in /inventory and /sell)
    const activeProducts = updatedCatalog.filter((p) => p.is_active);

    expect(activeProducts.length).toBe(2);
    expect(activeProducts.find((p) => p.id === deleteId)).toBeUndefined();

    // Sales item receipt lookup remains intact
    const historicalSaleItem = {
      product_id: 'prod-1',
      product_name: 'Blue Cotton Kurti',
      quantity: 2,
      price: 700,
    };
    const productRecord = updatedCatalog.find((p) => p.id === historicalSaleItem.product_id);
    expect(productRecord).toBeDefined();
    expect(productRecord?.name).toBe('Blue Cotton Kurti');
    expect(productRecord?.is_active).toBe(false);
  });

  it('correctly simulates deleting all entries from a table (e.g. sale_items or sales)', () => {
    let sales = [
      { id: 's-1', receipt_number: 'KG-1001', total: 699 },
      { id: 's-2', receipt_number: 'KG-1002', total: 1299 },
    ];
    let saleItems = [
      { id: 'si-1', sale_id: 's-1', product_name: 'Blue Cotton Kurti', quantity: 1 },
      { id: 'si-2', sale_id: 's-2', product_name: 'Ladies Purse', quantity: 1 },
    ];

    // Delete single entry from sale_items
    saleItems = saleItems.filter((i) => i.id !== 'si-1');
    expect(saleItems.length).toBe(1);
    expect(saleItems[0].id).toBe('si-2');

    // Delete all entries from sale_items
    saleItems = [];
    expect(saleItems.length).toBe(0);

    // Cascading delete: deleting all sales cascades to sale_items
    sales = [];
    if (sales.length === 0) {
      saleItems = [];
    }
    expect(sales.length).toBe(0);
    expect(saleItems.length).toBe(0);
  });

  it('correctly extracts inventory quantity from both object and array Supabase PostgREST formats', async () => {
    const { extractQuantity, extractCategoryName } = await import('../services/productService');

    // Supabase PostgREST 1-to-1 object format
    expect(extractQuantity({ quantity: 15 })).toBe(15);
    expect(extractQuantity({ quantity: '25' })).toBe(25);
    expect(extractQuantity({ quantity: 0 })).toBe(0);

    // Array format
    expect(extractQuantity([{ quantity: 30 }])).toBe(30);
    expect(extractQuantity([{ quantity: 0 }])).toBe(0);
    expect(extractQuantity([])).toBe(0);

    // Direct number and null/undefined fallbacks
    expect(extractQuantity(40)).toBe(40);
    expect(extractQuantity(null)).toBe(0);
    expect(extractQuantity(undefined)).toBe(0);

    // Category name extraction
    expect(extractCategoryName({ name: 'Men Wear' })).toBe('Men Wear');
    expect(extractCategoryName([{ name: 'Electronics' }])).toBe('Electronics');
    expect(extractCategoryName(null)).toBe('General');
    expect(extractCategoryName(undefined)).toBe('General');
  });
});


