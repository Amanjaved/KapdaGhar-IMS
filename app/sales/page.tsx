'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { salesService } from '@/services/salesService';
import { Sale } from '@/types';
import { formatCurrency } from '@/lib/utils/currency';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import {
  ReceiptText,
  Calendar,
  Search,
  ArrowUpDown,
  TrendingUp,
  DollarSign,
  Printer,
  ChevronRight,
} from 'lucide-react';

type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'all';

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filterRange, setFilterRange] = useState<DateFilter>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSales = async () => {
    setLoading(true);
    try {
      const data = await salesService.getSales(filterRange);
      setSales(data);
    } catch (err) {
      console.error('Failed to load sales history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, [filterRange]);

  const filteredSales = useMemo(() => {
    if (!searchQuery.trim()) return sales;
    const q = searchQuery.toLowerCase().trim();
    return sales.filter(
      (s) =>
        s.receipt_number.toLowerCase().includes(q) ||
        s.payment_method.toLowerCase().includes(q)
    );
  }, [sales, searchQuery]);

  // Aggregate stats for filtered view
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const totalProfit = filteredSales.reduce((sum, s) => sum + s.total_profit, 0);
  const overallMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Sales Ledger & History
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              {filteredSales.length} bills
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complete transaction records, customer receipts, and payment splits
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
            ] as { id: DateFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterRange(tab.id)}
              className={`h-8 px-3 rounded-md text-xs font-semibold shrink-0 transition-all ${
                filterRange === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-xs'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Aggregate Revenue Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs">
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Settled Revenue
          </p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-1">
            {formatCurrency(totalRevenue)}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Across {filteredSales.length} customer bills</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs">
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Net Realized Profit
          </p>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-1">
            +{formatCurrency(totalProfit)}
          </p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-500/80 mt-0.5 font-medium">{overallMargin}% profit margin</p>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs">
          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Average Ticket Size
          </p>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-200 font-mono tabular-nums mt-1">
            {formatCurrency(filteredSales.length > 0 ? Math.round(totalRevenue / filteredSales.length) : 0)}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Per retail transaction</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder="Filter by receipt number or payment mode..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-lg bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs"
        />
      </div>

      {/* Sales Transactions Table */}
      <div className="rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400 text-xs">
            <p>Loading transaction history...</p>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400 text-xs">
            <p>No transaction records found for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium bg-slate-50/70 dark:bg-[#0b0f19]/60">
                  <th className="px-5 py-3">Receipt Number</th>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Profit</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredSales.map((sale) => (
                  <tr
                    key={sale.id}
                    onClick={() => setSelectedSale(sale)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 font-mono font-bold text-slate-900 dark:text-slate-200">
                      #{sale.receipt_number}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      {new Date(sale.created_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-[#0b0f19] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                        {sale.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400 font-mono">
                      {sale.items?.reduce((sum, item) => sum + item.quantity, 0) || 1}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                      +{formatCurrency(sale.total_profit)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-extrabold text-slate-900 dark:text-white">
                      {formatCurrency(sale.total)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSale(sale);
                        }}
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white text-xs font-medium border border-slate-200 dark:border-slate-700/60 transition-colors"
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

      {/* Receipt Modal */}
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
