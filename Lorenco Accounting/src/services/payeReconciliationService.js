// PAYE Reconciliation Service (skeleton)
const db = require('../config/database');

// Helper: fetch all employees for company
async function getEmployees(companyId) {
  const res = await db.query('SELECT id, employee_code, first_name, last_name, is_active FROM employees WHERE company_id = $1 AND is_active = true', [companyId]);
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
  const client = await db.getClient();
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
  const companyId = req.user.companyId;
  const reconId = req.params.reconId;
  const userId = req.user.id;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Check reconciliation exists and is in DRAFT status
    const reconRes = await client.query(
      'SELECT * FROM paye_reconciliations WHERE id = $1 AND company_id = $2',
      [reconId, companyId]
    );

    if (reconRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    const recon = reconRes.rows[0];

    if (recon.status !== 'DRAFT') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only DRAFT reconciliations can be approved' });
    }

    // Update status to APPROVED
    await client.query(
      'UPDATE paye_reconciliations SET status = $1, approved_by_user_id = $2, approved_at = CURRENT_TIMESTAMP WHERE id = $3',
      ['APPROVED', userId, reconId]
    );

    // Audit log
    const AuditLogger = require('../services/auditLogger');
    await AuditLogger.log({
      companyId,
      actorType: 'USER',
      actorId: userId,
      actionType: 'APPROVE',
      entityType: 'PAYE_RECONCILIATION',
      entityId: reconId,
      beforeJson: { status: 'DRAFT' },
      afterJson: { status: 'APPROVED' },
      reason: 'PAYE reconciliation approved'
    });

    await client.query('COMMIT');
    res.json({ approved: true, reconId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Failed to approve PAYE reconciliation' });
  } finally {
    client.release();
  }
};

exports.lock = async (req, res) => {
  const companyId = req.user.companyId;
  const reconId = req.params.reconId;
  const userId = req.user.id;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Check reconciliation exists and is APPROVED
    const reconRes = await client.query(
      'SELECT * FROM paye_reconciliations WHERE id = $1 AND company_id = $2',
      [reconId, companyId]
    );

    if (reconRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    const recon = reconRes.rows[0];

    if (recon.status !== 'APPROVED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Only APPROVED reconciliations can be locked' });
    }

    // Update status to LOCKED
    await client.query(
      'UPDATE paye_reconciliations SET status = $1, locked_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['LOCKED', reconId]
    );

    // Audit log
    const AuditLogger = require('../services/auditLogger');
    await AuditLogger.log({
      companyId,
      actorType: 'USER',
      actorId: userId,
      actionType: 'LOCK',
      entityType: 'PAYE_RECONCILIATION',
      entityId: reconId,
      beforeJson: { status: 'APPROVED' },
      afterJson: { status: 'LOCKED' },
      reason: 'PAYE reconciliation locked - now immutable'
    });

    await client.query('COMMIT');
    res.json({ locked: true, reconId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lock error:', err);
    res.status(500).json({ error: 'Failed to lock PAYE reconciliation' });
  } finally {
    client.release();
  }
};

exports.getSnapshot = async (req, res) => {
  const companyId = req.user.companyId;
  const reconId = req.params.reconId;

  try {
    // Fetch reconciliation (read-only snapshot)
    const reconRes = await db.query(
      'SELECT * FROM paye_reconciliations WHERE id = $1 AND company_id = $2',
      [reconId, companyId]
    );

    if (reconRes.rows.length === 0) {
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    const recon = reconRes.rows[0];

    // Fetch all employee lines with income and deduction details
    const employeeLinesRes = await db.query(`
      SELECT
        el.*,
        e.employee_code,
        e.first_name,
        e.last_name,
        (
          SELECT json_agg(json_build_object('incomeTypeKey', income_type_key, 'amount', amount))
          FROM paye_employee_income_lines
          WHERE paye_employee_line_id = el.id
        ) as income_lines,
        (
          SELECT json_agg(json_build_object('deductionTypeKey', deduction_type_key, 'amount', amount))
          FROM paye_employee_deduction_lines
          WHERE paye_employee_line_id = el.id
        ) as deduction_lines
      FROM paye_employee_lines el
      JOIN employees e ON el.employee_id = e.id
      WHERE el.paye_reconciliation_id = $1
      ORDER BY e.employee_code, el.month_key
    `, [reconId]);

    // Fetch config used for this reconciliation
    const config = await getConfig(companyId);

    res.json({
      reconciliation: recon,
      employeeLines: employeeLinesRes.rows,
      config,
      readOnly: recon.status === 'APPROVED' || recon.status === 'LOCKED'
    });
  } catch (err) {
    console.error('Snapshot error:', err);
    res.status(500).json({ error: 'Failed to fetch PAYE reconciliation snapshot' });
  }
};
