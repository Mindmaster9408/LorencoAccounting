/**
 * ============================================================================
 * Journal Creator — Convert allocated transactions into accounting journals
 * ============================================================================
 * SA double-entry bookkeeping:
 *   - Every bank debit  → DR Expense/Asset, CR Bank
 *   - Every bank credit → DR Bank, CR Revenue/Liability
 *   - VAT extracted at 15% where applicable
 *
 * Handles:
 *   - Automatic VAT extraction (15/115)
 *   - Cash book journal format (standard SA format)
 *   - Multi-period separation (transactions spanning months)
 *   - Afrikaans & English labels
 * ============================================================================
 */

// SA VAT rate
const VAT_RATE = 0.15;
const VAT_FRACTION = VAT_RATE / (1 + VAT_RATE);  // 15/115

// Categories where VAT input can be claimed
const VAT_CLAIMABLE_CATEGORIES = [
  'TELEPHONE', 'ELECTRICITY', 'WATER', 'RENT', 'FUEL', 'STATIONERY',
  'ADVERTISING', 'REPAIRS', 'SUBSCRIPTIONS', 'TRANSPORT', 'SECURITY',
  'CLEANING', 'IT_EQUIPMENT', 'FURNITURE', 'STOCK_PURCHASES',
  'PROFESSIONAL_FEES', 'TRAINING', 'MEMBERSHIP', 'CREDITOR_PAYMENT'
];

// Categories where VAT input is DENIED
const VAT_DENIED_CATEGORIES = [
  'ENTERTAINMENT', 'DONATIONS', 'DRAWINGS', 'PENALTIES',
  'SALARIES', 'PAYE', 'UIF', 'SDL', 'LOAN_REPAYMENT',
  'PROVISIONAL_TAX', 'COMPANY_TAX', 'CAPITAL'
];

// Categories that are credits (income/receipts)
const CREDIT_CATEGORIES = [
  'REVENUE', 'INTEREST_RECEIVED', 'DEBTOR_RECEIPT', 'REFUND', 'CAPITAL'
];

class JournalCreator {

