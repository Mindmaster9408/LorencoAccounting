/**
 * ============================================================================
 * SEAN AI — Decision Engine
 * ============================================================================
 * The CORE BRAIN of SEAN. Orchestrates all decision-making through a
 * prioritized pipeline — ZERO external API calls.
 *
 * Decision Priority:
 *   1. Private Codex (encrypted, company-specific learned decisions)
 *   2. Knowledge Base rules (tax rules, VAT cross-refs, decision engines)
 *   3. Global Patterns (anonymized cross-company intelligence)
 *   4. Rule-Based Logic (keyword matching, SA allocation categories)
 *   5. Historical Analysis (past company allocations)
 *   6. Ask User (learn for next time)
 *
 * Ported from sean-webapp/lib/allocation-engine.ts + codex-engine.ts
 * Adapted for Express + Supabase/Mock dual-mode backend.
 * ============================================================================
 */

const SeanEncryption = require('./encryption');
const { suggestCategoryLocal, getAlternativeSuggestions, normalizeDescription, extractKeywords } = require('./allocations');
const { processCalculation, parseCalculationRequest } = require('./calculations');
const { queryCodex, checkDeductibility, matchRelevantItems, parseTeachMessage } = require('./knowledge-base');

class SeanDecisionEngine {

  /**
   * @param {number} companyId - Company this engine serves
   * @param {string} encryptionKey - 64-char hex key for private codex encryption
   * @param {object} dataStore - Data access layer (mock or Supabase)
   */
  constructor(companyId, encryptionKey, dataStore) {
    this.companyId = companyId;
    this.encryptionKey = encryptionKey;
    this.store = dataStore;
  }

  // ─── Main Decision Entry Point ───────────────────────────────────────────

  /**
   * Make a decision for a given context.
   * Runs through the priority pipeline and returns the first confident answer.
   */
  async makeDecision(context) {
    const result = {
      method: null,
      suggestion: null,
      confidence: 0,
      reasoning: null,
      requiresUserInput: false,
      alternatives: [],
      metadata: {}
    };

    // Detect intent type
    const intentType = this.classifyIntent(context);
    result.metadata.intentType = intentType;

    // ── CALCULATION requests are handled immediately ──
    if (intentType === 'CALCULATION' && context.question) {
      const calcResult = processCalculation(context.question);
      if (calcResult) {
        result.method = 'calculation';
        result.suggestion = calcResult;
        result.confidence = 100;
        result.reasoning = 'Local SA tax/VAT calculation';
        return result;
      }
    }

    // ── ALLOCATION requests ──
    if (intentType === 'ALLOCATION' || context.merchant || context.description) {
      return this.makeAllocationDecision(context);
    }

    // ── QUESTION/TEACH/GENERAL requests ──
    if (intentType === 'TEACH' && context.question) {
      return this.handleTeachRequest(context);
    }

    if (intentType === 'QUESTION' || intentType === 'GENERAL') {
      return this.makeQuestionDecision(context);
    }

    // Unknown intent — ask user
    result.method = 'user_input_required';
    result.requiresUserInput = true;
    result.reasoning = 'I need more context to help you. What would you like me to do?';
    return result;
  }

  // ─── Intent Classification ─────────────────────────────────────────────

  /**
   * Classify what the user wants.
   * Ported from sean-webapp chat messages POST handler.
   */
  classifyIntent(context) {
    const text = (context.question || context.description || '').toLowerCase();

    // Teach mode
    if (/^(leer:|teach:|save to codex:)/i.test(context.question || '')) {
      return 'TEACH';
    }

    // Calculation
    if (parseCalculationRequest(text)) {
      return 'CALCULATION';
    }

    // Allocation
    if (context.merchant || context.transactionDescription ||
        text.includes('allocat') || text.includes('categoriz') || text.includes('categoris') ||
        text.includes('which account') || text.includes('expense type')) {
      return 'ALLOCATION';
    }

    // Question
    if (text.includes('?') || text.includes('how ') || text.includes('what ') ||
        text.includes('is ') || text.includes('can ') || text.includes('deductible') ||
        text.includes('vat') || text.includes('tax') || text.includes('paye')) {
      return 'QUESTION';
    }

    return 'GENERAL';
  }

  // ─── Allocation Decision Pipeline ──────────────────────────────────────

