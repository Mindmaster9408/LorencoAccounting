-- ========================================================
-- VAT RECONCILIATION SYSTEM - MIGRATION 004
-- ========================================================
-- Implements comprehensive VAT reconciliation with approval,
-- authorization, locking, and submission tracking
-- ========================================================

-- VAT Periods Table
-- Stores each VAT filing period with status and locking
CREATE TABLE IF NOT EXISTS vat_periods (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    period_key VARCHAR(50) NOT NULL, -- e.g., '2024.03', '2024.04'
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    filing_frequency VARCHAR(50) NOT NULL CHECK (filing_frequency IN ('monthly', 'bi-monthly', 'quarterly', 'six-monthly', 'custom')),
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'SUBMITTED', 'LOCKED')),
    
    -- Locking fields
    locked_at TIMESTAMP,
    locked_by_user_id INTEGER REFERENCES users(id),
    
    -- Submission tracking
    submitted_at TIMESTAMP,
    submitted_by_user_id INTEGER REFERENCES users(id),
    submission_reference VARCHAR(255),
    
    -- Payment tracking
    payment_date DATE,
    payment_reference VARCHAR(255),
    
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(company_id, period_key)
);

CREATE INDEX idx_vat_periods_company_id ON vat_periods(company_id);
CREATE INDEX idx_vat_periods_period_key ON vat_periods(company_id, period_key);
CREATE INDEX idx_vat_periods_dates ON vat_periods(from_date, to_date);
CREATE INDEX idx_vat_periods_status ON vat_periods(status);

-- VAT Reports Table
-- Stores the official VAT report snapshot for each period
CREATE TABLE IF NOT EXISTS vat_reports (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vat_period_id INTEGER NOT NULL REFERENCES vat_periods(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'LOCKED')),
    
    -- VAT Report Totals
    output_vat DECIMAL(15, 2) DEFAULT 0.00,
    input_vat DECIMAL(15, 2) DEFAULT 0.00,
    net_vat DECIMAL(15, 2) DEFAULT 0.00, -- output - input
    
    -- VAT201 Box Details (stored as JSONB for flexibility)
    box_details JSONB,
    
    -- Locking
    locked_at TIMESTAMP,
    locked_by_user_id INTEGER REFERENCES users(id),
    
    -- Creation tracking
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by_user_id INTEGER REFERENCES users(id),
    
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(vat_period_id, version)
);

CREATE INDEX idx_vat_reports_company_id ON vat_reports(company_id);
CREATE INDEX idx_vat_reports_vat_period_id ON vat_reports(vat_period_id);
CREATE INDEX idx_vat_reports_status ON vat_reports(status);

-- VAT Reconciliations Table
-- Stores reconciliation snapshots comparing VAT report to Trial Balance
CREATE TABLE IF NOT EXISTS vat_reconciliations (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vat_period_id INTEGER NOT NULL REFERENCES vat_periods(id) ON DELETE CASCADE,
    vat_report_id INTEGER REFERENCES vat_reports(id),
    version INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'LOCKED')),
    
    -- Authorization for Income/Expense Difference
    diff_authorized BOOLEAN DEFAULT false,
    diff_authorized_by_user_id INTEGER REFERENCES users(id),
    diff_authorized_by_initials VARCHAR(10),
    diff_authorized_at TIMESTAMP,
    
    -- Authorization for Statement of Account Difference
    soa_authorized BOOLEAN DEFAULT false,
    soa_authorized_by_user_id INTEGER REFERENCES users(id),
    soa_authorized_by_initials VARCHAR(10),
    soa_authorized_at TIMESTAMP,
    
    -- Statement of Account fields
    soa_amount DECIMAL(15, 2),
    soa_difference DECIMAL(15, 2), -- net_vat - soa_amount
    
    -- Approval tracking
    approved_at TIMESTAMP,
    approved_by_user_id INTEGER REFERENCES users(id),
    
    -- Locking
    locked_at TIMESTAMP,
    locked_by_user_id INTEGER REFERENCES users(id),
    
    -- Submission tracking (linked to period submission)
    submitted_at TIMESTAMP,
    submitted_by_user_id INTEGER REFERENCES users(id),
    
    -- Creation tracking
    created_by_user_id INTEGER REFERENCES users(id),
    
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(vat_period_id, version)
);

