-- ==============================================================================
-- Kapda Ghar - Customer Khata & Udhar (Credit Book) Schema
-- ==============================================================================

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    notes TEXT,
    total_due NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT total_due_non_negative CHECK (total_due >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique
ON customers (phone, COALESCE(business_id, '00000000-0000-0000-0000-000000000000'::UUID));

CREATE INDEX IF NOT EXISTS customers_name_idx ON customers(name);
CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers(phone);
CREATE INDEX IF NOT EXISTS customers_total_due_idx ON customers(total_due);

-- 2. Customer Transactions (Khata Ledger) Table
CREATE TABLE IF NOT EXISTS customer_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'payment')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT CHECK (payment_method IN ('cash', 'upi', 'card', 'bank', 'other')),
    receipt_number TEXT,
    notes TEXT,
    balance_after NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS customer_transactions_customer_idx ON customer_transactions(customer_id);
CREATE INDEX IF NOT EXISTS customer_transactions_created_idx ON customer_transactions(created_at);
CREATE INDEX IF NOT EXISTS customer_transactions_sale_idx ON customer_transactions(sale_id);

-- 3. Update Sales table constraints to allow 'udhar' as valid payment method
ALTER TABLE sales DROP CONSTRAINT IF EXISTS valid_payment_method;
ALTER TABLE sales ADD CONSTRAINT valid_payment_method CHECK (payment_method IN ('cash', 'upi', 'card', 'mixed', 'udhar'));

-- 4. Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_transactions ENABLE ROW LEVEL SECURITY;

-- Allow public / anon access for single-business store operations
CREATE POLICY "Allow public all access on customers"
ON customers FOR ALL
TO public
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public all access on customer_transactions"
ON customer_transactions FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Enable Supabase Realtime replication on customers and customer_transactions
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE customer_transactions;
