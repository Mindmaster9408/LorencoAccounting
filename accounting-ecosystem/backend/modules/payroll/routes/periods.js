/**
 * ============================================================================
 * Payroll Periods & Payrun Routes - Payroll Module
 * ============================================================================
 * Manages payroll periods and pay run processing.
 * Converted from Payroll App's localStorage-based DataAccess.
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
 * GET /api/payroll/periods
 * List payroll periods for the company
 */
router.get('/', requirePermission('PAYROLL.VIEW'), async (req, res) => {
  try {
    const { year, status } = req.query;

    let query = supabase
      .from('payroll_periods')
      .select('*')
      .eq('company_id', req.companyId)
      .order('start_date', { ascending: false });

    if (year) query = query.eq('tax_year', year);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json({ periods: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/payroll/periods
 * Create a new payroll period
 */
router.post('/', requirePermission('PAYROLL.CREATE'), async (req, res) => {
  try {
    const { start_date, end_date, pay_date, period_name, tax_year, frequency } = req.body;

    if (!start_date || !end_date || !pay_date) {
      return res.status(400).json({ error: 'start_date, end_date, and pay_date are required' });
    }

    const { data, error } = await supabase
      .from('payroll_periods')
      .insert({
        company_id: req.companyId,
        start_date,
        end_date,
        pay_date,
        period_name: period_name || `${start_date} to ${end_date}`,
        tax_year: tax_year || new Date(start_date).getFullYear(),
        frequency: frequency || 'monthly',
        status: 'draft',
        created_by: req.user.userId
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await auditFromReq(req, 'CREATE', 'payroll_period', data.id, { module: 'payroll', newValue: data });
    res.status(201).json({ period: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/payroll/periods/:id/status
 * Update period status (draft -> processing -> approved -> paid -> closed)
 */
router.put('/:id/status', requirePermission('PAYROLL.APPROVE'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'processing', 'approved', 'paid', 'closed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const { data: old } = await supabase
      .from('payroll_periods')
      .select('status')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();

    if (!old) return res.status(404).json({ error: 'Period not found' });

    const { data, error } = await supabase
      .from('payroll_periods')
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...(status === 'approved' ? { approved_by: req.user.userId, approved_at: new Date().toISOString() } : {}),
        ...(status === 'paid' ? { paid_at: new Date().toISOString() } : {})
      })
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await auditFromReq(req, 'UPDATE', 'payroll_period', req.params.id, {
      module: 'payroll',
      fieldName: 'status',
      oldValue: old.status,
      newValue: status,
    });

    res.json({ period: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
