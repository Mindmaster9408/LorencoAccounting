-- PAYE Reconciliation Module - Database Schema
-- Creates all tables required for PAYE reconciliation with configuration, snapshots, and audit trail

-- ========================================================
-- 1. EMPLOYEES TABLE
-- ========================================================
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_code VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, employee_code)
);

CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_employees_active ON employees(company_id, is_active);

-- ========================================================
-- 2. PAYE CONFIG - INCOME TYPES
-- ========================================================
CREATE TABLE IF NOT EXISTS paye_config_income_types (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  label VARCHAR(200) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_custom BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, key)
);

CREATE INDEX idx_paye_income_types_company ON paye_config_income_types(company_id);
CREATE INDEX idx_paye_income_types_active ON paye_config_income_types(company_id, is_active);

-- ========================================================
-- 3. PAYE CONFIG - DEDUCTION TYPES
-- ========================================================
CREATE TABLE IF NOT EXISTS paye_config_deduction_types (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  label VARCHAR(200) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_custom BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, key)
);

CREATE INDEX idx_paye_deduction_types_company ON paye_config_deduction_types(company_id);
CREATE INDEX idx_paye_deduction_types_active ON paye_config_deduction_types(company_id, is_active);

-- ========================================================
-- 4. PAYE PERIODS
-- ========================================================
CREATE TABLE IF NOT EXISTS paye_periods (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'LOCKED')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, from_date, to_date)
);

CREATE INDEX idx_paye_periods_company ON paye_periods(company_id);
CREATE INDEX idx_paye_periods_dates ON paye_periods(company_id, from_date, to_date);

-- ========================================================
-- 5. PAYE RECONCILIATIONS (SNAPSHOTS)
-- ========================================================
CREATE TABLE IF NOT EXISTS paye_reconciliations (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  paye_period_id INTEGER NOT NULL REFERENCES paye_periods(id) ON DELETE CASCADE,
  version INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'LOCKED')),
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  approved_by_user_id INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  locked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_paye_recon_company ON paye_reconciliations(company_id);
CREATE INDEX idx_paye_recon_period ON paye_reconciliations(paye_period_id);
CREATE INDEX idx_paye_recon_status ON paye_reconciliations(company_id, status);

-- ========================================================
-- 6. PAYE EMPLOYEE LINES (PER MONTH)
-- ========================================================
CREATE TABLE IF NOT EXISTS paye_employee_lines (
  id SERIAL PRIMARY KEY,
  paye_reconciliation_id INTEGER NOT NULL REFERENCES paye_reconciliations(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  month_key VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  gross_income DECIMAL(15,2) DEFAULT 0,
  total_deductions DECIMAL(15,2) DEFAULT 0,
  net_salary DECIMAL(15,2) DEFAULT 0,
  bank_paid_amount DECIMAL(15,2) DEFAULT 0,
  difference_amount DECIMAL(15,2) DEFAULT 0,
  metadata_json JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(paye_reconciliation_id, employee_id, month_key)
);

CREATE INDEX idx_paye_emp_lines_recon ON paye_employee_lines(paye_reconciliation_id);
CREATE INDEX idx_paye_emp_lines_employee ON paye_employee_lines(employee_id);
CREATE INDEX idx_paye_emp_lines_month ON paye_employee_lines(month_key);

-- ========================================================
-- 7. PAYE EMPLOYEE INCOME LINES
-- ========================================================
CREATE TABLE IF NOT EXISTS paye_employee_income_lines (
  id SERIAL PRIMARY KEY,
  paye_employee_line_id INTEGER NOT NULL REFERENCES paye_employee_lines(id) ON DELETE CASCADE,
  income_type_key VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_paye_income_lines_emp_line ON paye_employee_income_lines(paye_employee_line_id);

-- ========================================================
-- 8. PAYE EMPLOYEE DEDUCTION LINES
-- ========================================================
CREATE TABLE IF NOT EXISTS paye_employee_deduction_lines (
  id SERIAL PRIMARY KEY,
  paye_employee_line_id INTEGER NOT NULL REFERENCES paye_employee_lines(id) ON DELETE CASCADE,
  deduction_type_key VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_paye_deduction_lines_emp_line ON paye_employee_deduction_lines(paye_employee_line_id);

-- ========================================================
-- 9. INSERT DEFAULT CONFIGURATION
-- ========================================================
-- These defaults will be inserted when a company is created
-- For now, we'll create a function to initialize defaults

CREATE OR REPLACE FUNCTION initialize_paye_defaults(p_company_id INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Default Income Type: Basic Salary
  INSERT INTO paye_config_income_types (company_id, key, label, is_default, is_custom, is_active)
  VALUES (p_company_id, 'basic_salary', 'Basic Salary', true, false, true)
  ON CONFLICT (company_id, key) DO NOTHING;

  -- Default Deduction Types: PAYE and UIF
  INSERT INTO paye_config_deduction_types (company_id, key, label, is_default, is_custom, is_active)
  VALUES
    (p_company_id, 'paye', 'PAYE', true, false, true),
    (p_company_id, 'uif', 'UIF', true, false, true)
  ON CONFLICT (company_id, key) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ========================================================
-- 10. TRIGGERS FOR UPDATED_AT
-- ========================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paye_income_types_updated_at BEFORE UPDATE ON paye_config_income_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paye_deduction_types_updated_at BEFORE UPDATE ON paye_config_deduction_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paye_periods_updated_at BEFORE UPDATE ON paye_periods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paye_reconciliations_updated_at BEFORE UPDATE ON paye_reconciliations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paye_employee_lines_updated_at BEFORE UPDATE ON paye_employee_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