  async makeAllocationDecision(context) {
    const { merchant, description, amount } = context;
    const desc = description || merchant || '';
    const contextHash = SeanEncryption.hashContext(JSON.stringify({ merchant, description, amount }));

    const result = {
      method: null,
      suggestion: null,
      confidence: 0,
      reasoning: null,
      requiresUserInput: false,
      alternatives: [],
      metadata: { intentType: 'ALLOCATION' }
    };

    // PRIORITY 1: Check Private Codex (encrypted, company-specific)
    const codexResult = await this.checkPrivateCodex(contextHash);
    if (codexResult && codexResult.confidence >= 85) {
      result.method = 'private_codex';
      result.suggestion = codexResult.suggestion;
      result.confidence = codexResult.confidence;
      result.reasoning = 'Based on your previous decisions';
      return result;
    }

    // PRIORITY 2: Check Global Patterns (anonymized cross-company)
    const patternResult = await this.checkGlobalPatterns(context);
    if (patternResult && patternResult.confidence >= 75) {
      result.method = 'global_pattern';
      result.suggestion = patternResult.suggestion;
      result.confidence = patternResult.confidence;
      result.reasoning = patternResult.reasoning;
      result.metadata.distribution = patternResult.distribution;
      return result;
    }

    // PRIORITY 3: Rule-Based Logic (500+ SA keywords, free, deterministic)
    const learnedRules = await this.store.getAllocationRules(this.companyId);
    const ruleResult = suggestCategoryLocal(desc, amount || 0, learnedRules);
    if (ruleResult && ruleResult.confidence > 0.5) {
      result.method = ruleResult.matchType;
      result.suggestion = {
        category: ruleResult.category,
        categoryLabel: ruleResult.categoryLabel
      };
      result.confidence = Math.round(ruleResult.confidence * 100);
      result.reasoning = ruleResult.reasoning;
      result.alternatives = getAlternativeSuggestions(desc, ruleResult.category);
      return result;
    }

    // PRIORITY 4: Low-confidence keyword match (still useful)
    if (ruleResult && ruleResult.category) {
      result.method = ruleResult.matchType;
      result.suggestion = {
        category: ruleResult.category,
        categoryLabel: ruleResult.categoryLabel
      };
      result.confidence = Math.round(ruleResult.confidence * 100);
      result.reasoning = ruleResult.reasoning + ' (low confidence — please verify)';
      result.requiresUserInput = true;
      result.alternatives = getAlternativeSuggestions(desc, ruleResult.category);
      return result;
    }

    // PRIORITY 5: No match — ask user to teach SEAN
    result.method = 'user_input_required';
    result.requiresUserInput = true;
    result.reasoning = 'I haven\'t seen this pattern before. Please tell me the correct category so I can learn.';
    result.alternatives = getAlternativeSuggestions(desc);
    return result;
  }

  // ─── Question Decision Pipeline ────────────────────────────────────────

