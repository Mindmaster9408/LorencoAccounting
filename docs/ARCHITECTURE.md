# Lorenco Accounting System - Architecture & Design Document

## Executive Summary

Lorenco is a production-ready, full-featured accounting system comparable to Xero/Sage, designed to work 100% without AI. It includes an **optional** AI add-on ("Sean") that can be enabled/disabled per company, per user, and per capability, with strict governance modes.

**Version:** 1.0.0  
**Created:** January 2026  
**Architecture:** Multi-tenant, REST API, PostgreSQL, Node.js/Express

---

## Core Design Principles

### 1. Lorenco Core is the Single Source of Truth
- All accounting logic is deterministic and rule-based
- AI cannot bypass validations or business rules
- Double-entry bookkeeping enforced at the service layer

### 2. AI is Optional and Disabled by Default
- Companies must explicitly enable AI
- Each capability can be toggled independently
- Users can override company settings

### 3. AI Must Act Through Lorenco APIs
- No direct database writes
- Same validations as human users
- All AI actions auditable and reversible

### 4. Full Auditability
- Every action logged with before/after states
- Actor tracking (USER, AI, SYSTEM)
- Immutable audit trail

### 5. Human Approval Required
- Unless "Auto" mode is explicitly enabled
- Only for users with appropriate permissions
- Confidence threshold must be met

---

## System Architecture

### Technology Stack

**Backend:**
- Node.js 18+
- Express.js
- PostgreSQL 14+
- JWT for authentication
- Bcrypt for password hashing

**Frontend:**
- Vanilla HTML/CSS/JavaScript
- Fetch API for HTTP requests
- Responsive design

**Security:**
- Helmet.js (security headers)
- CORS configuration
- Rate limiting
- Input validation (Joi)
- SQL injection prevention (parameterized queries)

### Database Architecture

**Multi-Tenancy:**
- Each company is a separate tenant
- All data scoped by `company_id`
- Global admins can access all companies

**Key Tables:**

#### Foundation (Phase 1)
- `companies` - Tenant registry
- `users` - Users with roles
- `audit_log` - Complete audit trail

#### Accounting Core (Phase 2)
- `accounts` - Chart of accounts
- `accounting_periods` - Period locking
- `journals` - Journal headers
- `journal_lines` - Debit/credit entries
- `bank_accounts` - Bank account registry
- `bank_transactions` - Imported transactions

#### AI Module (Phase 3)
- `ai_settings_company` - Company-level AI toggle
- `ai_settings_capabilities` - Capability modes & thresholds
- `ai_settings_user_overrides` - User-specific overrides
- `ai_actions` - AI requests & results
- `ai_action_steps` - Multi-step operations
- `ai_approvals` - Review queue approvals

### Indexes & Performance

**Optimized for:**
- Company-scoped queries (all tables indexed on `company_id`)
- Date range queries (`journals.date`, `bank_transactions.date`)
- Status filtering (`journals.status`, `bank_transactions.status`)
- Audit log searches (multi-column indexes)

**Views:**
- `vw_general_ledger` - Pre-joined GL data for reporting

---

## Phase Implementation Details

### Phase 1: Multi-Tenant + RBAC + Audit

#### Multi-Tenancy
- Company-scoped data isolation
- Middleware enforces company boundaries
- Global admins bypass restrictions

#### Role-Based Access Control

**Roles:**
1. **Admin** - Full company administration, all permissions
2. **Accountant** - Full accounting operations, AI approval, posting/reversal
3. **Bookkeeper** - Create drafts, import bank txns, limited posting
4. **Viewer** - Read-only access

**Permission System:**
- Fine-grained permissions (e.g., `journal.post`, `ai.approve`)
- Middleware functions: `authenticate()`, `authorize()`, `hasPermission()`
- Global admins have all permissions

**Global Admins:**
- Hardcoded emails: ruanvlog@lorenco.co.za, antonjvr@lorenco.co.za
- Cross-company access
- Cannot be restricted

