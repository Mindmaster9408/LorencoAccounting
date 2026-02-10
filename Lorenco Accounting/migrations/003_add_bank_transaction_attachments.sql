-- ========================================================
-- MIGRATION 003: Add Bank Transaction Attachments
-- ========================================================
-- This migration adds support for attaching files to bank transactions
-- Date: 2026-01-14
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
CREATE INDEX idx_bank_transaction_attachments_company_id ON bank_transaction_attachments(company_id);
CREATE INDEX idx_bank_transaction_attachments_bank_transaction_id ON bank_transaction_attachments(bank_transaction_id);
CREATE INDEX idx_bank_transaction_attachments_uploaded_by ON bank_transaction_attachments(uploaded_by_user_id);

-- Add comment to table
COMMENT ON TABLE bank_transaction_attachments IS 'Stores file attachments (invoices, receipts, etc.) for bank transactions';
COMMENT ON COLUMN bank_transaction_attachments.filename IS 'Unique filename stored on disk';
COMMENT ON COLUMN bank_transaction_attachments.original_filename IS 'Original filename as uploaded by user';
COMMENT ON COLUMN bank_transaction_attachments.file_path IS 'Full path to file on disk';
COMMENT ON COLUMN bank_transaction_attachments.file_size IS 'File size in bytes';
COMMENT ON COLUMN bank_transaction_attachments.mime_type IS 'MIME type of the file';
