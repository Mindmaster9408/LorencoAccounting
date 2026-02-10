/**
 * ============================================================================
 * POS Sales Routes - Checkout Charlie Module
 * ============================================================================
 * Sales processing, void handling, and payment recording.
 * Includes audit logging for voids (critical fraud risk).
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
 * GET /api/pos/sales
 * List sales with optional filters
 */
router.get('/', requirePermission('SALES.VIEW'), async (req, res) => {
  try {
    const { from, to, status, cashier_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('sales')
      .select('*, sale_items(*), sale_payments(*)', { count: 'exact' })
      .eq('company_id', req.companyId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (status) query = query.eq('status', status);
    if (cashier_id) query = query.eq('cashier_id', cashier_id);

    const { data, error, count } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json({
      sales: data || [],
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/pos/sales/:id
 */
router.get('/:id', requirePermission('SALES.VIEW'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_items(*, products(name, barcode)), sale_payments(*)')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Sale not found' });
    res.json({ sale: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/pos/sales
 * Create a new sale with items and payments
 */
router.post('/', requirePermission('SALES.CREATE'), async (req, res) => {
  try {
    const {
      items, payments, customer_id, discount_amount,
      discount_percent, notes, till_session_id
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    // Calculate totals
    let subtotal = 0;
    let vat_total = 0;
    for (const item of items) {
      const lineTotal = item.quantity * item.unit_price;
      subtotal += lineTotal;
      if (item.vat_rate) {
        vat_total += lineTotal * (item.vat_rate / (100 + item.vat_rate));
      }
    }

    const discount = discount_amount || (discount_percent ? subtotal * discount_percent / 100 : 0);
    const total_amount = subtotal - discount;

    // Generate receipt number
    const receiptNumber = `RC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Create sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        company_id: req.companyId,
        cashier_id: req.user.userId,
        customer_id: customer_id || null,
        receipt_number: receiptNumber,
        subtotal,
        discount_amount: discount,
        vat_amount: vat_total,
        total_amount,
        status: 'completed',
        till_session_id,
        notes
      })
      .select()
      .single();

    if (saleError) return res.status(500).json({ error: saleError.message });

    // Insert sale items
    const saleItems = items.map(item => ({
      sale_id: sale.id,
      product_id: item.product_id,
      product_name: item.product_name || item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: item.discount_amount || 0,
      vat_rate: item.vat_rate || 15,
      line_total: item.quantity * item.unit_price - (item.discount_amount || 0),
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
    if (itemsError) console.error('Error inserting sale items:', itemsError.message);

    // Insert payments
    if (payments && payments.length > 0) {
      const salePayments = payments.map(p => ({
        sale_id: sale.id,
        payment_method: p.payment_method || p.method,
        amount: p.amount,
        reference: p.reference || null,
      }));

      const { error: payError } = await supabase.from('sale_payments').insert(salePayments);
      if (payError) console.error('Error inserting payments:', payError.message);
    }

    // Update stock quantities
    for (const item of items) {
      if (item.product_id) {
        await supabase.rpc('decrement_stock', {
          p_product_id: item.product_id,
          p_quantity: item.quantity
        }).then(({ error }) => {
          if (error) {
            // Fallback: manual update
            supabase.from('products')
              .select('stock_quantity')
              .eq('id', item.product_id)
              .single()
              .then(({ data: prod }) => {
                if (prod) {
                  supabase.from('products')
                    .update({ stock_quantity: Math.max(0, prod.stock_quantity - item.quantity) })
                    .eq('id', item.product_id);
                }
              });
          }
        });
      }
    }

    await auditFromReq(req, 'CREATE', 'sale', sale.id, {
      module: 'pos',
      newValue: { receiptNumber, total_amount, items: items.length },
    });

    res.status(201).json({ sale });
  } catch (err) {
    console.error('Create sale error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/pos/sales/:id/void
 * Void a sale — CRITICAL audit event
 */
router.post('/:id/void', requirePermission('SALES.VOID'), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Void reason is required' });

    // Get current sale for audit
    const { data: old } = await supabase
      .from('sales')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();

    if (!old) return res.status(404).json({ error: 'Sale not found' });
    if (old.status === 'voided') return res.status(400).json({ error: 'Sale is already voided' });

    const { data, error } = await supabase
      .from('sales')
      .update({
        status: 'voided',
        void_reason: reason,
        voided_by: req.user.userId,
        voided_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // CRITICAL AUDIT: void is a fraud risk
    await auditFromReq(req, 'VOID', 'sale', req.params.id, {
      module: 'pos',
      oldValue: { status: old.status, total_amount: old.total_amount },
      newValue: { status: 'voided', void_reason: reason },
      metadata: {
        receipt_number: old.receipt_number,
        original_amount: old.total_amount,
        reason
      }
    });

    res.json({ sale: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