  /**
   * Create journal entries from allocated transactions
   * @param {Array<object>} transactions - Allocated transactions with confirmedCategory
   * @param {object} options
   * @param {number} options.companyId
   * @param {boolean} [options.extractVAT=true] - Extract VAT at 15% where applicable
   * @param {string} [options.bankAccount='Bank'] - Bank account name
   * @param {string} [options.journal='CB'] - Journal type (CB=Cash Book)
   * @returns {{ journals: Array, vatSummary: object, periodSummary: object }}
   */
  static create(transactions, options = {}) {
    const {
      companyId = 1,
      extractVAT = true,
      bankAccount = 'Bank',
      journal = 'CB'
    } = options;

    const journals = [];
    const vatSummary = {
      totalVATInput: 0,   // VAT we can claim
      totalVATOutput: 0,  // VAT we owe
      totalExclusive: 0,  // Total excl VAT
      deniedInput: 0,     // VAT denied on expenses
      byCategory: {}
    };
    const periodSummary = {};

    for (const txn of transactions) {
      const category = txn.confirmedCategory || txn.allocation?.suggestedCategory;
      if (!category) continue;

      const isCredit = txn.type === 'credit' || txn.amount > 0 || CREDIT_CATEGORIES.includes(category);
      const absAmount = Math.abs(txn.amount);

      // Determine VAT treatment
      let vatAmount = 0;
      let exclusiveAmount = absAmount;
      let vatStatus = 'no_vat';

      if (extractVAT && absAmount > 0) {
        if (VAT_CLAIMABLE_CATEGORIES.includes(category)) {
          vatAmount = Math.round(absAmount * VAT_FRACTION * 100) / 100;
          exclusiveAmount = Math.round((absAmount - vatAmount) * 100) / 100;
          vatStatus = isCredit ? 'output' : 'input';
        } else if (VAT_DENIED_CATEGORIES.includes(category)) {
          vatStatus = 'denied';
        } else if (isCredit && category === 'REVENUE') {
          vatAmount = Math.round(absAmount * VAT_FRACTION * 100) / 100;
          exclusiveAmount = Math.round((absAmount - vatAmount) * 100) / 100;
          vatStatus = 'output';
        }
      }

      // Create journal entry (double-entry)
      const journalEntry = {
        id: `J-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        companyId,
        journal,
        date: txn.date,
        reference: txn.reference || '',
        description: txn.description || '',
        lines: []
      };

      if (isCredit) {
        // CREDIT TRANSACTION: DR Bank, CR Revenue/Income
        journalEntry.lines.push({
          account: bankAccount,
          debit: absAmount,
          credit: 0,
          description: txn.description
        });
        journalEntry.lines.push({
          account: this.accountName(category),
          debit: 0,
          credit: exclusiveAmount,
          description: txn.description
        });
        if (vatAmount > 0) {
          journalEntry.lines.push({
            account: 'VAT Output',
            debit: 0,
            credit: vatAmount,
            description: `VAT on ${txn.description}`
          });
          vatSummary.totalVATOutput += vatAmount;
        }
      } else {
        // DEBIT TRANSACTION: DR Expense/Asset, CR Bank
        journalEntry.lines.push({
          account: this.accountName(category),
          debit: exclusiveAmount,
          credit: 0,
          description: txn.description
        });
        if (vatAmount > 0 && vatStatus === 'input') {
          journalEntry.lines.push({
            account: 'VAT Input',
            debit: vatAmount,
            credit: 0,
            description: `VAT on ${txn.description}`
          });
          vatSummary.totalVATInput += vatAmount;
        } else if (vatStatus === 'denied') {
          // VAT denied — full amount goes to expense
          vatSummary.deniedInput += absAmount * VAT_FRACTION;
        }
        journalEntry.lines.push({
          account: bankAccount,
          debit: 0,
          credit: absAmount,
          description: txn.description
        });
      }

      // Validate double-entry balance
      const totalDebit = journalEntry.lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = journalEntry.lines.reduce((s, l) => s + l.credit, 0);
      journalEntry.balanced = Math.abs(totalDebit - totalCredit) < 0.01;
      journalEntry.totalDebit = Math.round(totalDebit * 100) / 100;
      journalEntry.totalCredit = Math.round(totalCredit * 100) / 100;

      journals.push(journalEntry);

      // Track VAT by category
      if (vatAmount > 0) {
        if (!vatSummary.byCategory[category]) {
          vatSummary.byCategory[category] = { input: 0, output: 0 };
        }
        if (vatStatus === 'input') {
          vatSummary.byCategory[category].input += vatAmount;
        } else if (vatStatus === 'output') {
          vatSummary.byCategory[category].output += vatAmount;
        }
      }

      vatSummary.totalExclusive += exclusiveAmount;

      // Track period (YYYY-MM)
      const period = txn.date ? txn.date.slice(0, 7) : 'unknown';
      if (!periodSummary[period]) {
        periodSummary[period] = { debits: 0, credits: 0, count: 0 };
      }
      periodSummary[period].count++;
      if (isCredit) {
        periodSummary[period].credits += absAmount;
      } else {
        periodSummary[period].debits += absAmount;
      }
    }

    // Round VAT summary
    vatSummary.totalVATInput = Math.round(vatSummary.totalVATInput * 100) / 100;
    vatSummary.totalVATOutput = Math.round(vatSummary.totalVATOutput * 100) / 100;
    vatSummary.totalExclusive = Math.round(vatSummary.totalExclusive * 100) / 100;
    vatSummary.deniedInput = Math.round(vatSummary.deniedInput * 100) / 100;
    vatSummary.netVAT = Math.round((vatSummary.totalVATOutput - vatSummary.totalVATInput) * 100) / 100;

    // Round period summary
    for (const period of Object.keys(periodSummary)) {
      periodSummary[period].debits = Math.round(periodSummary[period].debits * 100) / 100;
      periodSummary[period].credits = Math.round(periodSummary[period].credits * 100) / 100;
    }

    return { journals, vatSummary, periodSummary };
  }

  /**
   * Map category code to human-readable SA account name
   */
  static accountName(code) {
    const MAP = {
      'BANK_CHARGES': 'Bank Charges',
      'TELEPHONE': 'Telephone & Communications',
      'ELECTRICITY': 'Electricity',
      'WATER': 'Water & Rates',
      'RENT': 'Rent Paid',
      'SALARIES': 'Salaries & Wages',
      'PAYE': 'PAYE',
      'UIF': 'UIF',
      'SDL': 'SDL',
      'FUEL': 'Fuel & Motor Expenses',
      'INSURANCE': 'Insurance',
      'STATIONERY': 'Stationery & Office Supplies',
      'PROFESSIONAL_FEES': 'Professional Fees',
      'ADVERTISING': 'Advertising & Marketing',
      'REPAIRS': 'Repairs & Maintenance',
      'ENTERTAINMENT': 'Entertainment & Meals',
      'GROCERIES': 'Groceries & Consumables',
      'SUBSCRIPTIONS': 'Subscriptions & Software',
      'TRANSPORT': 'Transport & Delivery',
      'TRAVEL': 'Travel & Accommodation',
      'MEDICAL': 'Medical Expenses',
      'SECURITY': 'Security Services',
      'CLEANING': 'Cleaning Services',
      'IT_EQUIPMENT': 'IT Equipment',
      'FURNITURE': 'Furniture & Fittings',
      'VAT_INPUT': 'VAT Input',
      'VAT_OUTPUT': 'VAT Output',
      'VAT_PAYMENT': 'VAT Payment - SARS',
      'PROVISIONAL_TAX': 'Provisional Tax',
      'COMPANY_TAX': 'Company Tax',
      'DRAWINGS': 'Drawings',
      'CAPITAL': 'Capital',
      'LOAN_REPAYMENT': 'Loan Repayment',
      'INTEREST_RECEIVED': 'Interest Received',
      'INTEREST_PAID': 'Interest Paid',
      'REVENUE': 'Revenue / Income',
      'STOCK_PURCHASES': 'Stock Purchases',
      'CREDITOR_PAYMENT': 'Creditors',
      'DEBTOR_RECEIPT': 'Debtors',
      'REFUND': 'Refunds',
      'DONATION': 'Donations',
      'TRAINING': 'Training & Education',
      'MEMBERSHIP': 'Memberships',
      'PENALTIES': 'Penalties & Fines',
      'OTHER': 'Sundry Expenses'
    };
    return MAP[code] || code;
  }

  /**
   * Generate a cash book summary report
   */
  static cashBookSummary(journals) {
    const summary = {
      totalTransactions: journals.length,
      totalDebits: 0,
      totalCredits: 0,
      balanced: true,
      byAccount: {}
    };

    for (const j of journals) {
      for (const line of j.lines) {
        if (!summary.byAccount[line.account]) {
          summary.byAccount[line.account] = { debit: 0, credit: 0 };
        }
        summary.byAccount[line.account].debit += line.debit;
        summary.byAccount[line.account].credit += line.credit;
        summary.totalDebits += line.debit;
        summary.totalCredits += line.credit;
      }

      if (!j.balanced) summary.balanced = false;
    }

    summary.totalDebits = Math.round(summary.totalDebits * 100) / 100;
    summary.totalCredits = Math.round(summary.totalCredits * 100) / 100;
    summary.difference = Math.round((summary.totalDebits - summary.totalCredits) * 100) / 100;

    // Round account totals
    for (const acct of Object.keys(summary.byAccount)) {
      summary.byAccount[acct].debit = Math.round(summary.byAccount[acct].debit * 100) / 100;
      summary.byAccount[acct].credit = Math.round(summary.byAccount[acct].credit * 100) / 100;
    }

    return summary;
  }
}

module.exports = JournalCreator;
