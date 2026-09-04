'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  AlertOctagon, 
  RefreshCw, 
  LayoutDashboard, 
  ShoppingCart, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Database,
  ArrowRight
} from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Log exception for audit
    console.error('POS Application Runtime Exception:', error);
  }, [error]);

  const handleCopyDetails = () => {
    const errorPayload = `Time: ${new Date().toISOString()}\nMessage: ${error.message}\nDigest: ${error.digest || 'None'}\nStack:\n${error.stack || 'No stack trace available'}`;
    navigator.clipboard.writeText(errorPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Status Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-amber-500 to-indigo-500" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header & Icon */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                System Exception (500)
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Temporary Service Interruption
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pt-0.5">
                An unexpected error occurred while loading this view. Your offline inventory cache and register transactions remain completely safe.
              </p>
            </div>
          </div>

          {/* Quick Recovery Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => reset()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload View
            </button>
            <Link
              href="/sell"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-colors"
            >
              <ShoppingCart className="w-4 h-4 text-emerald-500" />
              Open POS Register
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Return to Store Dashboard
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium"
            >
              <Database className="w-3.5 h-3.5" />
              Settings & Cloud Sync
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Collapsible Technical Details for Troubleshooting */}
          <div className="pt-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 py-1.5 cursor-pointer"
            >
              <span>Technical Diagnostics {error.digest ? `(${error.digest})` : ''}</span>
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showDetails && (
              <div className="mt-2 p-3.5 rounded-xl bg-slate-950 text-slate-300 border border-slate-800 text-xs font-mono space-y-2.5">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5">
                  <span className="text-[11px] font-sans font-medium uppercase tracking-wider text-slate-500">
                    Error Diagnostic Log
                  </span>
                  <button
                    onClick={handleCopyDetails}
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy log'}
                  </button>
                </div>
                <p className="text-rose-400 font-semibold break-all">
                  {error.message || 'Unknown application error'}
                </p>
                {error.digest && (
                  <p className="text-slate-400 text-[11px]">
                    <span className="text-slate-500">Digest:</span> {error.digest}
                  </p>
                )}
                {error.stack && (
                  <pre className="max-h-36 overflow-y-auto text-[10px] text-slate-400 whitespace-pre-wrap leading-relaxed">
                    {error.stack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