  async makeQuestionDecision(context) {
    const question = context.question || '';

    const result = {
      method: null,
      suggestion: null,
      confidence: 0,
      reasoning: null,
      requiresUserInput: false,
      alternatives: [],
      metadata: { intentType: context.question ? 'QUESTION' : 'GENERAL' }
    };

    // PRIORITY 1: Check Private Codex for similar questions
    const contextHash = SeanEncryption.hashContext(question.toLowerCase().trim());
    const codexResult = await this.checkPrivateCodex(contextHash);
    if (codexResult && codexResult.confidence >= 80) {
      result.method = 'private_codex';
      result.suggestion = codexResult.suggestion;
      result.confidence = codexResult.confidence;
      result.reasoning = 'Based on your previous knowledge';
      return result;
    }

    // PRIORITY 2: Knowledge Base (codex rules, tax rules, VAT cross-refs)
    const knowledgeItems = await this.store.getKnowledgeItems(this.companyId);
    if (knowledgeItems.length > 0) {
      // Infer domain from question
      const domain = this.inferDomain(question);
      const codexResult = queryCodex(question, domain, knowledgeItems);

      if (codexResult.hasCodifiedKnowledge) {
        result.method = 'knowledge_base';
        result.suggestion = {
          answer: codexResult.formattedContext,
          taxRules: codexResult.taxRules.length,
          vatRules: codexResult.vatRules.length,
          decisionEngines: codexResult.decisionEngines.length
        };
        result.confidence = 85;
        result.reasoning = 'Answer from SEAN\'s codex rules and tax knowledge';
        return result;
      }

      // Check deductibility
      if (question.toLowerCase().includes('deductible') || question.toLowerCase().includes('aftrekbaar')) {
        const deductResult = checkDeductibility(question, question, knowledgeItems);
        if (deductResult) {
          result.method = 'knowledge_base';
          result.suggestion = {
            isDeductible: deductResult.isDeductible,
            percentage: deductResult.percentage,
            reason: deductResult.reason,
            conditions: deductResult.conditions,
            citations: deductResult.citations,
            vatImplication: deductResult.vatImplication
          };
          result.confidence = 80;
          result.reasoning = 'Deductibility analysis based on codex rules';
          return result;
        }
      }

      // Keyword search in knowledge items
      const relevantItems = matchRelevantItems(question, knowledgeItems);
      if (relevantItems.length > 0) {
        result.method = 'knowledge_base';
        result.suggestion = {
          answer: relevantItems.map(item => ({
            title: item.title,
            content: item.content || item.contentText,
            citationId: item.citation_id || item.citationId,
            score: item.score
          }))
        };
        result.confidence = 65;
        result.reasoning = `Found ${relevantItems.length} relevant knowledge item(s)`;
        return result;
      }
    }

    // PRIORITY 3: Calculation fallback
    const calcResult = processCalculation(question);
    if (calcResult) {
      result.method = 'calculation';
      result.suggestion = calcResult;
      result.confidence = 100;
      result.reasoning = 'Local SA tax/VAT calculation';
      return result;
    }

    // PRIORITY 4: No answer available — guide the user
    result.method = 'no_answer';
    result.requiresUserInput = true;
    result.confidence = 0;
    result.reasoning = 'I don\'t have enough knowledge to answer this yet. You can teach me with: TEACH: TITLE: [title] DOMAIN: [domain] CONTENT: [your knowledge]';
    return result;
  }

  // ─── Teach Handling ────────────────────────────────────────────────────

  async handleTeachRequest(context) {
    const parsed = parseTeachMessage(context.question);

    if (!parsed.success) {
      return {
        method: 'teach_error',
        suggestion: null,
        confidence: 0,
        reasoning: parsed.error,
        requiresUserInput: true,
        alternatives: [],
        metadata: { intentType: 'TEACH' }
      };
    }

    // Store in knowledge base
    const item = await this.store.addKnowledgeItem({
      company_id: parsed.data.scopeType === 'CLIENT' ? this.companyId : null,
      title: parsed.data.title,
      domain: parsed.data.primaryDomain,
      layer: parsed.data.layer,
      content: parsed.data.contentText,
      content_type: 'text',
      tags: parsed.data.tags,
      language: parsed.data.language,
      status: 'APPROVED'
    });

    return {
      method: 'teach_stored',
      suggestion: {
        itemId: item.id,
        title: parsed.data.title,
        domain: parsed.data.primaryDomain,
        layer: parsed.data.layer
      },
      confidence: 100,
      reasoning: `Knowledge stored: "${parsed.data.title}" in ${parsed.data.primaryDomain} codex`,
      requiresUserInput: false,
      alternatives: [],
      metadata: { intentType: 'TEACH' }
    };
  }

  // ─── Private Codex Access ──────────────────────────────────────────────

  async checkPrivateCodex(contextHash) {
    const entry = await this.store.getCodexEntry(this.companyId, contextHash);
    if (!entry) return null;

    try {
      const decryptedData = SeanEncryption.decrypt(entry.encrypted_data, this.encryptionKey);

      // Update usage stats
      await this.store.updateCodexUsage(entry.id);

      return {
        suggestion: decryptedData.suggestion,
        confidence: entry.confidence,
        source: 'private_codex'
      };
    } catch (err) {
      console.error('SEAN: Failed to decrypt codex entry:', err.message);
      return null;
    }
  }

  // ─── Global Pattern Access ─────────────────────────────────────────────

  async checkGlobalPatterns(context) {
    const { merchant, amount } = context;
    if (!merchant) return null;

    const amountRange = !amount ? 'any' : amount < 50 ? '<R50' : amount < 500 ? 'R50-R500' : '>R500';

    const patterns = await this.store.getGlobalPatterns(merchant, amountRange);
    if (!patterns || patterns.length === 0) return null;

    const pattern = patterns[0]; // Best match
    const distribution = pattern.outcome_distribution || {};
    const topOutcome = Object.keys(distribution).reduce((a, b) =>
      distribution[a] > distribution[b] ? a : b, Object.keys(distribution)[0]
    );

    return {
      suggestion: { category: topOutcome, distribution },
      confidence: pattern.confidence_score,
      reasoning: pattern.reasoning || `Based on patterns from ${pattern.companies_contributed} companies`,
      distribution
    };
  }

