-- ========================================================
-- LORENCO ACCOUNTING SYSTEM - DATABASE SCHEMA
-- ========================================================
-- Multi-tenant accounting system with optional AI add-on
-- PostgreSQL 14+
-- ========================================================

-- ========================================================
-- PHASE 1: FOUNDATION TABLES
-- ========================================================

-- Companies (Tenants)
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'read_only')),
    currency VARCHAR(3) DEFAULT 'ZAR',
    timezone VARCHAR(50) DEFAULT 'Africa/Johannesburg',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_companies_status ON companies(status);

-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'accountant', 'bookkeeper', 'viewer')),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Audit Log
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    actor_type VARCHAR(50) NOT NULL CHECK (actor_type IN ('USER', 'AI', 'SYSTEM')),
    actor_id INTEGER,
    action_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER,
    before_json JSONB,
    after_json JSONB,
    reason TEXT,
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_company_id ON audit_log(company_id);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_type, actor_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_log_action_type ON audit_log(action_type);

-- ========================================================
-- PHASE 2: CORE ACCOUNTING TABLES
-- ========================================================

-- Chart of Accounts
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
    parent_id INTEGER REFERENCES accounts(id),
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, code)
);

CREATE INDEX idx_accounts_company_id ON accounts(company_id);
CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_code ON accounts(company_id, code);
CREATE INDEX idx_accounts_parent_id ON accounts(parent_id);

-- Accounting Periods (for locking)
CREATE TABLE accounting_periods (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMP,
    locked_by_user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, from_date, to_date)
);

CREATE INDEX idx_accounting_periods_company_id ON accounting_periods(company_id);
CREATE INDEX idx_accounting_periods_dates ON accounting_periods(from_date, to_date);

-- Journals (Header)
CREATE TABLE journals (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    reference VARCHAR(100),
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed')),
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('manual', 'bank', 'payroll', 'vat', 'ai', 'system')),
    reversal_of_journal_id INTEGER REFERENCES journals(id),
    reversed_by_journal_id INTEGER REFERENCES journals(id),
    created_by_user_id INTEGER REFERENCES users(id),
    posted_by_user_id INTEGER REFERENCES users(id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    posted_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_journals_company_id ON journals(company_id);
CREATE INDEX idx_journals_date ON journals(date);
CREATE INDEX idx_journals_status ON journals(status);
CREATE INDEX idx_journals_source_type ON journals(source_type);
CREATE INDEX idx_journals_created_by ON journals(created_by_user_id);

-- Journal Lines (Debit/Credit entries)
CREATE TABLE journal_lines (
    id SERIAL PRIMARY KEY,
    journal_id INTEGER NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    line_number INTEGER NOT NULL,
    description TEXT,
    debit DECIMAL(15, 2) DEFAULT 0.00 CHECK (debit >= 0),
    credit DECIMAL(15, 2) DEFAULT 0.00 CHECK (credit >= 0),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX idx_journal_lines_journal_id ON journal_lines(journal_id);
CREATE INDEX idx_journal_lines_account_id ON journal_lines(account_id);

-- Bank Accounts
CREATE TABLE bank_accounts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(255),
    account_number_masked VARCHAR(50),
    currency VARCHAR(3) DEFAULT 'ZAR',
    ledger_account_id INTEGER REFERENCES accounts(id),
    is_active BOOLEAN DEFAULT true,
    opening_balance DECIMAL(15, 2) DEFAULT 0.00,
    opening_balance_date DATE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bank_accounts_company_id ON bank_accounts(company_id);
CREATE INDEX idx_bank_accounts_ledger_account_id ON bank_accounts(ledger_account_id);

-- Bank Transactions
CREATE TABLE bank_transactions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    balance DECIMAL(15, 2),
    reference VARCHAR(255),
    external_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'reconciled')),
    matched_entity_type VARCHAR(50),
    matched_entity_id INTEGER,
    matched_by_user_id INTEGER REFERENCES users(id),
    reconciled_at TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bank_transactions_company_id ON bank_transactions(company_id);
CREATE INDEX idx_bank_transactions_bank_account_id ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(date);
CREATE INDEX idx_bank_transactions_status ON bank_transactions(status);
CREATE INDEX idx_bank_transactions_external_id ON bank_transactions(bank_account_id, external_id);

-- ========================================================
-- PHASE 3: AI ADD-ON TABLES
-- ========================================================

-- AI Settings - Company Level
CREATE TABLE ai_settings_company (
    company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Settings - Capabilities
CREATE TABLE ai_settings_capabilities (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    capability_key VARCHAR(100) NOT NULL CHECK (capability_key IN (
        'BANK_ALLOCATION',
        'BANK_RECONCILIATION',
        'JOURNAL_PREP',
        'REPORT_PREP',
        'PAYROLL_RECON',
        'VAT_RECON'
    )),
    mode VARCHAR(50) DEFAULT 'off' CHECK (mode IN ('off', 'suggest', 'draft', 'auto')),
    min_confidence DECIMAL(3, 2) DEFAULT 0.80 CHECK (min_confidence >= 0 AND min_confidence <= 1),
    is_enabled BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, capability_key)
);

CREATE INDEX idx_ai_capabilities_company_id ON ai_settings_capabilities(company_id);
CREATE INDEX idx_ai_capabilities_key ON ai_settings_capabilities(capability_key);