#### Audit Logging

**Captured Data:**
- Actor (USER/AI/SYSTEM) with ID
- Action type (CREATE, UPDATE, DELETE, POST, REVERSE, etc.)
- Entity type and ID
- Before/after JSON snapshots
- Reason/rationale
- IP address and user agent
- Timestamp

**Service Layer:**
```javascript
await AuditLogger.logUserAction(req, 'POST', 'JOURNAL', journalId, 
  { status: 'draft' }, { status: 'posted' }, 'Journal posted'
);
```

---

### Phase 2: Core Accounting Engine

#### Chart of Accounts

**Account Types:**
- Asset
- Liability
- Equity
- Income
- Expense

**Features:**
- Unique codes per company
- Hierarchical (parent accounts)
- Active/inactive status
- System accounts (cannot be edited/deleted)
- Soft delete (cannot delete if used in posted journals)

#### Double-Entry Journal System

**Architecture:**
```
Journal (Header)
  ├── date, reference, description
  ├── status: draft | posted | reversed
  ├── source_type: manual | bank | payroll | vat | ai | system
  └── Journal Lines
      ├── account_id
      ├── debit / credit
      └── description
```

**Validation (JournalService):**
```javascript
// 1. Lines validation
- At least 2 lines (double-entry)
- Each line has accountId
- Either debit OR credit (not both, not neither)
- Non-negative amounts

// 2. Balance validation
- Sum(debits) = Sum(credits)
- Tolerance: 0.01 for rounding

// 3. Period lock check
- Cannot create/post in locked periods
```

**Posting Process:**
1. Validate balance
2. Check period lock
3. Update status to 'posted'
4. Record posted_at timestamp
5. Create audit log entry

**Reversal Process:**
1. Verify journal is posted
2. Check not already reversed
3. Create new journal with:
   - Swapped debits/credits
   - Reference: "REV-{original_reference}"
   - Status: 'posted' (auto-posted)
   - Link to original journal
4. Mark original as 'reversed'
5. Audit log both journals

#### General Ledger & Trial Balance

**General Ledger:**
- Account-specific transaction history
- Opening balance calculation
- Running balance per transaction
- Date range filtering

**Trial Balance:**
- All accounts with balances
- Grouped by account type
- Summary totals by type
- Balance verification (debits = credits)

#### Bank Module

**Import Flow:**
1. Upload CSV/manual entry
2. Parse transactions
3. Check for duplicates (external_id)
4. Insert as 'unmatched'

**Allocation Flow:**
1. Select unmatched transaction
2. Specify account allocations
3. System creates draft journal:
   - Bank account (debit for +, credit for -)
   - User-specified accounts (opposite side)
4. Mark transaction as 'matched'
5. Link to journal via metadata

**Reconciliation Flow:**
1. Match bank transactions to posted journals
2. Verify ledger balance = statement balance
3. Mark as 'reconciled'
4. Generate reconciliation report

---

### Phase 3: AI Add-On Module

#### AI Guard - Mode Enforcement

**Effective Mode Calculation:**
```
Priority (most restrictive wins):
1. Company AI disabled → OFF
2. Capability disabled → OFF
3. User override disabled → OFF
4. User override mode → Use override
5. Company capability mode → Use default
```

**Modes:**

1. **OFF** - AI capability disabled
   - Request returns error
   - Clear message to user

2. **SUGGEST** - AI returns suggestions only
   - No drafts created
   - User must manually implement
   - Good for learning/validation

3. **DRAFT** - AI creates draft for review
   - Appears in review queue
   - Must be approved before execution
   - Default safe mode

4. **AUTO** - AI executes directly
   - Only if:
     - Mode is AUTO
     - User has permission (admin/accountant)
     - Confidence >= threshold
     - Period not locked
   - Fallback to DRAFT if conditions not met

#### Capability Keys

Implemented:
- `BANK_ALLOCATION` - Auto-allocate bank transactions
- `BANK_RECONCILIATION` - Auto-reconcile matched items
- `JOURNAL_PREP` - Prepare journal entries
- `REPORT_PREP` - Generate report suggestions

