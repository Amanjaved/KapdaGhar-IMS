'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Users,
  Database,
  Building2,
  Cpu,
  Search,
  Plus,
  RefreshCw,
  Download,
  Eye,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Key,
  Phone,
  Store,
  FileSpreadsheet,
  X,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Lock,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { adminService, TABLE_CONFIGS } from '@/services/adminService';
import { Business, DatabaseTableName, TableMetadata, UserProfile, UserRole } from '@/types';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { formatINR } from '@/lib/utils/currency';
import { useAuth } from '@/components/auth/AuthProvider';

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'tables' | 'users' | 'business' | 'system'>('users');
  const [loading, setLoading] = useState(true);
  const [tableStats, setTableStats] = useState<TableMetadata[]>([]);
  const [activeTable, setActiveTable] = useState<DatabaseTableName>('products');
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Staff state
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('cashier');
  const [newStaffPin, setNewStaffPin] = useState('1234');
  const [activeStaffId, setActiveStaffId] = useState<string>('');

  // Business state
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessSaved, setBusinessSaved] = useState(false);

  // Inspector modal
  const [inspectedRow, setInspectedRow] = useState<any | null>(null);

  // Deletion modals state
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const hasCloud = isSupabaseConfigured();

  // Load initial data
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [stats, staff, biz] = await Promise.all([
        adminService.getTableCounts(),
        adminService.getStaffProfiles(),
        adminService.getBusinessProfile(),
      ]);
      setTableStats(stats);
      setProfiles(staff);
      setBusiness(biz);

      // Check active staff in localStorage
      const savedActive = localStorage.getItem('kapda_ghar_active_staff_id');
      if (savedActive) {
        setActiveStaffId(savedActive);
      } else if (staff.length > 0) {
        setActiveStaffId(staff[0].id);
        localStorage.setItem('kapda_ghar_active_staff_id', staff[0].id);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load active table data
  const loadTableData = async (table: DatabaseTableName, search?: string) => {
    setIsSearching(true);
    try {
      const res = await adminService.fetchTableRows(table, search, 100);
      setTableRows(res.rows);
    } catch (err) {
      console.error(`Failed to load ${table} data:`, err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (activeTab === 'tables') {
      loadTableData(activeTable, searchQuery);
    }
  }, [activeTab, activeTable]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTableData(activeTable, searchQuery);
  };

  // Add staff user
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;

    try {
      const created = await adminService.createStaffProfile({
        full_name: newStaffName,
        phone: newStaffPhone,
        role: newStaffRole,
        pin_code: newStaffPin,
      });
      setProfiles((prev) => [...prev, created]);
      setIsAddStaffOpen(false);
      setNewStaffName('');
      setNewStaffPhone('');
      setNewStaffRole('cashier');
      setNewStaffPin('1234');
      // Refresh counts
      const stats = await adminService.getTableCounts();
      setTableStats(stats);
    } catch (err) {
      console.error('Failed to create staff:', err);
    }
  };

  // Switch active register staff
  const handleSelectActiveStaff = (staff: UserProfile) => {
    setActiveStaffId(staff.id);
    localStorage.setItem('kapda_ghar_active_staff_id', staff.id);
    localStorage.setItem('kapda_ghar_active_staff_name', staff.full_name);
    localStorage.setItem('kapda_ghar_active_staff_role', staff.role);
    window.dispatchEvent(new Event('storage'));
  };

  // Delete staff profile
  const handleDeleteStaff = async (id: string) => {
    if (!confirm('Are you sure you want to remove this staff profile?')) return;
    try {
      await adminService.deleteStaffProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      const stats = await adminService.getTableCounts();
      setTableStats(stats);
      setActionNotice('Staff profile permanently deleted.');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err) {
      console.error('Failed to delete staff:', err);
    }
  };

  // Save business changes
  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business) return;
    await adminService.updateBusinessProfile(business);
    setBusinessSaved(true);
    setTimeout(() => setBusinessSaved(false), 3000);
  };

  // Export table rows to CSV
  const handleExportCSV = () => {
    if (!tableRows || tableRows.length === 0) return;
    const headers = Object.keys(tableRows[0]);
    const csvRows = [
      headers.join(','),
      ...tableRows.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            if (val === null || val === undefined) return '""';
            if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
            return `"${String(val).replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeTable}_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete all entries in active table
  const handleDeleteAllEntries = async () => {
    setIsDeleting(true);
    try {
      const res = await adminService.clearTableEntries(activeTable);
      setIsDeleteAllModalOpen(false);
      setActionNotice(`Successfully deleted all entries from ${activeTable.replace('_', ' ')} (${res.deletedCount} records).`);
      setTimeout(() => setActionNotice(null), 4000);
      await loadTableData(activeTable);
      const stats = await adminService.getTableCounts();
      setTableStats(stats);
    } catch (err) {
      console.error(`Failed to delete all entries from ${activeTable}:`, err);
      alert(`Error deleting entries: ${err}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete single row
  const handleDeleteSingleRow = async () => {
    if (!deletingRow || !deletingRow.id) return;
    setIsDeleting(true);
    try {
      await adminService.deleteTableRow(activeTable, deletingRow.id);
      setDeletingRow(null);
      setActionNotice(`Deleted record #${String(deletingRow.id).slice(0, 8)}... from ${activeTable.replace('_', ' ')}`);
      setTimeout(() => setActionNotice(null), 3000);
      await loadTableData(activeTable, searchQuery);
      const stats = await adminService.getTableCounts();
      setTableStats(stats);
    } catch (err) {
      console.error(`Failed to delete row:`, err);
      alert(`Error deleting row: ${err}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Clear all transaction records
  const handleClearTransactions = async () => {
    if (!confirm('Are you sure you want to clear all sales receipts, sale items, and inventory movement logs? Products catalog will be kept intact.')) return;
    setIsDeleting(true);
    try {
      await adminService.clearAllTransactions();
      setActionNotice('All sales transactions and audit trail movements have been cleared.');
      setTimeout(() => setActionNotice(null), 4000);
      await loadTableData(activeTable);
      const stats = await adminService.getTableCounts();
      setTableStats(stats);
    } catch (err) {
      console.error('Failed to clear transactions:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset database with default demo catalog
  const handleResetDefaults = async () => {
    if (!confirm('This will wipe test records and restore the complete default demo catalog with 8 products, 4 categories, and initial stock. Proceed?')) return;
    setIsDeleting(true);
    try {
      await adminService.resetDatabaseToDefaults();
      setActionNotice('Database restored to default demo catalog and inventory.');
      setTimeout(() => setActionNotice(null), 4000);
      await loadDashboardData();
      await loadTableData(activeTable);
    } catch (err) {
      console.error('Failed to reset defaults:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Wipe all store data for clean slate / real data entry
  const handleWipeAllForRealStore = async () => {
    if (
      !confirm(
        '⚠️ Are you sure you want to wipe ALL products, categories, inventory, and sales records?\n\nThis gives you a completely clean slate for entering your real store data. Your Store Profile and Admin PIN (9044) will remain intact.'
      )
    )
      return;
    setIsDeleting(true);
    try {
      await adminService.wipeAllDataForRealStore();
      setActionNotice('Clean slate ready! All demo products, categories, and sales have been eradicated.');
      setTimeout(() => setActionNotice(null), 4000);
      await loadDashboardData();
      await loadTableData(activeTable);
      const stats = await adminService.getTableCounts();
      setTableStats(stats);
    } catch (err) {
      console.error('Failed to wipe data for real store:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
            Store Owner
          </span>
        );
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
            Shift Manager
          </span>
        );
      case 'cashier':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            POS Cashier
          </span>
        );
    }
  };

  // Restrict Admin Console strictly to Store Owner (Admin)
  if (!authLoading && !isAdmin) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white dark:bg-[#0d1322] border border-rose-200 dark:border-rose-900/40 rounded-3xl shadow-xl space-y-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/15 flex items-center justify-center text-rose-600 dark:text-rose-400 border border-rose-500/30">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
            <Lock className="w-3.5 h-3.5" />
            <span>Store Owner Authorization Required</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Access Restricted to Store Owner
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            You are currently signed in as <span className="font-semibold text-slate-900 dark:text-slate-200">{user?.full_name || 'Staff Cashier'}</span> ({user?.role || 'cashier'}). The Admin Console & Database Management Hub is strictly reserved for the Store Owner (Admin).
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/login?redirect=/admin"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-xs"
          >
            Switch to Store Owner (PIN: 9044)
          </Link>
          <Link
            href="/sell"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
          >
            Return to POS Register
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-[1400px]">
      {/* Executive Header Banner */}
      <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              Store Administration
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {hasCloud ? 'Supabase Connected' : 'Local Offline Mode'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Admin Console & Database Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Manage staff accounts, explore all 8 database tables, configure store parameters, and prepare for authentication.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => loadDashboardData()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/70 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
          <Link
            href="/sell"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-xs"
          >
            Go to POS Register
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800/80 pb-px overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-colors border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff & Users ({profiles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tables')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-colors border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'tables'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Table Explorer (8 Tables)</span>
        </button>

        <button
          onClick={() => setActiveTab('business')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-colors border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'business'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Store & Business Identity</span>
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold transition-colors border-b-2 cursor-pointer shrink-0 ${
            activeTab === 'system'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Architecture & Health</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: USERS & STAFF MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Auth Readiness Banner */}
          <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-50/60 via-purple-50/30 to-indigo-50/60 dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-indigo-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Lock className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>Pre-Auth & Multi-User Architecture</span>
                  <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                    Ready for Login Screen
                  </span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Staff profiles configured below can switch active shifts at the register. When you connect your login page, these accounts link directly to Supabase Auth credentials.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAddStaffOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Staff Member
            </button>
          </div>

          {/* Staff Table */}
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Staff Directory & Shift Roles
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Manage active cashiers, shift managers, and owner access
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {profiles.length} registered
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-[#090d16]/60 text-slate-600 dark:text-slate-400 font-semibold">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Access Role</th>
                    <th className="py-3 px-4">Contact Phone</th>
                    <th className="py-3 px-4">Register PIN</th>
                    <th className="py-3 px-4">Active Shift</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {profiles.map((staff) => {
                    const isActiveShift = staff.id === activeStaffId;
                    return (
                      <tr
                        key={staff.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300">
                              {staff.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {staff.full_name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">ID: {staff.id.slice(0, 8)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">{getRoleBadge(staff.role)}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-mono">
                          {staff.phone || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">••••</td>
                        <td className="py-3 px-4">
                          {isActiveShift ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Logged In at Counter
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSelectActiveStaff(staff)}
                              className="text-[11px] font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                            >
                              Switch to this shift
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {staff.role !== 'owner' && (
                            <button
                              onClick={() => handleDeleteStaff(staff.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Delete staff"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DATABASE TABLE EXPLORER */}
      {/* ========================================================================= */}
      {activeTab === 'tables' && (
        <div className="space-y-4">
          {/* Horizontal Table Switcher Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {TABLE_CONFIGS.map((t) => {
              const stat = tableStats.find((s) => s.name === t.name);
              const isSelected = activeTable === t.name;
              return (
                <button
                  key={t.name}
                  onClick={() => {
                    setActiveTable(t.name);
                    setSearchQuery('');
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1322] hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                      {t.name}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {stat?.rowCount ?? 0}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-1">
                    {t.label}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Table Viewer Card */}
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
            {/* Action Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                    {activeTable.replace('_', ' ')}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-slate-600 dark:text-slate-400">
                    {tableRows.length} records shown
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {TABLE_CONFIGS.find((t) => t.name === activeTable)?.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-60">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search ${activeTable}...`}
                    className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </form>

                <button
                  onClick={handleExportCSV}
                  disabled={tableRows.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shrink-0"
                  title="Export to CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  Export CSV
                </button>

                <button
                  onClick={() => setIsDeleteAllModalOpen(true)}
                  disabled={tableRows.length === 0 || isDeleting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-2xs"
                  title={`Delete all entries in ${activeTable}`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  <span>Delete All Entries</span>
                </button>
              </div>
            </div>

            {/* Table Grid */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              {tableRows.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs space-y-3">
                  <p>{isSearching ? 'Loading records...' : 'No records found in this table. Clean slate ready for real data.'}</p>
                  {activeTable === 'products' ? (
                    <Link
                      href="/products/new"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add First Real Product
                    </Link>
                  ) : null}
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50/95 dark:bg-[#090d16]/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      {Object.keys(tableRows[0]).slice(0, 7).map((col) => (
                        <th key={col} className="py-2.5 px-3 capitalize font-mono text-[11px]">
                          {col.replace('_', ' ')}
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                    {tableRows.map((row, idx) => (
                      <tr
                        key={row.id || idx}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                        {Object.keys(row).slice(0, 7).map((key) => {
                          const val = row[key];
                          let formattedVal = String(val ?? '—');
                          if (typeof val === 'boolean') {
                            formattedVal = val ? 'true' : 'false';
                          } else if (typeof val === 'object' && val !== null) {
                            formattedVal = JSON.stringify(val);
                          }
                          return (
                            <td
                              key={key}
                              className="py-2.5 px-3 text-slate-800 dark:text-slate-200 max-w-[180px] truncate"
                              title={formattedVal}
                            >
                              {key === 'is_active' ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    val
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {val ? 'active' : 'inactive'}
                                </span>
                              ) : key.includes('price') || key === 'total' || key === 'profit' ? (
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {typeof val === 'number' ? formatINR(val) : formattedVal}
                                </span>
                              ) : (
                                formattedVal
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              onClick={() => setInspectedRow(row)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer text-[10px]"
                              title="Inspect record JSON"
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </button>
                            <button
                              onClick={() => setDeletingRow(row)}
                              className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                              title="Delete this record"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: STORE & BUSINESS IDENTITY */}
      {/* ========================================================================= */}
      {activeTab === 'business' && business && (
        <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs max-w-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Store Business Profile
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Printed on receipts, invoices, and cloud database tenant records
              </p>
            </div>
            {businessSaved && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Saved & Synced!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveBusiness} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Store Legal Name
                </label>
                <input
                  type="text"
                  value={business.name}
                  onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={business.phone || ''}
                  onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Store Tagline / Branding Header
              </label>
              <input
                type="text"
                value={business.tagline || ''}
                onChange={(e) => setBusiness({ ...business, tagline: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Street Address
              </label>
              <input
                type="text"
                value={business.address || ''}
                onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={business.city || ''}
                  onChange={(e) => setBusiness({ ...business, city: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={business.state || ''}
                  onChange={(e) => setBusiness({ ...business, state: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Pincode
                </label>
                <input
                  type="text"
                  value={business.pincode || ''}
                  onChange={(e) => setBusiness({ ...business, pincode: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  GSTIN Tax Identifier
                </label>
                <input
                  type="text"
                  value={business.gstin || ''}
                  onChange={(e) => setBusiness({ ...business, gstin: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Currency Symbol
                </label>
                <input
                  type="text"
                  value={business.currency}
                  onChange={(e) => setBusiness({ ...business, currency: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                Save Business Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ARCHITECTURE & SYSTEM HEALTH */}
      {/* ========================================================================= */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Cloud Database Connectivity
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Database Engine</span>
                <span className="font-semibold text-slate-900 dark:text-white">PostgreSQL 15 (Supabase)</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Endpoint Host</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                  {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not Configured'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Tenant Business ID</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  b0000000-0000-0000-0000-000000000001
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-500 dark:text-slate-400">Offline Caching Layer</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  IndexedDB (kapda_ghar_db v2)
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Database Table Summary
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {tableStats.map((stat) => (
                <div
                  key={stat.name}
                  className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between"
                >
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 truncate">
                    {stat.name}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {stat.rowCount}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Database Maintenance Operations */}
          <div className="md:col-span-2 bg-white dark:bg-[#0d1322] border border-rose-200 dark:border-rose-900/40 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Database Maintenance & Reset Operations
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Useful when clearing test billing transactions or returning the store to default opening state.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 space-y-2">
                <div className="font-semibold text-xs text-rose-800 dark:text-rose-300">
                  Clean Slate for Real Store
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Wipes all demo products, categories, inventory, sales, and audit logs. Store Profile & Admin login (PIN 9044) stay safe.
                </p>
                <button
                  onClick={handleWipeAllForRealStore}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Wipe All Demo Data</span>
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-2">
                <div className="font-semibold text-xs text-slate-900 dark:text-white">
                  Clear Sales & Transactions Only
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Purges customer sales receipts, sale items snapshot records, and inventory audit logs. Product catalog & categories stay intact.
                </p>
                <button
                  onClick={handleClearTransactions}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Wipe All Sales & Invoices</span>
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-2">
                <div className="font-semibold text-xs text-slate-900 dark:text-white">
                  Restore Demo Catalog
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Optional: reloads default sample catalog (Clothes, Purses, Footwear, Accessories) with test inventory.
                </p>
                <button
                  onClick={handleResetDefaults}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Load Sample Demo Stock</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD STAFF MEMBER */}
      {/* ========================================================================= */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                Add New Staff Account
              </h3>
              <button
                onClick={() => setIsAddStaffOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Staff Member Full Name
                </label>
                <input
                  type="text"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Access Role
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="cashier">POS Cashier (Sales, receipts & inventory viewing)</option>
                  <option value="manager">Shift Manager (Catalog updates, stock adjustments & sales)</option>
                  <option value="owner">Store Owner (Full administrative access)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mobile / Contact Number
                </label>
                <input
                  type="text"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  placeholder="+91 98765 00000"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fast Counter PIN Code (4 Digits)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={newStaffPin}
                  onChange={(e) => setNewStaffPin(e.target.value)}
                  placeholder="1234"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono text-center tracking-widest text-sm"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-xs cursor-pointer"
                >
                  Save Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RAW JSON RECORD INSPECTOR */}
      {/* ========================================================================= */}
      {inspectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Record Details ({activeTable})
                </h3>
              </div>
              <button
                onClick={() => setInspectedRow(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(inspectedRow).map(([key, val]) => (
                  <div key={key} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
                    <span className="text-[10px] text-slate-400 font-sans uppercase font-bold tracking-wider block mb-0.5">
                      {key}
                    </span>
                    <span className="text-slate-900 dark:text-slate-100 break-all">
                      {val === null || val === undefined ? (
                        <em className="text-slate-400">null</em>
                      ) : typeof val === 'object' ? (
                        JSON.stringify(val, null, 2)
                      ) : (
                        String(val)
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <span className="text-[10px] text-slate-400 font-sans uppercase font-bold tracking-wider block mb-1">
                  Full Raw JSON Payload
                </span>
                <pre className="p-3 bg-slate-950 text-slate-300 rounded-xl overflow-x-auto text-[11px] leading-relaxed">
                  {JSON.stringify(inspectedRow, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setInspectedRow(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM DELETE ALL TABLE ENTRIES */}
      {/* ========================================================================= */}
      {isDeleteAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delete All Entries in &quot;{activeTable.replace('_', ' ')}&quot;?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This action will permanently delete all{' '}
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    {tableRows.length} records
                  </span>{' '}
                  from the table <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px]">{activeTable}</code> across local storage and cloud database.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Permanent Deletion Notice</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-300/90">
                {activeTable === 'sales' && 'Deleting all sales will also delete all corresponding sale_items to prevent orphan receipt records.'}
                {activeTable === 'sale_items' && 'All item line item snapshots for receipts will be cleared.'}
                {activeTable === 'products' && 'Deleting all products will also reset current inventory stock records.'}
                {activeTable === 'profiles' && 'The default Admin profile will be kept intact so you do not lose login access.'}
                {activeTable === 'inventory_movements' && 'All historical stock adjustment audit entries will be purged.'}
                {activeTable === 'categories' && 'All category taxonomy classifications will be cleared.'}
                {activeTable === 'inventory' && 'All stock count records will be cleared.'}
                {activeTable === 'businesses' && 'Store business parameters will remain initialized with default configuration.'}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDeleteAllModalOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAllEntries}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isDeleting ? 'animate-spin' : ''}`} />
                <span>{isDeleting ? 'Deleting...' : `Yes, Delete All (${tableRows.length})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM DELETE SINGLE ROW */}
      {/* ========================================================================= */}
      {deletingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Delete Record?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Delete entry from <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{activeTable}</span>
                  {deletingRow.name ? ` (${deletingRow.name})` : deletingRow.product_name ? ` (${deletingRow.product_name})` : deletingRow.receipt_number ? ` (Receipt #${deletingRow.receipt_number})` : ''}?
                </p>
                <p className="text-[10px] text-slate-400 font-mono truncate max-w-[240px]">
                  ID: {deletingRow.id}
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingRow(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSingleRow}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Notice Toast */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-2xl border border-slate-800 dark:border-slate-200 animate-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
          <button
            onClick={() => setActionNotice(null)}
            className="ml-2 text-slate-400 hover:text-white dark:hover:text-slate-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
