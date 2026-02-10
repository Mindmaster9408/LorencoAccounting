/**
 * ============================================================================
 * POS Customers Routes - Checkout Charlie Module
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
 * GET /api/pos/customers
 */
router.get('/', requirePermission('CUSTOMERS.VIEW'), async (req, res) => {
  try {
    const { search, active_only, group } = req.query;

    let query = supabase
      .from('customers')
      .select('*')
      .eq('company_id', req.companyId);

    if (active_only !== 'false') query = query.eq('is_active', true);
    if (group) query = query.eq('customer_group', group);
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    }

    query = query.order('name');

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json({ customers: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/pos/customers/:id
 */
router.get('/:id', requirePermission('CUSTOMERS.VIEW'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Customer not found' });
    res.json({ customer: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/pos/customers
 */
router.post('/', requirePermission('CUSTOMERS.CREATE'), async (req, res) => {
  try {
    const { name, email, phone, address, id_number, customer_group, notes } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const customerNumber = `C-${Date.now().toString(36).toUpperCase()}`;

    const { data, error } = await supabase
      .from('customers')
      .insert({
        company_id: req.companyId,
        name,
        email,
        phone,
        address,
        id_number,
        customer_number: customerNumber,
        customer_group: customer_group || 'retail',
        loyalty_points: 0,
        loyalty_tier: 'bronze',
        current_balance: 0,
        notes,
        is_active: true
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await auditFromReq(req, 'CREATE', 'customer', data.id, { module: 'pos', newValue: data });
    res.status(201).json({ customer: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/pos/customers/:id
 */
router.put('/:id', requirePermission('CUSTOMERS.EDIT'), async (req, res) => {
  try {
    const allowed = ['name', 'email', 'phone', 'address', 'id_number', 'customer_group', 'notes', 'is_active'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Customer not found' });

    await auditFromReq(req, 'UPDATE', 'customer', req.params.id, { module: 'pos', newValue: data });
    res.json({ customer: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/pos/customers/:id (soft delete)
 */
router.delete('/:id', requirePermission('CUSTOMERS.DELETE'), async (req, res) => {
  try {
    const { error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', req.params.id)
      .eq('company_id', req.companyId);

    if (error) return res.status(500).json({ error: error.message });

    await auditFromReq(req, 'DELETE', 'customer', req.params.id, { module: 'pos' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
