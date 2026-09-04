'use client';

import React, { useState } from 'react';
import { Product } from '@/types';
import { productService, deleteProduct } from '@/services/productService';
import { Trash2, AlertTriangle, X, Loader2, Package } from 'lucide-react';

interface DeleteProductModalProps {
  product: Product;
  onClose: () => void;
  onDeleted: (productId: string) => void;
}

export function DeleteProductModal({ product, onClose, onDeleted }: DeleteProductModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    setErrorMsg(null);

    try {
      let success = false;
      if (typeof deleteProduct === 'function') {
        success = await deleteProduct(product.id);
      } else if (typeof productService?.deleteProduct === 'function') {
        success = await productService.deleteProduct(product.id);
      } else if (typeof productService?.updateProduct === 'function') {
        await productService.updateProduct(product.id, { is_active: false });
        success = true;
      }

      if (success) {
        onDeleted(product.id);
        onClose();
      } else {
        setErrorMsg('Failed to delete product. Please try again.');
      }
    } catch (err: any) {
      console.error('Error in DeleteProductModal:', err);
      setErrorMsg(err.message || 'An error occurred while deleting');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-500/20">
              <Trash2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Product</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Confirm catalog removal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-4 space-y-3 text-xs">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Are you sure you want to delete <strong className="text-slate-900 dark:text-white font-semibold">"{product.name}"</strong>?
          </p>

          {/* Product Summary Box with Photo */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800/80 flex items-center gap-3">
            {/* Product Photo Thumbnail */}
            <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-[#121827] border border-slate-200 dark:border-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                  <Package className="w-6 h-6 stroke-[1.5]" />
                  <span className="text-[9px] font-sans mt-0.5">No photo</span>
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="flex-1 min-w-0 space-y-1 font-mono text-[11px]">
              <div className="font-sans font-bold text-xs text-slate-900 dark:text-white truncate">
                {product.name}
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Category:</span>
                <span className="text-slate-800 dark:text-slate-200 font-sans truncate ml-2">
                  {product.category_name}
                </span>
              </div>
              {(product.sku || product.barcode) && (
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>SKU / Barcode:</span>
                  <span className="text-slate-800 dark:text-slate-200 truncate ml-2">
                    {product.sku || product.barcode}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Stock:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {product.quantity ?? 0} units
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>This removes the item from the catalog and register. Existing sales receipts will remain safe.</span>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{errorMsg}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="h-10 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-10 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs shadow-sm shadow-red-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
