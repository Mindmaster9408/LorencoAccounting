# Lorenco Accounting System

A full-featured, multi-tenant accounting system with optional AI add-on capabilities.

## Overview

Lorenco is a professional-grade accounting platform (comparable to Xero/Sage) that works 100% without AI. The optional AI assistant "Sean" can be enabled per company, per user, and per module with strict governance.

## Core Principles

1. **Lorenco Core is the single source of truth** - All accounting logic is deterministic and rule-based
2. **AI is optional and disabled by default** - Can be toggled at company, user, and capability levels
3. **AI actions go through the same validations** - No bypass of business rules or permissions
4. **Full auditability** - Every action is logged with before/after states and rationale
5. **Human approval required** - Unless "Auto" mode is explicitly enabled with proper permissions
6. **No hidden logic** - All postings show debit/credit impact and are reversible

## Architecture

### Phase 1: Foundation
- Multi-tenant architecture (company-scoped data)
- Role-Based Access Control (Admin, Accountant, Bookkeeper, Viewer)
- Comprehensive audit logging
- Global admin access for authorized emails

### Phase 2: Core Accounting Engine
- Chart of Accounts (Asset, Liability, Equity, Income, Expense)
- Double-entry journal system with validation
- General Ledger and Trial Balance
- Bank module with reconciliation
- Period locking for compliance

### Phase 3: AI Add-on "Sean"
- Capability-based toggles (Bank Allocation, Reconciliation, Journal Prep, etc.)
- Four modes: Off / Suggest / Draft / Auto
- Review queue for AI-generated drafts
- Confidence scoring and rationale tracking
- Full reversal support

### Phase 4: Professional Reports
- Template-based, printable outputs
- Trial Balance, General Ledger, Bank Reconciliation
- Export to PDF, Excel, CSV

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- PostgreSQL >= 14
- npm >= 9.0.0

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
# Then run migrations
npm run migrate

# Seed initial data (sample company, chart of accounts)
npm run seed

# Start development server
npm run dev
```

### Production Deployment

```bash
# Set NODE_ENV=production in .env
# Run migrations
npm run migrate

