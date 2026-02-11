/**
 * ============================================================================
 * Database Seed — Master Admin Account
 * ============================================================================
 * Creates the master admin user + default company on first run.
 * Skips if users already exist. Safe to run on every startup.
 * ============================================================================
 */

const bcrypt = require('bcrypt');

const MASTER_USER = {
  username: 'ruanvlog@lorenco.co.za',
  email: 'ruanvlog@lorenco.co.za',
  full_name: 'Ruan',
  password: 'Mindmaster@277477',
  is_super_admin: true,
  role: 'super_admin'
};

const DEFAULT_COMPANY = {
  company_name: 'Lorenco Accounting Services',
  trading_name: 'Lorenco',
  is_active: true,
  modules_enabled: ['pos', 'payroll', 'accounting', 'sean'],
  subscription_status: 'active'
};

async function seedMasterAdmin(supabase) {
  try {
    // Check if any users exist
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (checkError) {
      console.error('  ⚠️  Seed: Could not check users table:', checkError.message);
      return;
    }

    if (existingUsers && existingUsers.length > 0) {
      console.log('  ✅ Users exist — skipping seed');
      return;
    }

    console.log('  🌱 No users found — seeding master admin...');

    // Hash master password
    const password_hash = await bcrypt.hash(MASTER_USER.password, 12);

    // Create master user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        username: MASTER_USER.username,
        email: MASTER_USER.email,
        full_name: MASTER_USER.full_name,
        password_hash,
        role: MASTER_USER.role,
        is_super_admin: MASTER_USER.is_super_admin,
        is_active: true
      })
      .select()
      .single();

    if (userError) {
      console.error('  ❌ Seed: Failed to create user:', userError.message);
      return;
    }
    console.log(`  ✅ Master admin created (ID: ${user.id}) — ${MASTER_USER.email}`);

    // Ensure company exists
    let { data: company } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .single();

    if (!company) {
      const { data: newCompany, error: compError } = await supabase
        .from('companies')
        .insert(DEFAULT_COMPANY)
        .select()
        .single();

      if (compError) {
        console.error('  ❌ Seed: Failed to create company:', compError.message);
        return;
      }
      company = newCompany;
      console.log(`  ✅ Default company created (ID: ${company.id}) — ${DEFAULT_COMPANY.company_name}`);
    }

    // Link user to company as business_owner
    const { error: linkError } = await supabase
      .from('user_company_access')
      .insert({
        user_id: user.id,
        company_id: company.id,
        role: 'business_owner',
        is_primary: true,
        is_active: true
      });

    if (linkError) {
      console.error('  ❌ Seed: Failed to link user to company:', linkError.message);
    } else {
      console.log(`  ✅ User linked to company as business_owner`);
    }

    console.log('\n  🎉 Seed complete! Login with:');
    console.log(`     Email:    ${MASTER_USER.email}`);
    console.log(`     Password: ${MASTER_USER.password}\n`);

  } catch (err) {
    console.error('  ❌ Seed error:', err.message);
  }
}

module.exports = { seedMasterAdmin };
