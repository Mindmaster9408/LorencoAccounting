# Implementation Plan: Checkout Charlie POS Integration & Cash Reconciliation

## Overview

Integrate Checkout Charlie POS system with Lorenco Accounting. POS sales flow to Accounts Receivable (not directly to bank), enabling cash/card reconciliation against actual bank deposits.

---

## Architecture

### Transaction Flow
```
POS SALE (Checkout Charlie)
    │
    ├── Account Sale ───> Customer: "ABC Company"
    │                     Dr Accounts Receivable 1100
    │                     Cr Sales Revenue 4000
    │                     Cr VAT Output 2300
    │
    └── Cash/Card Sale ──> Customer: "Checkout Charlie" (system customer)
                          Dr Accounts Receivable 1100
                          Cr Sales Revenue 4000
                          Cr VAT Output 2300

                          Tracked separately: Cash vs Card payment method

BANK DEPOSIT
    │
    └── Cash Reconciliation ──> Match POS daily totals to bank deposits
                               Dr Bank 1000
                               Cr Accounts Receivable 1100
                               (Settles "Checkout Charlie" balance)
```

### Key Principles
1. **POS sales NEVER post directly to bank** - they create receivables
2. **Cash vs Card tracked separately** - for reconciliation
3. **Daily totals** - Cash Recon shows per-day breakdown
4. **Bank matching** - When deposit found, settle the receivable

---

## Implementation Tasks

### Phase 1: Update Ledger System
**File:** `public/js/ledger.js`

Add new functions:
- `postPOSSale(data)` - Posts sale to receivables (not bank)
- `getPOSSales(customerId, dateRange)` - Get POS transactions
- `getCustomerBalance(customerId)` - Get customer A/R balance
- `getPOSDailyTotals(dateRange)` - Get daily cash/card totals
- `settlePOSDay(date, paymentMethod, bankTransactionId)` - Settle receivable from bank

Add new storage:
- `lorenco_customers` - Customer list
- `lorenco_pos_sales` - POS transaction log with payment method

### Phase 2: Add POS Sales Tab to Customers
**File:** `public/customers.html`

1. Add new tab: "POS Sales" after "Receipts"
2. Create POS Sales table showing:
   - Date/Time
   - Invoice #
   - Customer (or "Cash Sale")
   - Payment Method (Cash/Card/Account)
   - Amount (incl VAT)
   - Status (Pending/Settled)

3. Add filter by:
   - Date range
   - Payment method
   - Status (unsettled/settled)

4. Add "Checkout Charlie" as system customer on init

### Phase 3: Create Cash Reconciliation Page
**File:** `public/cash-reconciliation.html` (NEW)

**Layout:**
```
+--------------------------------------------------+
| CASH RECONCILIATION                              |
+--------------------------------------------------+
| Date Range: [From] [To]  [Load]                  |
+--------------------------------------------------+
| DAILY SUMMARY                                     |
+--------------------------------------------------+
| Date       | Cash Sales | Card Sales | Total     |
|------------|------------|------------|-----------|
| 2026-01-22 | R 5,420.00 | R 12,350   | R 17,770  |
| 2026-01-21 | R 3,200.00 | R 8,900    | R 12,100  |
+--------------------------------------------------+

+--------------------------------------------------+
| RECONCILIATION: 2026-01-22                       |
+--------------------------------------------------+
| CASH                                             |
| POS Cash Sales:        R 5,420.00                |
| Bank Deposit:          [Select from unmatched]   |
| Difference:            R 0.00                    |
| [Reconcile Cash]                                 |
+--------------------------------------------------+
| CARD                                             |
| POS Card Sales:        R 12,350.00               |
| Bank Deposit:          [Select from unmatched]   |
| Difference:            R 0.00                    |
| [Reconcile Card]                                 |
+--------------------------------------------------+
```

**Features:**
- Shows unreconciled POS days
- Pull unmatched bank deposits to match
- Support partial matches (deposit spans multiple days)
- Show variance if amounts don't match exactly
- Auto-allocate when matched

### Phase 4: Update Integrations API
**File:** `src/routes/integrations.js`

Modify `/external/transactions` endpoint:
- Add `paymentMethod` field (cash/card/account)
- For POS transactions, post to Receivables NOT bank
- If `paymentMethod === 'account'`, use specified customer
- If `paymentMethod === 'cash'` or `'card'`, use "Checkout Charlie" customer

### Phase 5: Customer Report for Checkout Charlie
**File:** `public/customers.html` (customer detail view)

When viewing "Checkout Charlie" customer:
- Show Cash balance (unsettled cash sales)
- Show Card balance (unsettled card sales)
- Show reconciliation history
- Link to Cash Reconciliation page

---

## Data Structures

### POS Sale Record
```javascript
{
  id: 'POS-2026-00001',
  date: '2026-01-22',
  time: '14:32:15',
  customerId: 'checkout-charlie' | 'CUST-001',
  customerName: 'Checkout Charlie' | 'ABC Company',
  paymentMethod: 'cash' | 'card' | 'account',
  items: [...],
  subtotal: 1000.00,
  vatAmount: 150.00,
  total: 1150.00,
  status: 'pending' | 'settled',
  settledDate: null,
  settledBankTxnId: null,
  journalRef: 'JNL-00045'
}
```

### Customer Record
```javascript
{
  id: 'CUST-001',
  code: 'ABC001',
  name: 'ABC Company',
  type: 'company' | 'individual',
  isSystemCustomer: false,
  // ... other fields
}

// System customer
{
  id: 'checkout-charlie',
  code: 'CC-POS',
  name: 'Checkout Charlie',
  type: 'system',
  isSystemCustomer: true,
  // Tracks: cashBalance, cardBalance
}
```

### Daily POS Summary
```javascript
{
  date: '2026-01-22',
  cashSales: 5420.00,
  cardSales: 12350.00,
  accountSales: 2500.00,
  totalSales: 20270.00,
  cashSettled: false,
  cardSettled: false,
  cashBankTxnId: null,
  cardBankTxnId: null
}
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `public/js/ledger.js` | MODIFY | Add POS/customer functions |
| `public/customers.html` | MODIFY | Add POS Sales tab |
| `public/cash-reconciliation.html` | CREATE | Cash/card reconciliation page |
| `public/js/navigation.js` | MODIFY | Add Cash Recon to menu |
| `src/routes/integrations.js` | MODIFY | Handle POS payment methods |

---

## Navigation Update

Add to Banking dropdown in navigation.js:
```
Banking
├── Bank Accounts
├── Bank Transactions
├── Bank Reconciliation
└── Cash Reconciliation  <-- NEW
```

---

## Approval Required

Please confirm this plan before implementation:
1. POS sales post to Receivables (1100), not Bank (1000)
2. "Checkout Charlie" is a system customer for cash/card sales
3. Cash Reconciliation matches daily POS totals to bank deposits
4. Separate tracking for Cash vs Card
5. Settlement posts: Dr Bank / Cr Receivables
