/**
 * ============================================================================
 * Balance Validator — Checks debit/credit balance integrity
 * ============================================================================
 */

class BalanceValidator {

  /**
   * Validate that transactions balance correctly
   * @param {Array<object>} transactions - Normalized transactions
   * @returns {{ valid: boolean, errors: Array, summary: object }}
   */
  static validate(transactions) {
    const errors = [];

    const totalDebits = transactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalCredits = transactions
      .filter(t => t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    const difference = Math.abs(totalDebits - totalCredits);

    const summary = {
      transactionCount: transactions.length,
      debitCount: transactions.filter(t => t.type === 'debit').length,
      creditCount: transactions.filter(t => t.type === 'credit').length,
      totalDebits: Math.round(totalDebits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
      difference: Math.round(difference * 100) / 100,
      balanced: difference < 0.01
    };

    // Cash books and bank statements don't need to balance (debits ≠ credits)
    // Only flag if the user explicitly expects a balanced import
    if (difference > 0.01) {
      errors.push({
        type: 'UNBALANCED',
        severity: 'INFO',
        message: `Debits (R${summary.totalDebits.toFixed(2)}) ≠ Credits (R${summary.totalCredits.toFixed(2)}) — Difference: R${summary.difference.toFixed(2)}`,
        data: summary
      });
    }

    // Check for zero-amount transactions
    const zeroAmounts = transactions.filter(t => t.amount === 0 && t.description);
    if (zeroAmounts.length > 0) {
      errors.push({
        type: 'ZERO_AMOUNTS',
        severity: 'WARNING',
        message: `${zeroAmounts.length} transaction(s) have zero amounts`,
        lines: zeroAmounts.map(t => t.lineNumber)
      });
    }

    // Check for missing dates
    const missingDates = transactions.filter(t => !t.date);
    if (missingDates.length > 0) {
      errors.push({
        type: 'MISSING_DATES',
        severity: 'WARNING',
        message: `${missingDates.length} transaction(s) have no date`,
        lines: missingDates.map(t => t.lineNumber)
      });
    }

    // Check for missing descriptions
    const missingDescs = transactions.filter(t => !t.description || t.description.length < 2);
    if (missingDescs.length > 0) {
      errors.push({
        type: 'MISSING_DESCRIPTIONS',
        severity: 'WARNING',
        message: `${missingDescs.length} transaction(s) have no description`,
        lines: missingDescs.map(t => t.lineNumber)
      });
    }

    return {
      valid: !errors.some(e => e.severity === 'CRITICAL'),
      errors,
      summary
    };
  }
}

module.exports = BalanceValidator;
