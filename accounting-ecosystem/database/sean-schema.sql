-- ============================================================================
-- SEAN AI Foundation — Database Schema
-- Privacy-First & Zero External API Costs
-- ============================================================================
-- Part of the Accounting Ecosystem unified backend
-- All tables use company_id for multi-tenant isolation
-- ============================================================================

-- ─── Company Private Codex (Encrypted — NO visibility for admin) ─────────────
-- Stores learned decisions per company, encrypted at rest.
-- Only the owning company can decrypt their own codex entries.
CREATE TABLE IF NOT EXISTS sean_codex_private (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  encrypted_data BYTEA NOT NULL,
  encryption_key_id VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  context_hash VARCHAR(64),
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  times_used INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_codex_company ON sean_codex_private(company_id);
CREATE INDEX IF NOT EXISTS idx_codex_hash ON sean_codex_private(context_hash);
CREATE INDEX IF NOT EXISTS idx_codex_confidence ON sean_codex_private(confidence DESC);

-- ─── Global Pattern Library (Anonymized — NO amounts, names, or company IDs) ─
-- Shared intelligence: merchant/vendor patterns learned across all companies.
-- Contains NO private data — only aggregated outcome distributions.
CREATE TABLE IF NOT EXISTS sean_patterns_global (
  id SERIAL PRIMARY KEY,
  pattern_type VARCHAR(50) NOT NULL,
  pattern_key TEXT NOT NULL UNIQUE,
  amount_range VARCHAR(50),
  merchant_pattern VARCHAR(255),
  companies_contributed INTEGER DEFAULT 0,
  total_occurrences INTEGER DEFAULT 0,
  outcome_distribution JSONB,
  confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patterns_type ON sean_patterns_global(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_key ON sean_patterns_global(pattern_key);
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON sean_patterns_global(confidence_score DESC);

-- ─── SEAN Learning Log (Track interactions) ──────────────────────────────────
-- Every decision SEAN makes or learns from is logged here.
CREATE TABLE IF NOT EXISTS sean_learning_log (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  interaction_type VARCHAR(50) NOT NULL,
  context_provided TEXT,
  sean_suggestion TEXT,
  user_action TEXT,
  was_correct BOOLEAN,
  stored_in_codex BOOLEAN DEFAULT false,
  contributed_to_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_company ON sean_learning_log(company_id);
CREATE INDEX IF NOT EXISTS idx_learning_date ON sean_learning_log(created_at DESC);

-- ─── SEAN Knowledge Base (Codex Rules — Tax, VAT, Deductions) ────────────────
-- Stores structured accounting knowledge: tax rules, VAT cross-refs, 
-- decision engines, lookup tables. No external API needed.
CREATE TABLE IF NOT EXISTS sean_knowledge_items (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  domain VARCHAR(50) NOT NULL,  -- VAT, INCOME_TAX, COMPANY_TAX, PAYROLL, etc.
  layer VARCHAR(20) DEFAULT 'LEGAL',  -- LEGAL, FIRM, CLIENT
  content TEXT NOT NULL,
  content_type VARCHAR(30) DEFAULT 'text',  -- text, tax_rule, vat_cross_reference, decision_engine, lookup_table
  tags TEXT[],
  citation_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'APPROVED',
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,  -- NULL = global
  version INTEGER DEFAULT 1,
  language VARCHAR(10) DEFAULT 'EN',  -- EN, AF, MIXED
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_domain ON sean_knowledge_items(domain);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON sean_knowledge_items(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_company ON sean_knowledge_items(company_id);

-- ─── Allocation Rules (Learned patterns per company) ─────────────────────────
CREATE TABLE IF NOT EXISTS sean_allocation_rules (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  is_global BOOLEAN DEFAULT false,
  normalized_pattern TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  confidence DECIMAL(3,2) DEFAULT 0.80,
  learned_from_count INTEGER DEFAULT 1,
  last_matched TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alloc_rules_company ON sean_allocation_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_alloc_rules_pattern ON sean_allocation_rules(normalized_pattern);

-- ─── Bank Transactions (for allocation processing) ──────────────────────────
CREATE TABLE IF NOT EXISTS sean_bank_transactions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type VARCHAR(10) DEFAULT 'debit',  -- debit, credit
  merchant VARCHAR(255),
  suggested_category VARCHAR(50),
  confirmed_category VARCHAR(50),
  confidence DECIMAL(3,2),
  match_type VARCHAR(30),  -- exact, learned, keyword, industry, rule_based, user_input
  allocated_by VARCHAR(20),  -- sean, user
  allocation_rule_id INTEGER REFERENCES sean_allocation_rules(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_txn_company ON sean_bank_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_txn_date ON sean_bank_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_txn_category ON sean_bank_transactions(confirmed_category);

-- ─── Row Level Security (CRITICAL — Privacy enforcement) ─────────────────────
ALTER TABLE sean_codex_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE sean_learning_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sean_bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sean_allocation_rules ENABLE ROW LEVEL SECURITY;

-- Policy: Company can ONLY see their own Codex
CREATE POLICY codex_company_isolation ON sean_codex_private
  FOR ALL
  USING (
    company_id = (current_setting('request.jwt.claims', true)::json->>'companyId')::integer
  );

-- Policy: Company can ONLY see their own learning log
CREATE POLICY learning_company_isolation ON sean_learning_log
  FOR ALL
  USING (
    company_id = (current_setting('request.jwt.claims', true)::json->>'companyId')::integer
  );

-- Policy: Company can ONLY see their own transactions
CREATE POLICY transactions_company_isolation ON sean_bank_transactions
  FOR ALL
  USING (
    company_id = (current_setting('request.jwt.claims', true)::json->>'companyId')::integer
  );

-- Policy: Company can see global rules + their own
CREATE POLICY rules_company_isolation ON sean_allocation_rules
  FOR ALL
  USING (
    is_global = true OR
    company_id = (current_setting('request.jwt.claims', true)::json->>'companyId')::integer
  );

-- Global patterns: No RLS (contains no private data)

-- ─── Seed: Initial Global Patterns (SA-specific) ────────────────────────────
INSERT INTO sean_patterns_global (pattern_type, pattern_key, amount_range, merchant_pattern, outcome_distribution, confidence_score, reasoning) VALUES
('merchant_allocation', 'engen_small', '<R50', 'Engen|Shell|BP|Sasol', '{"snacks": 85, "fuel": 2, "airtime": 10, "car_accessories": 3}', 88, 'Small transactions at fuel stations are usually convenience store purchases'),
('merchant_allocation', 'engen_large', '>R500', 'Engen|Shell|BP|Sasol', '{"fuel": 95, "car_wash": 3, "shop": 2}', 96, 'Large transactions at fuel stations are usually fuel fills'),
('merchant_allocation', 'woolworths_small', '<R100', 'Woolworths', '{"groceries": 40, "clothing": 50, "homeware": 10}', 75, 'Small Woolworths purchases could be various categories'),
('merchant_allocation', 'woolworths_large', '>R500', 'Woolworths', '{"groceries": 90, "clothing": 8, "homeware": 2}', 92, 'Large Woolworths purchases are usually groceries'),
('merchant_allocation', 'uber_eats', 'any', 'Uber Eats|Mr D Food', '{"meals_entertainment": 85, "client_entertainment": 10, "employee_benefits": 5}', 90, 'Food delivery is typically meals, context determines if client or employee'),
('merchant_allocation', 'checkers_shoprite', 'any', 'Checkers|Shoprite', '{"groceries": 92, "other": 8}', 94, 'Checkers/Shoprite are predominantly grocery stores'),
('merchant_allocation', 'pick_n_pay', 'any', 'Pick n Pay|PnP', '{"groceries": 88, "clothing": 7, "other": 5}', 90, 'Pick n Pay is primarily groceries'),
('merchant_allocation', 'telkom_vodacom', 'any', 'Telkom|Vodacom|MTN|Cell C', '{"telephone": 95, "other": 5}', 96, 'Telecom providers are almost always communication expenses'),
('merchant_allocation', 'fnb_absa_fees', '<R200', 'FNB|ABSA|Nedbank|Standard Bank|Capitec', '{"bank_charges": 95, "other": 5}', 97, 'Small bank debits are typically service fees'),
('payroll_rule', 'sunday_overtime', 'any', 'overtime_sunday', '{"rate": 200, "taxable": true, "include_uif": true}', 95, 'Sunday work typically paid at double time in South Africa'),
('payroll_rule', 'public_holiday', 'any', 'overtime_public_holiday', '{"rate": 200, "taxable": true, "include_uif": true}', 95, 'Public holiday work paid at double time in SA')
ON CONFLICT (pattern_key) DO NOTHING;