# Start server
npm start
```

## API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `POST /api/auth/logout` - Logout user

### Companies (Tenants)
- `GET /api/companies` - List companies (admin only)
- `POST /api/companies` - Create new company (admin only)
- `GET /api/companies/:id` - Get company details
- `PUT /api/companies/:id` - Update company

### Chart of Accounts
- `GET /api/accounts` - List accounts for company
- `POST /api/accounts` - Create account
- `PUT /api/accounts/:id` - Update account
- `DELETE /api/accounts/:id` - Soft delete (disable) account

### Journals
- `GET /api/journals` - List journals
- `POST /api/journals` - Create draft journal
- `POST /api/journals/:id/post` - Post journal (creates ledger entries)
- `POST /api/journals/:id/reverse` - Reverse posted journal
- `GET /api/journals/:id` - Get journal with lines

### Bank Module
- `GET /api/bank/accounts` - List bank accounts
- `POST /api/bank/accounts` - Create bank account
- `POST /api/bank/import` - Import bank transactions (CSV)
- `GET /api/bank/transactions` - List transactions
- `POST /api/bank/transactions/:id/allocate` - Allocate to journal
- `POST /api/bank/reconcile` - Mark transactions as reconciled

### Reports
- `GET /api/reports/trial-balance?from=YYYY-MM-DD&to=YYYY-MM-DD` - Trial Balance
- `GET /api/reports/general-ledger?accountId=X&from=...&to=...` - General Ledger
- `GET /api/reports/bank-reconciliation?bankAccountId=X&date=...` - Bank Recon

### AI Module (Optional)
- `GET /api/ai/settings` - Get AI settings for company
- `PUT /api/ai/settings` - Update AI settings (admin/accountant only)
- `POST /api/ai/actions` - Submit AI action request
- `GET /api/ai/actions/:id` - Get action status and result
- `GET /api/ai/review-queue` - List pending AI drafts
- `POST /api/ai/actions/:id/approve` - Approve AI draft
- `POST /api/ai/actions/:id/reject` - Reject AI draft

### Audit Log
- `GET /api/audit` - Query audit log (filtered by entity, date range, actor)

## Database Schema

See `/docs/schema.sql` for complete database structure.

Key tables:
- `companies` - Multi-tenant companies
- `users` - Users with role-based permissions
- `accounts` - Chart of accounts
- `journals` - Journal headers
- `journal_lines` - Journal line items (debits/credits)
- `bank_accounts` - Bank account registry
- `bank_transactions` - Imported bank transactions
- `audit_log` - Complete audit trail
- `ai_settings_*` - AI configuration and overrides
- `ai_actions` - AI action requests and results

## Permissions & Roles

### Roles
- **Admin** - Full company administration
- **Accountant** - Full accounting operations, approvals
- **Bookkeeper** - Create drafts, limited posting
- **Viewer** - Read-only access

### Global Admins
Hardcoded emails with cross-company access:
- ruanvlog@lorenco.co.za
- antonjvr@lorenco.co.za

## AI Modes

- **OFF** - AI capability disabled (returns error)
- **SUGGEST** - AI returns suggestions only (no drafts created)
- **DRAFT** - AI creates draft journals/reconciliations for review
- **AUTO** - AI posts directly (requires permission + confidence threshold)

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Company-scoped data isolation
- Rate limiting on API endpoints
- Input validation with Joi
- SQL injection prevention (parameterized queries)
- Helmet.js security headers

## Sean AI - Bank Transaction Allocation (Future Implementation)

### Overview
Sean AI will provide intelligent bank transaction allocation with learning capabilities. This is an optional add-on feature that requires both feature flags to be enabled.

### Feature Gating (NON-NEGOTIABLE)
The AI allocation feature is ONLY functional when BOTH conditions are true:
- `user.profile.seanActive === true`
- `user.profile.seanAllocateBankTransactions === true`

If either flag is false:
- Hide the AI button OR show it disabled with tooltip "Sean is not active for this profile"
- No API calls to Sean AI must occur
- Override functionality is unavailable

### Sean AI Workflow

#### 1. AI Analysis
When the AI button is clicked on a bank transaction, Sean provides:
- **Transaction Description**: What Sean understands this transaction to be
- **Allocation Decision**: The Chart of Accounts (COA) account selection
- **Reasoning**: WHY this allocation was made (with business context)
- **Supporting Articles**: Relevant guidelines/articles justifying the allocation/deduction

#### 2. Context Sean Receives
To make intelligent decisions, Sean needs:
- **Company Description**: What does the company do (e.g., "bakery", "consulting firm")
- **Chart of Accounts**: Available COA accounts with types
- **Transaction Details**: Amount, description, reference, counterparty, date
- **Business Context**: Industry-specific knowledge (e.g., bakery buying coffee = cost of sales, not employee welfare)

#### 3. Override & Learning Flow
Users can override Sean's allocation with two scenarios:

**With Feedback (Learning Mode):**
- User changes allocation
- Panel auto-opens showing: "Sean said: [original] + why" vs "You selected: [new] + why"
- User provides reason in textarea
- Feedback is sent to Sean AI via API
- Sean learns from this correction

**Without Feedback (Silent Override):**
- User changes allocation
- User clicks "Authorize" without providing reason
- Transaction is authorized with no description
- NO API call to Sean (no learning occurs)
- Override is saved locally

#### 4. Authorization Rules
- **With Reason**: Sends feedback to Sean AI, updates transaction as reviewed
- **Without Reason**: Authorizes transaction, marks as reviewed, no feedback sent to Sean

### Implementation Architecture (Backend)

#### Database Schema
- `bank_transactions` - Add status: [unreviewed | allocated | overridden | authorized]
- `transaction_allocations` - Store Sean's allocations and user overrides
- `transaction_ai_explanations` - Store Sean's reasoning and references
- `transaction_overrides` - Audit trail of user overrides with feedback
- `integration_settings` - Company-level Sean AI configuration

#### API Integration
- **Sean Allocate Endpoint**: POST to Sean with company context, COA, transaction details
- **Sean Feedback Endpoint**: POST override feedback when user provides reason
- **Server-Side Only**: All Sean API calls happen server-side (never from browser)
- **Idempotent Operations**: Prevent duplicate allocations
- **Correlation IDs**: Track every request for debugging

#### Security
- Sean API key stored server-side only (encrypted at rest)
- All endpoints require authenticated session/JWT
- Tenant isolation enforced (company_id scoping)
- No secrets in logs or client responses

### UI Behavior

#### AI Button States
- **Enabled**: Both feature flags active, shows 🤖 AI button
- **Disabled**: Shows disabled button with tooltip explaining why
- **Hidden**: Optionally hide completely when feature not available

#### Expansion Panel
When AI button clicked:
1. Show loading skeleton
2. Call backend API (which calls Sean)
3. Display:
   - Sean's description of transaction
   - Suggested allocation (COA + VAT + flags)
   - Reasoning text
   - Reference articles (title, source, section, excerpt, links)
4. Show override form:
   - COA dropdown (searchable)
   - VAT code selector
   - Tax deductible toggle
   - Reason textarea (optional but encouraged)
   - "Save Override" and "Authorize" buttons

#### Override UX
- If allocation changed → Auto-open panel showing before/after comparison
- If reason provided → Show "Feedback sent to Sean ✓"
- If reason empty → Show "Saved without feedback"
- If API fails → Show non-blocking warning, allow retry

### Caching Strategy
- Cache Sean responses per transaction
- Invalidate cache when:
  - Chart of Accounts changes
  - Transaction details modified
  - User clicks "Refresh AI"
- Don't overwrite user overrides with new Sean suggestions

### Audit Trail
Every allocation and override must be reproducible:
- Store exact payload sent to Sean
- Store Sean's request_id and model_version
- Store timestamps and user who authorized
- Never delete overrides (compliance requirement)

### Error Handling
- **Sean API Down**: Show "Sean unavailable. Try again later." Allow manual allocation
- **Timeout**: Retry once with exponential backoff, then fail gracefully
- **Unauthorized**: Return 403 to client
- **Tenant Mismatch**: Return 404

### Testing Requirements
- Unit tests for feature flag gating
- Override with reason → feedback API called
- Override without reason → feedback NOT called
- Overridden transactions not auto-overwritten
- Integration tests with mocked Sean endpoints

---

## Support

For issues or questions, contact:
- ruanvlog@lorenco.co.za
- antonjvr@lorenco.co.za

## License

PROPRIETARY - All rights reserved.

## VAT Reconciliation System - Completion Notice

═══════════════════════════════════════════════════════════════════════════════
**VAT RECONCILIATION SYSTEM - COMPLETED AND LOCKED**
═══════════════════════════════════════════════════════════════════════════════

**STATUS: COMPLETE - DO NOT MODIFY UNLESS EXPLICITLY REQUESTED**

This VAT reconciliation system includes:
- VAT Reconciliation Table with auto-calculations (Total Output A, Total Input B, VAT Payable, Difference)
- Trial Balance section with VAT/NO VAT inputs and automatic totals
- Reconciliation Comparison (INCOME/EXPENSE) with automatic calculations:
  * According to VAT Report (Excl) = Inclusive - Output
  * According to TB = Trial Balance VAT totals
  * Difference = TB - VAT Report
  * Percentage = (Difference / TB) × 100
- All calculations update in real-time across all sections

**MODIFICATION POLICY:**
Only modify this file if specifically requested to work on VAT reconciliation.
For other features, create separate files or work in designated sections.

═══════════════════════════════════════════════════════════════════════════════
