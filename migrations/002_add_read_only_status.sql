-- Migration: Add READ_ONLY status to companies table
-- Run this after the initial schema has been applied

-- Drop the existing CHECK constraint
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_status_check;

-- Re-add the constraint with the new value
ALTER TABLE companies ADD CONSTRAINT companies_status_check 
  CHECK (status IN ('active', 'inactive', 'suspended', 'read_only'));

-- Add comment explaining READ_ONLY mode
COMMENT ON COLUMN companies.status IS 'Company status: active (normal), inactive (disabled), suspended (payment issue), read_only (view-only access)';
