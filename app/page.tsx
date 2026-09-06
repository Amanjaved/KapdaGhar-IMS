'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Plus,
  Package,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  ReceiptText,
  Clock,
  ArrowUpRight,
  DollarSign,
  Layers,
  Sparkles,
} from 'lucide-react';
import { reportsService } from '@/services/reportsService';
import { salesService } from '@/services/salesService';
import { productService } from '@/services/productService';
import { DashboardStats, Sale } from '@/types';
import { formatCurrency } from '@/lib/utils/currency';
import { ReceiptModal } from '@/components/pos/ReceiptModal';

export default function DashboardPage() {
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

  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async (force: boolean = false) => {
    try {
      // 1. Fetch complete sales and products concurrently
      const [allSales, allProducts] = await Promise.all([
        salesService.getSales('all', force),
        productService.getProducts(undefined, undefined, force),
      ]);

      // 2. Synchronously derive both KPI stats and Recent Sales from the single allSales array
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

      let todaySales = 0;
      let todayProfit = 0;
      let todayCost = 0;
      let todayTransactions = 0;
      let monthSales = 0;
      let monthProfit = 0;
      let itemsSold = 0;

      const todaySalesList: Sale[] = [];

      for (const sale of allSales) {
        if (sale.status !== 'completed') continue;

        const saleTime = new Date(sale.created_at).getTime();

        if (saleTime >= startOfToday) {
          todaySalesList.push(sale);
          todaySales += sale.total;
          todayProfit += sale.total_profit;
          todayCost += sale.total_cost;
          todayTransactions++;

          if (sale.items && sale.items.length > 0) {
            for (const item of sale.items) {
              itemsSold += item.quantity;
            }
          }
        }

        if (saleTime >= startOfMonth) {
          monthSales += sale.total;
          monthProfit += sale.total_profit;
        }
      }

      const lowStockCount = allProducts.filter(
        (p) => (p.quantity ?? 0) <= p.low_stock_threshold
      ).length;

      todaySalesList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setStats({
        today_sales: Math.round(todaySales),
        today_profit: Math.round(todayProfit),
        today_cost: Math.round(todayCost),
        items_sold: itemsSold,
        transactions: todayTransactions,
        low_stock_count: lowStockCount,
        month_sales: Math.round(monthSales),
        month_profit: Math.round(monthProfit),
      });

      // Recent sales: show today's receipts; if none recorded today, show latest overall receipts
      if (todaySalesList.length > 0) {
        setRecentSales(todaySalesList.slice(0, 6));
      } else {
        const sortedAll = [...allSales].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setRecentSales(sortedAll.slice(0, 6));
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    const handleLiveRefresh = () => {
      loadDashboardData(true);
    };

    window.addEventListener('sales-refreshed', handleLiveRefresh);
    window.addEventListener('catalog-refreshed', handleLiveRefresh);
    window.addEventListener('focus', handleLiveRefresh);
    window.addEventListener('online', handleLiveRefresh);

    return () => {
      window.removeEventListener('sales-refreshed', handleLiveRefresh);
      window.removeEventListener('catalog-refreshed', handleLiveRefresh);
      window.removeEventListener('focus', handleLiveRefresh);
      window.removeEventListener('online', handleLiveRefresh);
    };
  }, []);

  const profitMargin = stats.today_sales > 0
    ? ((stats.today_profit / stats.today_sales) * 100).toFixed(1)
    : '0.0';

  const averageTicket = stats.transactions > 0
    ? Math.round(stats.today_sales / stats.transactions)
    : 0;

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header & Overview Bar */}
      <div className="flex items-center justify-between gap-3 pb-1 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Store Dashboard
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Shift
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span>{todayFormatted}</span>
          </p>
        </div>

        <Link
          href="/reports"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs active:scale-95 transition-all shrink-0"
        >
          <span>Analytics</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
        </Link>
      </div>

      {/* Quick Launchpad Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Primary POS Register Launchpad */}
        <Link
          href="/sell"
          className="group relative md:col-span-2 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 border border-indigo-400/40 shadow-xl shadow-indigo-600/15 hover:shadow-indigo-600/25 active:scale-[0.99] transition-all flex flex-col justify-between overflow-hidden text-white"
        >
          {/* Subtle decorative glow circle */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />

          <div className="space-y-1.5 relative z-10">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/20 dark:bg-white/15 text-white text-[10px] font-bold border border-white/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              COUNTER REGISTER
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              Scan & Sell Terminal
            </h3>
            <p className="text-xs text-indigo-100 font-normal leading-relaxed max-w-md">
              Fast barcode scanning, stock-aware checkout & instant digital receipts.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-white/15 relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-indigo-700 text-xs font-bold shadow-sm group-hover:bg-indigo-50 transition-colors">
              <ShoppingCart className="w-4 h-4 stroke-[2.4]" />
              <span>Open POS Register</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
            </span>
            <span className="hidden sm:inline-flex text-[10px] font-mono text-indigo-200 px-2 py-1 rounded-lg bg-white/10 border border-white/15">
              F2 Shortcut
            </span>
          </div>
        </Link>

        {/* Secondary Shortcuts (Vertical Stack on Desktop, 2 cols on mobile) */}
        <div className="grid grid-cols-2 md:grid-cols-1 gap-2.5 sm:gap-3">
          <Link
            href="/products/new"
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#0f1523] border border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 shadow-2xs hover:shadow-xs active:scale-98 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Add Product</p>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">Catalog & Barcode</p>
            </div>
          </Link>

          <Link
            href="/inventory"
            className="flex items-center gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#0f1523] border border-slate-200/80 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-800 shadow-2xs hover:shadow-xs active:scale-98 transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
              <Package className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Stock Inventory</p>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">Levels & Valuation</p>
            </div>
          </Link>
        </div>
      </div>

      {/* KPI Performance Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Today's Gross Sales */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0f1523] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Today's Sales
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <ReceiptText className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums tracking-tight">
              {formatCurrency(stats.today_sales)}
            </p>
            <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
              <span>{stats.transactions} sales</span>
              <span>•</span>
              <span>Avg {formatCurrency(averageTicket)}</span>
            </div>
          </div>
        </div>

        {/* Today's Net Profit */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0f1523] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Net Profit
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums tracking-tight">
              {formatCurrency(stats.today_profit)}
            </p>
            <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] text-emerald-600 dark:text-emerald-500 font-semibold">
              <span>{profitMargin}% margin</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-slate-500 dark:text-slate-400 font-normal">COGS: {formatCurrency(stats.today_cost)}</span>
            </div>
          </div>
        </div>

        {/* Units Sold */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0f1523] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Units Sold
            </span>
            <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Layers className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums tracking-tight">
              {stats.items_sold}
            </p>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 dark:text-slate-400 truncate">
              <span>Across {stats.transactions} tickets</span>
            </div>
          </div>
        </div>

        {/* Stock Health & Alerts */}
        <Link
          href="/inventory?filter=low"
          className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0f1523] border border-slate-200/80 dark:border-slate-800/80 hover:border-amber-400 dark:hover:border-amber-500/40 shadow-2xs active:scale-98 transition-all group block"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Stock Alerts
            </span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <p className="text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                {stats.low_stock_count}
              </p>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">SKUs low</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold group-hover:underline">
              <span>{stats.low_stock_count > 0 ? 'Restock required' : 'Stock healthy'}</span>
              <ArrowRight className="w-3 h-3 ml-0.5" />
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Sales Register Feed */}
      <div className="rounded-2xl bg-white dark:bg-[#0f1523] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <ReceiptText className="w-4 h-4" />
            </div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              Recent Sales
            </h4>
            <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
              {recentSales.length}
            </span>
          </div>
          <Link
            href="/sales"
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors shrink-0"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentSales.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40 flex items-center justify-center mx-auto">
              <ReceiptText className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-900 dark:text-white">No transactions recorded today</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mx-auto leading-relaxed">
                Ready for customer checkout. Start ringing up sales on the terminal.
              </p>
            </div>
            <Link
              href="/sell"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
            >
              <ShoppingCart className="w-3.5 h-3.5 stroke-[2.4]" />
              <span>Start New Sale</span>
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile Card View (<md screens) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
              {recentSales.map((sale) => (
                <div
                  key={sale.id}
                  onClick={() => setSelectedSale(sale)}
                  className="p-3.5 space-y-2 hover:bg-slate-50/60 dark:hover:bg-slate-850 active:bg-slate-100/70 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                        #{sale.receipt_number}
                      </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                        {sale.payment_method}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {new Date(sale.created_at).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {sale.items?.reduce((s, i) => s + i.quantity, 0) || 1} items
                      {sale.total_profit > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-2">
                          +{formatCurrency(sale.total_profit)}
                        </span>
                      )}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono tabular-nums text-sm">
                      {formatCurrency(sale.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>=md screens) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium bg-slate-50/70 dark:bg-[#0b0f19]/60">
                    <th className="px-5 py-2.5">Receipt #</th>
                    <th className="px-4 py-2.5">Time</th>
                    <th className="px-4 py-2.5">Payment</th>
                    <th className="px-4 py-2.5 text-right">Items</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                    <th className="px-5 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {recentSales.map((sale) => (
                    <tr
                      key={sale.id}
                      onClick={() => setSelectedSale(sale)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-3 font-mono font-semibold text-slate-900 dark:text-slate-200">
                        #{sale.receipt_number}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {new Date(sale.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                          {sale.payment_method}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 font-mono">
                        {sale.items?.reduce((s, i) => s + i.quantity, 0) || 1}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                          {formatCurrency(sale.total)}
                        </span>
                        {sale.total_profit > 0 && (
                          <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            +{formatCurrency(sale.total_profit)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSale(sale);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-200 dark:border-slate-700/60 transition-colors"
                        >
                          Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Receipt Modal Viewer */}
      {selectedSale && (
        <ReceiptModal
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
          onNewSale={() => {
            setSelectedSale(null);
            window.location.href = '/sell';
          }}
        />
      )}
    </div>
  );
}
