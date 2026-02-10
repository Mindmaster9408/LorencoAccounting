/**
 * ============================================================================
 * POS Products Routes - Checkout Charlie Module
 * ============================================================================
 * Product CRUD with company isolation, price change auditing.
 * BUG FIX #2: All queries filter by company_id from JWT token.
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
 * GET /api/pos/products
 */
router.get('/', requirePermission('PRODUCTS.VIEW'), async (req, res) => {
  try {
    const { category_id, search, active_only } = req.query;

    let query = supabase
      .from('products')
      .select('*, categories(name)')
      .eq('company_id', req.companyId);

    if (active_only !== 'false') query = query.eq('is_active', true);
    if (category_id) query = query.eq('category_id', category_id);
    if (search) {
      query = query.or(`name.ilike.%${search}%,barcode.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    query = query.order('name');

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json({ products: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/pos/products/:id
 */
router.get('/:id', requirePermission('PRODUCTS.VIEW'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/pos/products
 */
router.post('/', requirePermission('PRODUCTS.CREATE'), async (req, res) => {
  try {
    const {
      name, description, barcode, sku, category_id,
      cost_price, selling_price, stock_quantity, reorder_level,
      vat_inclusive, vat_rate, unit
    } = req.body;

    if (!name || selling_price === undefined) {
      return res.status(400).json({ error: 'name and selling_price are required' });
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        company_id: req.companyId,
        name,
        description,
        barcode,
        sku,
        category_id,
        cost_price: cost_price || 0,
        selling_price,
        stock_quantity: stock_quantity || 0,
        reorder_level: reorder_level || 10,
        vat_inclusive: vat_inclusive !== false,
        vat_rate: vat_rate || 15,
        unit: unit || 'each',
        is_active: true
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await auditFromReq(req, 'CREATE', 'product', data.id, {
      module: 'pos',
      newValue: { name, selling_price, barcode }
    });

    res.status(201).json({ product: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/pos/products/:id
 * Includes PRICE_CHANGE audit for compliance
 */
router.put('/:id', requirePermission('PRODUCTS.EDIT'), async (req, res) => {
  try {
    const id = req.params.id;

    // Get old data for audit (especially price changes)
    const { data: old } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('company_id', req.companyId)
      .single();

    if (!old) return res.status(404).json({ error: 'Product not found' });

    const allowed = [
      'name', 'description', 'barcode', 'sku', 'category_id',
      'cost_price', 'selling_price', 'stock_quantity', 'reorder_level',
      'vat_inclusive', 'vat_rate', 'unit', 'is_active'
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Special audit for price changes (critical for fraud detection)
    if (updates.selling_price !== undefined && old.selling_price !== updates.selling_price) {
      await auditFromReq(req, 'PRICE_CHANGE', 'product', id, {
        module: 'pos',
        fieldName: 'selling_price',
        oldValue: old.selling_price,
        newValue: updates.selling_price,
        metadata: { product_name: old.name }
      });
    }
    if (updates.cost_price !== undefined && old.cost_price !== updates.cost_price) {
      await auditFromReq(req, 'PRICE_CHANGE', 'product', id, {
        module: 'pos',
        fieldName: 'cost_price',
        oldValue: old.cost_price,
        newValue: updates.cost_price,
        metadata: { product_name: old.name }
      });
    }

    await auditFromReq(req, 'UPDATE', 'product', id, {
      module: 'pos',
      oldValue: old,
      newValue: data
    });

    res.json({ product: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/pos/products/next-code/:prefix
 * Generate the next product code with given prefix
 */
router.post('/next-code/:prefix', requirePermission('PRODUCTS.CREATE'), async (req, res) => {
  try {
    const prefix = req.params.prefix || 'PRO';

    // Get company settings for prefix
    const { data: settings } = await supabase
      .from('company_settings')
      .select('product_code_prefix')
      .eq('company_id', req.companyId)
      .maybeSingle();

    const codePrefix = settings?.product_code_prefix || prefix;

    // Find the highest existing code with this prefix
    const { data: products } = await supabase
      .from('products')
      .select('product_code')
      .eq('company_id', req.companyId)
      .ilike('product_code', `${codePrefix}%`)
      .order('product_code', { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (products && products.length > 0) {
      const lastCode = products[0].product_code;
      const numPart = parseInt(lastCode.replace(codePrefix, '')) || 0;
      nextNum = numPart + 1;
    }

    const nextCode = `${codePrefix}${String(nextNum).padStart(4, '0')}`;
    res.json({ code: nextCode, prefix: codePrefix });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/pos/products/:id/stock-by-location
 * Get stock levels by location for a product
 */
router.get('/:id/stock-by-location', requirePermission('PRODUCTS.VIEW'), async (req, res) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select('id, product_name, stock_quantity')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();

    if (error || !product) return res.status(404).json({ error: 'Product not found' });

    // Return stock as single location (multi-location is a future feature)
    res.json({
      product_id: product.id,
      product_name: product.product_name,
      locations: [{ location: 'Main Store', stock_quantity: product.stock_quantity }],
      total_stock: product.stock_quantity
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/pos/products/:id (soft delete)
 */
router.delete('/:id', requirePermission('PRODUCTS.DELETE'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);

    if (error) return res.status(500).json({ error: error.message });

    await auditFromReq(req, 'DELETE', 'product', req.params.id, { module: 'pos' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
