'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { productService } from '@/services/productService';
import { imageService } from '@/services/imageService';
import { Category } from '@/types';
import { formatCurrency } from '@/lib/utils/currency';
import {
  Camera,
  Upload,
  ArrowLeft,
  Check,
  Plus,
  Tag,
  IndianRupee,
  Layers,
  Sparkles,
  AlertCircle,
  Barcode,
} from 'lucide-react';

export default function AddProductPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [hasBarcode, setHasBarcode] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [sellingPrice, setSellingPrice] = useState<string>('');
  const [openingStock, setOpeningStock] = useState<string>('10');
  const [lowStockThreshold, setLowStockThreshold] = useState<string>('5');
  const [description, setDescription] = useState('');

  // Image states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressProgress, setCompressProgress] = useState<number>(0);
  const [compressedSizeKb, setCompressedSizeKb] = useState<number | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New category creation inline
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  useEffect(() => {
    productService.getCategories().then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setSelectedCategory(cats[0].id);
    });
  }, []);

  const handleFileChange = async (file: File) => {
    setImageFile(file);
    setCompressProgress(10);
    try {
      const uploadRes = await imageService.processAndUploadImage(
        file,
        `prod-temp-${Date.now()}`,
        (percent) => setCompressProgress(percent)
      );
      setImagePreview(uploadRes.imageUrl);
      setCompressedSizeKb(uploadRes.sizeKb);
    } catch (err) {
      console.warn('Failed to process image:', err);
      // Fallback preview
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    const cat = await productService.createCategory(newCatName.trim());
    setCategories((prev) => [...prev, cat]);
    setSelectedCategory(cat.id);
    setNewCatName('');
    setIsAddingNewCat(false);
  };

  const calculateProfitPerUnit = () => {
    const buy = parseFloat(purchasePrice) || 0;
    const sell = parseFloat(sellingPrice) || 0;
    return sell - buy;
  };

  const handleSaveProduct = async (addAnother: boolean = false) => {
    if (!name.trim()) {
      setErrorMsg('Product name is required');
      return;
    }
    let targetCat = selectedCategory;
    if (!targetCat && newCatName.trim()) {
      try {
        const newCat = await productService.createCategory(newCatName.trim());
        setCategories((prev) => [...prev, newCat]);
        targetCat = newCat.id;
        setSelectedCategory(newCat.id);
      } catch (e) {}
    }

    if (!targetCat) {
      if (categories.length > 0) {
        targetCat = categories[0].id;
        setSelectedCategory(categories[0].id);
      } else {
        targetCat = 'c0000000-0000-0000-0000-000000000001';
      }
    }

    const buy = parseFloat(purchasePrice) || 0;
    const sell = parseFloat(sellingPrice) || 0;
    const stock = parseInt(openingStock) || 0;
    const lowStock = parseInt(lowStockThreshold) || 5;

    if (buy < 0 || sell < 0 || stock < 0) {
      setErrorMsg('Prices and stock must be positive numbers');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await productService.createProduct(
        {
          name: name.trim(),
          category_id: targetCat,
          purchase_price: buy,
          selling_price: sell,
          low_stock_threshold: lowStock,
          sku: sku.trim() || undefined,
          barcode: hasBarcode && barcode.trim() ? barcode.trim() : undefined,
          description: description.trim() || undefined,
          image_url: imagePreview || undefined,
          is_active: true,
        },
        stock
      );

      setSuccessMsg(`✓ "${name}" added to inventory!`);

      if (addAnother) {
        // Reset inputs for next item and stay on page
        setName('');
        setPurchasePrice('');
        setSellingPrice('');
        setOpeningStock('10');
        setSku('');
        setHasBarcode(false);
        setBarcode('');
        setDescription('');
        setImageFile(null);
        setImagePreview(null);
        setCompressedSizeKb(null);
        setCompressProgress(0);
      } else {
        // Navigate to catalog
        router.push('/inventory');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const profit = calculateProfitPerUnit();

  return (
    <div className="space-y-5 pb-8">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/inventory"
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Add New Product</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Step-by-step fast cataloging</p>
          </div>
        </div>
      </div>

      {/* Form Sections */}
      <div className="space-y-4">
        {/* Section 1: Basic Information */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold font-mono">
              1
            </span>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Product Identification</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Product Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Embroidered Cotton Kurti, Leather Handbag..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-base sm:text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Product Category *</label>
              {categories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsAddingNewCat(!isAddingNewCat)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                >
                  {isAddingNewCat ? 'Cancel' : '+ New Category'}
                </button>
              )}
            </div>

            {isAddingNewCat || categories.length === 0 ? (
              <div className="space-y-2">
                {categories.length === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    No categories exist yet. Type your first category name below (e.g. Sarees, Kurtis, Shoes, Bags):
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter category name"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 h-10 px-3 rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-base sm:text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    className="px-4 h-10 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                  >
                    Save Category
                  </button>
                </div>
              </div>
            ) : (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Section 2: Pricing & Margins */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold font-mono">
                2
              </span>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Pricing & Unit Economics</h3>
            </div>
            {profit !== 0 && (
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                  profit >= 0
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                }`}
              >
                Margin: {profit >= 0 ? `+${formatCurrency(profit)}` : `-${formatCurrency(Math.abs(profit))}`}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Purchase / Cost Price (₹) *
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-semibold text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Selling / Retail Price (₹) *
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-semibold text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Stock & Identifiers */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold font-mono">
              3
            </span>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Inventory & Identifiers</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Initial Opening Stock *
              </label>
              <input
                type="number"
                min="0"
                value={openingStock}
                onChange={(e) => setOpeningStock(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-semibold text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Low Stock Warning Level
              </label>
              <input
                type="number"
                min="1"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-semibold text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                SKU Code (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. KG-CLOTH-001"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-base sm:text-xs text-slate-900 dark:text-white font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Barcode Option Checkbox */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <label
              htmlFor="barcode-checkbox"
              className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0b0f19]/60 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors select-none group"
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="barcode-checkbox"
                  checked={hasBarcode}
                  onChange={(e) => {
                    setHasBarcode(e.target.checked);
                    if (!e.target.checked) setBarcode('');
                  }}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 bg-white dark:bg-[#0b0f19] cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    Product has Barcode
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Check this to assign a barcode number for fast POS scanner lookup
                  </span>
                </div>
              </div>
              <Barcode
                className={`w-4 h-4 shrink-0 transition-colors ${
                  hasBarcode ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                }`}
              />
            </label>

            {/* Conditionally Revealed Barcode Input */}
            {hasBarcode && (
              <div className="mt-3 p-3.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-900 dark:text-white">
                    Barcode / EAN Number *
                  </label>
                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                    Scanner Ready
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Scan with barcode gun or type number (e.g. 890123456789)"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg bg-white dark:bg-[#0b0f19] border border-indigo-200 dark:border-indigo-800/80 text-base sm:text-xs text-slate-900 dark:text-white font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <Barcode className="w-4 h-4 text-indigo-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  You can directly point your handheld USB/Bluetooth scanner at this field to scan.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Product Image */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold font-mono">
              4
            </span>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Product Photo</h3>
          </div>

          {imagePreview ? (
            <div className="relative aspect-video max-h-52 w-full rounded-lg bg-slate-100 dark:bg-[#0b0f19] overflow-hidden border border-slate-300 dark:border-slate-700">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] text-emerald-400 font-medium">
                Optimized WebP {compressedSizeKb ? `(${compressedSizeKb} KB)` : ''}
              </div>
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setImageFile(null);
                }}
                className="absolute top-2 right-2 px-2.5 py-1 rounded bg-black/70 text-xs font-medium text-white hover:bg-black/90 transition-colors"
              >
                Change Photo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-5 rounded-lg bg-slate-50 dark:bg-[#0b0f19] hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 flex flex-col items-center justify-center gap-2 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block">Camera Capture</span>
                  <span className="text-[10px] text-slate-500">Take live photo</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-5 rounded-lg bg-slate-50 dark:bg-[#0b0f19] hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 flex flex-col items-center justify-center gap-2 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block">Upload Image</span>
                  <span className="text-[10px] text-slate-500">From local files</span>
                </div>
              </button>
            </div>
          )}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
          />
        </div>
      </div>

      {/* Status Messages */}
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 text-xs border border-red-500/30">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs border border-emerald-500/30">
          <Check className="w-4 h-4 shrink-0 stroke-[3]" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={() => handleSaveProduct(true)}
          disabled={isSubmitting}
          className="h-11 rounded-lg bg-white dark:bg-[#0f1523] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-semibold text-xs border border-slate-200 dark:border-slate-800 transition-all flex items-center justify-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Save & Add Another</span>
        </button>

        <button
          type="button"
          onClick={() => handleSaveProduct(false)}
          disabled={isSubmitting}
          className="h-11 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
        >
          <Check className="w-4 h-4 stroke-[2.5]" />
          <span>{isSubmitting ? 'Saving to Catalog...' : 'Save Product'}</span>
        </button>
      </div>
    </div>
  );
}
