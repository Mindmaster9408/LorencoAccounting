/**
 * ============================================================================
 * POS Inventory Routes - Checkout Charlie Module
 * ============================================================================
 */

const express = require('express');
const { supabase } = require('../../../config/database');
const { authenticateToken, requireCompany, requirePermission } = require('../../../middleware/auth');
const { auditFromReq } = require('../../../middleware/audit');

const router = express.Router();

router.use(authenticateToken);
router.use(requireCompany);

/**
 * GET /api/pos/inventory
 * Get stock levels for all products
 */
router.get('/', requirePermission('INVENTORY.VIEW'), async (req, res) => {
  try {
    const { low_stock } = req.query;

    let query = supabase
      .from('products')
      .select('id, name, barcode, sku, stock_quantity, reorder_level, cost_price, selling_price, category_id, categories(name)')
      .eq('company_id', req.companyId)
      .eq('is_active', true)
      .order('name');

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    let products = data || [];
    if (low_stock === 'true') {
      products = products.filter(p => p.stock_quantity <= p.reorder_level);
    }

    res.json({ inventory: products });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/pos/inventory/adjust
 * Manual stock adjustment
 */
router.post('/adjust', requirePermission('INVENTORY.ADJUST'), async (req, res) => {
  try {
    const { product_id, quantity_change, reason, notes } = req.body;

    if (!product_id || quantity_change === undefined) {
      return res.status(400).json({ error: 'product_id and quantity_change are required' });
    }

    // Get current stock
    const { data: product } = await supabase
      .from('products')
      .select('stock_quantity, name')
      .eq('id', product_id)
      .eq('company_id', req.companyId)
      .single();

    if (!product) return res.status(404).json({ error: 'Product not found' });

    const oldQty = product.stock_quantity;
    const newQty = oldQty + quantity_change;

    // Update stock
    await supabase
      .from('products')
      .update({ stock_quantity: Math.max(0, newQty) })
      .eq('id', product_id)
      .eq('company_id', req.companyId);

    // Record adjustment
    const { data: adj, error } = await supabase
      .from('inventory_adjustments')
      .insert({
        company_id: req.companyId,
        product_id,
        adjusted_by: req.user.userId,
        quantity_before: oldQty,
        quantity_change,
        quantity_after: Math.max(0, newQty),
        reason: reason || 'manual',
        notes
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await auditFromReq(req, 'UPDATE', 'inventory', product_id, {
      module: 'pos',
      fieldName: 'stock_quantity',
      oldValue: oldQty,
      newValue: Math.max(0, newQty),
      metadata: { product_name: product.name, reason }
    });

    res.json({ adjustment: adj });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/pos/inventory/adjustments
 * List stock adjustments history
 */
router.get('/adjustments', requirePermission('INVENTORY.VIEW'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('inventory_adjustments')
      .select('*, products(name, barcode)')
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ adjustments: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
