/**
 * ============================================================================
 * Duplicate Detector — Prevents double-importing transactions
 * ============================================================================
 * Checks against existing transactions in the data store using:
 *   - Exact match (date + description + amount)
 *   - Fuzzy match (similar description within date range)
 * ============================================================================
 */

class DuplicateDetector {

  /**
   * Check for duplicates against existing data
   * @param {Array<object>} newTransactions  - Transactions to import
   * @param {Array<object>} existingTransactions - Already in system
   * @returns {{ duplicates: Array, unique: Array, warnings: Array }}
   */
  static detect(newTransactions, existingTransactions = []) {
    const duplicates = [];
    const unique = [];
    const warnings = [];

    if (!existingTransactions || existingTransactions.length === 0) {
      return { duplicates: [], unique: newTransactions, warnings: [] };
    }

    // Build lookup index from existing transactions
    const existingIndex = new Map();
    for (const existing of existingTransactions) {
      const key = this.makeKey(existing);
      if (!existingIndex.has(key)) existingIndex.set(key, []);
      existingIndex.get(key).push(existing);
    }

    for (const txn of newTransactions) {
      const key = this.makeKey(txn);

      if (existingIndex.has(key)) {
        duplicates.push({
          transaction: txn,
          matchedWith: existingIndex.get(key)[0],
          matchType: 'EXACT'
        });
      } else {
        // Fuzzy check: same date + similar amount
        const fuzzyMatch = this.fuzzyMatch(txn, existingTransactions);
        if (fuzzyMatch) {
          warnings.push({
            transaction: txn,
            possibleMatch: fuzzyMatch,
            matchType: 'FUZZY',
            similarity: fuzzyMatch.similarity
          });
        }
        unique.push(txn);
      }
    }

    return { duplicates, unique, warnings };
  }

  /**
   * Create a unique key for exact matching
   */
  static makeKey(txn) {
    const date = (txn.date || '').split('T')[0];
    const amount = Math.round((txn.amount || 0) * 100);
    const type = txn.type || 'debit';
    const desc = (txn.description || '').toLowerCase().trim().slice(0, 30);
    return `${date}|${amount}|${type}|${desc}`;
  }

  /**
   * Fuzzy match: same date, similar amount (within 1%), similar description
   */
  static fuzzyMatch(txn, existingTransactions) {
    for (const existing of existingTransactions) {
      // Same date
      if (txn.date !== existing.date) continue;
      // Same type
      if (txn.type !== existing.type) continue;
      // Similar amount (within 1%)
      const amountDiff = Math.abs(txn.amount - existing.amount);
      if (amountDiff > txn.amount * 0.01 && amountDiff > 1) continue;
      // Similar description (Levenshtein distance)
      const similarity = this.descriptionSimilarity(txn.description, existing.description);
      if (similarity > 0.7) {
        return { ...existing, similarity };
      }
    }
    return null;
  }

  /**
   * Simple description similarity (Jaccard index on words)
   */
  static descriptionSimilarity(a, b) {
    if (!a || !b) return 0;
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return union === 0 ? 0 : intersection / union;
  }
}

module.exports = DuplicateDetector;
