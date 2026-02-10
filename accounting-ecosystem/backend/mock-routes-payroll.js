/**
 * ============================================================================
 * MOCK PAYROLL ROUTES — In-Memory CRUD for Lorenco Paytime
 * ============================================================================
 * Replaces Supabase-backed Payroll routes with in-memory data operations.
 * Response formats match original routes EXACTLY.
 * ============================================================================
 */

const express = require('express');
const { authenticateToken, requireCompany, requirePermission } = require('./middleware/auth');
const mock = require('./mock-data');

const router = express.Router();

router.use(authenticateToken);
router.use(requireCompany);

// ═══════════════════════════════════════════════════════════════════════════════
// PAYROLL EMPLOYEES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/payroll/employees
 */
router.get('/employees', requirePermission('PAYROLL.VIEW'), (req, res) => {
  let results = mock.employees
    .filter(e => e.company_id === req.companyId && e.is_active)
    .map(e => ({
      ...e,
      employee_bank_details: mock.employeeBankDetails.filter(b => b.employee_id === e.id),
    }));

  res.json({ employees: results });
});

/**
 * GET /api/payroll/employees/:id
 */
router.get('/employees/:id', requirePermission('PAYROLL.VIEW'), (req, res) => {
  const emp = mock.employees.find(e => e.id === parseInt(req.params.id) && e.company_id === req.companyId);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  res.json({
    employee: {
      ...emp,
      employee_bank_details: mock.employeeBankDetails.filter(b => b.employee_id === emp.id),
    },
  });
});

/**
 * PUT /api/payroll/employees/:id/salary
 */