Framework ready:
- `PAYROLL_RECON` - Payroll reconciliation
- `VAT_RECON` - VAT return reconciliation

#### AI Action Lifecycle

```
1. REQUEST
   ├── Validate capability
   ├── Check permissions
   ├── Create ai_actions record
   └── Status: pending

2. PROCESSING (async)
   ├── Call AI provider
   ├── Generate output
   ├── Calculate confidence
   └── Update status

3. SUGGEST MODE
   └── Status: executed (suggestions returned)

4. DRAFT MODE
   ├── Create draft entities
   ├── Status: ready_for_review
   └── Await approval

5. AUTO MODE (if conditions met)
   ├── Create and post entities
   └── Status: executed

6. APPROVAL (draft mode only)
   ├── User reviews
   ├── Approve/Reject/Edit
   └── Execute or discard

7. AUDIT
   └── Log all steps with rationale
```

#### AI Output Requirements

**Mandatory Fields:**
- `rationale` - Why this action was taken
- `confidence` - Score 0.00-1.00
- `evidence` - Reference IDs used
- `impact` - Debit/credit summary for journals
- `reversibility` - How to undo (journal ID for reversal)

**Example:**
```json
{
  "capability": "BANK_ALLOCATION",
  "confidence": 0.92,
  "rationale": "Transaction description matches invoice INV-001",
  "evidence": {
    "bankTransactionId": 123,
    "invoiceId": 456
  },
  "impact": {
    "debits": [{"account": "1000", "amount": 5000}],
    "credits": [{"account": "1100", "amount": 5000}]
  },
  "actions": [
    {
      "type": "CREATE_JOURNAL",
      "journalId": 789
    }
  ]
}
```

#### Review Queue

**For Draft Mode:**
- List all `ai_actions` with status 'ready_for_review'
- Display: capability, confidence, rationale, impact
- Actions: Approve, Reject, Edit
- Permissions: `ai.approve` (admin/accountant only)

**Approval Process:**
```javascript
// Approve
- Execute action (create journal, etc.)
- Update status to 'executed'
- Log approval

// Reject
- Update status to 'rejected'
- Log rejection with reason
- Do not create entities

// Edit
- Allow user to modify output
- Execute modified version
- Log as 'edited'
```

---

### Phase 4: Report Templates

#### Trial Balance
- Fixed layout, printable
- Account code, name, type
- Debit, credit, balance columns
- Subtotals by type
- Grand totals

#### General Ledger
- Account header with balance summary
- Transaction list with running balance
- Date range filtering
- Export to CSV/Excel

#### Bank Reconciliation
- Statement balance vs ledger balance
- Unreconciled items list
- Difference calculation
- Printable working paper format

#### Export Formats
- **HTML** - For screen display and printing
- **CSV** - For Excel import
- **PDF** - (Framework ready, not implemented)

---

## Security Architecture

### Authentication
- JWT tokens (24h expiry by default)
- Bcrypt password hashing (10 rounds)
- Token stored in localStorage (client)
- Authorization header: `Bearer <token>`

### Authorization
- Role-based access control (RBAC)
- Permission checks at route level
- Company scope enforcement
- Global admin bypass

### Input Validation
- Joi schemas for complex objects
- Express-validator for simple inputs
- SQL injection prevention (parameterized queries)
- XSS prevention (Helmet.js)

### Rate Limiting
- 100 requests per 15 minutes (configurable)
- Applied to all `/api/*` routes
- IP-based tracking

### Audit Trail
- All significant actions logged
- Immutable (no UPDATE/DELETE on audit_log)
- Retention policy: permanent (unless manually purged)

---

## API Design

### RESTful Principles
- Standard HTTP methods (GET, POST, PUT, DELETE)
- Resource-based URLs (`/api/journals/:id`)
- Consistent JSON responses
- HTTP status codes (200, 201, 400, 401, 403, 404, 409, 500)

