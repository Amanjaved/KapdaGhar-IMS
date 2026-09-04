-- ==============================================================================
-- Kapda Ghar - Row Level Security (RLS) and Storage Policies
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's business_id
CREATE OR REPLACE FUNCTION get_user_business_id()
RETURNS UUID AS $$
    SELECT business_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1. Profiles Policies
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- 2. Businesses Policies
CREATE POLICY "Users can view their business"
ON businesses FOR SELECT
USING (id = get_user_business_id());

CREATE POLICY "Owners can update their business"
ON businesses FOR UPDATE
USING (id = get_user_business_id());

-- 3. Categories Policies
CREATE POLICY "Users can view business categories"
ON categories FOR SELECT
USING (business_id IS NULL OR business_id = get_user_business_id());

CREATE POLICY "Users can manage business categories"
ON categories FOR ALL
USING (business_id IS NULL OR business_id = get_user_business_id())
WITH CHECK (business_id IS NULL OR business_id = get_user_business_id());

-- 4. Products Policies
CREATE POLICY "Users can view business products"
ON products FOR SELECT
USING (business_id IS NULL OR business_id = get_user_business_id());

CREATE POLICY "Users can manage business products"
ON products FOR ALL
USING (business_id IS NULL OR business_id = get_user_business_id())
WITH CHECK (business_id IS NULL OR business_id = get_user_business_id());

-- 5. Inventory Policies
CREATE POLICY "Users can view business inventory"
ON inventory FOR SELECT
USING (business_id IS NULL OR business_id = get_user_business_id());

CREATE POLICY "Users can manage business inventory"
ON inventory FOR ALL
USING (business_id IS NULL OR business_id = get_user_business_id())
WITH CHECK (business_id IS NULL OR business_id = get_user_business_id());

-- 6. Sales Policies
CREATE POLICY "Users can view business sales"
ON sales FOR SELECT
USING (business_id IS NULL OR business_id = get_user_business_id());

CREATE POLICY "Users can insert business sales"
ON sales FOR INSERT
WITH CHECK (business_id IS NULL OR business_id = get_user_business_id());

-- 7. Sale Items Policies
CREATE POLICY "Users can view business sale items"
ON sale_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM sales s
        WHERE s.id = sale_items.sale_id
        AND (s.business_id IS NULL OR s.business_id = get_user_business_id())
    )
);

CREATE POLICY "Users can insert business sale items"
ON sale_items FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sales s
        WHERE s.id = sale_items.sale_id
        AND (s.business_id IS NULL OR s.business_id = get_user_business_id())
    )
);

-- 8. Inventory Movements Policies
CREATE POLICY "Users can view business inventory movements"
ON inventory_movements FOR SELECT
USING (business_id IS NULL OR business_id = get_user_business_id());

CREATE POLICY "Users can insert business inventory movements"
ON inventory_movements FOR INSERT
WITH CHECK (business_id IS NULL OR business_id = get_user_business_id());

-- 9. Supabase Storage Bucket & Policies for product-images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Read Product Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated Users Can Upload Product Images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated Users Can Update Product Images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
);
