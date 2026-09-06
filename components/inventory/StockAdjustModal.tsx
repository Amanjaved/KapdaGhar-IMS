'use client';

import React, { useState } from 'react';
import { Product } from '@/types';
import { inventoryService } from '@/services/inventoryService';
import { Plus, Minus, X, AlertTriangle, Check } from 'lucide-react';

interface StockAdjustModalProps {
  product: Product;
  onClose: () => void;
  onUpdated: (newQuantity: number) => void;
}

export function StockAdjustModal({ product, onClose, onUpdated }: StockAdjustModalProps) {
  const [type, setType] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState<number>(1);
  const [reason, setReason] = useState<string>('New Purchase');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentQty = product.quantity ?? 0;
  const quantityChange = type === 'add' ? amount : -amount;
  const projectedQty = currentQty + quantityChange;
  const isInvalid = projectedQty < 0 || amount <= 0;

  const addReasons = ['New Purchase', 'Customer Return', 'Stock Correction (Found)'];
  const removeReasons = ['Damaged Goods', 'Lost / Stolen', 'Stock Correction', 'Customer Exchange'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalid || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const result = await inventoryService.adjustStock(
      product.id,
      quantityChange,
      reason,
      notes.trim() || undefined
    );

    setIsSubmitting(false);

    if (result.success) {
      onUpdated(result.newQuantity);
      onClose();
    } else {
      setErrorMsg(result.error || 'Failed to adjust stock');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-sm max-h-[92vh] flex flex-col bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-4 sm:p-5 overflow-y-auto my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Adjust Stock Level</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">{product.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Type Toggle */}
        <div className="grid grid-cols-2 gap-1.5 mt-4 p-1 bg-slate-100 dark:bg-[#0b0f19] rounded-lg border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setType('add');
              setReason('New Purchase');
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
              type === 'add'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stock</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setType('remove');
              setReason('Damaged Goods');
            }}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
              type === 'remove'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Minus className="w-3.5 h-3.5" />
            <span>Remove Stock</span>
          </button>
        </div>

        {/* Stock Projection Indicator */}
        <div className="flex items-center justify-between p-3 my-4 rounded-lg bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Current</p>
            <p className="text-base font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">{currentQty}</p>
          </div>
          <div className="text-xs font-bold text-slate-400 dark:text-slate-500">→</div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Projected</p>
            <p
              className={`text-base font-extrabold font-mono tabular-nums ${
                projectedQty < 0
                  ? 'text-red-600 dark:text-red-400'
                  : projectedQty <= product.low_stock_threshold
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {projectedQty}
            </p>
          </div>
        </div>

        {/* Form Controls */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Quantity to {type === 'add' ? 'Add' : 'Remove'}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAmount((prev) => Math.max(1, prev - 1))}
                className="w-11 h-11 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-800 dark:text-white font-bold text-base active:scale-95 transition-all cursor-pointer"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 h-11 text-center font-mono font-bold text-lg rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setAmount((prev) => prev + 1)}
                className="w-11 h-11 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-800 dark:text-white font-bold text-base active:scale-95 transition-all cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {(type === 'add' ? addReasons : removeReasons).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Optional Note
            </label>
            <input
              type="text"
              placeholder="e.g., Supplier Invoice #1024"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/15 text-red-600 dark:text-red-400 text-xs border border-red-500/30">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isInvalid || isSubmitting}
            className={`w-full h-11 rounded-lg font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
              isInvalid || isSubmitting
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : type === 'add'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{isSubmitting ? 'Updating...' : `Confirm ${type === 'add' ? 'Addition' : 'Deduction'}`}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
