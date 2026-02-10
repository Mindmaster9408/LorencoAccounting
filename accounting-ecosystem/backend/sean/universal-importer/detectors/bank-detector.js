/**
 * ============================================================================
 * Bank Detector — Identifies SA bank statement formats
 * ============================================================================
 * Detects FNB, ABSA, Nedbank, Standard Bank, Capitec, Investec, TymeBank
 * statement formats from column headers and content patterns.
 * ============================================================================
 */

const BANK_FORMATS = {
  FNB: {
    name: 'First National Bank',
    headerPatterns: ['account number', 'statement number', 'fnb'],
    dateFormat: 'DD/MM/YYYY',
    descriptionHeaders: ['description'],
    amountHeaders: ['amount'],
    balanceHeaders: ['balance']
  },
  ABSA: {
    name: 'ABSA Bank',
    headerPatterns: ['absa', 'account number'],
    dateFormat: 'YYYY-MM-DD',
    descriptionHeaders: ['description', 'transaction description'],
    amountHeaders: ['amount'],
    balanceHeaders: ['balance']
  },
  NEDBANK: {
    name: 'Nedbank',
    headerPatterns: ['nedbank', 'account number'],
    dateFormat: 'YYYY/MM/DD',
    descriptionHeaders: ['description', 'transaction description'],
    debitHeaders: ['debit'],
    creditHeaders: ['credit'],
    balanceHeaders: ['balance']
  },
  STANDARD_BANK: {
    name: 'Standard Bank',
    headerPatterns: ['standard bank', 'account number'],
    dateFormat: 'DD MMM YYYY',
    descriptionHeaders: ['description'],
    amountHeaders: ['amount'],
    balanceHeaders: ['balance']
  },
  CAPITEC: {
    name: 'Capitec Bank',
    headerPatterns: ['capitec', 'global one'],
    dateFormat: 'YYYY-MM-DD',
    descriptionHeaders: ['description'],
    debitHeaders: ['debit'],
    creditHeaders: ['credit'],
    balanceHeaders: ['balance']
  },
  INVESTEC: {
    name: 'Investec',
    headerPatterns: ['investec'],
    dateFormat: 'DD/MM/YYYY',
    descriptionHeaders: ['description', 'narrative'],
    amountHeaders: ['amount'],
    balanceHeaders: ['balance']
  }
};

class BankDetector {

  /**
   * Try to detect which bank the statement comes from
   * @param {Array} headerRow - Header row values
   * @param {Array<Array>} sampleRows - First few data rows
   * @param {string} fileName - Original file name
   * @returns {{ detected: boolean, bank: string|null, format: object|null, confidence: number }}
   */
  static detect(headerRow, sampleRows, fileName) {
    const headerText = (headerRow || []).map(h => String(h || '').toLowerCase()).join(' ');
    const fileNameLower = (fileName || '').toLowerCase();

    let bestMatch = null;
    let bestScore = 0;

    for (const [bankKey, bankFormat] of Object.entries(BANK_FORMATS)) {
      let score = 0;

      // Check file name
      if (fileNameLower.includes(bankKey.toLowerCase()) || fileNameLower.includes(bankFormat.name.toLowerCase())) {
        score += 30;
      }

      // Check header patterns
      for (const pattern of bankFormat.headerPatterns) {
        if (headerText.includes(pattern)) score += 25;
      }

      // Check description header matches
      if (bankFormat.descriptionHeaders) {
        for (const dh of bankFormat.descriptionHeaders) {
          if (headerText.includes(dh)) score += 10;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { bank: bankKey, format: bankFormat };
      }
    }

    if (bestMatch && bestScore >= 25) {
      return {
        detected: true,
        bank: bestMatch.bank,
        bankName: bestMatch.format.name,
        format: bestMatch.format,
        confidence: Math.min(bestScore, 100)
      };
    }

    return { detected: false, bank: null, format: null, confidence: 0 };
  }
}

module.exports = BankDetector;
