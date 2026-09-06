import { getDB } from '@/lib/indexeddb/db';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { DashboardStats, Product } from '@/types';
import { productService } from './productService';

export interface TopProductMetric {
  id: string;
  name: string;
  category_name?: string;
  quantitySold: number;
  revenue: number;
}

// In-memory cache for dashboard stats (fast 0ms return)
let memoryStats: DashboardStats | null = null;
let lastStatsFetch = 0;
const STATS_TTL_MS = 10_000; // 10 seconds

if (typeof window !== 'undefined') {
  window.addEventListener('sales-refreshed', () => {
    memoryStats = null;
  });
  window.addEventListener('catalog-refreshed', () => {
    memoryStats = null;
  });
}

export const reportsService = {
  async getDashboardStats(forceRefresh: boolean = false): Promise<DashboardStats> {
    const nowTime = Date.now();

    // 1. Fast in-memory cache return
    if (!forceRefresh && memoryStats && nowTime - lastStatsFetch < STATS_TTL_MS) {
      return memoryStats;
    }

    // 2. If Supabase RPC is available and online, try get_dashboard_stats()
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data, error } = await supabase.rpc('get_dashboard_stats');
          if (!error && data) {
            memoryStats = {
              today_sales: Number(data.today_sales || 0),
              today_profit: Number(data.today_profit || 0),
              today_cost: Number(data.today_cost || 0),
              items_sold: Number(data.items_sold || 0),
              transactions: Number(data.transactions || 0),
              low_stock_count: Number(data.low_stock_count || 0),
              month_sales: Number(data.month_sales || 0),
              month_profit: Number(data.month_profit || 0),
            };
            lastStatsFetch = Date.now();
            return memoryStats;
          }
        }
      } catch (err) {
        console.warn('Falling back to local dashboard statistics calculation:', err);
      }
    }

    // 3. Local IndexedDB Calculation fallback
    const db = await getDB();
    if (!db) {
      return {
        today_sales: 0,
        today_profit: 0,
        today_cost: 0,
        items_sold: 0,
        transactions: 0,
        low_stock_count: 0,
        month_sales: 0,
        month_profit: 0,
      };
    }

    const allSales = await db.getAll('sales');
    const allSaleItems = await db.getAll('sale_items');
    const allProducts = await productService.getProducts();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let todaySales = 0;
    let todayProfit = 0;
    let todayCost = 0;
    let todayTransactions = 0;
    let monthSales = 0;
    let monthProfit = 0;

    const todaySaleIds = new Set<string>();

    for (const sale of allSales) {
      if (sale.status !== 'completed') continue;

      const saleTime = new Date(sale.created_at).getTime();

      if (saleTime >= startOfToday) {
        todaySales += sale.total;
        todayProfit += sale.total_profit;
        todayCost += sale.total_cost;
        todayTransactions++;
        todaySaleIds.add(sale.id);
      }

      if (saleTime >= startOfMonth) {
        monthSales += sale.total;
        monthProfit += sale.total_profit;
      }
    }

    let itemsSold = 0;
    for (const item of allSaleItems) {
      if (todaySaleIds.has(item.sale_id)) {
        itemsSold += item.quantity;
      }
    }

    const lowStockCount = allProducts.filter(
      (p) => (p.quantity ?? 0) <= p.low_stock_threshold
    ).length;

    memoryStats = {
      today_sales: Math.round(todaySales),
      today_profit: Math.round(todayProfit),
      today_cost: Math.round(todayCost),
      items_sold: itemsSold,
      transactions: todayTransactions,
      low_stock_count: lowStockCount,
      month_sales: Math.round(monthSales),
      month_profit: Math.round(monthProfit),
    };
    lastStatsFetch = Date.now();

    return memoryStats;
  },

  async getTopProducts(limit: number = 5): Promise<TopProductMetric[]> {
    const db = await getDB();
    if (!db) return [];

    let saleItems = await db.getAll('sale_items');
    if (saleItems.length === 0 && isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data, error } = await supabase.from('sale_items').select('*');
          if (!error && data && data.length > 0) {
            saleItems = data.map((i: any) => ({
              ...i,
              quantity: Number(i.quantity),
              selling_price: Number(i.selling_price),
              purchase_price: Number(i.purchase_price),
              subtotal: Number(i.subtotal),
              profit: Number(i.profit || 0),
            }));
          }
        }
      } catch (_) {}
    }

    const productStats = new Map<string, { name: string; quantitySold: number; revenue: number }>();

    for (const item of saleItems) {
      const existing = productStats.get(item.product_id) || {
        name: item.product_name,
        quantitySold: 0,
        revenue: 0,
      };

      existing.quantitySold += item.quantity;
      existing.revenue += item.subtotal;
      productStats.set(item.product_id, existing);
    }

    const sorted = Array.from(productStats.entries())
      .map(([id, stats]) => ({
        id,
        name: stats.name,
        quantitySold: stats.quantitySold,
        revenue: Math.round(stats.revenue),
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold);

    return sorted.slice(0, limit);
  },

  async getLowStockProducts(): Promise<Product[]> {
    const products = await productService.getProducts();
    return products.filter((p) => (p.quantity ?? 0) <= p.low_stock_threshold);
  },
};
