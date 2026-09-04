# Kapda Ghar (कपड़ा घर) 🛍️
### Production-Grade Inventory Management & Mobile POS Progressive Web App (PWA)

Kapda Ghar is a mobile-first retail management system engineered specifically for small retail shops in India selling **clothes, ladies' purses, and footwear**. Built with extreme focus on speed, touch ergonomics, offline reliability, thermal receipt printing, camera-based product entry, and atomic inventory integrity.

---

## 🌟 Key Features

1. **Mobile-First POS ("Scan & Sell")**:
   - Ultra-fast product search (<100ms) by name, SKU, or barcode.
   - Built-in camera barcode scanning and quick category chips.
   - Large 48–56px thumb-friendly quantity steppers `[-] 2 [+]`.
   - Native thermal printer (80mm) and standard A4 receipt printing with `@media print`.
   - Direct WhatsApp receipt sharing via native Web Share API / WhatsApp intent.

2. **Atomic Inventory & Financial Integrity**:
   - PostgreSQL Stored Procedure `complete_sale()` executes validation, inventory row-locking (`SELECT ... FOR UPDATE`), price snapshotting, and stock deduction in one atomic transaction.
   - Preserves historical purchase price in `sale_items` so future price edits never corrupt past profit calculations.
   - Strict database constraints (`CHECK (quantity >= 0)`) guarantee stock never goes negative.
   - Comprehensive audit trail in `inventory_movements` for every sale, purchase, damage, or adjustment.

3. **Offline-First Resilience**:
   - Embedded IndexedDB catalog and sales queue.
   - Works seamlessly during internet outages in busy market basements.
   - Automatic background synchronization when network reconnects.
   - Unique `client_transaction_id` UUID idempotency prevents duplicate billing upon reconnection.

4. **Camera-Based Product Entry**:
   - Instant camera photo capture (`<input capture="environment">`).
   - Client-side Canvas WebP image compression (<300KB, max 1200px) before upload.
   - Step-based rapid flow with "Save & Add Another" for bulk stock onboarding.

5. **Action-Oriented Dashboard & Business Reports**:
   - Instant overview of Today's Sales (₹), Profit (₹), Items Sold, and Low Stock Alerts.
   - Date-filtered sales ledger (Today, Yesterday, This Week, This Month).
   - High-contrast visual indicators tailored for busy shop counters.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router), React, TypeScript | Fast SSR/CSR, SEO, strict type safety |
| **Styling** | Tailwind CSS, Lucide Icons | Retail-optimized warm UI, touch targets >44px |
| **PWA & Offline** | Service Worker, Web App Manifest, IndexedDB (`idb`) | Offline caching, pending queue, installability |
| **Backend & DB** | Supabase (PostgreSQL 15+, Auth, Storage) | Relational integrity, row locking, RLS, WebP storage |
| **Transactions** | PL/pgSQL RPC Functions | `complete_sale()` and `adjust_inventory()` |
| **Testing** | Vitest | Concurrency, negative stock, discount & profit tests |

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm or pnpm
- (Optional) Supabase account for cloud database & storage

### 2. Environment Setup
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BUSINESS_ID=b0000000-0000-0000-0000-000000000001
```

> **Note**: If Supabase credentials are left empty, Kapda Ghar automatically activates **Local Offline/Demo Mode** with IndexedDB, allowing complete testing of POS, cart, camera upload, receipts, and stock management immediately!

### 3. Database Migration (Supabase Cloud)
Run the SQL scripts in order via the Supabase SQL Editor:
1. `supabase/migrations/20260904000000_schema.sql` (Tables, constraints, indexes)
2. `supabase/migrations/20260904000001_functions.sql` (Atomic `complete_sale()`, `get_dashboard_stats()`)
3. `supabase/migrations/20260904000002_rls.sql` (Row-Level Security & Storage Bucket)
4. `supabase/seed.sql` (Seed categories, retail products & inventory)

### 4. Running Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) on your mobile browser or desktop.

---

## 🧪 Testing

Run automated tests covering financial math, negative stock constraints, and simulated concurrency:
```bash
npm run test
```
