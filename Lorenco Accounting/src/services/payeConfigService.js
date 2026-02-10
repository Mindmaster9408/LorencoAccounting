// PAYE Configuration Service
const db = require('../config/database');

// GET: Fetch PAYE config (income & deduction types)
exports.getConfig = async (req, res) => {
  const companyId = req.user.companyId;
  try {
    const incomeTypes = await db.query('SELECT * FROM paye_config_income_types WHERE company_id = $1 AND is_active = true', [companyId]);
    const deductionTypes = await db.query('SELECT * FROM paye_config_deduction_types WHERE company_id = $1 AND is_active = true', [companyId]);
    res.json({ incomeTypes: incomeTypes.rows, deductionTypes: deductionTypes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch PAYE configuration.' });
  }
};

// PUT: Update PAYE config (income & deduction types)
exports.updateConfig = async (req, res) => {
  const companyId = req.user.companyId;
  const { incomeTypes, deductionTypes } = req.body;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    // Deactivate all current types
    await client.query('UPDATE paye_config_income_types SET is_active = false WHERE company_id = $1', [companyId]);
    await client.query('UPDATE paye_config_deduction_types SET is_active = false WHERE company_id = $1', [companyId]);
    // Upsert new/active types
    for (const t of incomeTypes) {
      await client.query(`INSERT INTO paye_config_income_types (company_id, key, label, is_default, is_custom, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (company_id, key) DO UPDATE SET label = $3, is_default = $4, is_custom = $5, is_active = true`,
        [companyId, t.key, t.label, !!t.isDefault, !!t.isCustom]);
    }
    for (const t of deductionTypes) {
      await client.query(`INSERT INTO paye_config_deduction_types (company_id, key, label, is_default, is_custom, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (company_id, key) DO UPDATE SET label = $3, is_default = $4, is_custom = $5, is_active = true`,
        [companyId, t.key, t.label, !!t.isDefault, !!t.isCustom]);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update PAYE configuration.' });
  } finally {
    client.release();
  }
};
