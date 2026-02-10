/**
 * ============================================================================
 * Payroll Items Master Routes - Payroll Module
 * ============================================================================
 * Master list of payroll earning/deduction types per company.
 * Replaces localStorage DataAccess.getPayrollItems().
 * ============================================================================
 */

const express = require('express');
const { supabase } = require('../../../config/database');
const { authenticateToken, requireCompany, requirePermission } = require('../../../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.use(requireCompany);

/**
 * GET /api/payroll/items
 */
router.get('/', requirePermission('PAYROLL.VIEW'), async (req, res) => {
  try {
    const { type } = req.query; // 'earning' or 'deduction'

    let query = supabase
      .from('payroll_items_master')
      .select('*')
      .eq('company_id', req.companyId)
      .eq('is_active', true)
      .order('item_type', { ascending: true })
      .order('name');

    if (type) query = query.eq('item_type', type);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json({ items: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/payroll/items
 */
router.post('/', requirePermission('PAYROLL.CREATE'), async (req, res) => {
  try {
    const { code, name, item_type, is_taxable, is_recurring, default_amount, description } = req.body;

    if (!code || !name || !item_type) {
      return res.status(400).json({ error: 'code, name, and item_type are required' });
    }

    const { data, error } = await supabase
      .from('payroll_items_master')
      .insert({
        company_id: req.companyId,
        code,
        name,
        item_type, // 'earning' or 'deduction'
        is_taxable: is_taxable !== false,
        is_recurring: is_recurring || false,
        default_amount: default_amount || 0,
        description,
        is_active: true
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ item: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/payroll/items/:id
 */
router.put('/:id', requirePermission('PAYROLL.CREATE'), async (req, res) => {
  try {
    const allowed = ['code', 'name', 'item_type', 'is_taxable', 'is_recurring', 'default_amount', 'description', 'is_active'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const { data, error } = await supabase
      .from('payroll_items_master')
      .update(updates)
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ item: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
