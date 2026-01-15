# Lorenco Accounting System - API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
All API endpoints (except `/auth/login` and `/auth/register`) require authentication via JWT token.

Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Authentication Endpoints

### POST /auth/register
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "companyId": 1,
  "firstName": "John",
  "lastName": "Doe",
  "role": "viewer"
}
```

**Roles:** `admin`, `accountant`, `bookkeeper`, `viewer`

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "viewer",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### POST /auth/login
Login and receive JWT token.

**Request Body:**
```json
{
  "email": "admin@acme.com",
  "password": "admin123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@acme.com",
    "role": "admin",
    "firstName": "Admin",
    "lastName": "User",
    "companyId": 1,
    "companyName": "Acme Corporation"
  }
}
```

---

## Chart of Accounts

### GET /accounts
List all accounts.

**Query Parameters:**
- `type`: Filter by account type (asset, liability, equity, income, expense)
- `isActive`: Filter by active status (true/false)
- `includeInactive`: Include inactive accounts (true/false)

**Response:**
```json
{
  "accounts": [
    {
      "id": 1,
      "code": "1000",
      "name": "Bank - Current Account",
      "type": "asset",
      "isActive": true
    }
  ],
  "count": 1
}
```

### POST /accounts
Create a new account.

**Request Body:**
```json
{
  "code": "1000",
  "name": "Bank - Current Account",
  "type": "asset",
  "description": "Main business bank account"
}
```

**Permission Required:** `account.create`

### PUT /accounts/:id
Update an account.

**Permission Required:** `account.edit`

### DELETE /accounts/:id
Soft delete (deactivate) an account.

**Permission Required:** `account.delete`

---

## Journals

### GET /journals
List journals.

**Query Parameters:**
- `status`: draft, posted, reversed
- `sourceType`: manual, bank, payroll, vat, ai, system
- `fromDate`: YYYY-MM-DD
- `toDate`: YYYY-MM-DD
- `limit`: Default 100
- `offset`: Default 0

### GET /journals/:id
Get a journal with all lines.

### POST /journals
Create a draft journal.

**Request Body:**
```json
{
  "date": "2026-01-14",
  "reference": "JV001",
  "description": "Monthly salary payment",
  "sourceType": "manual",
  "lines": [
    {
      "accountId": 15,
      "debit": 50000,
      "credit": 0,
      "description": "Salaries expense"
    },
    {
      "accountId": 1,
      "debit": 0,
      "credit": 50000,
      "description": "Payment from bank"
    }
  ]
}
```

**Validation:**
- Journal must balance (sum of debits = sum of credits)
- At least 2 lines required
- Each line must have either debit or credit (not both)
- Period must not be locked

**Permission Required:** `journal.create`

### POST /journals/:id/post
Post a draft journal to the ledger.

**Permission Required:** `journal.post`

**Response:**
```json
{
  "id": 1,
  "status": "posted",
  "postedAt": "2026-01-14T10:30:00Z",
  "lines": [...]
}
```

### POST /journals/:id/reverse
Reverse a posted journal.

**Request Body:**
```json
{
  "reason": "Correction: Wrong amount posted"
}
```

**Permission Required:** `journal.reverse`

**Response:**
```json
{
  "message": "Journal reversed successfully",
  "reversalJournal": {
    "id": 2,
    "reference": "REV-JV001",
    "reversalOfJournalId": 1
  }
}
```

---

## Bank Module

### GET /bank/accounts
List bank accounts.

### POST /bank/accounts
Create a bank account.

**Request Body:**
```json
{
  "name": "Main Business Account",
  "bankName": "Standard Bank",
  "accountNumberMasked": "****1234",
  "currency": "ZAR",
  "ledgerAccountId": 1,
  "openingBalance": 10000,
  "openingBalanceDate": "2026-01-01"
}
```

### GET /bank/transactions
List bank transactions.

**Query Parameters:**
- `bankAccountId`: Filter by bank account
- `status`: unmatched, matched, reconciled
- `fromDate`, `toDate`

### POST /bank/import
Import bank transactions.

**Request Body:**
```json
{
  "bankAccountId": 1,
  "transactions": [
    {
      "date": "2026-01-10",
      "description": "Customer payment - ABC Ltd",
      "amount": 5000,
      "reference": "PMT123",
      "externalId": "BANK-TXN-001"
    }
  ]
}
```

**Permission Required:** `bank.import`

### POST /bank/transactions/:id/allocate
Allocate a bank transaction to create a journal.

**Request Body:**
```json
{
  "description": "Customer payment received",
  "lines": [
    {
      "accountId": 10,
      "amount": 5000,
      "description": "Accounts Receivable"
    }
  ]
}
```

Creates a draft journal with:
- Bank account (debit for money in, credit for money out)
- User-specified allocations

**Permission Required:** `bank.allocate`

### POST /bank/reconcile
Mark transactions as reconciled.

**Request Body:**
```json
{
  "transactionIds": [1, 2, 3]
}
```

**Permission Required:** `bank.reconcile`

---

## Reports

### GET /reports/trial-balance
Generate trial balance for a period.

**Query Parameters:**
- `fromDate`: YYYY-MM-DD (required)
- `toDate`: YYYY-MM-DD (required)

**Response:**
```json
{
  "fromDate": "2026-01-01",
  "toDate": "2026-01-31",
  "accounts": [
    {
      "code": "1000",
      "name": "Bank - Current Account",
      "type": "asset",
      "totalDebit": 50000,
      "totalCredit": 30000,
      "balance": 20000
    }
  ],
  "summary": {
    "asset": { "debit": 50000, "credit": 30000, "balance": 20000 },
    "total": { "debit": 100000, "credit": 100000 }
  },
  "isBalanced": true
}
```

### GET /reports/general-ledger
Generate general ledger for an account.

**Query Parameters:**
- `accountId`: Account ID (required)
- `fromDate`: YYYY-MM-DD (optional)
- `toDate`: YYYY-MM-DD (optional)

**Response:**
```json
{
  "account": { "code": "1000", "name": "Bank" },
  "openingBalance": 10000,
  "transactions": [
    {
      "date": "2026-01-10",
      "reference": "JV001",
      "description": "Customer payment",
      "debit": 5000,
      "credit": 0,
      "balance": 15000
    }
  ],
  "totalDebit": 5000,
  "totalCredit": 0,
  "closingBalance": 15000
}
```

### GET /reports/bank-reconciliation
Generate bank reconciliation report.

**Query Parameters:**
- `bankAccountId`: Bank account ID (required)
- `date`: YYYY-MM-DD (required)

---

## AI Module (Optional)

### GET /ai/settings
Get AI settings for the company.

**Permission Required:** `ai.settings.view`

**Response:**
```json
{
  "company": {
    "companyId": 1,
    "isEnabled": false
  },
  "capabilities": [
    {
      "capabilityKey": "BANK_ALLOCATION",
      "mode": "off",
      "minConfidence": 0.80,
      "isEnabled": false
    }
  ],
  "userOverrides": []
}
```

### PUT /ai/settings
Update AI settings.

**Request Body:**
```json
{
  "companyEnabled": true,
  "capabilities": [
    {
      "capabilityKey": "BANK_ALLOCATION",
      "mode": "draft",
      "minConfidence": 0.85,
      "isEnabled": true
    }
  ]
}
```

**Modes:** `off`, `suggest`, `draft`, `auto`

**Permission Required:** `ai.settings.edit`

### POST /ai/actions
Submit an AI action request.

**Request Body:**
```json
{
  "capabilityKey": "BANK_ALLOCATION",
  "inputRefs": {
    "bankTransactionId": 123
  },
  "metadata": {
    "note": "Auto-allocate customer payment"
  }
}
```

**Capability Keys:**
- `BANK_ALLOCATION`
- `BANK_RECONCILIATION`
- `JOURNAL_PREP`
- `REPORT_PREP`
- `PAYROLL_RECON`
- `VAT_RECON`

**Permission Required:** `ai.request`

### GET /ai/actions/:id
Get AI action status and result.

### GET /ai/review-queue
Get pending AI actions awaiting approval.

**Permission Required:** `ai.approve`

### POST /ai/actions/:id/approve
Approve or reject an AI action.

**Request Body:**
```json
{
  "decision": "approve",
  "notes": "Looks correct, approved"
}
```

**Decisions:** `approve`, `reject`, `edit`

**Permission Required:** `ai.approve`

---

## Audit Log

### GET /audit
Query audit log.

**Query Parameters:**
- `entityType`: ACCOUNT, JOURNAL, BANK_TRANSACTION, AI_ACTION, etc.
- `entityId`: Specific entity ID
- `actorType`: USER, AI, SYSTEM
- `actionType`: CREATE, UPDATE, DELETE, POST, REVERSE, etc.
- `fromDate`, `toDate`
- `limit`, `offset`

**Permission Required:** `audit.view`

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message here"
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., duplicate code)
- `500` - Internal Server Error

---

## Permissions Matrix

| Role | Permissions |
|------|------------|
| **Admin** | All permissions, company management |
| **Accountant** | Full accounting operations, AI approval, journal posting/reversal |
| **Bookkeeper** | Create drafts, import bank transactions, AI requests (draft mode) |
| **Viewer** | Read-only access to reports and journals |

**Global Admins** (hardcoded emails):
- ruanvlog@lorenco.co.za
- antonjvr@lorenco.co.za

Have full access across all companies.
