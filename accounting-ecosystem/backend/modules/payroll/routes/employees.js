/**
 * ============================================================================
 * Payroll Employees Routes - Payroll Module
 * ============================================================================
 * Employee payroll data (salary, bank details, tax info).
 * Converted from localStorage (DataAccess) to Supabase API.
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
 * GET /api/payroll/employees
 * Get employees with their payroll-specific data
 */
router.get('/', requirePermission('PAYROLL.VIEW'), async (req, res) => {
  try {
    const { data: employees, error } = await supabase
      .from('employees')
      .select('*, employee_bank_details(*)')
      .eq('company_id', req.companyId)
      .eq('is_active', true)
      .order('full_name');

    if (error) return res.status(500).json({ error: error.message });
    res.json({ employees: employees || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/payroll/employees/:id
 */
router.get('/:id', requirePermission('PAYROLL.VIEW'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*, employee_bank_details(*)')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Employee not found' });
    res.json({ employee: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/payroll/employees/:id/salary
 * Update salary information
 */
router.put('/:id/salary', requirePermission('PAYROLL.CREATE'), async (req, res) => {
  try {
    const { basic_salary, hourly_rate, payment_frequency } = req.body;

    const { data: old } = await supabase
      .from('employees')
      .select('basic_salary, hourly_rate, payment_frequency')
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .single();

    if (!old) return res.status(404).json({ error: 'Employee not found' });

    const updates = {};
    if (basic_salary !== undefined) updates.basic_salary = basic_salary;
    if (hourly_rate !== undefined) updates.hourly_rate = hourly_rate;
    if (payment_frequency !== undefined) updates.payment_frequency = payment_frequency;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', req.params.id)
      .eq('company_id', req.companyId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await auditFromReq(req, 'UPDATE', 'employee_salary', req.params.id, {
      module: 'payroll',
      oldValue: old,
      newValue: updates,
    });

    res.json({ employee: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/payroll/employees/:id/bank-details
 * Update bank details
 */
router.put('/:id/bank-details', requirePermission('PAYROLL.CREATE'), async (req, res) => {
  try {
    const empId = req.params.id;
    const { bank_name, account_number, branch_code, account_type } = req.body;

    // Verify employee belongs to company
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('id', empId)
      .eq('company_id', req.companyId)
      .single();

    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    // Upsert bank details
    const { data, error } = await supabase
      .from('employee_bank_details')
      .upsert({
        employee_id: empId,
        bank_name,
        account_number,
        branch_code,
        account_type: account_type || 'savings',
        updated_at: new Date().toISOString()
      }, { onConflict: 'employee_id' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    await auditFromReq(req, 'UPDATE', 'bank_details', empId, {
      module: 'payroll',
      metadata: { bank_name }
    });

    res.json({ bank_details: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
