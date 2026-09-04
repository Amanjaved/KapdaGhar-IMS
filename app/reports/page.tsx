'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { reportsService, TopProductMetric } from '@/services/reportsService';
import { DashboardStats, Product } from '@/types';
import { formatCurrency } from '@/lib/utils/currency';
import {
  BarChart3,
  TrendingUp,
  Package,
  AlertTriangle,
  Flame,
  ArrowRight,
  DollarSign,
  Calendar,
  Layers,
  ArrowUpRight,
} from 'lucide-react';

export default function ReportsPage() {
  const [stats, setStats] = useState<DashboardStats>({
    today_sales: 0,
    today_profit: 0,
    today_cost: 0,
    items_sold: 0,
    transactions: 0,
    low_stock_count: 0,
    month_sales: 0,
    month_profit: 0,
  });

  const [topProducts, setTopProducts] = useState<TopProductMetric[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      reportsService.getDashboardStats(),
      reportsService.getTopProducts(5),
      reportsService.getLowStockProducts(),
    ]).then(([s, top, low]) => {
      setStats(s);
      setTopProducts(top);
      setLowStockProducts(low);
      setLoading(false);
    });
  }, []);

  const todayMargin = stats.today_sales > 0
    ? ((stats.today_profit / stats.today_sales) * 100).toFixed(1)
    : '0';

  const monthMargin = stats.month_sales > 0
    ? ((stats.month_profit / stats.month_sales) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Financial Reports & Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Revenue trends, profit margin metrics, and product velocity
          </p>
        </div>
      </div>

      {/* Today vs Month High-level Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today Summary */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Today's Performance
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Live store transactions</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
              Active Shift
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Gross Revenue</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                {formatCurrency(stats.today_sales)}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
                {stats.transactions} bills ({stats.items_sold} items)
              </p>
            </div>

            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Net Profit</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                +{formatCurrency(stats.today_profit)}
              </p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-500/90 mt-1 font-medium">
                {todayMargin}% net margin
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Cost of Goods Sold (COGS):</span>
            <span className="font-mono text-slate-800 dark:text-slate-300 font-semibold">{formatCurrency(stats.today_cost)}</span>
          </div>
        </div>

        {/* Month Summary */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Month-to-Date
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Monthly cumulative metrics</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold border border-indigo-500/20">
              Current Month
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Monthly Revenue</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                {formatCurrency(stats.month_sales)}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Total customer invoices</p>
            </div>

            <div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Cumulative Profit</p>
              <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono tabular-nums mt-0.5">
                +{formatCurrency(stats.month_profit)}
              </p>
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400/90 mt-1 font-medium">
                {monthMargin}% gross margin
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Estimated Monthly Profit:</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">+{formatCurrency(stats.month_profit)}</span>
          </div>
        </div>
      </div>

      {/* Top Best-Selling Products & Restock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Best Sellers */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Flame className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Top Best-Selling SKUs</span>
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">By volume</span>
          </div>

          {topProducts.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
              No sales data recorded yet to rank best-sellers.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {topProducts.map((prod, idx) => (
                <div key={prod.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-[#0b0f19] text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs flex items-center justify-center border border-slate-200 dark:border-slate-800">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">{prod.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{prod.quantitySold} units sold</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                    {formatCurrency(prod.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Restock Reorder Alerts</span>
            </h3>
            <Link
              href="/inventory?filter=low"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <span>Manage All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {lowStockProducts.length === 0 ? (
            <p className="py-8 text-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              All inventory products are above reorder thresholds.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {lowStockProducts.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">{p.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{p.category_name}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
                      {p.quantity ?? 0} left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
