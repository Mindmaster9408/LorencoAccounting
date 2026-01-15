-- PAYE Reconciliation Module: Core Tables
-- Created: 2026-01-15

-- 1. Employees (reference, assumed already exists)
-- 2. PAYE Income Types
CREATE TABLE IF NOT EXISTS paye_config_income_types (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    key VARCHAR(64) NOT NULL,
    label VARCHAR(128) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. PAYE Deduction Types
CREATE TABLE IF NOT EXISTS paye_config_deduction_types (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    key VARCHAR(64) NOT NULL,
    label VARCHAR(128) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. PAYE Periods
CREATE TABLE IF NOT EXISTS paye_periods (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT', -- DRAFT|APPROVED|LOCKED
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. PAYE Reconciliations (per period, versioned)
CREATE TABLE IF NOT EXISTS paye_reconciliations (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    paye_period_id INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT', -- DRAFT|APPROVED|LOCKED
    created_by_user_id INTEGER,
    approved_by_user_id INTEGER,
    approved_at TIMESTAMP,
    locked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. PAYE Employee Lines (per employee, per month)
CREATE TABLE IF NOT EXISTS paye_employee_lines (
    id SERIAL PRIMARY KEY,
    paye_reconciliation_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    month_key VARCHAR(7) NOT NULL, -- e.g. '2026-01'
    gross_income NUMERIC(14,2) DEFAULT 0,
    total_deductions NUMERIC(14,2) DEFAULT 0,
    net_salary NUMERIC(14,2) DEFAULT 0,
    bank_paid_amount NUMERIC(14,2) DEFAULT 0,
    difference_amount NUMERIC(14,2) DEFAULT 0,
    metadata_json JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. PAYE Employee Income Lines
CREATE TABLE IF NOT EXISTS paye_employee_income_lines (
    id SERIAL PRIMARY KEY,
    paye_employee_line_id INTEGER NOT NULL,
    income_type_key VARCHAR(64) NOT NULL,
    amount NUMERIC(14,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 8. PAYE Employee Deduction Lines
CREATE TABLE IF NOT EXISTS paye_employee_deduction_lines (
    id SERIAL PRIMARY KEY,
    paye_employee_line_id INTEGER NOT NULL,
    deduction_type_key VARCHAR(64) NOT NULL,
    amount NUMERIC(14,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 9. Audit Log (for PAYE actions)
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    user_id INTEGER,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64),
    entity_id INTEGER,
    details_json JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