router.put('/employees/:id/salary', requirePermission('PAYROLL.CREATE'), (req, res) => {
  const idx = mock.employees.findIndex(e => e.id === parseInt(req.params.id) && e.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Employee not found' });

  const { basic_salary, hourly_rate, payment_frequency } = req.body;
  const old = { ...mock.employees[idx] };

  if (basic_salary !== undefined) mock.employees[idx].basic_salary = basic_salary;
  if (hourly_rate !== undefined) mock.employees[idx].hourly_rate = hourly_rate;
  if (payment_frequency !== undefined) mock.employees[idx].payment_frequency = payment_frequency;
  mock.employees[idx].updated_at = new Date().toISOString();

  mock.mockAuditFromReq(req, 'UPDATE', 'employee', req.params.id, {
    module: 'payroll', oldValue: { basic_salary: old.basic_salary }, newValue: { basic_salary: mock.employees[idx].basic_salary },
  });

  res.json({ employee: mock.employees[idx] });
});

/**
 * PUT /api/payroll/employees/:id/bank-details
 */
router.put('/employees/:id/bank-details', requirePermission('PAYROLL.CREATE'), (req, res) => {
  const empId = parseInt(req.params.id);
  const emp = mock.employees.find(e => e.id === empId && e.company_id === req.companyId);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const { bank_name, account_number, branch_code, account_type } = req.body;

  let existing = mock.employeeBankDetails.findIndex(b => b.employee_id === empId);
  if (existing !== -1) {
    mock.employeeBankDetails[existing].bank_name = bank_name;
    mock.employeeBankDetails[existing].account_number = account_number;
    mock.employeeBankDetails[existing].branch_code = branch_code;
    mock.employeeBankDetails[existing].account_type = account_type || 'savings';
  } else {
    mock.employeeBankDetails.push({
      id: mock.nextId(), employee_id: empId,
      bank_name, account_number, branch_code, account_type: account_type || 'savings',
      created_at: new Date().toISOString(),
    });
    existing = mock.employeeBankDetails.length - 1;
  }

  res.json({ bank_details: mock.employeeBankDetails[existing !== -1 ? existing : mock.employeeBankDetails.length - 1] });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYROLL PERIODS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/payroll/periods
 */
router.get('/periods', requirePermission('PAYROLL.VIEW'), (req, res) => {
  const { year, status } = req.query;
  let results = mock.payrollPeriods.filter(p => p.company_id === req.companyId);

  if (year) results = results.filter(p => p.tax_year && p.tax_year.startsWith(year));
  if (status) results = results.filter(p => p.status === status);

  results.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
  res.json({ periods: results });
});

/**
 * POST /api/payroll/periods
 */
router.post('/periods', requirePermission('PAYROLL.CREATE'), (req, res) => {
  const { start_date, end_date, pay_date, period_name, tax_year, frequency } = req.body;

  if (!start_date || !end_date || !pay_date) {
    return res.status(400).json({ error: 'start_date, end_date, and pay_date are required' });
  }

  const period = {
    id: mock.nextId(), company_id: req.companyId,
    start_date, end_date, pay_date,
    period_name: period_name || `${start_date} to ${end_date}`,
    tax_year: tax_year || '2024/2025', frequency: frequency || 'monthly',
    status: 'draft', created_by: req.user.userId,
    approved_by: null, approved_at: null, paid_at: null,
    created_at: new Date().toISOString(),
  };
  mock.payrollPeriods.push(period);

  mock.mockAuditFromReq(req, 'CREATE', 'payroll_period', period.id, {
    module: 'payroll', newValue: { period_name: period.period_name, status: 'draft' },
  });

  res.status(201).json({ period });
});

/**
 * PUT /api/payroll/periods/:id/status
 */
router.put('/periods/:id/status', requirePermission('PAYROLL.APPROVE'), (req, res) => {
  const idx = mock.payrollPeriods.findIndex(p => p.id === parseInt(req.params.id) && p.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Period not found' });

  const { status } = req.body;
  const validFlow = { draft: 'processing', processing: 'approved', approved: 'paid', paid: 'closed' };
  const current = mock.payrollPeriods[idx].status;

  if (validFlow[current] !== status && status !== 'draft') {
    return res.status(400).json({ error: `Cannot transition from ${current} to ${status}` });
  }

  const old = mock.payrollPeriods[idx].status;
  mock.payrollPeriods[idx].status = status;

  if (status === 'approved') {
    mock.payrollPeriods[idx].approved_by = req.user.userId;
    mock.payrollPeriods[idx].approved_at = new Date().toISOString();
  }
  if (status === 'paid') {
    mock.payrollPeriods[idx].paid_at = new Date().toISOString();
  }

  mock.mockAuditFromReq(req, 'UPDATE', 'payroll_period', req.params.id, {
    module: 'payroll', oldValue: { status: old }, newValue: { status },
  });

  res.json({ period: mock.payrollPeriods[idx] });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYROLL TRANSACTIONS (Payslips)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/payroll/transactions
 */
router.get('/transactions', requirePermission('PAYROLL.VIEW'), (req, res) => {
  const { period_id, employee_id } = req.query;
  let results = mock.payrollTransactions.filter(t => t.company_id === req.companyId);

  if (period_id) results = results.filter(t => t.period_id === parseInt(period_id));
  if (employee_id) results = results.filter(t => t.employee_id === parseInt(employee_id));

  results = results.map(t => {
    const emp = mock.employees.find(e => e.id === t.employee_id);
    return {
      ...t,
      employees: emp ? { full_name: emp.full_name, employee_number: emp.employee_number } : null,
      payslip_items: mock.payslipItems.filter(i => i.transaction_id === t.id),
    };
  });

  res.json({ transactions: results });
});

/**
 * GET /api/payroll/transactions/:id
 */
router.get('/transactions/:id', requirePermission('PAYROLL.VIEW'), (req, res) => {
  const txn = mock.payrollTransactions.find(t => t.id === parseInt(req.params.id) && t.company_id === req.companyId);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });

  const emp = mock.employees.find(e => e.id === txn.employee_id);
  res.json({
    transaction: {
      ...txn,
      employees: emp ? { full_name: emp.full_name, employee_number: emp.employee_number, email: emp.email } : null,
      payslip_items: mock.payslipItems.filter(i => i.transaction_id === txn.id),
    },
  });
});

/**
 * POST /api/payroll/transactions
 */
router.post('/transactions', requirePermission('PAYROLL.CREATE'), (req, res) => {
  const { period_id, employee_id, basic_salary, gross_pay, net_pay, total_earnings, total_deductions, paye_tax, uif_employee, uif_employer, items, notes } = req.body;

  if (!period_id || !employee_id) {
    return res.status(400).json({ error: 'period_id and employee_id are required' });
  }

  const txn = {
    id: mock.nextId(), company_id: req.companyId,
    period_id: parseInt(period_id), employee_id: parseInt(employee_id),
    basic_salary: basic_salary || 0, gross_pay: gross_pay || 0,
    net_pay: net_pay || 0, total_earnings: total_earnings || 0,
    total_deductions: total_deductions || 0,
    paye_tax: paye_tax || 0, uif_employee: uif_employee || 0, uif_employer: uif_employer || 0,
    status: 'draft', notes: notes || null,
    created_at: new Date().toISOString(),
  };
  mock.payrollTransactions.push(txn);

  // Insert items
  if (items && items.length > 0) {
    for (const item of items) {
      mock.payslipItems.push({
        id: mock.nextId(), transaction_id: txn.id,
        item_code: item.code || item.item_code,
        item_name: item.name || item.item_name,
        item_type: item.type || item.item_type || 'earning',
        amount: item.amount || 0,
        is_taxable: item.is_taxable !== false,
        is_recurring: item.is_recurring || false,
        notes: item.notes || null,
      });
    }
  }

  mock.mockAuditFromReq(req, 'CREATE', 'payroll_transaction', txn.id, {
    module: 'payroll', newValue: { period_id, employee_id, basic_salary: txn.basic_salary },
  });

  res.status(201).json({ transaction: txn });
});

/**
 * PUT /api/payroll/transactions/:id
 */
router.put('/transactions/:id', requirePermission('PAYROLL.CREATE'), (req, res) => {
  const idx = mock.payrollTransactions.findIndex(t => t.id === parseInt(req.params.id) && t.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });

  const allowed = ['basic_salary', 'gross_pay', 'net_pay', 'total_earnings', 'total_deductions', 'paye_tax', 'uif_employee', 'uif_employer', 'status', 'notes'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) mock.payrollTransactions[idx][key] = req.body[key];
  }

  res.json({ transaction: mock.payrollTransactions[idx] });
});

/**
 * DELETE /api/payroll/transactions/:id
 */
router.delete('/transactions/:id', requirePermission('PAYROLL.CREATE'), (req, res) => {
  const idx = mock.payrollTransactions.findIndex(t => t.id === parseInt(req.params.id) && t.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });

  if (mock.payrollTransactions[idx].status !== 'draft') {
    return res.status(400).json({ error: 'Can only delete draft transactions' });
  }

  const txnId = mock.payrollTransactions[idx].id;

  // Remove payslip items
  for (let i = mock.payslipItems.length - 1; i >= 0; i--) {
    if (mock.payslipItems[i].transaction_id === txnId) mock.payslipItems.splice(i, 1);
  }

  mock.payrollTransactions.splice(idx, 1);
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAYROLL ITEMS (Master list)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/items', requirePermission('PAYROLL.VIEW'), (req, res) => {
  const { type } = req.query;
  let results = mock.payrollItemsMaster.filter(i => i.company_id === req.companyId && i.is_active);
  if (type) results = results.filter(i => i.item_type === type);
  res.json({ items: results });
});

router.post('/items', requirePermission('PAYROLL.CREATE'), (req, res) => {
  const { code, name, item_type, is_taxable, is_recurring, default_amount, description } = req.body;

  if (!code || !name || !item_type) {
    return res.status(400).json({ error: 'code, name, and item_type are required' });
  }

  const item = {
    id: mock.nextId(), company_id: req.companyId,
    code, name, item_type,
    is_taxable: is_taxable !== false, is_recurring: is_recurring || false,
    default_amount: default_amount || 0, description: description || null,
    is_active: true, created_at: new Date().toISOString(),
  };
  mock.payrollItemsMaster.push(item);
  res.status(201).json({ item });
});

router.put('/items/:id', requirePermission('PAYROLL.CREATE'), (req, res) => {
  const idx = mock.payrollItemsMaster.findIndex(i => i.id === parseInt(req.params.id) && i.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });

  const allowed = ['code', 'name', 'item_type', 'is_taxable', 'is_recurring', 'default_amount', 'description', 'is_active'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) mock.payrollItemsMaster[idx][key] = req.body[key];
  }

  res.json({ item: mock.payrollItemsMaster[idx] });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/attendance', requirePermission('ATTENDANCE.VIEW'), (req, res) => {
  const { date, employee_id, from, to } = req.query;
  let results = mock.attendance.filter(a => a.company_id === req.companyId);

  if (date) results = results.filter(a => a.date === date);
  if (employee_id) results = results.filter(a => a.employee_id === parseInt(employee_id));
  if (from) results = results.filter(a => a.date >= from);
  if (to) results = results.filter(a => a.date <= to);

  results = results.map(a => {
    const emp = mock.employees.find(e => e.id === a.employee_id);
    return { ...a, employees: emp ? { full_name: emp.full_name, employee_number: emp.employee_number } : null };
  });

  res.json({ attendance: results });
});

