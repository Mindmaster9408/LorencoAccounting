// PAYE Reconciliation Service (skeleton)
const db = require('../config/database');

// Helper: fetch all employees for company
async function getEmployees(companyId) {
  const res = await db.query('SELECT id, employeeCode, firstName, lastName, isActive FROM employees WHERE companyId = $1 AND isActive = true', [companyId]);
  return res.rows;
}

// Helper: fetch config
async function getConfig(companyId) {
  const income = await db.query('SELECT * FROM paye_config_income_types WHERE company_id = $1 AND is_active = true', [companyId]);
  const deduction = await db.query('SELECT * FROM paye_config_deduction_types WHERE company_id = $1 AND is_active = true', [companyId]);
  return { incomeTypes: income.rows, deductionTypes: deduction.rows };
}

// GET draft
exports.getDraft = async (req, res) => {
  const companyId = req.user.companyId;
  const periodId = req.params.periodId;
  try {
    // Get employees
    const employees = await getEmployees(companyId);
    // Get config
    const config = await getConfig(companyId);
    // Get draft reconciliation (if exists)
    const reconRes = await db.query('SELECT * FROM paye_reconciliations WHERE company_id = $1 AND paye_period_id = $2 AND status = $3', [companyId, periodId, 'DRAFT']);
    let recon = reconRes.rows[0];
    let employeeLines = [];
    if (recon) {
      const linesRes = await db.query('SELECT * FROM paye_employee_lines WHERE paye_reconciliation_id = $1', [recon.id]);
      employeeLines = linesRes.rows;
      // TODO: fetch income/deduction lines per employeeLine
    }
    res.json({ employees, config, status: recon ? recon.status : 'DRAFT', employeeLines });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch PAYE reconciliation draft.' });
  }
};

// PUT draft
exports.saveDraft = async (req, res) => {
  const companyId = req.user.companyId;
  const periodId = req.params.periodId;
  const { employeeLines, incomeLines, deductionLines } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Upsert reconciliation draft
    let reconRes = await client.query('SELECT * FROM paye_reconciliations WHERE company_id = $1 AND paye_period_id = $2 AND status = $3', [companyId, periodId, 'DRAFT']);
    let recon = reconRes.rows[0];
    if (!recon) {
      const ins = await client.query('INSERT INTO paye_reconciliations (company_id, paye_period_id, status, created_by_user_id) VALUES ($1, $2, $3, $4) RETURNING *', [companyId, periodId, 'DRAFT', req.user.id]);
      recon = ins.rows[0];
    }
    // Remove old lines
    await client.query('DELETE FROM paye_employee_lines WHERE paye_reconciliation_id = $1', [recon.id]);
    // Insert new lines
    for (const line of employeeLines) {
      const empLineRes = await client.query(
        'INSERT INTO paye_employee_lines (paye_reconciliation_id, employee_id, month_key, gross_income, total_deductions, net_salary, bank_paid_amount, difference_amount, metadata_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
        [recon.id, line.employeeId, line.monthKey, line.grossIncome, line.totalDeductions, line.netSalary, line.bankPaidAmount, line.differenceAmount, line.metadataJson || null]
      );
      const empLineId = empLineRes.rows[0].id;
      // Income lines
      for (const inc of (incomeLines || []).filter(i => i.employeeId === line.employeeId && i.monthKey === line.monthKey)) {
        await client.query('INSERT INTO paye_employee_income_lines (paye_employee_line_id, income_type_key, amount) VALUES ($1, $2, $3)', [empLineId, inc.incomeTypeKey, inc.amount]);
      }
      // Deduction lines
      for (const ded of (deductionLines || []).filter(d => d.employeeId === line.employeeId && d.monthKey === line.monthKey)) {
        await client.query('INSERT INTO paye_employee_deduction_lines (paye_employee_line_id, deduction_type_key, amount) VALUES ($1, $2, $3)', [empLineId, ded.deductionTypeKey, ded.amount]);
      }
    }
    await client.query('COMMIT');
    res.json({ saved: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to save PAYE reconciliation draft.' });
  } finally {
    client.release();
  }
};

exports.approve = async (req, res) => {
  // TODO: Approve reconciliation (set status, log audit)
  res.json({ approved: true });
};

exports.lock = async (req, res) => {
  // TODO: Lock reconciliation (set status, log audit)
  res.json({ locked: true });
};

exports.getSnapshot = async (req, res) => {
  // TODO: Fetch immutable snapshot for reconId
  res.json({ snapshot: true });
};
