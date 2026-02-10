/**
 * ============================================================================
 * Attendance Routes - Payroll Module
 * ============================================================================
 * Replaces localStorage DataAccess.getAttendance() / saveAttendance().
 * ============================================================================
 */

const express = require('express');
const { supabase } = require('../../../config/database');
const { authenticateToken, requireCompany, requirePermission } = require('../../../middleware/auth');

const router = express.Router();

router.use(authenticateToken);
router.use(requireCompany);

/**
 * GET /api/payroll/attendance
 * Get attendance records
 */
router.get('/', requirePermission('ATTENDANCE.VIEW'), async (req, res) => {
  try {
    const { date, employee_id, from, to } = req.query;

    let query = supabase
      .from('attendance')
      .select('*, employees(full_name, employee_number)')
      .eq('company_id', req.companyId)
      .order('date', { ascending: false });

    if (date) query = query.eq('date', date);
    if (employee_id) query = query.eq('employee_id', employee_id);
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    res.json({ attendance: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/payroll/attendance
 * Record attendance for one or more employees
 */
router.post('/', requirePermission('ATTENDANCE.RECORD'), async (req, res) => {
  try {
    const { entries } = req.body; // Array of { employee_id, date, status, clock_in, clock_out, notes }

    if (!entries || entries.length === 0) {
      return res.status(400).json({ error: 'entries array is required' });
    }

    const records = entries.map(e => ({
      company_id: req.companyId,
      employee_id: e.employee_id,
      date: e.date || new Date().toISOString().split('T')[0],
      status: e.status || 'present', // present, absent, late, half_day, leave
      clock_in: e.clock_in || null,
      clock_out: e.clock_out || null,
      hours_worked: e.hours_worked || null,
      overtime_hours: e.overtime_hours || 0,
      notes: e.notes || null,
      recorded_by: req.user.userId
    }));

    const { data, error } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'company_id,employee_id,date' })
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ attendance: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LEAVE RECORDS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/payroll/attendance/leave
 * Save leave records for an employee
 */
router.post('/leave', requirePermission('PAYROLL.CREATE'), async (req, res) => {
  try {
    const { employee_id, records } = req.body;
    if (!employee_id || !records || records.length === 0) {
      return res.status(400).json({ error: 'employee_id and records array required' });
    }

    const leaveRecords = records.map(r => ({
      company_id: req.companyId,
      employee_id: parseInt(employee_id),
      leave_type: r.leave_type || r.type || 'annual',
      start_date: r.start_date,
      end_date: r.end_date,
      days_taken: parseFloat(r.days_taken || r.days) || 1,
      status: r.status || 'pending',
      reason: r.reason || null
    }));

    const { data, error } = await supabase.from('leave_records').insert(leaveRecords).select();
    if (error) return res.status(500).json({ error: error.message });

    // Update leave balances
    for (const rec of leaveRecords) {
      const year = new Date(rec.start_date).getFullYear();
      const { data: bal } = await supabase.from('leave_balances')
        .select('*')
        .eq('company_id', req.companyId)
        .eq('employee_id', rec.employee_id)
        .eq('leave_type', rec.leave_type)
        .eq('year', year)
        .single();

      if (bal) {
        await supabase.from('leave_balances')
          .update({ balance: parseFloat(bal.balance) - rec.days_taken, updated_at: new Date().toISOString() })
          .eq('id', bal.id);
      }
    }

    res.status(201).json({ data: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/payroll/attendance/summary
 * Attendance summary for a date range
 */
router.get('/summary', requirePermission('ATTENDANCE.VIEW'), async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates are required' });
    }

    const { data, error } = await supabase
      .from('attendance')
      .select('employee_id, status, hours_worked, overtime_hours, employees(full_name)')
      .eq('company_id', req.companyId)
      .gte('date', from)
      .lte('date', to);

    if (error) return res.status(500).json({ error: error.message });

    // Aggregate by employee
    const summary = {};
    for (const record of (data || [])) {
      const eid = record.employee_id;
      if (!summary[eid]) {
        summary[eid] = {
          employee_id: eid,
          full_name: record.employees?.full_name || 'Unknown',
          present: 0, absent: 0, late: 0, leave: 0,
          total_hours: 0, total_overtime: 0
        };
      }
      summary[eid][record.status] = (summary[eid][record.status] || 0) + 1;
      summary[eid].total_hours += record.hours_worked || 0;
      summary[eid].total_overtime += record.overtime_hours || 0;
    }

    res.json({ summary: Object.values(summary) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
