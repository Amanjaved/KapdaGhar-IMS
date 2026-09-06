'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { productService } from '@/services/productService';
import { Category, Product } from '@/types';
import { formatCurrency } from '@/lib/utils/currency';
import { StockAdjustModal } from '@/components/inventory/StockAdjustModal';
import { DeleteProductModal } from '@/components/inventory/DeleteProductModal';
import {
  Search,
  Plus,
  Package,
  AlertTriangle,
  SlidersHorizontal,
  TrendingUp,
  Tag,
  Boxes,
  DollarSign,
  ArrowUpDown,
  Edit3,
  Trash2,
  RefreshCw,
} from 'lucide-react';

function InventoryContent() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get('filter');

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialFilter === 'low' ? 'low' : 'all'
  );
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (forceRefresh = false) => {
    if (!forceRefresh && products.length === 0) setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        productService.getProducts(undefined, undefined, forceRefresh),
        productService.getCategories(forceRefresh),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleCatalogRefreshed = () => {
      loadData(true);
    };

    window.addEventListener('catalog-refreshed', handleCatalogRefreshed);
    window.addEventListener('focus', handleCatalogRefreshed);
    return () => {
      window.removeEventListener('catalog-refreshed', handleCatalogRefreshed);
      window.removeEventListener('focus', handleCatalogRefreshed);
    };
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.includes(q);

      if (!matchesSearch) return false;

      if (selectedCategory === 'low') {
        return (p.quantity ?? 0) <= p.low_stock_threshold;
      }
      if (selectedCategory !== 'all') {
        return p.category_id === selectedCategory;
      }
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  // Inventory financial totals
  const totalValuation = products.reduce((sum, p) => sum + (p.purchase_price * (p.quantity ?? 0)), 0);
  const totalRetailValue = products.reduce((sum, p) => sum + (p.selling_price * (p.quantity ?? 0)), 0);
  const lowStockCount = products.filter((p) => (p.quantity ?? 0) <= p.low_stock_threshold).length;

  const handleStockUpdated = (newQty: number) => {
    if (!adjustingProduct) return;
    setProducts((prev) =>
      prev.map((p) => (p.id === adjustingProduct.id ? { ...p, quantity: newQty } : p))
    );
  };

  const handleProductDeleted = (deletedId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== deletedId));
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Inventory & Stock
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              {products.length} SKUs
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time stock ledger, unit costs, and inventory valuation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              await productService.pushLocalCatalogToCloud();
              await productService.syncProductsFromCloud();
              await productService.syncCategoriesFromCloud();
              await loadData(true);
              setLoading(false);
            }}
            title="Sync latest inventory with Supabase Cloud"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync Cloud</span>
          </button>

          <Link
            href="/products/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add New Product</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs">
          <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Valuation (Cost)</p>
          <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5 sm:mt-1 truncate">
            {formatCurrency(totalValuation)}
          </p>
          <p className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">Unit purchase cost</p>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs">
          <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Expected Retail Value</p>
          <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-0.5 sm:mt-1 truncate">
            {formatCurrency(totalRetailValue)}
          </p>
          <p className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">100% sell-through</p>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3 sm:p-3.5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Low Stock SKUs</p>
            {lowStockCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </div>
          <p className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums mt-0.5 sm:mt-1">
            {lowStockCount} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">SKUs</span>
          </p>
          <p className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">At or below restock threshold</p>
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search products by title, SKU, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-lg bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -webkit-overflow-scrolling-touch">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`h-8 px-3 rounded-md text-xs font-semibold shrink-0 transition-all ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-xs'
            }`}
          >
            All ({products.length})
          </button>

          <button
            onClick={() => setSelectedCategory('low')}
            className={`h-8 px-3 rounded-md text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all ${
              selectedCategory === 'low'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 shadow-xs'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Low Stock ({lowStockCount})</span>
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

      {/* Inventory Item Rows / Cards */}
      <div className="rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs overflow-hidden">
        {loading && products.length === 0 ? (
          <div className="py-20 text-center text-slate-500 dark:text-slate-400 text-xs space-y-3">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-medium text-slate-600 dark:text-slate-300">Loading catalog...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400 text-xs space-y-3">
            {products.length === 0 ? (
              <div className="max-w-xs mx-auto space-y-3">
                <Package className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">Catalog is ready for real products</p>
                  <p className="text-[11px] text-slate-400 mt-1">All demo products have been cleared. Add your real shop inventory to start tracking stock.</p>
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
              <p>No inventory items match your search filter.</p>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card List View (<md screens) - No Horizontal Scrolling! */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredProducts.map((product) => {
                const qty = product.quantity ?? 0;
                const isLow = qty <= product.low_stock_threshold;
                const isOut = qty <= 0;
                const unitMargin = product.selling_price - product.purchase_price;
                const marginPercent =
                  product.selling_price > 0
                    ? ((unitMargin / product.selling_price) * 100).toFixed(0)
                    : '0';

                return (
                  <div
                    key={product.id}
                    className="p-3.5 space-y-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    {/* Header: Photo + Name + Category & Stock Pill */}
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 shrink-0 overflow-hidden">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600">
                            <Tag className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug line-clamp-1">
                            {product.name}
                          </h3>
                          {/* Stock badge */}
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono shrink-0 ${
                              isOut
                                ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30'
                                : isLow
                                ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                                : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                            }`}
                          >
                            {isOut ? 'Out of Stock' : `${qty} in stock`}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                            {product.category_name}
                          </span>
                          {(product.sku || product.barcode) && (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">•</span>
                              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                                {product.sku || product.barcode}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pricing Grid */}
                    <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-slate-50 dark:bg-[#0b0f19] border border-slate-200/80 dark:border-slate-800/80 text-center">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                          Retail
                        </p>
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                          {formatCurrency(product.selling_price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                          Cost
                        </p>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                          {formatCurrency(product.purchase_price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                          Margin
                        </p>
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                          +{marginPercent}%
                        </p>
                      </div>
                    </div>

                    {/* Mobile Action Buttons */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setAdjustingProduct(product)}
                        className="flex-1 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                      >
                        <Boxes className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Adjust Stock</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingProduct(product)}
                        className="w-9 h-9 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/15 dark:hover:text-red-400 flex items-center justify-center transition-colors border border-slate-200 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-500/30 active:scale-95 cursor-pointer"
                        title={`Delete "${product.name}"`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>=md screens) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium bg-slate-50/70 dark:bg-[#0b0f19]/60">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Category / SKU</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                    <th className="px-4 py-3 text-right">Retail</th>
                    <th className="px-4 py-3 text-right">Margin</th>
                    <th className="px-4 py-3 text-center">Stock Level</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredProducts.map((product) => {
                    const qty = product.quantity ?? 0;
                    const isLow = qty <= product.low_stock_threshold;
                    const isOut = qty <= 0;
                    const unitMargin = product.selling_price - product.purchase_price;
                    const marginPercent =
                      product.selling_price > 0
                        ? ((unitMargin / product.selling_price) * 100).toFixed(0)
                        : '0';

                    return (
                      <tr
                        key={product.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Product Thumbnail & Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 shrink-0 overflow-hidden">
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600">
                                  <Tag className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white leading-tight block">
                                {product.name}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Category & SKU */}
                        <td className="px-4 py-3">
                          <span className="text-slate-700 dark:text-slate-300 block">
                            {product.category_name}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono block mt-0.5">
                            {product.sku || product.barcode || '—'}
                          </span>
                        </td>

                        {/* Cost */}
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {formatCurrency(product.purchase_price)}
                        </td>

                        {/* Retail */}
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                          {formatCurrency(product.selling_price)}
                        </td>

                        {/* Margin */}
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                          +{marginPercent}%
                        </td>

                        {/* Stock Level Badge */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                              isOut
                                ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30'
                                : isLow
                                ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                                : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                            }`}
                          >
                            {isOut ? 'Out of Stock' : `${qty} in stock`}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAdjustingProduct(product)}
                              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white text-xs font-medium border border-slate-200 dark:border-slate-700/60 transition-colors cursor-pointer"
                            >
                              Adjust Stock
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingProduct(product)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/15 dark:hover:text-red-400 transition-colors cursor-pointer"
                              title={`Delete "${product.name}"`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Adjust Modal */}
      {adjustingProduct && (
        <StockAdjustModal
          product={adjustingProduct}
          onClose={() => setAdjustingProduct(null)}
          onUpdated={handleStockUpdated}
        />
      )}

      {/* Delete Modal */}
      {deletingProduct && (
        <DeleteProductModal
          product={deletingProduct}
          onClose={() => setDeletingProduct(null)}
          onDeleted={handleProductDeleted}
        />
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 text-xs">Loading inventory catalog...</div>}>
      <InventoryContent />
    </Suspense>
  );
}
