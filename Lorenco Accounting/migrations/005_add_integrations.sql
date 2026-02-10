-- ========================================================
-- MIGRATION 005: Add Integrations System
-- ========================================================
-- This migration adds support for external app integrations
-- like Checkout Charlie, payment gateways, etc.
-- Date: 2026-01-22
-- ========================================================

-- Create integrations table (stores integration configurations)
CREATE TABLE IF NOT EXISTS integrations (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'checkout_charlie', 'bank_feed', 'sars', etc.
    description TEXT,
    config JSONB DEFAULT '{}', -- Integration-specific configuration
    api_key_hash VARCHAR(64), -- SHA256 hash of API key
    is_active BOOLEAN DEFAULT true,
    created_by_user_id INTEGER REFERENCES users(id),
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create integration_transactions table (tracks transactions from integrations)
CREATE TABLE IF NOT EXISTS integration_transactions (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    integration_id INTEGER NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    external_id VARCHAR(255), -- External system's transaction ID
    journal_id INTEGER REFERENCES journals(id),
    type VARCHAR(50) NOT NULL, -- 'sale', 'pos_sale', 'refund', 'pos_refund', 'payment', 'expense'
    amount DECIMAL(15, 2) NOT NULL,
    vat_amount DECIMAL(15, 2) DEFAULT 0,
    description TEXT,
    raw_data JSONB, -- Original data from external system
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'posted', 'settled', 'failed', 'reversed'
    error_message TEXT,
    payment_method VARCHAR(20), -- 'cash', 'card', 'account' - for POS transactions
    customer_id VARCHAR(100), -- Customer ID for account sales
    customer_name VARCHAR(255), -- Customer display name
    settled_date DATE, -- When the POS transaction was settled to bank
    settled_journal_id INTEGER REFERENCES journals(id), -- Settlement journal
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create integration_webhooks table (logs incoming webhooks)
CREATE TABLE IF NOT EXISTS integration_webhooks (
    id SERIAL PRIMARY KEY,
    integration_id INTEGER NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB,
    status VARCHAR(20) DEFAULT 'received', -- 'received', 'processed', 'failed'
    error_message TEXT,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for integrations
CREATE INDEX idx_integrations_company_id ON integrations(company_id);
CREATE INDEX idx_integrations_type ON integrations(type);
CREATE INDEX idx_integrations_api_key_hash ON integrations(api_key_hash);
CREATE INDEX idx_integrations_is_active ON integrations(is_active);

-- Create indexes for integration_transactions
CREATE INDEX idx_integration_transactions_company_id ON integration_transactions(company_id);
CREATE INDEX idx_integration_transactions_integration_id ON integration_transactions(integration_id);
CREATE INDEX idx_integration_transactions_external_id ON integration_transactions(integration_id, external_id);
CREATE INDEX idx_integration_transactions_journal_id ON integration_transactions(journal_id);
CREATE INDEX idx_integration_transactions_type ON integration_transactions(type);
CREATE INDEX idx_integration_transactions_status ON integration_transactions(status);
CREATE INDEX idx_integration_transactions_created_at ON integration_transactions(created_at);
CREATE INDEX idx_integration_transactions_payment_method ON integration_transactions(payment_method);
CREATE INDEX idx_integration_transactions_customer_id ON integration_transactions(customer_id);

-- Create indexes for integration_webhooks
CREATE INDEX idx_integration_webhooks_integration_id ON integration_webhooks(integration_id);
CREATE INDEX idx_integration_webhooks_event_type ON integration_webhooks(event_type);
CREATE INDEX idx_integration_webhooks_status ON integration_webhooks(status);
CREATE INDEX idx_integration_webhooks_created_at ON integration_webhooks(created_at);

-- Add unique constraint for external ID per integration
CREATE UNIQUE INDEX idx_integration_transactions_unique_external ON integration_transactions(integration_id, external_id)
WHERE external_id IS NOT NULL;

-- Add comments
COMMENT ON TABLE integrations IS 'Stores configuration for external app integrations (Checkout Charlie, bank feeds, etc.)';
COMMENT ON COLUMN integrations.type IS 'Integration type: checkout_charlie, bank_feed, sars, etc.';
COMMENT ON COLUMN integrations.config IS 'JSON configuration including account mappings, sync options, etc.';
COMMENT ON COLUMN integrations.api_key_hash IS 'SHA256 hash of the API key (key itself is never stored)';

COMMENT ON TABLE integration_transactions IS 'Tracks all transactions received from external integrations';
COMMENT ON COLUMN integration_transactions.external_id IS 'Unique transaction ID from the external system';
COMMENT ON COLUMN integration_transactions.raw_data IS 'Original JSON payload received from external system';
COMMENT ON COLUMN integration_transactions.type IS 'Transaction type: sale, pos_sale, refund, pos_refund, payment, expense';
COMMENT ON COLUMN integration_transactions.payment_method IS 'For POS transactions: cash, card, or account';
COMMENT ON COLUMN integration_transactions.customer_id IS 'Customer ID for account sales (optional)';
COMMENT ON COLUMN integration_transactions.customer_name IS 'Customer display name';
COMMENT ON COLUMN integration_transactions.settled_date IS 'Date when POS transaction was matched to bank deposit';
COMMENT ON COLUMN integration_transactions.settled_journal_id IS 'Reference to the settlement journal entry';

COMMENT ON TABLE integration_webhooks IS 'Logs all incoming webhook events from integrations';
COMMENT ON COLUMN integration_webhooks.payload IS 'Full webhook payload as JSON';
