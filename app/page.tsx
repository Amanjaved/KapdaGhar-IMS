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

  const loadDashboardData = async () => {
    try {
      const [statsData, salesData] = await Promise.all([
        reportsService.getDashboardStats(),
        salesService.getSales('today'),
      ]);
      setStats(statsData);
      setRecentSales(salesData.slice(0, 6));
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
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
    <div className="space-y-6">
      {/* Top Header & Overview Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Store Dashboard
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-500/20">
              Active Shift
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span>{todayFormatted}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors shadow-xs"
          >
            <span>Analytics & Margins</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* Quick Launchpad Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Primary POS Register Launchpad */}
        <Link
          href="/sell"
          className="group relative md:col-span-2 p-5 rounded-xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 dark:from-indigo-950 dark:via-indigo-900/60 dark:to-slate-900 border border-indigo-400/40 dark:border-indigo-500/30 hover:border-indigo-400/80 dark:hover:border-indigo-500/60 shadow-lg shadow-indigo-600/10 dark:shadow-indigo-950/40 transition-all flex items-center justify-between overflow-hidden text-white"
        >
          <div className="space-y-1.5 relative z-10">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/20 dark:bg-indigo-500/20 text-white dark:text-indigo-300 text-[11px] font-semibold border border-white/20 dark:border-indigo-400/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 dark:bg-indigo-400 animate-pulse" />
              COUNTER REGISTER
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Scan & Sell Terminal</span>
            </h3>
            <p className="text-xs text-indigo-100 dark:text-slate-400 font-normal max-w-md">
              Fast barcode scanning, stock-aware checkout, and instant digital & thermal receipts.
            </p>
          </div>

          <div className="flex items-center gap-3 relative z-10 shrink-0">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] uppercase font-mono text-indigo-200 dark:text-slate-400">Shortcut</span>
              <kbd className="text-xs px-2 py-0.5 rounded bg-white/20 dark:bg-slate-800 text-white dark:text-slate-300 font-mono border border-white/30 dark:border-slate-700">
                F2
              </kbd>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 dark:bg-indigo-600 group-hover:bg-white/30 dark:group-hover:bg-indigo-500 text-white flex items-center justify-center shadow-md backdrop-blur-xs transition-transform group-hover:scale-105 border border-white/20 dark:border-transparent">
              <ShoppingCart className="w-6 h-6 stroke-[2.2]" />
            </div>
          </div>
        </Link>

        {/* Secondary Shortcuts (Vertical Stack) */}
        <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
          <Link
            href="/products/new"
            className="flex items-center gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850 shadow-xs transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Add Product</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">Catalog & Barcode</p>
            </div>
          </Link>

          <Link
            href="/inventory"
            className="flex items-center gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850 shadow-xs transition-all"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
              <Package className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">Stock Inventory</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">Levels & Valuation</p>
            </div>
          </Link>
        </div>
      </div>

      {/* KPI Performance Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Gross Sales */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Today's Gross Sales
            </span>
            <span className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <ReceiptText className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums tracking-tight">
              {formatCurrency(stats.today_sales)}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
              <span>{stats.transactions} sales</span>
              <span>•</span>
              <span>Avg {formatCurrency(averageTicket)}</span>
            </div>
          </div>
        </div>

        {/* Today's Net Profit */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Net Profit Margin
            </span>
            <span className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums tracking-tight">
              {formatCurrency(stats.today_profit)}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-500/90 font-medium">
              <span>{profitMargin}% margin</span>
              <span className="text-slate-400 dark:text-slate-500">•</span>
              <span className="text-slate-500 dark:text-slate-400">COGS: {formatCurrency(stats.today_cost)}</span>
            </div>
          </div>
        </div>

        {/* Units Sold */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Units Sold
            </span>
            <span className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Layers className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums tracking-tight">
              {stats.items_sold}
            </p>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400">
              <span>Across {stats.transactions} customer tickets</span>
            </div>
          </div>
        </div>

        {/* Stock Health & Alerts */}
        <Link
          href="/inventory?filter=low"
          className="p-4 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 hover:border-amber-400 dark:hover:border-amber-500/40 shadow-xs transition-colors group block"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Stock Alerts
            </span>
            <span className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <p className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                {stats.low_stock_count}
              </p>
              <span className="text-xs text-slate-500 dark:text-slate-400">SKUs low</span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-[11px] text-amber-600 dark:text-amber-400/90 font-medium group-hover:underline">
              <span>{stats.low_stock_count > 0 ? 'Requires restock' : 'Stock healthy'}</span>
              <ArrowRight className="w-3 h-3 ml-0.5" />
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Sales Register Feed */}
      <div className="rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ReceiptText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Recent Transactions Today</h4>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">({recentSales.length})</span>
          </div>
          <Link
            href="/sales"
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
          >
            <span>Complete Sales Ledger</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recentSales.length === 0 ? (
          <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">
            <p className="font-medium">No sales recorded yet today.</p>
            <Link
              href="/sell"
              className="inline-flex items-center gap-1.5 mt-3 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-xs"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Start First Sale</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