  // ─── Learning ──────────────────────────────────────────────────────────

  /**
   * Learn from a user's decision.
   * Stores in private codex (encrypted) and optionally contributes to global patterns.
   */
  async learn(context, userDecision, wasCorrect = true) {
    const contextHash = SeanEncryption.hashContext(JSON.stringify(context));

    // 1. Store in private codex (encrypted)
    const codexEntry = {
      context,
      suggestion: userDecision,
      confidence: 100,
      learned_from: 'user',
      timestamp: new Date().toISOString()
    };

    const encrypted = SeanEncryption.encrypt(codexEntry, this.encryptionKey);

    const existing = await this.store.getCodexEntry(this.companyId, contextHash);

    if (existing) {
      await this.store.updateCodexEntry(existing.id, {
        encrypted_data: encrypted,
        success_count: existing.success_count + (wasCorrect ? 1 : 0),
        failure_count: existing.failure_count + (wasCorrect ? 0 : 1),
        confidence: Math.min(100, existing.confidence + (wasCorrect ? 5 : -10)),
        times_used: existing.times_used + 1,
        last_used: new Date().toISOString()
      });
    } else {
      await this.store.createCodexEntry({
        company_id: this.companyId,
        encrypted_data: encrypted,
        encryption_key_id: `key_${this.companyId}`,
        category: 'allocation',
        context_hash: contextHash,
        confidence: 100,
        times_used: 1,
        success_count: 1,
        failure_count: 0
      });
    }

    // 2. Store as allocation rule for keyword matching
    if (context.description || context.merchant) {
      const normalized = normalizeDescription(context.description || context.merchant || '');
      await this.store.upsertAllocationRule(this.companyId, normalized, userDecision);
    }

    // 3. Contribute to global patterns (anonymized)
    if (context.merchant && context.amount) {
      await this.contributeToGlobalPattern(context, userDecision);
    }

    // 4. Log the learning interaction
    await this.store.addLearningLog({
      company_id: this.companyId,
      interaction_type: 'allocation_learned',
      context_provided: JSON.stringify(context),
      sean_suggestion: null,
      user_action: typeof userDecision === 'string' ? userDecision : JSON.stringify(userDecision),
      was_correct: wasCorrect,
      stored_in_codex: true,
      contributed_to_global: !!context.merchant
    });

    return { success: true, message: 'SEAN learned from your decision' };
  }

  // ─── Global Pattern Contribution ───────────────────────────────────────

  async contributeToGlobalPattern(context, outcome) {
    const { merchant, amount } = context;
    if (!merchant) return;

    const amountRange = !amount ? 'any' : amount < 50 ? '<R50' : amount < 500 ? 'R50-R500' : '>R500';
    const patternKey = `${SeanEncryption.anonymizeDescription(merchant).replace(/\s+/g, '_')}_${amountRange}`;
    const outcomeKey = typeof outcome === 'string' ? outcome : outcome.category || 'unknown';

    await this.store.upsertGlobalPattern(patternKey, {
      pattern_type: 'merchant_allocation',
      amount_range: amountRange,
      merchant_pattern: SeanEncryption.anonymizeDescription(merchant),
      outcome: outcomeKey
    });
  }

  // ─── Domain Inference ──────────────────────────────────────────────────

  inferDomain(question) {
    const q = question.toLowerCase();
    if (q.includes('vat') || q.includes('btw') || q.includes('value added')) return 'VAT';
    if (q.includes('paye') || q.includes('salary') || q.includes('payroll') || q.includes('uif')) return 'PAYROLL';
    if (q.includes('company tax') || q.includes('corporate tax') || q.includes('itr14')) return 'COMPANY_TAX';
    if (q.includes('capital gain') || q.includes('cgt')) return 'CAPITAL_GAINS_TAX';
    if (q.includes('withholding') || q.includes('dividend tax')) return 'WITHHOLDING_TAX';
    if (q.includes('income tax') || q.includes('deductible') || q.includes('section 11')) return 'INCOME_TAX';
    return 'ACCOUNTING_GENERAL';
  }

  // ─── Stats ─────────────────────────────────────────────────────────────

  async getStats() {
    return this.store.getSeanStats(this.companyId);
  }
}

module.exports = SeanDecisionEngine;
