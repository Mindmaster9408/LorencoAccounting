const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function seed() {
  console.log('🌱 Starting database seeding...');

  try {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Create sample company
      console.log('Creating sample company...');
      const companyResult = await client.query(`
        INSERT INTO companies (name, status, currency, timezone)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, ['Acme Corporation', 'active', 'ZAR', 'Africa/Johannesburg']);
      
      const companyId = companyResult.rows[0].id;
      console.log(`✓ Created company with ID: ${companyId}`);

      // Create admin user
      console.log('Creating admin user...');
      const passwordHash = await bcrypt.hash('admin123', 10);
      await client.query(`
        INSERT INTO users (company_id, email, password_hash, role, first_name, last_name, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [companyId, 'admin@acme.com', passwordHash, 'admin', 'Admin', 'User', true]);
      console.log('✓ Created admin user (admin@acme.com / admin123)');

      // Create global admin users
      console.log('Creating global admin users...');
      const globalAdminPassword = await bcrypt.hash('LorencoAdmin2026!', 10);
      
      await client.query(`
        INSERT INTO users (company_id, email, password_hash, role, first_name, last_name, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO NOTHING
      `, [companyId, 'ruanvlog@lorenco.co.za', globalAdminPassword, 'admin', 'Ruan', 'Global Admin', true]);
      
      await client.query(`
        INSERT INTO users (company_id, email, password_hash, role, first_name, last_name, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO NOTHING
      `, [companyId, 'antonjvr@lorenco.co.za', globalAdminPassword, 'admin', 'Anton', 'Global Admin', true]);
      console.log('✓ Created global admin users');

      // Create chart of accounts
      console.log('Creating chart of accounts...');
      const accounts = [
        // Assets
        { code: '1000', name: 'Bank - Current Account', type: 'asset' },
        { code: '1010', name: 'Bank - Savings Account', type: 'asset' },
        { code: '1100', name: 'Accounts Receivable', type: 'asset' },
        { code: '1200', name: 'Inventory', type: 'asset' },
        { code: '1500', name: 'Fixed Assets - Equipment', type: 'asset' },
        { code: '1510', name: 'Fixed Assets - Furniture', type: 'asset' },
        { code: '1600', name: 'Accumulated Depreciation', type: 'asset' },
        
        // Liabilities
        { code: '2000', name: 'Accounts Payable', type: 'liability' },
        { code: '2100', name: 'VAT Payable', type: 'liability' },
        { code: '2200', name: 'PAYE Payable', type: 'liability' },
        { code: '2300', name: 'UIF Payable', type: 'liability' },
        { code: '2400', name: 'Loan - Bank', type: 'liability' },
        
        // Equity
        { code: '3000', name: 'Share Capital', type: 'equity' },
        { code: '3100', name: 'Retained Earnings', type: 'equity' },
        { code: '3900', name: 'Current Year Earnings', type: 'equity' },
        
        // Income
        { code: '4000', name: 'Sales Revenue', type: 'income' },
        { code: '4100', name: 'Service Revenue', type: 'income' },
        { code: '4900', name: 'Other Income', type: 'income' },
        
        // Expenses
        { code: '5000', name: 'Cost of Sales', type: 'expense' },
        { code: '6000', name: 'Salaries and Wages', type: 'expense' },
        { code: '6100', name: 'Rent Expense', type: 'expense' },
        { code: '6200', name: 'Utilities', type: 'expense' },
        { code: '6300', name: 'Office Supplies', type: 'expense' },
        { code: '6400', name: 'Professional Fees', type: 'expense' },
        { code: '6500', name: 'Depreciation Expense', type: 'expense' },
        { code: '6600', name: 'Bank Charges', type: 'expense' },
        { code: '6700', name: 'Marketing and Advertising', type: 'expense' },
        { code: '6800', name: 'Travel and Entertainment', type: 'expense' },
      ];

      for (const account of accounts) {
        await client.query(`
          INSERT INTO accounts (company_id, code, name, type, is_active, is_system)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [companyId, account.code, account.name, account.type, true, true]);
      }
      console.log(`✓ Created ${accounts.length} accounts`);

      // Initialize AI settings (disabled by default)
      console.log('Initializing AI settings...');
      await client.query(`
        INSERT INTO ai_settings_company (company_id, is_enabled)
        VALUES ($1, $2)
      `, [companyId, false]);
      
      const capabilities = [
        'BANK_ALLOCATION',
        'BANK_RECONCILIATION',
        'JOURNAL_PREP',
        'REPORT_PREP',
        'PAYROLL_RECON',
        'VAT_RECON'
      ];
      
      for (const capability of capabilities) {
        await client.query(`
          INSERT INTO ai_settings_capabilities (company_id, capability_key, mode, min_confidence, is_enabled)
          VALUES ($1, $2, $3, $4, $5)
        `, [companyId, capability, 'off', 0.80, false]);
      }
      console.log(`✓ Initialized AI settings (all disabled by default)`);

      // Create sample bank account
      const bankAccountResult = await client.query(`
        SELECT id FROM accounts WHERE company_id = $1 AND code = '1000'
      `, [companyId]);
      
      const ledgerAccountId = bankAccountResult.rows[0]?.id;
      
      if (ledgerAccountId) {
        await client.query(`
          INSERT INTO bank_accounts (company_id, name, bank_name, account_number_masked, currency, ledger_account_id, is_active, opening_balance, opening_balance_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [companyId, 'Main Business Account', 'Standard Bank', '****1234', 'ZAR', ledgerAccountId, true, 0, new Date()]);
        console.log('✓ Created sample bank account');
      }

      await client.query('COMMIT');
      console.log('✅ Seeding completed successfully!');
      console.log('\n📋 Login credentials:');
      console.log('   Email: admin@acme.com');
      console.log('   Password: admin123');
      console.log('\n🔐 Global Admin credentials:');
      console.log('   Emails: ruanvlog@lorenco.co.za, antonjvr@lorenco.co.za');
      console.log('   Password: LorencoAdmin2026!');

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
