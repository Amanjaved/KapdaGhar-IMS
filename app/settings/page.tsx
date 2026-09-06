'use client';

import React, { useState, useEffect } from 'react';
import { syncEngine } from '@/lib/offline/syncEngine';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { useTheme } from '@/components/theme/ThemeProvider';
import {
  Settings,
  Store,
  RefreshCw,
  Database,
  Printer,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sun,
  Moon,
  Laptop,
  Lock,
  Shield,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, session, securitySettings, updateSecuritySettings, lockTerminal } = useAuth();
  const [storeName, setStoreName] = useState('Kapda Ghar');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [address, setAddress] = useState('Shop #12, Main Market, New Delhi');
  const [printerPaperWidth, setPrinterPaperWidth] = useState<'80mm' | '58mm' | 'a4'>('80mm');
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<any>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedWidth = localStorage.getItem('kapda_ghar_printer_width') as '80mm' | '58mm' | 'a4' | null;
      if (savedWidth && ['80mm', '58mm', 'a4'].includes(savedWidth)) {
        setPrinterPaperWidth(savedWidth);
      }
      const savedName = localStorage.getItem('kapda_ghar_store_name');
      if (savedName) setStoreName(savedName);

      const savedPhone = localStorage.getItem('kapda_ghar_store_phone');
      if (savedPhone) setPhone(savedPhone);

      const savedAddress = localStorage.getItem('kapda_ghar_store_address');
      if (savedAddress) setAddress(savedAddress);
    } catch (e) {}
  }, []);

  const handleSetPrinterWidth = (width: '80mm' | '58mm' | 'a4') => {
    setPrinterPaperWidth(width);
    try {
      localStorage.setItem('kapda_ghar_printer_width', width);
      window.dispatchEvent(new Event('storage'));
      const label = width === '80mm' ? '80mm POS Roll' : width === '58mm' ? '58mm Mini Roll' : 'A4 Full Sheet';
      setSavedFeedback(`✓ Printer format set to ${label}. Receipts will now format for ${width}.`);
      setTimeout(() => setSavedFeedback(null), 4000);
    } catch (e) {}
  };

  const handleUpdateStoreName = (val: string) => {
    setStoreName(val);
    try {
      localStorage.setItem('kapda_ghar_store_name', val);
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  };

  const handleUpdatePhone = (val: string) => {
    setPhone(val);
    try {
      localStorage.setItem('kapda_ghar_store_phone', val);
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  };

  const handleUpdateAddress = (val: string) => {
    setAddress(val);
    try {
      localStorage.setItem('kapda_ghar_store_address', val);
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  };

  useEffect(() => {
    if (!syncEngine) return;
    const unsubscribe = syncEngine.subscribe((status) => {
      setSyncStatus(status);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleManualSync = async () => {
    if (!syncEngine) return;
    setIsSyncing(true);
    setSyncMessage(null);
    const res = await syncEngine.runFullAutoSync(true);
    setIsSyncing(false);
    if (!res.success && res.errors > 0) {
      setSyncMessage(`Sync warning: ${res.syncedCount} synced, ${res.errors} error(s) — ${res.message}`);
    } else {
      setSyncMessage(`✓ Auto-sync completed: ${res.message}`);
    }
  };

  const handleClearPendingQueue = async () => {
    if (!syncEngine) return;
    const count = syncStatus.pendingCount || 0;
    if (count === 0) return;
    const confirmed = window.confirm(
      `Discard ${count} pending offline transaction(s)?\n\nThese sales will be removed from your local offline queue and will NOT be uploaded to the cloud database.`
    );
    if (!confirmed) return;
    const res = await syncEngine.clearPendingQueue();
    setSyncMessage(`✓ Cleared ${res.clearedCount} pending offline transaction(s)`);
    setTimeout(() => setSyncMessage(null), 4000);
  };

  const hasCloud = isSupabaseConfigured();

  return (
    <div className="space-y-6 pb-8 max-w-3xl">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200 dark:border-slate-800/80 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Store & System Settings
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure POS register, receipt printers, and cloud connectivity
          </p>
        </div>
      </div>

      {/* Global Saved Notification */}
      {savedFeedback && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedFeedback}</span>
        </div>
      )}

      {/* Appearance & Theme Selector */}
      <div className="p-5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <Sun className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Appearance & Theme Preference
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Choose between clean SaaS Light mode, high-contrast Obsidian Dark mode, or automatic system sync.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-3.5 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border ${
              theme === 'light'
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-600 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs'
                : 'bg-slate-50 dark:bg-[#0b0f19] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300'
            }`}
          >
            <Sun className="w-5 h-5" />
            <span className="text-xs">Light Mode</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-3.5 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border ${
              theme === 'dark'
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-600 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs'
                : 'bg-slate-50 dark:bg-[#0b0f19] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300'
            }`}
          >
            <Moon className="w-5 h-5" />
            <span className="text-xs">Dark Mode</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`p-3.5 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border ${
              theme === 'system'
                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-600 text-indigo-700 dark:text-indigo-300 font-bold shadow-xs'
                : 'bg-slate-50 dark:bg-[#0b0f19] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300'
            }`}
          >
            <Laptop className="w-5 h-5" />
            <span className="text-xs">System Auto</span>
          </button>
        </div>
      </div>

      {/* Cloud & Auto-Sync Engine Card */}
      <div className="p-5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Automatic Multi-Device Cloud Sync
            </span>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
              hasCloud
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
            }`}
          >
            {hasCloud ? 'Supabase Realtime Connected' : 'Local IndexedDB (Offline)'}
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Continuous two-way synchronization keeps inventory, stock levels, categories, and sales updated across Desktop, Phone, and all store terminals automatically.
        </p>

        {/* Auto-Sync Settings Controls */}
        <div className="space-y-3 pt-1">
          {/* Toggle: Auto-Sync */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-200/80 dark:border-slate-800">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Continuous Background Auto-Sync</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Automatically checks for catalog changes and pushes pending records in the background.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !(syncStatus.autoSyncEnabled !== false);
                syncEngine?.setAutoSyncEnabled(next);
                setSavedFeedback(`✓ Auto-sync ${next ? 'enabled' : 'paused'}`);
                setTimeout(() => setSavedFeedback(null), 3000);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                syncStatus.autoSyncEnabled !== false ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  syncStatus.autoSyncEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Sync Frequency Selector */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">Auto-Sync Frequency</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  How often terminals automatically verify inventory and sync with the cloud database.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                Every {syncStatus.autoSyncIntervalSeconds || 10}s
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { sec: 10, label: '10 Seconds', desc: 'Realtime (Best)' },
                { sec: 30, label: '30 Seconds', desc: 'Balanced' },
                { sec: 60, label: '60 Seconds', desc: 'Low Data' },
              ].map((item) => (
                <button
                  key={item.sec}
                  type="button"
                  onClick={() => {
                    syncEngine?.setAutoSyncInterval(item.sec);
                    setSavedFeedback(`✓ Auto-sync interval set to ${item.sec}s`);
                    setTimeout(() => setSavedFeedback(null), 3000);
                  }}
                  className={`py-2 px-2 text-center rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                    (syncStatus.autoSyncIntervalSeconds || 10) === item.sec
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                      : 'bg-white dark:bg-[#121827] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <span className="block font-bold">{item.label}</span>
                  <span className={`block text-[10px] font-normal ${
                    (syncStatus.autoSyncIntervalSeconds || 10) === item.sec ? 'text-indigo-100' : 'text-slate-400'
                  }`}>{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sync Status & Action Bar */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800/60 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400">
                Pending Offline Transactions:{' '}
                <strong
                  className={`font-mono ${
                    (syncStatus.pendingCount || 0) > 0
                      ? 'text-amber-600 dark:text-amber-400 font-bold'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {syncStatus.pendingCount || 0}
                </strong>
              </span>
            </div>
            {syncStatus.lastSyncedAt && (
              <p className="text-[11px] text-slate-400">
                Last auto-synced: {new Date(syncStatus.lastSyncedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(syncStatus.pendingCount || 0) > 0 && (
              <button
                type="button"
                onClick={handleClearPendingQueue}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 font-semibold text-xs transition-all active:scale-95 cursor-pointer shrink-0"
                title="Discard pending offline queue"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Discard Queue</span>
              </button>
            )}
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing
                  ? 'Auto-Syncing...'
                  : (syncStatus.pendingCount || 0) > 0
                  ? `Sync Now (${syncStatus.pendingCount})`
                  : 'Run Full Auto-Sync Now'}
              </span>
            </button>
          </div>
        </div>

        {syncMessage && (
          <p
            className={`text-xs font-medium ${
              syncMessage.includes('warning') || syncMessage.includes('error')
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {syncMessage}
          </p>
        )}
      </div>

      {/* Store Identity (Prints on receipts) */}
      <div className="p-5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <Store className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Thermal Receipt Header Information
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Store / Business Name
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => handleUpdateStoreName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Contact Phone Number
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => handleUpdatePhone(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Store Address & City
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => handleUpdateAddress(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white dark:bg-[#0b0f19] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Printer Format Settings */}
      <div className="p-5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Printer Receipt Width Preset
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase">
            Active: {printerPaperWidth}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: '80mm', label: '80mm POS Roll', sub: 'Standard 3"' },
              { id: '58mm', label: '58mm Mini Roll', sub: 'Compact 2"' },
              { id: 'a4', label: 'A4 Full Sheet', sub: 'Standard Letter' },
            ] as const
          ).map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => handleSetPrinterWidth(fmt.id)}
              className={`py-3 px-3 rounded-lg text-left flex flex-col justify-between gap-1 transition-all ${
                printerPaperWidth === fmt.id
                  ? 'bg-indigo-600 text-white shadow-sm border border-indigo-400/40 ring-2 ring-indigo-500/20'
                  : 'bg-slate-50 dark:bg-[#0b0f19] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              <span className="text-xs font-bold block">{fmt.label}</span>
              <span
                className={`text-[10px] font-mono block ${
                  printerPaperWidth === fmt.id ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {fmt.sub}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {printerPaperWidth === '80mm' && 'Standard 80mm roll is ideal for commercial desktop thermal ESC/POS printers.'}
          {printerPaperWidth === '58mm' && 'Compact 58mm roll formats the receipt with tighter margins for 2-inch mini Bluetooth/USB printers.'}
          {printerPaperWidth === 'a4' && 'A4 format formats the receipt as a clean full-sheet retail invoice for standard laser/inkjet printers.'}
        </p>
      </div>

      {/* Terminal Security & Access Protection */}
      <div className="p-5 rounded-xl bg-white dark:bg-[#0f1523] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Terminal Security & Session Controls
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            High Security Enforced
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Configure auto-lock parameters, idle timers, and browser tab close protection so the POS register is never left unlocked unattended.
        </p>

        <div className="space-y-4 pt-1">
          {/* Setting 1: Require PIN on Tab/Browser Close */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-200/80 dark:border-slate-800">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Require PIN on Browser / Tab Close</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Wipes session on window/tab close so reopening the app the next day always asks for PIN authentication.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !securitySettings.require_pin_on_close;
                updateSecuritySettings({ require_pin_on_close: next });
                setSavedFeedback(`✓ Tab close protection ${next ? 'enabled (High Security)' : 'disabled (Persistent)'}`);
                setTimeout(() => setSavedFeedback(null), 4000);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                securitySettings.require_pin_on_close ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  securitySettings.require_pin_on_close ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Setting 2: Idle Inactivity Auto-Lock */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">Inactivity / Idle Auto-Lock</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Locks the terminal screen when no keyboard, mouse, or touch activity is detected.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {securitySettings.idle_timeout_minutes === 0 ? 'Disabled' : `${securitySettings.idle_timeout_minutes} mins`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {[5, 15, 30, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    updateSecuritySettings({ idle_timeout_minutes: mins });
                    setSavedFeedback(`✓ Idle auto-lock set to ${mins} minutes.`);
                    setTimeout(() => setSavedFeedback(null), 4000);
                  }}
                  className={`py-2 px-2 text-center rounded-lg text-xs font-semibold transition-all border ${
                    securitySettings.idle_timeout_minutes === mins
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                      : 'bg-white dark:bg-[#121827] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          {/* Setting 3: Max Session Expiration */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-200/80 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white">Maximum Session Expiration</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Forces staff to re-authenticate with their PIN once the shift duration is reached.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {Math.round(securitySettings.session_timeout_minutes / 60)} hours
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {[120, 240, 480, 720].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    updateSecuritySettings({ session_timeout_minutes: mins });
                    setSavedFeedback(`✓ Max session expiration set to ${mins / 60} hours.`);
                    setTimeout(() => setSavedFeedback(null), 4000);
                  }}
                  className={`py-2 px-2 text-center rounded-lg text-xs font-semibold transition-all border ${
                    securitySettings.session_timeout_minutes === mins
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                      : 'bg-white dark:bg-[#121827] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  {mins / 60} hrs
                </button>
              ))}
            </div>
          </div>

          {/* Active Session & Lock Terminal Action */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Active Terminal Session: {user?.full_name || 'Staff User'} ({user?.role || 'cashier'})
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Anti-Brute Force Protection Active: Locks terminal for 60s upon 5 wrong PIN attempts.
              </p>
            </div>
            <button
              type="button"
              onClick={lockTerminal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Terminal Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* Security & Data Integrity Summary */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0b0f19] border border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-500 dark:text-slate-400">
        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-800 dark:text-slate-300">Transaction & Inventory Integrity</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-500">
            Stock quantities are strictly validated to prevent overselling. Product prices are permanently locked into sale snapshots at checkout time.
          </p>
        </div>
      </div>
    </div>
  );
}
