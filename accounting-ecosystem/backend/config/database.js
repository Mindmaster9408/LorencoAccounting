/**
 * ============================================================================
 * Database Configuration - Supabase Connection
 * ============================================================================
 * Centralized database connection used by all modules.
 * Uses Supabase JS client with service-role key for backend operations.
 * ============================================================================
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables');
  console.error('   Copy .env.example to .env and fill in your Supabase credentials');
  process.exit(1);
}

// Service-role client (bypasses RLS — use for backend operations only)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Anon client (respects RLS — use when forwarding user context)
const supabaseAnon = SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/**
 * Helper: run a query and return { data, error }
 * Wraps common patterns for cleaner route code.
 */
async function dbQuery(table) {
  return supabase.from(table);
}

/**
 * Health check — verify Supabase connection is working
 */
async function checkConnection() {
  try {
    const { data, error } = await supabase.from('companies').select('id').limit(1);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('❌ Supabase connection test failed:', err.message);
    return false;
  }
}

/**
 * BUG FIX #1: Ensure default company only created if none exist.
 * Previously, a default company was created on every startup.
 */
async function ensureDefaultCompany() {
  try {
    const { data: existing, error } = await supabase
      .from('companies')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Error checking companies:', error.message);
      return;
    }

    // Only create default if NO companies exist at all
    if (!existing || existing.length === 0) {
      const { data, error: insertError } = await supabase
        .from('companies')
        .insert({
          company_name: 'Default Company',
          trading_name: 'Default',
          is_active: true,
          modules_enabled: ['pos'],
          subscription_status: 'active'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating default company:', insertError.message);
      } else {
        console.log('✅ Default company created (ID:', data.id, ')');
      }
    } else {
      console.log('✅ Companies exist — skipping default company creation');
    }
  } catch (err) {
    console.error('Error in ensureDefaultCompany:', err.message);
  }
}

module.exports = {
  supabase,
  supabaseAnon,
  dbQuery,
  checkConnection,
  ensureDefaultCompany
};
