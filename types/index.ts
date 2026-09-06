export type PaymentMethod = 'cash' | 'upi' | 'card' | 'mixed' | 'udhar';
export type SaleStatus = 'completed' | 'cancelled' | 'refunded';
export type MovementType = 'purchase' | 'sale' | 'return' | 'adjustment' | 'damage';

export interface Business {
  id: string;
  name: string;
  tagline?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  currency: string;
  created_at: string;
}

export interface Category {
  id: string;
  business_id?: string;
  name: string;
  description?: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  business_id?: string;
  category_id: string;
  category_name?: string;
  name: string;
  sku?: string;
  barcode?: string;
  description?: string;
  image_url?: string;
  purchase_price: number;
  selling_price: number;
  low_stock_threshold: number;
  is_active: boolean;
  quantity?: number; // joined from inventory
  created_at: string;
  updated_at: string;
}

export interface Inventory {
  id: string;
  business_id?: string;
  product_id: string;
  quantity: number;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  business_id?: string;
  product_id: string;
  product_name?: string;
  movement_type: MovementType;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reference_id?: string;
  notes?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id?: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  total_due: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerTransaction {
  id: string;
  business_id?: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  sale_id?: string;
  type: 'credit' | 'payment';
  amount: number;
  payment_method?: 'cash' | 'upi' | 'card' | 'bank' | 'other';
  receipt_number?: string;
  notes?: string;
  balance_after: number;
  created_at: string;
}

export interface Sale {
  id: string;
  business_id?: string;
  client_transaction_id?: string;
  receipt_number: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  total_cost: number;
  total_profit: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  notes?: string;
  created_at: string;
  items?: SaleItem[];
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  paid_amount?: number;
  balance_due?: number;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  selling_price: number;
  purchase_price: number;
  subtotal: number;
  profit: number;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selling_price: number;
  purchase_price: number;
}

export interface DashboardStats {
  today_sales: number;
  today_profit: number;
  today_cost: number;
  items_sold: number;
  transactions: number;
  low_stock_count: number;
  month_sales: number;
  month_profit: number;
}

export interface PendingSale {
  client_transaction_id: string;
  receipt_number: string;
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    selling_price: number;
    purchase_price: number;
  }[];
  subtotal: number;
  discount: number;
  total: number;
  total_cost: number;
  total_profit: number;
  payment_method: PaymentMethod;
  notes?: string;
  created_at: string;
  synced: boolean;
  sync_error?: string;
}

export type UserRole = 'owner' | 'manager' | 'cashier';

export interface UserProfile {
  id: string;
  business_id?: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  pin_code?: string;
  is_active?: boolean;
  created_at: string;
  updated_at?: string;
}

export type DatabaseTableName = 
  | 'products'
  | 'categories'
  | 'inventory'
  | 'sales'
  | 'sale_items'
  | 'inventory_movements'
  | 'businesses'
  | 'profiles';

export interface TableMetadata {
  name: DatabaseTableName;
  label: string;
  description: string;
  rowCount: number;
}

export interface SecuritySettings {
  session_timeout_minutes: number; // Maximum session duration (e.g. 240 min = 4 hours)
  idle_timeout_minutes: number; // Inactivity auto-lock (e.g. 15 min, 0 = disabled)
  require_pin_on_close: boolean; // Require PIN every time the app/browser is opened
  max_failed_attempts: number; // Lockout threshold (default 5)
  lockout_duration_seconds: number; // Lockout duration (default 60s)
}

export interface AuthSession {
  user: UserProfile;
  loginTime: number;
  lastActiveTime: number;
  expiresAt: number;
  sessionToken: string;
}