CREATE INDEX idx_vat_reconciliations_company_id ON vat_reconciliations(company_id);
CREATE INDEX idx_vat_reconciliations_vat_period_id ON vat_reconciliations(vat_period_id);
CREATE INDEX idx_vat_reconciliations_vat_report_id ON vat_reconciliations(vat_report_id);
CREATE INDEX idx_vat_reconciliations_status ON vat_reconciliations(status);

-- VAT Reconciliation Lines Table
-- Stores individual line items for the reconciliation
CREATE TABLE IF NOT EXISTS vat_reconciliation_lines (
    id SERIAL PRIMARY KEY,
    vat_reconciliation_id INTEGER NOT NULL REFERENCES vat_reconciliations(id) ON DELETE CASCADE,
    section_key VARCHAR(100) NOT NULL, -- 'INCOME_OUTPUT', 'EXPENSE_INPUT', 'TB_INCOME', 'TB_EXPENSE'
    row_key VARCHAR(100) NOT NULL, -- Account code or description key
    label VARCHAR(255) NOT NULL,
    line_order INTEGER DEFAULT 0,
    
    -- Values
    vat_amount DECIMAL(15, 2), -- From VAT report
    tb_amount DECIMAL(15, 2), -- From Trial Balance
    statement_amount DECIMAL(15, 2), -- From Statement of Account
    difference_amount DECIMAL(15, 2), -- Calculated difference
    
    -- Additional fields
    account_id INTEGER REFERENCES accounts(id),
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vat_reconciliation_lines_recon_id ON vat_reconciliation_lines(vat_reconciliation_id);
CREATE INDEX idx_vat_reconciliation_lines_section ON vat_reconciliation_lines(section_key);
CREATE INDEX idx_vat_reconciliation_lines_account_id ON vat_reconciliation_lines(account_id);

-- VAT Submission History Table
-- Tracks all submissions to SARS
CREATE TABLE IF NOT EXISTS vat_submissions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vat_period_id INTEGER NOT NULL REFERENCES vat_periods(id) ON DELETE CASCADE,
    vat_report_id INTEGER REFERENCES vat_reports(id),
    vat_reconciliation_id INTEGER REFERENCES vat_reconciliations(id),
    
    -- Submission details
    submission_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    submitted_by_user_id INTEGER NOT NULL REFERENCES users(id),
    submission_reference VARCHAR(255),
    
    -- Amounts submitted
    output_vat DECIMAL(15, 2) NOT NULL,
    input_vat DECIMAL(15, 2) NOT NULL,
    net_vat DECIMAL(15, 2) NOT NULL,
    
    -- Payment tracking
    payment_date DATE,
    payment_reference VARCHAR(255),
    payment_status VARCHAR(50) DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'REFUND_PENDING', 'REFUNDED')),
    
    -- Status
    status VARCHAR(50) DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'ACKNOWLEDGED', 'REJECTED', 'COMPLETED')),
    
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vat_submissions_company_id ON vat_submissions(company_id);
CREATE INDEX idx_vat_submissions_vat_period_id ON vat_submissions(vat_period_id);
CREATE INDEX idx_vat_submissions_submission_date ON vat_submissions(submission_date);
CREATE INDEX idx_vat_submissions_status ON vat_submissions(status);

-- ========================================================
-- TRIGGERS FOR UPDATED_AT
-- ========================================================

CREATE TRIGGER update_vat_periods_updated_at BEFORE UPDATE ON vat_periods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vat_reports_updated_at BEFORE UPDATE ON vat_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vat_reconciliations_updated_at BEFORE UPDATE ON vat_reconciliations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vat_submissions_updated_at BEFORE UPDATE ON vat_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================================
-- COMMENTS
-- ========================================================

COMMENT ON TABLE vat_periods IS 'VAT filing periods with status and locking';
COMMENT ON TABLE vat_reports IS 'VAT report snapshots for each period';
COMMENT ON TABLE vat_reconciliations IS 'VAT reconciliation snapshots comparing report to TB';
COMMENT ON TABLE vat_reconciliation_lines IS 'Individual line items in VAT reconciliation';
COMMENT ON TABLE vat_submissions IS 'VAT submission history and tracking';

COMMENT ON COLUMN vat_reconciliations.diff_authorized IS 'Authorization for Income/Expense difference';
COMMENT ON COLUMN vat_reconciliations.soa_authorized IS 'Authorization for Statement of Account difference';
COMMENT ON COLUMN vat_reconciliations.soa_amount IS 'Amount according to SARS statement of account';
COMMENT ON COLUMN vat_reconciliations.soa_difference IS 'Difference between net VAT and SOA amount';
