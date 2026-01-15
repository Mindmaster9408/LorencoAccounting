# VAT RECONCILIATION QUICK START GUIDE

## 🎯 Purpose
This system allows you to reconcile your VAT returns against the Trial Balance, authorize differences, approve reconciliations, and submit to SARS with full locking and audit trail.

---

## 📋 STEP-BY-STEP WORKFLOW

### Step 1: Select VAT Period
1. Open VAT Management page
2. Click "VAT Reconciliation" button
3. Select period from dropdown (e.g., "2025.08" for August 2025)
4. System automatically loads:
   - Trial Balance for that month only
   - Existing draft reconciliation (if any)
   - VAT report data from journals

### Step 2: Review Top Table
The top table shows monthly breakdown:
- **Income (Output)**: Standard outputs + Capital goods + Zero rate
- **Expenses (Input)**: Standard inputs + Capital goods + Bad debts
- **VAT Payable**: Total Output (A) - Total Input (B)

### Step 3: Review Income Reconciliation
Compare VAT Report vs. Trial Balance:
- "According to VAT Report (Excl)" - from journals with VAT codes
- "According to Trial Balance (Excl)" - from GL accounts
- "Difference" - automatically calculated

### Step 4: Review Expense Reconciliation
Same as income - compare VAT Report vs. TB amounts.

### Step 5: Review Trial Balance Section
Detailed account-level breakdown:
- **INCOME** section - shows all income accounts with VAT/NO VAT split
- **EXPENSE** section - shows all expense accounts with VAT/NO VAT split
- Amounts are from the selected period ONLY (not cumulative)

### Step 6: Enter Statement of Account Amount
1. Find "According to Statement of Account" input
2. Enter the amount from your SARS statement
3. System calculates difference vs. Net VAT

### Step 7: Authorize Differences
**Two authorizations required:**

**A) Income/Expense Difference Authorization**
1. Review the difference between VAT Report and Trial Balance
2. Tick the "Authorized" checkbox
3. System records your initials (e.g., "r vL" for Ruan van Loughrenberg)
4. Initials display next to checkbox

**B) Statement of Account Difference Authorization**
1. Review the difference between Net VAT and SOA amount
2. Tick the "Authorized" checkbox
3. System records your initials
4. Initials display next to checkbox

### Step 8: Save Draft
1. Click "Save Draft" button
2. Reconciliation saved with status = DRAFT
3. You can log out and return later

### Step 9: Approve Reconciliation
1. Click "Approve Reconciliation" button
2. Confirm approval
3. Status changes to APPROVED
4. Period is now ready for submission

### Step 10: Submit to SARS
1. Click "Submit to SARS" button
2. **WARNING DIALOG** appears:
   - This will LOCK the reconciliation
   - This will LOCK the VAT report
   - No further changes allowed
3. Confirm submission
4. Optional: Enter SARS submission reference
5. System:
   - Creates submission record
   - Locks all data
   - Adds to submission history

### Step 11: View Historical Records
1. Scroll to "VAT Submission History" table
2. Find your submitted period
3. Click "View" under "Reconciliation" column → Opens locked snapshot
4. Click "View" under "VAT Report" column → Opens VAT report

---

## 🔒 LOCKING BEHAVIOR

### What Can Be Edited?
- **DRAFT** status: Everything editable
- **APPROVED** status: Can still make final adjustments
- **LOCKED** status: Nothing editable (read-only)

### When Does Locking Happen?
- Automatically when you submit to SARS
- Cannot be unlocked (permanent)
- Protects compliance and audit integrity

### What Gets Locked?
1. VAT Period (cannot reopen)
2. VAT Reconciliation (cannot edit)
3. VAT Report (cannot regenerate)
4. All linked data frozen

---

## 👤 USER PERMISSIONS

| Action | Viewer | Bookkeeper | Accountant | Admin |
|--------|--------|------------|------------|-------|
| View reconciliation | ✅ | ✅ | ✅ | ✅ |
| Save draft | ❌ | ❌ | ✅ | ✅ |
| Authorize differences | ❌ | ❌ | ✅ | ✅ |
| Approve reconciliation | ❌ | ❌ | ✅ | ✅ |
| Submit to SARS | ❌ | ❌ | ✅ | ✅ |
| View history | ✅ | ✅ | ✅ | ✅ |

---

## 📊 SUBMISSION HISTORY TABLE

### Columns Explained
- **Period**: VAT period (e.g., "January 2026")
- **Submission Date**: When submitted to SARS
- **Output VAT**: Total VAT collected (sales)
- **Input VAT**: Total VAT paid (expenses)
- **Net VAT**: Amount payable to SARS (or refund)
- **Payment Date**: When payment made
- **Status**: 
  - PENDING - Not yet submitted
  - SUBMITTED - Sent to SARS
  - ACKNOWLEDGED - SARS confirmed receipt
  - COMPLETED - Payment processed
- **Reconciliation**: Link to view reconciliation snapshot
- **VAT Report**: Link to view VAT201 report

### View Links
- **Enabled**: Period has been submitted and locked
- **Disabled (N/A)**: Period is draft or pending

---

## 🔍 AUDIT TRAIL

Every action is logged:
- Who performed the action
- When it happened
- What changed (before/after snapshots)
- Why (authorization initials, submission references)

View audit log in Admin → Audit section.

---

## 🤖 AI INTEGRATION (FUTURE)

Framework in place for AI to:
- Auto-populate reconciliation fields
- Suggest differences explanations
- Draft reconciliations for review

Currently requires manual input.

---

## ⚠️ IMPORTANT NOTES

### Trial Balance Period Rule
The Trial Balance section shows ONLY the selected period's data.
- Example: If you select August 2025, TB shows August transactions only
- NOT cumulative from start of year
- Ensures accurate period-specific reconciliation

### Authorization Initials Format
System automatically formats your initials:
- First name first letter (lowercase)
- Space
- Last name first letter or prefix (uppercase)
- Examples:
  - "Ruan van Loughrenberg" → "r vL"
  - "John Smith" → "j S"

### Cannot Unlock
Once submitted to SARS, the period is PERMANENTLY locked.
- No admin override
- No unlock feature
- This is intentional for compliance

### Statement of Account
Always verify SOA amount against official SARS statement before submission.

---

## 📞 SUPPORT & TROUBLESHOOTING

### Common Issues

**Q: Can't see "Authorize" checkboxes?**  
A: Only ACCOUNTANT and ADMIN roles can authorize.

**Q: Submit button disabled?**  
A: Must approve reconciliation first.

**Q: View links show "N/A"?**  
A: Period hasn't been submitted yet (still draft).

**Q: Trial Balance amounts don't match?**  
A: Check selected period range - must match VAT period exactly.

**Q: Can I unlock a submitted period?**  
A: No - this is permanent to maintain audit integrity.

---

## 📚 RELATED DOCUMENTATION

- Full implementation details: `docs/VAT_RECONCILIATION_IMPLEMENTATION.md`
- API endpoints: `docs/API.md`
- Database schema: `docs/schema.sql`
- Architecture overview: `docs/ARCHITECTURE.md`

---

**Last Updated:** January 15, 2026  
**Version:** 1.0.0