-- AI Settings - User Overrides
CREATE TABLE ai_settings_user_overrides (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    capability_key VARCHAR(100) NOT NULL,
    mode_override VARCHAR(50) CHECK (mode_override IN ('off', 'suggest', 'draft', 'auto')),
    is_enabled_override BOOLEAN,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, user_id, capability_key)
);

CREATE INDEX idx_ai_user_overrides_company_user ON ai_settings_user_overrides(company_id, user_id);

-- AI Actions
CREATE TABLE ai_actions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    requested_by_user_id INTEGER NOT NULL REFERENCES users(id),
    capability_key VARCHAR(100) NOT NULL,
    mode_used VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending',
        'processing',
        'ready_for_review',
        'approved',
        'rejected',
        'executed',
        'failed'
    )),
    input_refs JSONB,
    output_json JSONB,
    confidence DECIMAL(3, 2),
    rationale TEXT,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_actions_company_id ON ai_actions(company_id);
CREATE INDEX idx_ai_actions_user_id ON ai_actions(requested_by_user_id);
CREATE INDEX idx_ai_actions_status ON ai_actions(status);
CREATE INDEX idx_ai_actions_capability ON ai_actions(capability_key);
CREATE INDEX idx_ai_actions_created_at ON ai_actions(created_at);

-- AI Action Steps (for complex multi-step operations)
CREATE TABLE ai_action_steps (
    id SERIAL PRIMARY KEY,
    ai_action_id INTEGER NOT NULL REFERENCES ai_actions(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_type VARCHAR(100) NOT NULL,
    step_data JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_action_steps_action_id ON ai_action_steps(ai_action_id);

-- AI Approvals
CREATE TABLE ai_approvals (
    id SERIAL PRIMARY KEY,
    ai_action_id INTEGER NOT NULL REFERENCES ai_actions(id) ON DELETE CASCADE,
    approved_by_user_id INTEGER NOT NULL REFERENCES users(id),
    decision VARCHAR(50) NOT NULL CHECK (decision IN ('approve', 'reject', 'edit')),
    notes TEXT,
    edited_output JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_approvals_action_id ON ai_approvals(ai_action_id);
CREATE INDEX idx_ai_approvals_user_id ON ai_approvals(approved_by_user_id);

-- ========================================================
-- FUNCTIONS AND TRIGGERS
-- ========================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journals_updated_at BEFORE UPDATE ON journals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_transactions_updated_at BEFORE UPDATE ON bank_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_settings_company_updated_at BEFORE UPDATE ON ai_settings_company
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_settings_capabilities_updated_at BEFORE UPDATE ON ai_settings_capabilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_settings_user_overrides_updated_at BEFORE UPDATE ON ai_settings_user_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_actions_updated_at BEFORE UPDATE ON ai_actions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================================
-- VIEWS FOR REPORTING
-- ========================================================

-- View: General Ledger (all posted journal lines with account details)
CREATE OR REPLACE VIEW vw_general_ledger AS
SELECT 
    jl.id,
    j.company_id,
    j.date,
    j.reference,
    j.description as journal_description,
    jl.description as line_description,
    a.code as account_code,
    a.name as account_name,
    a.type as account_type,
    jl.debit,
    jl.credit,
    CASE 
        WHEN jl.debit > 0 THEN jl.debit 
        WHEN jl.credit > 0 THEN -jl.credit 
        ELSE 0 
    END as net_movement,
    j.source_type,
    j.posted_at,
    j.id as journal_id,
    jl.account_id
FROM journal_lines jl
JOIN journals j ON jl.journal_id = j.id
JOIN accounts a ON jl.account_id = a.id
WHERE j.status = 'posted'
ORDER BY j.date, j.id, jl.line_number;

-- ========================================================
-- COMMENTS
-- ========================================================

COMMENT ON TABLE companies IS 'Multi-tenant companies (one per client)';
COMMENT ON TABLE users IS 'Users with role-based permissions';
COMMENT ON TABLE audit_log IS 'Complete audit trail for all actions';
COMMENT ON TABLE accounts IS 'Chart of accounts';
COMMENT ON TABLE accounting_periods IS 'Period locking for compliance';
COMMENT ON TABLE journals IS 'Journal headers (double-entry)';
COMMENT ON TABLE journal_lines IS 'Journal line items with debits/credits';
COMMENT ON TABLE bank_accounts IS 'Bank account registry';
COMMENT ON TABLE bank_transactions IS 'Imported bank statement transactions';
COMMENT ON TABLE ai_settings_company IS 'Company-level AI enablement';
COMMENT ON TABLE ai_settings_capabilities IS 'AI capability toggles and modes';
COMMENT ON TABLE ai_settings_user_overrides IS 'User-specific AI overrides';
COMMENT ON TABLE ai_actions IS 'AI action requests and results';
COMMENT ON TABLE ai_action_steps IS 'Multi-step AI operation tracking';
COMMENT ON TABLE ai_approvals IS 'Review queue approvals/rejections';

-- ========================================================
-- BANK TRANSACTION ATTACHMENTS
-- ========================================================

-- Create bank_transaction_attachments table
CREATE TABLE IF NOT EXISTS bank_transaction_attachments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    bank_transaction_id INTEGER NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by_user_id INTEGER REFERENCES users(id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bank_transaction_attachments_company_id ON bank_transaction_attachments(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_transaction_attachments_bank_transaction_id ON bank_transaction_attachments(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_bank_transaction_attachments_uploaded_by ON bank_transaction_attachments(uploaded_by_user_id);

COMMENT ON TABLE bank_transaction_attachments IS 'Stores file attachments (invoices, receipts, etc.) for bank transactions';