router.post('/attendance', requirePermission('ATTENDANCE.RECORD'), (req, res) => {
  const { entries } = req.body;
  if (!entries || entries.length === 0) {
    return res.status(400).json({ error: 'entries array is required' });
  }

  const saved = [];
  for (const entry of entries) {
    const existing = mock.attendance.findIndex(
      a => a.company_id === req.companyId && a.employee_id === entry.employee_id && a.date === (entry.date || new Date().toISOString().split('T')[0])
    );

    const record = {
      id: existing !== -1 ? mock.attendance[existing].id : mock.nextId(),
      company_id: req.companyId,
      employee_id: entry.employee_id,
      date: entry.date || new Date().toISOString().split('T')[0],
      status: entry.status || 'present',
      clock_in: entry.clock_in || null,
      clock_out: entry.clock_out || null,
      hours_worked: entry.hours_worked || 0,
      overtime_hours: entry.overtime_hours || 0,
      notes: entry.notes || null,
    };

    if (existing !== -1) {
      mock.attendance[existing] = record;
    } else {
      mock.attendance.push(record);
    }
    saved.push(record);
  }

  res.json({ attendance: saved });
});

router.get('/attendance/summary', requirePermission('ATTENDANCE.VIEW'), (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'from and to dates are required' });
  }

  const records = mock.attendance.filter(
    a => a.company_id === req.companyId && a.date >= from && a.date <= to
  );

  // Group by employee
  const grouped = {};
  for (const r of records) {
    if (!grouped[r.employee_id]) {
      const emp = mock.employees.find(e => e.id === r.employee_id);
      grouped[r.employee_id] = {
        employee_id: r.employee_id,
        full_name: emp ? emp.full_name : 'Unknown',
        present: 0, absent: 0, late: 0, leave: 0,
        total_hours: 0, total_overtime: 0,
      };
    }
    const g = grouped[r.employee_id];
    if (r.status === 'present') g.present++;
    else if (r.status === 'absent') g.absent++;
    else if (r.status === 'late') { g.late++; g.present++; }
    else if (r.status === 'leave') g.leave++;
    else if (r.status === 'half_day') g.present++;
    g.total_hours += r.hours_worked || 0;
    g.total_overtime += r.overtime_hours || 0;
  }

  res.json({ summary: Object.values(grouped) });
});

module.exports = router;
