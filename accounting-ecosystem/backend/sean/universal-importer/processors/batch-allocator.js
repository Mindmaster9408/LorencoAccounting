/**
 * ============================================================================
 * Batch Allocator — Bulk-allocate imported transactions via SEAN
 * ============================================================================
 * Feeds each transaction through SEAN's decision engine allocation pipeline:
 *   1. Private Codex (company-specific learned decisions)
 *   2. Global Patterns (anonymized cross-company)
 *   3. Rule-Based Logic (500+ SA keywords)
 *   4. Amount heuristics
 *   5. Mark as "ask user" if no match
 *
 * Returns transactions with allocation suggestions attached.
 * ============================================================================
 */

const { suggestCategoryLocal, getAlternativeSuggestions, normalizeDescription } = require('../../allocations');

class BatchAllocator {

  /**
   * Allocate an array of normalized transactions
   * @param {Array<object>} transactions  - From TransactionNormalizer
   * @param {object} options
   * @param {number} options.companyId
   * @param {object} [options.decisionEngine] - SeanDecisionEngine instance (if available)
   * @param {object} [options.dataStore] - Mock or real data store
   * @param {number} [options.autoConfirmThreshold] - Confidence % to auto-confirm (default 85)
   * @returns {Promise<{ allocated: Array, needsReview: Array, stats: object }>}
   */
  static async allocate(transactions, options = {}) {
    const {
      companyId = 1,
      decisionEngine = null,
      dataStore = null,
      autoConfirmThreshold = 85
    } = options;

    const allocated = [];
    const needsReview = [];
    const stats = {
      total: transactions.length,
      autoAllocated: 0,
      needsReview: 0,
      byCategory: {},
      byMethod: {},
      avgConfidence: 0
    };

    let totalConfidence = 0;

    // Get learned rules if data store available
    let learnedRules = [];
    if (dataStore) {
      try {
        learnedRules = await dataStore.getAllocationRules(companyId);
      } catch (e) { /* ignore */ }
    }

    for (const txn of transactions) {
      let allocation = null;

      // Strategy 1: Use full decision engine (codex + patterns + keywords)
      if (decisionEngine) {
        try {
          allocation = await decisionEngine.makeDecision({
            description: txn.description,
            merchant: txn.description,
            amount: Math.abs(txn.amount),
            transactionDescription: txn.description
          });
        } catch (e) {
          console.error('BatchAllocator: Decision engine error:', e.message);
        }
      }

      // Strategy 2: Fallback to direct keyword matching
      if (!allocation || !allocation.suggestion) {
        const ruleResult = suggestCategoryLocal(
          txn.description || '',
          Math.abs(txn.amount || 0),
          learnedRules
        );

        allocation = {
          method: ruleResult.matchType || 'keyword',
          suggestion: ruleResult.category ? {
            category: ruleResult.category,
            categoryLabel: ruleResult.categoryLabel
          } : null,
          confidence: Math.round((ruleResult.confidence || 0) * 100),
          reasoning: ruleResult.reasoning || 'No match found',
          requiresUserInput: !ruleResult.category || ruleResult.confidence < 0.5,
          alternatives: getAlternativeSuggestions(txn.description || '', ruleResult.category)
        };
      }

      // Enrich transaction with allocation
      const enriched = {
        ...txn,
        allocation: {
          suggestedCategory: allocation.suggestion?.category || null,
          categoryLabel: allocation.suggestion?.categoryLabel || null,
          confidence: allocation.confidence || 0,
          method: allocation.method || 'none',
          reasoning: allocation.reasoning || '',
          alternatives: (allocation.alternatives || []).slice(0, 3),
          autoConfirmed: false
        }
      };

      // Auto-confirm if confidence is high enough
      if (enriched.allocation.suggestedCategory && enriched.allocation.confidence >= autoConfirmThreshold) {
        enriched.allocation.autoConfirmed = true;
        enriched.confirmedCategory = enriched.allocation.suggestedCategory;
        stats.autoAllocated++;
        allocated.push(enriched);
      } else {
        stats.needsReview++;
        needsReview.push(enriched);
      }

      // Track stats
      const cat = enriched.allocation.suggestedCategory || 'UNALLOCATED';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
      const method = enriched.allocation.method || 'none';
      stats.byMethod[method] = (stats.byMethod[method] || 0) + 1;
      totalConfidence += enriched.allocation.confidence;
    }

    stats.avgConfidence = transactions.length > 0
      ? Math.round(totalConfidence / transactions.length)
      : 0;

    return { allocated, needsReview, stats };
  }

  /**
   * Learn from user confirmations (batch)
   * @param {Array<object>} confirmedTransactions - Transactions with confirmedCategory set by user
   * @param {object} decisionEngine - SeanDecisionEngine instance
   */
  static async learnFromConfirmations(confirmedTransactions, decisionEngine) {
    if (!decisionEngine) return { learned: 0 };

    let learned = 0;
    for (const txn of confirmedTransactions) {
      if (!txn.confirmedCategory) continue;

      try {
        await decisionEngine.learn(
          { description: txn.description, merchant: txn.description, amount: txn.amount },
          { category: txn.confirmedCategory },
          true
        );
        learned++;
      } catch (e) {
        console.error('BatchAllocator: Learn error:', e.message);
      }
    }

    return { learned };
  }
}

module.exports = BatchAllocator;
