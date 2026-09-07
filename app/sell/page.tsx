'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { productService } from '@/services/productService';
import { salesService } from '@/services/salesService';
import { khataService } from '@/services/khataService';
import { Category, Product, CartItem, PaymentMethod, Sale, Customer } from '@/types';
import { formatCurrency, roundToTwo } from '@/lib/utils/currency';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { ProductImage } from '@/components/common/ProductImage';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  X,
  CheckCircle2,
  AlertCircle,
  Tag,
  CreditCard,
  Banknote,
  QrCode,
  Layers,
  ArrowRight,
  Package,
  BookOpen,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';

export default function ScanAndSellPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [showBarcodePrompt, setShowBarcodePrompt] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Customer Khata state for Udhar sales
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('');
  const [paidNowInput, setPaidNowInput] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // Load catalog
  const loadCatalog = async (forceRefresh = false) => {
    try {
      const [prods, cats] = await Promise.all([
        productService.getProducts(undefined, undefined, forceRefresh),
        productService.getCategories(forceRefresh),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load products for POS:', err);
    }
  };

  const loadCustomers = async (forceRefresh = false) => {
    try {
      const custList = await khataService.getCustomers(undefined, 'all', forceRefresh);
      setCustomers(custList);
    } catch (err) {
      console.warn('Failed to load customers for POS:', err);
    }
  };

  useEffect(() => {
    loadCatalog();
    loadCustomers();

    const handleCatalogRefreshed = () => {
      loadCatalog(true);
    };

    const handleKhataRefreshed = () => {
      loadCustomers(true);
    };

    window.addEventListener('catalog-refreshed', handleCatalogRefreshed);
    window.addEventListener('khata-refreshed', handleKhataRefreshed);
    return () => {
      window.removeEventListener('catalog-refreshed', handleCatalogRefreshed);
      window.removeEventListener('khata-refreshed', handleKhataRefreshed);
    };
  }, []);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory =
        selectedCategory === 'all' || p.category_id === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart operations
  const addToCart = (product: Product) => {
    const availableStock = product.quantity ?? 0;
    if (availableStock <= 0) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= availableStock) return prev;
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          selling_price: product.selling_price,
          purchase_price: product.purchase_price,
        },
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const maxStock = item.product.quantity ?? 0;
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > maxStock) return item;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
  };

  // Cart totals
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce(
    (sum, item) => sum + item.selling_price * item.quantity,
    0
  );
  const total = Math.max(0, subtotal - discount);

  // Complete Sale
  const handleCompleteSale = async () => {
    if (cart.length === 0 || isSubmitting) return;

    if (paymentMethod === 'udhar') {
      if (!selectedCustomer) {
        setErrorMsg('Please select or add a customer for Udhar / Credit sale.');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const paidNow = paymentMethod === 'udhar'
      ? Math.min(total, Math.max(0, parseFloat(paidNowInput) || 0))
      : total;
    const balanceDue = paymentMethod === 'udhar'
      ? Math.max(0, total - paidNow)
      : 0;

    const res = await salesService.completeSale({
      items: cart,
      discount,
      paymentMethod,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      customerPhone: selectedCustomer?.phone,
      paidAmount: paidNow,
      balanceDue: balanceDue,
    });

    setIsSubmitting(false);

    if (res.success && res.sale) {
      setCompletedSale(res.sale);
      setCart([]);
      setDiscount(0);
      setSelectedCustomer(null);
      setPaidNowInput('');
      setCustomerSearch('');
      setIsCartOpen(false);
      loadCatalog();
      loadCustomers(true);
    } else {
      setErrorMsg(res.error || 'Failed to complete sale');
    }
  };

  const handleQuickCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustomerName.trim()) {
      setErrorMsg('Customer name is required');
      return;
    }
    if (!quickCustomerPhone.trim() || quickCustomerPhone.trim().length < 8) {
      setErrorMsg('Valid phone number is required');
      return;
    }

    setIsCreatingCustomer(true);
    setErrorMsg(null);
    try {
      const created = await khataService.createCustomer({
        name: quickCustomerName,
        phone: quickCustomerPhone,
      });
      setSelectedCustomer(created);
      setShowQuickAddCustomer(false);
      setQuickCustomerName('');
      setQuickCustomerPhone('');
      await loadCustomers(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create customer');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const handleBarcodeSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const matched = products.find(
      (p) => p.barcode === barcodeInput.trim() || p.sku?.toLowerCase() === barcodeInput.trim().toLowerCase()
    );

    if (matched) {
      addToCart(matched);
      setBarcodeInput('');
      setShowBarcodePrompt(false);
    } else {
      alert(`No product found with barcode / SKU: ${barcodeInput}`);
    }
  };

  const renderCartItemsList = () => (
    <div className="space-y-2">
      {cart.map((item) => {
        const available = item.product.quantity ?? 0;
        const canIncrease = item.quantity < available;

        return (
          <div
            key={item.product.id}
            className="p-3 rounded-lg bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2 transition-all"
          >
            <div className="flex-1 min-w-0 pr-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate leading-tight">
                {item.product.name}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                {formatCurrency(item.selling_price)} × {item.quantity} ={' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(item.selling_price * item.quantity)}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => updateQuantity(item.product.id, -1)}
                className="w-7 h-7 rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs active:scale-95 transition-all"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <span className="w-6 text-center font-bold text-xs text-slate-900 dark:text-white font-mono tabular-nums">
                {item.quantity}
              </span>

              <button
                type="button"
                onClick={() => updateQuantity(item.product.id, 1)}
                disabled={!canIncrease}
                className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs active:scale-95 transition-all ${
                  canIncrease
                    ? 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                }`}
                title={!canIncrease ? 'Max stock reached' : 'Add one more'}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => removeFromCart(item.product.id)}
                className="w-7 h-7 ml-1 rounded-md text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors"
                title="Remove item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderCheckoutSummary = () => (
    <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
      {/* Discount Row */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-600 dark:text-slate-400 font-medium">Order Discount:</span>
        <div className="flex items-center gap-1">
          <span className="text-slate-500 dark:text-slate-400 font-mono">₹</span>
          <input
            type="number"
            min="0"
            max={subtotal}
            value={discount === 0 ? '' : discount}
            placeholder="0"
            onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-24 h-8 px-2 text-right rounded-md bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
          />
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-1 text-xs pt-2 border-t border-slate-200 dark:border-slate-800/60">
        <div className="flex justify-between text-slate-600 dark:text-slate-400">
          <span>Subtotal:</span>
          <span className="font-mono tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
            <span>Discount:</span>
            <span className="font-mono tabular-nums">-{formatCurrency(discount)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Total Due</span>
          <span className="font-mono font-extrabold text-xl text-slate-900 dark:text-white tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {/* Payment Methods */}
      <div>
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5">
          Payment Method
        </span>
        <div className="grid grid-cols-5 gap-1">
          {(
            [
              { id: 'cash', label: 'Cash', icon: Banknote },
              { id: 'upi', label: 'UPI', icon: QrCode },
              { id: 'card', label: 'Card', icon: CreditCard },
              { id: 'mixed', label: 'Split', icon: Layers },
              { id: 'udhar', label: 'Udhar', icon: BookOpen },
            ] as { id: PaymentMethod; label: string; icon: any }[]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPaymentMethod(id)}
              className={`h-9 rounded-md text-[11px] font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
                paymentMethod === id
                  ? 'bg-indigo-600 text-white shadow-sm border border-indigo-400/40'
                  : 'bg-slate-100 dark:bg-[#0b0f19] text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Customer Khata Selector & Partial Payment (When Udhar is selected) */}
      {paymentMethod === 'udhar' && (
        <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-[#0b101e] border border-indigo-200 dark:border-indigo-900/60 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Customer Khata (Credit)</span>
            </span>
            {selectedCustomer && (
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                Change Customer
              </button>
            )}
          </div>

          {/* Selected Customer View */}
          {selectedCustomer ? (
            <div className="space-y-2">
              <div className="p-2 rounded-lg bg-white dark:bg-[#080c16] border border-indigo-200/80 dark:border-indigo-900/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {selectedCustomer.name}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {selectedCustomer.phone}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 uppercase font-semibold block">Existing Udhar</span>
                  <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                    {formatCurrency(selectedCustomer.total_due || 0)}
                  </span>
                </div>
              </div>

              {/* Partial Payment input */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Paid Now (Cash/UPI):
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 font-mono text-xs">₹</span>
                    <input
                      type="number"
                      min="0"
                      max={total}
                      placeholder="0 (full udhar)"
                      value={paidNowInput}
                      onChange={(e) => setPaidNowInput(e.target.value)}
                      className="w-24 h-7 px-2 text-right rounded bg-white dark:bg-[#080c16] border border-slate-300 dark:border-slate-700 font-mono font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Calculation breakdown */}
                {(() => {
                  const paid = Math.min(total, Math.max(0, parseFloat(paidNowInput) || 0));
                  const creditDue = Math.max(0, total - paid);
                  const newTotalCustDue = roundToTwo((selectedCustomer.total_due || 0) + creditDue);

                  return (
                    <div className="p-2 rounded bg-slate-100 dark:bg-[#070a13] text-[11px] space-y-1 font-mono">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Adding to Udhar:</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">+{formatCurrency(creditDue)}</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300 pt-0.5 border-t border-slate-200 dark:border-slate-800">
                        <span>New Total Customer Due:</span>
                        <span className="font-black text-rose-600 dark:text-rose-400">{formatCurrency(newTotalCustDue)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            /* Search or Quick Add Customer */
            <div className="space-y-2">
              {!showQuickAddCustomer ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search customer by name or phone..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-white dark:bg-[#080c16] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Filtered customer options */}
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {customers
                      .filter((c) => {
                        if (!customerSearch.trim()) return true;
                        const q = customerSearch.toLowerCase().trim();
                        return c.name.toLowerCase().includes(q) || c.phone.includes(q);
                      })
                      .slice(0, 4)
                      .map((cust) => (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(cust);
                            setCustomerSearch('');
                          }}
                          className="w-full p-1.5 text-left rounded bg-white dark:bg-[#080c16] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs transition-colors"
                        >
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block leading-tight">{cust.name}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{cust.phone}</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400">
                            Due: {formatCurrency(cust.total_due || 0)}
                          </span>
                        </button>
                      ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowQuickAddCustomer(true)}
                    className="w-full py-1.5 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Quick Add New Customer</span>
                  </button>
                </>
              ) : (
                /* Quick Add Form */
                <div className="space-y-1.5 p-2 rounded-lg bg-white dark:bg-[#080c16] border border-indigo-200 dark:border-indigo-900">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-900 dark:text-white">Quick Add Customer</span>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddCustomer(false)}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Customer Name *"
                    value={quickCustomerName}
                    onChange={(e) => setQuickCustomerName(e.target.value)}
                    className="w-full h-7 px-2 text-xs rounded bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                  <input
                    type="tel"
                    placeholder="10-digit Mobile *"
                    value={quickCustomerPhone}
                    onChange={(e) => setQuickCustomerPhone(e.target.value)}
                    className="w-full h-7 px-2 text-xs font-mono rounded bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleQuickCreateCustomer}
                    disabled={isCreatingCustomer}
                    className="w-full h-7 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs"
                  >
                    {isCreatingCustomer ? 'Adding...' : 'Save & Select'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-red-500/15 text-red-600 dark:text-red-400 text-xs border border-red-500/30">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Charge Button */}
      <button
        type="button"
        onClick={handleCompleteSale}
        disabled={isSubmitting || cart.length === 0}
        className={`w-full h-12 rounded-lg font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.99] ${
          cart.length === 0
            ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700/40'
            : paymentMethod === 'udhar'
            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25 border border-rose-400/30'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25 border border-emerald-400/30'
        }`}
      >
        <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
        <span>
          {isSubmitting
            ? 'Recording Transaction...'
            : cart.length === 0
            ? 'Cart is Empty'
            : paymentMethod === 'udhar'
            ? `Record Udhar Sale (${formatCurrency(total)})`
            : `Charge ${formatCurrency(total)}`}
        </span>
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search product title, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-8 rounded-lg bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs"
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

          <button
            onClick={() => setShowBarcodePrompt(true)}
            className="h-10 px-3 rounded-lg bg-white dark:bg-[#0f1523] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-800 active:scale-95 transition-all shrink-0 text-xs font-medium shadow-xs"
            title="Scan or enter barcode"
          >
            <Barcode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden sm:inline">Barcode</span>
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar max-w-2xl">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`h-8 px-3 rounded-md text-xs font-semibold shrink-0 transition-all ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-xs'
            }`}
          >
            All Items ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`h-8 px-3 rounded-md text-xs font-semibold shrink-0 transition-all ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-xs'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main POS Split Screen Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Product Catalog Grid */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const inCartItem = cart.find((i) => i.product.id === product.id);
              const currentStock = product.quantity ?? 0;
              const isOutOfStock = currentStock <= 0;
              const isMaxCart = inCartItem && inCartItem.quantity >= currentStock;

              return (
                <div
                  key={product.id}
                  className={`group flex flex-col justify-between p-3 rounded-xl bg-white dark:bg-[#0f1523] border transition-all relative overflow-hidden shadow-xs ${
                    inCartItem
                      ? 'border-indigo-500 dark:border-indigo-500/70 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Product Image Thumbnail */}
                  <div className="relative aspect-[4/3] w-full rounded-lg bg-slate-100 dark:bg-[#0b0f19] overflow-hidden mb-2.5 border border-slate-200 dark:border-slate-800/60">
                    <ProductImage
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Stock Status Badge */}
                    <div className="absolute top-1.5 right-1.5">
                      {isOutOfStock ? (
                        <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/80 text-red-700 dark:text-red-200 text-[10px] font-bold border border-red-200 dark:border-transparent">
                          Out
                        </span>
                      ) : currentStock <= product.low_stock_threshold ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/90 text-slate-950 text-[10px] font-bold">
                          {currentStock} left
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-white/90 dark:bg-slate-900/80 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold backdrop-blur-sm border border-slate-200 dark:border-slate-700/60 shadow-xs">
                          {currentStock}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Category */}
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate block">
                      {product.category_name}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug mt-0.5" title={product.name}>
                      {product.name}
                    </h4>
                  </div>

                  {/* Price & Add Action */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                        {formatCurrency(product.selling_price)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock || Boolean(isMaxCart)}
                      className={`h-8 px-2.5 rounded-md flex items-center justify-center gap-1 text-xs font-bold transition-all active:scale-90 ${
                        isOutOfStock || isMaxCart
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                          : inCartItem
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                      }`}
                      title={isMaxCart ? 'Max stock added' : 'Add to cart'}
                    >
                      {inCartItem ? (
                        <>
                          <span>{inCartItem.quantity}</span>
                          <Plus className="w-3 h-3 stroke-[2.5]" />
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400 text-xs rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              {products.length === 0 ? (
                <div className="max-w-xs mx-auto space-y-3">
                  <Package className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
                  <div>
                    <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Your store catalog is empty</p>
                    <p className="text-[11px] text-slate-400 mt-1">Add real products to your catalog to start ringing up sales at the counter.</p>
                  </div>
                  <Link
                    href="/products/new"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Product</span>
                  </Link>
                </div>
              ) : (
                <p>No products match your search or filter.</p>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Live Desktop POS Register Ticket (Sticky) */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-4 sticky top-20">
          <div className="rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-md overflow-hidden flex flex-col max-h-[calc(100vh-100px)]">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/70 dark:bg-[#0b0f19]/60">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Current Register Bill
                </h3>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                  {totalItemsCount}
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-[11px] text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Cart Items Scroll Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[380px]">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs space-y-1">
                  <p>Register ticket is empty.</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Click items on the left or scan barcodes to begin.
                  </p>
                </div>
              ) : (
                renderCartItemsList()
              )}
            </div>

            {/* Checkout & Payment Section */}
            <div className="p-4 bg-slate-50/50 dark:bg-[#0d1322] border-t border-slate-200 dark:border-slate-800/80">
              {renderCheckoutSummary()}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Mobile Cart Bar - safely elevated above BottomNav and safe areas */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 sm:left-4 sm:right-4 max-w-md mx-auto z-30">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full p-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-between shadow-xl shadow-indigo-600/30 active:scale-[0.98] transition-all border border-indigo-400/30 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-xs">
                {totalItemsCount}
              </div>
              <div className="text-left">
                <p className="text-[11px] font-medium text-indigo-100">
                  {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'} in bill
                </p>
                <p className="text-base font-extrabold font-mono tabular-nums leading-none mt-0.5">
                  {formatCurrency(total)}
                </p>
              </div>
            </div>

            <span className="text-xs font-bold uppercase tracking-wider bg-white text-indigo-700 px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1">
              <span>Checkout</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>
        </div>
      )}

      {/* Slide-over Mobile Cart Drawer */}
      {isCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#0f1523] h-full flex flex-col border-l border-slate-200 dark:border-slate-800 pb-safe overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Current Register Bill</h3>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">({totalItemsCount} items)</span>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-2">
              {renderCartItemsList()}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1322] shrink-0 overflow-y-auto max-h-[55vh]">
              {renderCheckoutSummary()}
            </div>
          </div>
        </div>
      )}

      {/* Barcode Quick Entry Modal */}
      {showBarcodePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Barcode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Barcode / SKU Quick Scan</span>
              </h3>
              <button
                onClick={() => setShowBarcodePrompt(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleBarcodeSearch} className="space-y-4 mt-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Scan with a handheld scanner or enter the numeric barcode or SKU:
              </p>
              <input
                type="text"
                autoFocus
                placeholder="e.g. 8901001001 or KG-CL-001"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg bg-slate-50 dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20"
              >
                Add Item to Bill
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Completed Sale Receipt Modal */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          onClose={() => setCompletedSale(null)}
          onNewSale={() => setCompletedSale(null)}
        />
      )}
    </div>
  );
}
