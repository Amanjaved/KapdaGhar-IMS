-- ==============================================================================
-- Kapda Ghar - Seed Data
-- ==============================================================================

-- 1. Create Default Business
INSERT INTO businesses (id, name, tagline, phone, city, state)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'Kapda Ghar',
    'फैशन और स्टाइल का संगम • Clothes, Purses & Footwear',
    '+91 98765 43210',
    'New Delhi',
    'Delhi'
) ON CONFLICT (id) DO NOTHING;

-- 2. Seed Categories
INSERT INTO categories (id, business_id, name, description, is_active)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Clothes', 'Kurtis, Suits, Sarees & Ethnic Wear', true),
    ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Ladies Purses', 'Handbags, Clutches, Shoulder Bags & Wallets', true),
    ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Footwear', 'Sandals, Heels, Slippers, Flats & Mojaris', true),
    ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'Accessories', 'Dupattas, Belts, Scarves & Jewellery', true)
ON CONFLICT DO NOTHING;

-- 3. Seed Products
INSERT INTO products (id, business_id, category_id, name, sku, barcode, purchase_price, selling_price, low_stock_threshold, is_active, description)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Blue Cotton Kurti', 'KG-CL-001', '8901001001', 350.00, 699.00, 5, true, 'Comfortable pure cotton daily wear kurti with hand embroidery'),
    ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Embroidered Anarkali Suit', 'KG-CL-002', '8901001002', 850.00, 1699.00, 5, true, 'Festive royal anarkali suit set with heavy dupatta'),
    ('a0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Black Ladies Handbag', 'KG-PR-001', '8901002001', 450.00, 999.00, 5, true, 'Premium faux leather handbag with zip compartments'),
    ('a0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Golden Party Clutch', 'KG-PR-002', '8901002002', 250.00, 549.00, 5, true, 'Glittery party wear clutch with detachable sling chain'),
    ('a0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Black Casual Sandal', 'KG-FW-001', '8901003001', 300.00, 650.00, 5, true, 'Comfortable cushioned flat casual sandal for ladies'),
    ('a0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Ethnic Mojari Footwear', 'KG-FW-002', '8901003002', 280.00, 599.00, 5, true, 'Traditional handcrafted Rajasthani jutti / mojari'),
    ('a0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'Banarasi Silk Dupatta', 'KG-AC-001', '8901004001', 200.00, 499.00, 5, true, 'Rich zari woven Banarasi art silk dupatta with tassels')
ON CONFLICT DO NOTHING;

-- 4. Seed Inventory Records
INSERT INTO inventory (business_id, product_id, quantity)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 15),
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 8),
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 6),
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 10),
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 12),
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 2), -- Low Stock Alert!
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', 20)
ON CONFLICT (product_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- 5. Seed Initial Inventory Movements (Opening Stock)
INSERT INTO inventory_movements (business_id, product_id, movement_type, quantity_change, quantity_before, quantity_after, notes)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'purchase', 15, 0, 15, 'Opening Stock setup'),
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'purchase', 8, 0, 8, 'Opening Stock setup'),
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'purchase', 6, 0, 6, 'Opening Stock setup'),
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'purchase', 10, 0, 10, 'Opening Stock setup'),
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'purchase', 12, 0, 12, 'Opening Stock setup'),
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'purchase', 2, 0, 2, 'Opening Stock setup'),
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000007', 'purchase', 20, 0, 20, 'Opening Stock setup');
