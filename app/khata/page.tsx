'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Plus,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  CreditCard,
  Banknote,
  QrCode,
  Building2,
  MessageCircle,
  Receipt,
  Clock,
  Phone,
  MapPin,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowDownLeft,
  RotateCw,
  Share2,
  ChevronRight,
  UserPlus,
  BookOpen,
  DollarSign,
} from 'lucide-react';
import { Customer, CustomerTransaction, PaymentMethod } from '@/types';
import { khataService } from '@/services/khataService';
import { formatCurrency, roundToTwo } from '@/lib/utils/currency';

export default function KhataPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'due' | 'cleared'>('due');

  // Stats
  const [stats, setStats] = useState({
    totalOutstanding: 0,
    debtorCount: 0,
    collectedThisMonth: 0,
  });

  // Modals & Drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    initialDue: '',
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Payment Modal
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'bank'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Ledger Drawer
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [ledgerTransactions, setLedgerTransactions] = useState<CustomerTransaction[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Store profile for WhatsApp reminders
  const [storeName, setStoreName] = useState('Kapda Ghar');
  const [storePhone, setStorePhone] = useState('+91 98765 43210');

  useEffect(() => {
    try {
      const savedName = localStorage.getItem('kapda_ghar_store_name');
      if (savedName) setStoreName(savedName);
      const savedPhone = localStorage.getItem('kapda_ghar_store_phone');
      if (savedPhone) setStorePhone(savedPhone);
    } catch (e) {}
  }, []);

  // Load data
  const loadData = async (force: boolean = false) => {
    try {
      if (force) setIsRefreshing(true);
      const [custList, statData] = await Promise.all([
        khataService.getCustomers(undefined, 'all', force),
        khataService.getKhataSummaryStats(force),
      ]);
      setCustomers(custList);
      setStats(statData);
    } catch (err) {
      console.error('Failed to load Khata customers:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleRefreshed = () => {
      loadData(true);
    };

    window.addEventListener('khata-refreshed', handleRefreshed);
    return () => window.removeEventListener('khata-refreshed', handleRefreshed);
  }, []);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    return khataService.filterCustomerList(customers, searchQuery, filterType);
  }, [customers, searchQuery, filterType]);

  // Handle Create Customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) {
      setAddError('Customer name is required');
      return;
    }
    if (!newCustomer.phone.trim() || newCustomer.phone.trim().length < 8) {
      setAddError('Valid 10-digit phone number is required');
      return;
    }

    setIsSubmittingNew(true);
    setAddError(null);

    try {
      await khataService.createCustomer({
        name: newCustomer.name,
        phone: newCustomer.phone,
        address: newCustomer.address,
        notes: newCustomer.notes,
        initialDue: newCustomer.initialDue ? parseFloat(newCustomer.initialDue) : 0,
      });

      setShowAddModal(false);
      setNewCustomer({ name: '', phone: '', address: '', notes: '', initialDue: '' });
      await loadData(true);
    } catch (err: any) {
      setAddError(err?.message || 'Failed to create customer');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Handle Record Payment (Jama)
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForPayment) return;

    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      setPaymentError('Please enter a valid repayment amount');
      return;
    }

    setIsSubmittingPayment(true);
    setPaymentError(null);

    try {
      const res = await khataService.recordPayment({
        customerId: selectedCustomerForPayment.id,
        amount: amt,
        paymentMethod,
        notes: paymentNotes,
      });

      if (!res.success) {
        setPaymentError(res.error || 'Failed to record payment');
        setIsSubmittingPayment(false);
        return;
      }

      setSelectedCustomerForPayment(null);
      setPaymentAmount('');
      setPaymentNotes('');
      await loadData(true);

      // If ledger is open for this customer, refresh it
      if (ledgerCustomer && ledgerCustomer.id === selectedCustomerForPayment.id) {
        openLedger(res.customer || selectedCustomerForPayment);
      }
    } catch (err: any) {
      setPaymentError(err?.message || 'Payment recording failed');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Open Ledger Statement
  const openLedger = async (customer: Customer) => {
    setLedgerCustomer(customer);
    setLoadingLedger(true);
    try {
      const txs = await khataService.getCustomerLedger(customer.id);
      setLedgerTransactions(txs);
    } catch (err) {
      console.error('Failed to load customer ledger:', err);
    } finally {
      setLoadingLedger(false);
    }
  };

  // WhatsApp Reminder Link
  const openWhatsAppReminder = (customer: Customer) => {
    const text = khataService.generateWhatsAppReminderMessage(customer, storeName, storePhone);
    const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/91${cleanPhone.startsWith('91') ? cleanPhone.slice(2) : cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // WhatsApp Share Ledger
  const shareLedgerOnWhatsApp = (customer: Customer) => {
    const header = `*${storeName} — Account Statement (Khata)*\nCustomer: *${customer.name}*\nPhone: ${customer.phone}\nTotal Outstanding Due: *${formatCurrency(customer.total_due || 0)}*\n--------------------------------\n*Recent Transactions:*\n`;

    const txLines = ledgerTransactions
      .slice(0, 10)
      .map((t) => {
        const date = new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        if (t.type === 'credit') {
          return `🔴 ${date}: +${formatCurrency(t.amount)} (Udhar Bill #${t.receipt_number || ''})`;
        } else {
          return `🟢 ${date}: -${formatCurrency(t.amount)} (Jama via ${(t.payment_method || 'CASH').toUpperCase()})`;
        }
      })
      .join('\n');

    const footer = `\n--------------------------------\n*Current Balance Due: ${formatCurrency(customer.total_due || 0)}*\nPlease pay at your earliest convenience.\nThank you!`;

    const fullMsg = header + txLines + footer;
    const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/91${cleanPhone.startsWith('91') ? cleanPhone.slice(2) : cleanPhone}?text=${encodeURIComponent(fullMsg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-5 pb-20 md:pb-8">
      {/* Top Header & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Customer Khata
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              Udhar Ledger
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Track credit sales (Udhar), collect repayments (Jama), and send 1-tap WhatsApp reminders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="h-9 px-3 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-50"
            title="Refresh Khata Data"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button
            onClick={() => {
              setAddError(null);
              setShowAddModal(true);
            }}
            className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 stroke-[2.2]" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Outstanding Udhar */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0f1523] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Store Udhar
            </span>
            <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <TrendingDown className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 font-mono tabular-nums">
              {formatCurrency(stats.totalOutstanding)}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Owed by {stats.debtorCount} customers
            </p>
          </div>
        </div>

        {/* Active Debtors Count */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0f1523] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Debtors
            </span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Users className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
              {stats.debtorCount}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              With balance &gt; ₹0
            </p>
          </div>
        </div>

        {/* Collected This Month (Repayments) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0f1523] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Jama This Month
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
              {formatCurrency(stats.collectedThisMonth)}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Repayments received
            </p>
          </div>
        </div>

        {/* Total Customers Registered */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0f1523] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Customers
            </span>
            <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <BookOpen className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
              {customers.length}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Registered in store directory
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search customer by name, mobile, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-8 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setFilterType('due')}
            className={`h-8 px-3 rounded-lg text-xs font-semibold shrink-0 transition-all ${
              filterType === 'due'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Pending Udhar ({stats.debtorCount})
          </button>
          <button
            onClick={() => setFilterType('all')}
            className={`h-8 px-3 rounded-lg text-xs font-semibold shrink-0 transition-all ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Accounts ({customers.length})
          </button>
          <button
            onClick={() => setFilterType('cleared')}
            className={`h-8 px-3 rounded-lg text-xs font-semibold shrink-0 transition-all ${
              filterType === 'cleared'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Cleared / Settled
          </button>
        </div>
      </div>

      {/* Customer Directory Cards */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <RotateCw className="w-5 h-5 animate-spin text-indigo-500" />
            <span>Loading Customer Khata...</span>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400 text-xs rounded-2xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 p-6">
            <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 stroke-[1.5]" />
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                {searchQuery ? 'No customers found' : filterType === 'due' ? 'No pending debtors!' : 'Customer ledger is empty'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No customer matches "${searchQuery}". Try searching another name or phone number.`
                  : filterType === 'due'
                  ? 'All customers have cleared their store credit. Great job!'
                  : 'Add customer accounts to record store credit and send reminders.'}
              </p>
            </div>
            {!searchQuery && filterType !== 'due' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Customer</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredCustomers.map((customer) => {
              const due = customer.total_due || 0;
              const hasDue = due > 0;

              return (
                <div
                  key={customer.id}
                  className="rounded-2xl bg-white dark:bg-[#0f1523] border border-slate-200/90 dark:border-slate-800/80 p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700/80 transition-all flex flex-col justify-between gap-3 relative overflow-hidden"
                >
                  {/* Top: Customer Info & Balance */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {customer.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <a
                          href={`tel:${customer.phone}`}
                          className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span className="font-mono">{customer.phone}</span>
                        </a>
                        {customer.address && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1 truncate" title={customer.address}>
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{customer.address}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Due Badge */}
                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                        {hasDue ? 'Udhar Baki' : 'Balance'}
                      </span>
                      <span
                        className={`font-mono font-black text-base sm:text-lg tabular-nums block ${
                          hasDue
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {formatCurrency(due)}
                      </span>
                    </div>
                  </div>

                  {/* Notes / Last updated */}
                  {customer.notes && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0b0f19] px-2.5 py-1.5 rounded-lg italic line-clamp-1 border border-slate-100 dark:border-slate-800/60">
                      "{customer.notes}"
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                    {/* WhatsApp Reminder (Enabled if due > 0) */}
                    {hasDue ? (
                      <button
                        onClick={() => openWhatsAppReminder(customer)}
                        className="flex-1 h-8.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-300/40 dark:border-emerald-800/50 active:scale-95 transition-all cursor-pointer"
                        title="Send polite WhatsApp payment reminder"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-emerald-600 text-white stroke-1" />
                        <span>Reminder</span>
                      </button>
                    ) : (
                      <button
                        disabled
                        className="flex-1 h-8.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-slate-400 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Cleared</span>
                      </button>
                    )}

                    {/* Receive Payment (Jama) */}
                    <button
                      onClick={() => {
                        setSelectedCustomerForPayment(customer);
                        setPaymentAmount(due > 0 ? String(due) : '');
                        setPaymentNotes('');
                        setPaymentError(null);
                      }}
                      className="h-8.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-1 border border-indigo-200 dark:border-indigo-800/50 active:scale-95 transition-all cursor-pointer"
                      title="Record repayment (Jama)"
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>Jama</span>
                    </button>

                    {/* Statement / Ledger */}
                    <button
                      onClick={() => openLedger(customer)}
                      className="h-8.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
                      title="View Khata Ledger Statement"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add New Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Add Customer to Khata</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 border border-red-500/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Mobile Number (WhatsApp) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Address / Locality (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Main Market, Shop #12"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Initial Udhar Balance (Optional Opening Balance)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newCustomer.initialDue}
                    onChange={(e) => setNewCustomer({ ...newCustomer, initialDue: e.target.value })}
                    className="w-full h-10 pl-7 pr-3 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Brother of Sharma ji"
                  value={newCustomer.notes}
                  onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmittingNew ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Payment (Jama) Modal */}
      {selectedCustomerForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Receive Payment (Jama)
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedCustomerForPayment.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCustomerForPayment(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Due Box */}
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
              <span className="text-xs text-rose-700 dark:text-rose-300 font-medium">Current Balance Due:</span>
              <span className="text-base font-black font-mono text-rose-600 dark:text-rose-400">
                {formatCurrency(selectedCustomerForPayment.total_due || 0)}
              </span>
            </div>

            {paymentError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 border border-red-500/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Amount Received (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full h-11 px-3 text-lg font-mono font-bold rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />

                {/* Quick Amount Pills */}
                <div className="flex items-center gap-1.5 mt-2">
                  {selectedCustomerForPayment.total_due > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(String(selectedCustomerForPayment.total_due))}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      Full Due ({formatCurrency(selectedCustomerForPayment.total_due)})
                    </button>
                  )}
                  {[500, 1000, 2000].map((quickAmt) => (
                    <button
                      key={quickAmt}
                      type="button"
                      onClick={() => setPaymentAmount(String(quickAmt))}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      ₹{quickAmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1.5">
                  Payment Mode
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'cash', label: 'Cash', icon: Banknote },
                    { id: 'upi', label: 'UPI', icon: QrCode },
                    { id: 'card', label: 'Card', icon: CreditCard },
                    { id: 'bank', label: 'Bank', icon: Building2 },
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPaymentMethod(id as any)}
                      className={`h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                        paymentMethod === id
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-[#0b0f19] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase mb-1">
                  Payment Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via PhonePe / cash at counter"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCustomerForPayment(null)}
                  className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmittingPayment ? 'Saving...' : 'Record Payment (Jama)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Ledger Statement Drawer / Modal */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-[#0f1523] h-full flex flex-col border-l border-slate-200 dark:border-slate-800 shadow-2xl">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-[#0b0f19]/60">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Customer Ledger Statement
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {ledgerCustomer.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  {ledgerCustomer.phone}
                </p>
              </div>
              <button
                onClick={() => setLedgerCustomer(null)}
                className="w-8 h-8 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Balance Bar */}
            <div className="p-4 bg-slate-100/70 dark:bg-[#0d1322] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Current Outstanding Due</span>
                <p className="text-xl font-black font-mono text-rose-600 dark:text-rose-400">
                  {formatCurrency(ledgerCustomer.total_due || 0)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => shareLedgerOnWhatsApp(ledgerCustomer)}
                  className="h-8.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                  title="Share complete statement on WhatsApp"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedCustomerForPayment(ledgerCustomer);
                    setPaymentAmount(ledgerCustomer.total_due > 0 ? String(ledgerCustomer.total_due) : '');
                  }}
                  className="h-8.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>Jama</span>
                </button>
              </div>
            </div>

            {/* Ledger Transactions List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {loadingLedger ? (
                <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <RotateCw className="w-5 h-5 animate-spin text-indigo-500" />
                  <span>Loading ledger entries...</span>
                </div>
              ) : ledgerTransactions.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs space-y-1">
                  <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p>No transactions recorded yet.</p>
                  <p className="text-[11px] text-slate-500">Sales made on credit or payments received will appear here.</p>
                </div>
              ) : (
                ledgerTransactions.map((tx) => {
                  const isCredit = tx.type === 'credit';

                  return (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl bg-white dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800/80 shadow-2xs flex items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isCredit
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isCredit ? (
                            <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
                          ) : (
                            <ArrowDownLeft className="w-4 h-4 stroke-[2.2]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {isCredit ? 'Udhar (Store Credit)' : 'Repayment (Jama)'}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {tx.notes || (isCredit ? `Bill #${tx.receipt_number || ''}` : `Via ${(tx.payment_method || 'CASH').toUpperCase()}`)}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                            {new Date(tx.created_at).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className={`font-mono font-bold text-sm tabular-nums ${
                            isCredit ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isCredit ? `+${formatCurrency(tx.amount)}` : `-${formatCurrency(tx.amount)}`}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          Bal: {formatCurrency(tx.balance_after)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
