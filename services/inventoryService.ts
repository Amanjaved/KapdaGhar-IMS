import { getDB } from '@/lib/indexeddb/db';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { generateUUID } from '@/lib/utils/uuid';
import { InventoryMovement, MovementType } from '@/types';
import { productService } from './productService';
import { broadcastLocalChange } from '@/lib/supabase/realtime';

const DEFAULT_BUSINESS_ID = process.env.NEXT_PUBLIC_BUSINESS_ID || 'b0000000-0000-0000-0000-000000000001';

export const inventoryService = {
  async adjustStock(
    productId: string,
    quantityChange: number,
    reason: string,
    notes?: string
  ): Promise<{ success: boolean; newQuantity: number; error?: string }> {
    const db = await getDB();
    if (!db) {
      return { success: false, newQuantity: 0, error: 'Local database not accessible' };
    }

    const tx = db.transaction(['products', 'inventory', 'inventory_movements'], 'readwrite');
    const product = await tx.objectStore('products').get(productId);
    const inv = await tx.objectStore('inventory').index('by-product').get(productId);

    if (!product || !inv) {
      await tx.done;
      return { success: false, newQuantity: 0, error: 'Product or inventory record not found' };
    }

    const currentQty = inv.quantity;
    const newQty = currentQty + quantityChange;

    // Strict non-negative inventory constraint
    if (newQty < 0) {
      await tx.done;
      return {
        success: false,
        newQuantity: currentQty,
        error: `Insufficient stock. Cannot reduce ${Math.abs(quantityChange)} units. Only ${currentQty} available.`,
      };
    }

    // Determine movement type
    let movementType: MovementType = 'adjustment';
    const lowerReason = reason.toLowerCase();
    if (quantityChange > 0) {
      if (lowerReason.includes('purchase')) movementType = 'purchase';
      else if (lowerReason.includes('return')) movementType = 'return';
    } else {
      if (lowerReason.includes('damage')) movementType = 'damage';
    }

    // Update local inventory
    inv.quantity = newQty;
    inv.updated_at = new Date().toISOString();
    await tx.objectStore('inventory').put(inv);

    // Record audit movement
    const movement: InventoryMovement = {
      id: generateUUID(),
      product_id: productId,
      product_name: product.name,
      movement_type: movementType,
      quantity_change: quantityChange,
      quantity_before: currentQty,
      quantity_after: newQty,
      notes: `${reason}${notes ? ` - ${notes}` : ''}`,
      created_at: new Date().toISOString(),
    };
    await tx.objectStore('inventory_movements').put(movement);
    await tx.done;

    // Immediately update in-memory product cache for 0ms UI lag
    productService.updateLocalProductStock(productId, newQty);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('catalog-refreshed'));
    }
    broadcastLocalChange('STOCK_UPDATED', { productId, newQuantity: newQty });

    // Sync to Supabase in background (DO NOT BLOCK UI)
    if (isSupabaseConfigured() && typeof navigator !== 'undefined' && navigator.onLine) {
      (async () => {
        try {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { error: rpcErr } = await supabase.rpc('adjust_inventory', {
              p_product_id: productId,
              p_quantity_change: quantityChange,
              p_reason: reason,
              p_notes: notes || null,
              p_business_id: DEFAULT_BUSINESS_ID,
            });

            if (rpcErr) {
              await supabase.from('inventory').upsert(
                {
                  business_id: DEFAULT_BUSINESS_ID,
                  product_id: productId,
                  quantity: newQty,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'product_id' }
              );

              await supabase.from('inventory_movements').insert({
                business_id: DEFAULT_BUSINESS_ID,
                product_id: productId,
                movement_type: movementType,
                quantity_change: quantityChange,
                quantity_before: currentQty,
                quantity_after: newQty,
                notes: `${reason}${notes ? ` - ${notes}` : ''}`,
              });
            }
          }
        } catch (err) {
          console.warn('Inventory adjusted locally; Supabase adjustment deferred:', err);
        }
      })();
    }

    return { success: true, newQuantity: newQty };
  },

  async getMovements(productId?: string): Promise<InventoryMovement[]> {
    const db = await getDB();
    if (!db) return [];

    let movements: InventoryMovement[] = [];
    if (productId) {
      movements = await db.getAllFromIndex('inventory_movements', 'by-product', productId);
    } else {
      movements = await db.getAll('inventory_movements');
    }

    return movements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },
};
