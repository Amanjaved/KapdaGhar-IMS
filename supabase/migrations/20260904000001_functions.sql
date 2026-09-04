-- ==============================================================================
-- Kapda Ghar - Atomic Transaction Functions and Stored Procedures
-- ==============================================================================

-- 1. Helper function to generate human-readable receipt number
-- Example: KG-20260904-0001
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
    v_date TEXT;
    v_seq BIGINT;
BEGIN
    v_date := TO_CHAR(NOW(), 'YYYYMMDD');
    v_seq := NEXTVAL('receipt_seq');
    RETURN 'KG-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. Atomic POS Sale Transaction: complete_sale()
-- Performs validation, inventory row-locking (FOR UPDATE), stock deduction,
-- movement recording, snapshot pricing, and profit calculation in a single transaction.
CREATE OR REPLACE FUNCTION complete_sale(
    p_items JSONB,
    p_discount NUMERIC DEFAULT 0,
    p_payment_method TEXT DEFAULT 'cash',
    p_client_transaction_id UUID DEFAULT NULL,
    p_receipt_number TEXT DEFAULT NULL,
    p_business_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_sale_id UUID;
    v_receipt_number TEXT;
    v_item RECORD;
    v_product RECORD;
    v_current_stock INTEGER;
    v_new_stock INTEGER;
    v_item_subtotal NUMERIC(12,2);
    v_item_cost NUMERIC(12,2);
    v_item_profit NUMERIC(12,2);
    v_subtotal NUMERIC(12,2) := 0;
    v_total_cost NUMERIC(12,2) := 0;
    v_total NUMERIC(12,2) := 0;
    v_total_profit NUMERIC(12,2) := 0;
    v_result JSONB;
    v_existing_sale RECORD;
BEGIN
    -- Step 1: Idempotency Check
    -- If client_transaction_id already exists, return the existing sale immediately
    IF p_client_transaction_id IS NOT NULL THEN
        SELECT id, receipt_number, total, total_profit, created_at, status
        INTO v_existing_sale
        FROM sales
        WHERE client_transaction_id = p_client_transaction_id;

        IF FOUND THEN
            SELECT jsonb_build_object(
                'success', true,
                'is_duplicate', true,
                'sale_id', v_existing_sale.id,
                'receipt_number', v_existing_sale.receipt_number,
                'total', v_existing_sale.total,
                'profit', v_existing_sale.total_profit,
                'created_at', v_existing_sale.created_at,
                'message', 'Sale already processed previously'
            ) INTO v_result;
            RETURN v_result;
        END IF;
    END IF;

    -- Validate items array
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Sale cannot be completed without items';
    END IF;

    -- Validate payment method
    IF p_payment_method NOT IN ('cash', 'upi', 'card', 'mixed') THEN
        RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
    END IF;

    -- Determine receipt number
    IF p_receipt_number IS NOT NULL AND p_receipt_number != '' THEN
        v_receipt_number := p_receipt_number;
    ELSE
        v_receipt_number := generate_receipt_number();
    END IF;

    -- Create initial sale record
    INSERT INTO sales (
        business_id,
        client_transaction_id,
        receipt_number,
        subtotal,
        discount,
        total,
        total_cost,
        total_profit,
        payment_method,
        status,
        notes
    ) VALUES (
        p_business_id,
        p_client_transaction_id,
        v_receipt_number,
        0,
        COALESCE(p_discount, 0),
        0,
        0,
        0,
        p_payment_method,
        'completed',
        p_notes
    ) RETURNING id INTO v_sale_id;

    -- Step 2: Loop over every item, lock stock row, validate and deduct
    FOR v_item IN
        SELECT 
            (item->>'product_id')::UUID AS product_id,
            (item->>'quantity')::INTEGER AS quantity
        FROM jsonb_array_elements(p_items) AS item
    LOOP
        IF v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'Quantity must be greater than zero for product %', v_item.product_id;
        END IF;

        -- Fetch product details
        SELECT id, name, purchase_price, selling_price, is_active, business_id
        INTO v_product
        FROM products
        WHERE id = v_item.product_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product with ID % not found', v_item.product_id;
        END IF;

        IF NOT v_product.is_active THEN
            RAISE EXCEPTION 'Product % is inactive and cannot be sold', v_product.name;
        END IF;

        -- ROW LOCKING: SELECT FOR UPDATE on inventory row to prevent race conditions
        SELECT quantity
        INTO v_current_stock
        FROM inventory
        WHERE product_id = v_item.product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'No inventory record found for product %', v_product.name;
        END IF;

        -- Stock availability check
        IF v_current_stock < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product "%": Available %, Requested %',
                v_product.name, v_current_stock, v_item.quantity;
        END IF;

        v_new_stock := v_current_stock - v_item.quantity;

        -- Calculations for this item
        v_item_subtotal := v_product.selling_price * v_item.quantity;
        v_item_cost := v_product.purchase_price * v_item.quantity;
        v_item_profit := (v_product.selling_price - v_product.purchase_price) * v_item.quantity;

        v_subtotal := v_subtotal + v_item_subtotal;
        v_total_cost := v_total_cost + v_item_cost;

        -- Deduct inventory
        UPDATE inventory
        SET quantity = v_new_stock,
            updated_at = NOW()
        WHERE product_id = v_item.product_id;

        -- Record inventory movement audit
        INSERT INTO inventory_movements (
            business_id,
            product_id,
            movement_type,
            quantity_change,
            quantity_before,
            quantity_after,
            reference_id,
            notes
        ) VALUES (
            p_business_id,
            v_item.product_id,
            'sale',
            -v_item.quantity,
            v_current_stock,
            v_new_stock,
            v_sale_id,
            'Sold in receipt #' || v_receipt_number
        );

        -- Record sale item with historical price snapshot
        INSERT INTO sale_items (
            sale_id,
            product_id,
            product_name,
            quantity,
            selling_price,
            purchase_price,
            subtotal,
            profit
        ) VALUES (
            v_sale_id,
            v_item.product_id,
            v_product.name,
            v_item.quantity,
            v_product.selling_price,
            v_product.purchase_price,
            v_item_subtotal,
            v_item_profit
        );
    END LOOP;

    -- Calculate total and net profit
    v_total := GREATEST(v_subtotal - COALESCE(p_discount, 0), 0);
    v_total_profit := v_total - v_total_cost;

    -- Update final sale totals
    UPDATE sales
    SET subtotal = v_subtotal,
        discount = COALESCE(p_discount, 0),
        total = v_total,
        total_cost = v_total_cost,
        total_profit = v_total_profit
    WHERE id = v_sale_id;

    -- Return JSON payload
    SELECT jsonb_build_object(
        'success', true,
        'sale_id', v_sale_id,
        'receipt_number', v_receipt_number,
        'subtotal', v_subtotal,
        'discount', COALESCE(p_discount, 0),
        'total', v_total,
        'total_cost', v_total_cost,
        'total_profit', v_total_profit,
        'payment_method', p_payment_method,
        'created_at', NOW()
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- 3. Inventory Adjustment Function: adjust_inventory()
CREATE OR REPLACE FUNCTION adjust_inventory(
    p_product_id UUID,
    p_quantity_change INTEGER,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL,
    p_business_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_stock INTEGER;
    v_new_stock INTEGER;
    v_movement_type TEXT;
BEGIN
    -- Determine movement type
    IF p_quantity_change > 0 THEN
        IF LOWER(p_reason) LIKE '%purchase%' THEN
            v_movement_type := 'purchase';
        ELSIF LOWER(p_reason) LIKE '%return%' THEN
            v_movement_type := 'return';
        ELSE
            v_movement_type := 'adjustment';
        END IF;
    ELSE
        IF LOWER(p_reason) LIKE '%damage%' THEN
            v_movement_type := 'damage';
        ELSE
            v_movement_type := 'adjustment';
        END IF;
    END IF;

    -- Lock inventory row
    SELECT quantity INTO v_current_stock
    FROM inventory
    WHERE product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory row not found for product %', p_product_id;
    END IF;

    v_new_stock := v_current_stock + p_quantity_change;

    IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'Stock adjustment would cause negative inventory. Current: %, Change: %',
            v_current_stock, p_quantity_change;
    END IF;

    UPDATE inventory
    SET quantity = v_new_stock,
        updated_at = NOW()
    WHERE product_id = p_product_id;

    INSERT INTO inventory_movements (
        business_id,
        product_id,
        movement_type,
        quantity_change,
        quantity_before,
        quantity_after,
        notes
    ) VALUES (
        p_business_id,
        p_product_id,
        v_movement_type,
        p_quantity_change,
        v_current_stock,
        v_new_stock,
        p_reason || COALESCE(' - ' || p_notes, '')
    );

    RETURN jsonb_build_object(
        'success', true,
        'product_id', p_product_id,
        'previous_stock', v_current_stock,
        'new_stock', v_new_stock,
        'quantity_change', p_quantity_change
    );
END;
$$ LANGUAGE plpgsql;

-- 4. High-Performance Dashboard Aggregate: get_dashboard_stats()
CREATE OR REPLACE FUNCTION get_dashboard_stats(
    p_business_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_today_sales NUMERIC(12,2) := 0;
    v_today_profit NUMERIC(12,2) := 0;
    v_today_cost NUMERIC(12,2) := 0;
    v_today_items_sold BIGINT := 0;
    v_today_transactions BIGINT := 0;
    v_low_stock_count BIGINT := 0;
    v_month_sales NUMERIC(12,2) := 0;
    v_month_profit NUMERIC(12,2) := 0;
BEGIN
    -- Today's sales metrics (Indian Standard Time or UTC boundary)
    SELECT 
        COALESCE(SUM(total), 0),
        COALESCE(SUM(total_profit), 0),
        COALESCE(SUM(total_cost), 0),
        COUNT(*)
    INTO
        v_today_sales,
        v_today_profit,
        v_today_cost,
        v_today_transactions
    FROM sales
    WHERE DATE(created_at AT TIME ZONE 'Asia/Kolkata') = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')
      AND status = 'completed'
      AND (p_business_id IS NULL OR business_id = p_business_id);

    -- Today's items sold
    SELECT COALESCE(SUM(si.quantity), 0)
    INTO v_today_items_sold
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE DATE(s.created_at AT TIME ZONE 'Asia/Kolkata') = DATE(NOW() AT TIME ZONE 'Asia/Kolkata')
      AND s.status = 'completed'
      AND (p_business_id IS NULL OR s.business_id = p_business_id);

    -- Month's sales and profit
    SELECT 
        COALESCE(SUM(total), 0),
        COALESCE(SUM(total_profit), 0)
    INTO
        v_month_sales,
        v_month_profit
    FROM sales
    WHERE DATE_TRUNC('month', created_at AT TIME ZONE 'Asia/Kolkata') = DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kolkata')
      AND status = 'completed'
      AND (p_business_id IS NULL OR business_id = p_business_id);

    -- Low stock items count
    SELECT COUNT(*)
    INTO v_low_stock_count
    FROM products p
    JOIN inventory i ON i.product_id = p.id
    WHERE p.is_active = TRUE
      AND i.quantity <= p.low_stock_threshold
      AND (p_business_id IS NULL OR p.business_id = p_business_id);

    RETURN jsonb_build_object(
        'today_sales', v_today_sales,
        'today_profit', v_today_profit,
        'today_cost', v_today_cost,
        'items_sold', v_today_items_sold,
        'transactions', v_today_transactions,
        'low_stock_count', v_low_stock_count,
        'month_sales', v_month_sales,
        'month_profit', v_month_profit
    );
END;
$$ LANGUAGE plpgsql;