### Error Handling
```json
{
  "error": "Human-readable message",
  "code": "OPTIONAL_ERROR_CODE",
  "details": { ... }
}
```

### Pagination
```
?limit=100&offset=0
```

### Filtering
```
?status=draft&fromDate=2026-01-01&toDate=2026-01-31
```

### Response Format
```json
{
  "resource": [...],
  "count": 10,
  "metadata": { ... }
}
```

---

## Data Integrity

### Database Constraints
- Foreign key constraints (cascade deletes)
- Check constraints (valid enums, non-negative amounts)
- Unique constraints (company + code for accounts)
- NOT NULL on critical fields

### Application-Level Validation
- Double-entry balance validation
- Period lock enforcement
- Duplicate prevention (bank transactions)
- Permission checks

### Transactions
- All multi-step operations use database transactions
- Rollback on error
- Commit only on success

---

## Scalability Considerations

### Database
- Indexes on all foreign keys
- Composite indexes for common queries
- Connection pooling (max 20)
- Query optimization for reports

### Application
- Stateless API (JWT tokens)
- Horizontal scaling ready
- No session storage

### Caching
- Framework ready (not implemented)
- Suggested: Redis for session data
- Account/company data cacheable

---

## Testing Strategy

### Unit Tests
- Service layer logic (JournalService, AIGuard)
- Validation functions
- Permission calculations

### Integration Tests
- API endpoint testing
- Database interactions
- Authentication flows

### Manual Testing
- UI workflows
- Report generation
- Bank reconciliation end-to-end

---

## Deployment

### Environment Variables
```env
NODE_ENV=production
PORT=3000
DB_HOST=...
DB_NAME=...
JWT_SECRET=...
ADMIN_EMAILS=...
```

### Database Migrations
```bash
npm run migrate
```

### Seed Data
```bash
npm run seed
```

### Production Checklist
- [ ] Strong JWT_SECRET
- [ ] Secure database password
- [ ] HTTPS/SSL certificate
- [ ] Firewall configuration
- [ ] Database backups
- [ ] Logging configuration
- [ ] Monitoring (PM2, New Relic)
- [ ] CORS origin restrictions

---

## Future Enhancements

### Planned Features
- **Multi-currency support** - Foreign exchange handling
- **Budgeting module** - Budget vs actuals
- **Payroll integration** - Full payroll reconciliation
- **VAT returns** - Automated VAT calculation and submission
- **Fixed assets** - Depreciation schedules
- **Invoicing** - AR/AP management
- **Purchase orders** - Procurement workflow
- **Document attachments** - PDF storage for journals

### AI Expansion
- **Auto-categorization** - ML-based account suggestion
- **Anomaly detection** - Flag unusual transactions
- **Forecasting** - Cash flow predictions
- **Natural language queries** - "Show me Q1 expenses"
- **Smart reconciliation** - Fuzzy matching for bank recons

---

## Maintenance & Support

### Logging
- Console logging (development)
- File logging (production) - `logs/lorenco.log`
- Winston logger configured

### Monitoring
- Health check endpoint: `/health`
- Database connection monitoring
- API response times

### Backup Strategy
- **Database:** Daily automated backups
- **Retention:** 30 days minimum
- **Disaster recovery:** Off-site backup storage

### Support Contacts
- ruanvlog@lorenco.co.za
- antonjvr@lorenco.co.za

---

## Compliance & Standards

### Accounting Standards
- Double-entry bookkeeping (GAAP compliant)
- Audit trail (immutable, timestamped)
- Period locking for year-end close

### Data Protection
- Company data isolation
- Role-based access
- Audit logging of all access

### AI Governance
- Human oversight required (except Auto mode)
- Explainable AI (rationale mandatory)
- Reversibility (all AI actions can be undone)
- Transparency (full audit trail)

---

## License

PROPRIETARY - All rights reserved.

Copyright © 2026 Lorenco Accounting Systems
