const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function migrateVATRecon() {
  console.log('🚀 Starting VAT Reconciliation System migration...');

  try {
    const migrationPath = path.join(__dirname, '../../migrations/004_add_vat_reconciliation_system.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Executing VAT reconciliation migration...');
    await db.query(migration);

    console.log('✅ VAT Reconciliation System activated successfully!');
    console.log('');
    console.log('Tables created:');
    console.log('  ✓ vat_periods');
    console.log('  ✓ vat_reports');
    console.log('  ✓ vat_reconciliations');
    console.log('  ✓ vat_reconciliation_lines');
    console.log('  ✓ vat_submissions');
    console.log('');
    console.log('API routes available at: /api/vat-recon');
    console.log('Frontend updated: vat.html');
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateVATRecon();
