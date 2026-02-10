/**
 * ============================================================================
 * SEAN AI — Mock Data Store
 * ============================================================================
 * In-memory data store for SEAN when running in MOCK_MODE.
 * Provides the same interface as Supabase would, so the decision engine
 * is completely database-agnostic.
 *
 * Also used as the data access interface definition — any real store
 * must implement the same methods.
 * ============================================================================
 */

const crypto = require('crypto');

// ─── In-Memory Data ──────────────────────────────────────────────────────────

const seanData = {
  codexEntries: [],
  globalPatterns: [],
  learningLog: [],
  knowledgeItems: [],
  allocationRules: [],
  bankTransactions: [],
  importLogs: [],
  interCompanyInvoices: [],
  interCompanyRelationships: [],
  _nextId: 100
};

function nextId() {
  return seanData._nextId++;
}

// ─── Initialize Mock Data ────────────────────────────────────────────────────

function initSeanMockData() {
  // Global patterns (SA-specific, anonymized)
  seanData.globalPatterns = [
    {
      id: 1, pattern_type: 'merchant_allocation', pattern_key: 'engen_small',
      amount_range: '<R50', merchant_pattern: 'Engen|Shell|BP|Sasol',
      companies_contributed: 47, total_occurrences: 312,
      outcome_distribution: { snacks: 85, fuel: 2, airtime: 10, car_accessories: 3 },
      confidence_score: 88, reasoning: 'Small transactions at fuel stations are usually convenience store purchases',
      created_at: '2024-06-01T00:00:00Z', last_updated: '2025-01-15T00:00:00Z'
    },
    {
      id: 2, pattern_type: 'merchant_allocation', pattern_key: 'engen_large',
      amount_range: '>R500', merchant_pattern: 'Engen|Shell|BP|Sasol',
      companies_contributed: 52, total_occurrences: 890,
      outcome_distribution: { fuel: 95, car_wash: 3, shop: 2 },
      confidence_score: 96, reasoning: 'Large transactions at fuel stations are usually fuel fills',
      created_at: '2024-06-01T00:00:00Z', last_updated: '2025-02-01T00:00:00Z'
    },
    {
      id: 3, pattern_type: 'merchant_allocation', pattern_key: 'woolworths_small',
      amount_range: '<R100', merchant_pattern: 'Woolworths',
      companies_contributed: 38, total_occurrences: 210,
      outcome_distribution: { groceries: 40, clothing: 50, homeware: 10 },
      confidence_score: 75, reasoning: 'Small Woolworths purchases could be various categories',
      created_at: '2024-06-01T00:00:00Z', last_updated: '2025-01-20T00:00:00Z'
    },
    {
      id: 4, pattern_type: 'merchant_allocation', pattern_key: 'woolworths_large',
      amount_range: '>R500', merchant_pattern: 'Woolworths',
      companies_contributed: 41, total_occurrences: 450,
      outcome_distribution: { groceries: 90, clothing: 8, homeware: 2 },
      confidence_score: 92, reasoning: 'Large Woolworths purchases are usually groceries',
      created_at: '2024-06-01T00:00:00Z', last_updated: '2025-01-25T00:00:00Z'
    },
    {
      id: 5, pattern_type: 'merchant_allocation', pattern_key: 'uber_eats',
      amount_range: 'any', merchant_pattern: 'Uber Eats|Mr D Food',
      companies_contributed: 55, total_occurrences: 780,
      outcome_distribution: { meals_entertainment: 85, client_entertainment: 10, employee_benefits: 5 },
      confidence_score: 90, reasoning: 'Food delivery is typically meals',
      created_at: '2024-06-01T00:00:00Z', last_updated: '2025-02-05T00:00:00Z'
    },
    {
      id: 6, pattern_type: 'merchant_allocation', pattern_key: 'checkers_shoprite',
      amount_range: 'any', merchant_pattern: 'Checkers|Shoprite',
      companies_contributed: 60, total_occurrences: 1200,
      outcome_distribution: { groceries: 92, other: 8 },
      confidence_score: 94, reasoning: 'Checkers/Shoprite are predominantly grocery stores',
      created_at: '2024-06-01T00:00:00Z', last_updated: '2025-02-08T00:00:00Z'
    },
    {
      id: 7, pattern_type: 'merchant_allocation', pattern_key: 'telkom_vodacom',
      amount_range: 'any', merchant_pattern: 'Telkom|Vodacom|MTN|Cell C',
      companies_contributed: 58, total_occurrences: 950,
      outcome_distribution: { telephone: 95, other: 5 },
      confidence_score: 96, reasoning: 'Telecom providers are communication expenses',
      created_at: '2024-06-01T00:00:00Z', last_updated: '2025-02-07T00:00:00Z'
    },
    {
      id: 8, pattern_type: 'merchant_allocation', pattern_key: 'fnb_fees',
      amount_range: '<R200', merchant_pattern: 'FNB|ABSA|Nedbank|StandardBank|Capitec',
      companies_contributed: 62, total_occurrences: 2800,
      outcome_distribution: { bank_charges: 95, other: 5 },
      confidence_score: 97, reasoning: 'Small bank debits are typically service fees',
      created_at: '2024-06-01T00:00:00Z', last_updated: '2025-02-09T00:00:00Z'
    },
    {
      id: 9, pattern_type: 'payroll_rule', pattern_key: 'sunday_overtime',
      amount_range: 'any', merchant_pattern: 'overtime_sunday',
      companies_contributed: 30, total_occurrences: 180,
      outcome_distribution: { rate: 200, taxable: true, include_uif: true },
      confidence_score: 95, reasoning: 'Sunday work at double time in SA',
      created_at: '2024-06-01T00:00:00Z', last_updated: '2025-01-30T00:00:00Z'
    }
  ];

  // Knowledge items (SA tax knowledge base)
  seanData.knowledgeItems = [
    {
      id: 1, title: 'Section 11(a) — General Deductions',
      domain: 'INCOME_TAX', layer: 'LEGAL', company_id: null,
      content: JSON.stringify({
        codex_pack: 'SA Income Tax Act',
        jurisdiction: 'South Africa',
        authority: 'SARS / Income Tax Act 58 of 1962',
        rules: [
          {
            section: 'Section 11(a)',
            type: 'General Deduction',
            law_says: 'Expenditure and losses actually incurred in the production of income, provided such expenditure is not of a capital nature.',
            interpretation: 'To be deductible: (1) must be actually incurred (not just accrued), (2) must be in production of income, (3) must not be capital in nature, (4) must be related to the trade.',
            application_logic: 'If expense is operational and directly related to producing income, it is deductible under s11(a). Capital expenses (assets, improvements, long-term) are NOT deductible here but may qualify for capital allowances.'
          },
          {
            section: 'Section 23(g)',
            type: 'Prohibited Deduction',
            law_says: 'No deduction shall be made in respect of any moneys claimed as a deduction from income to the extent to which such moneys were not laid out or expended for the purposes of trade.',
            interpretation: 'Private/personal expenses are NOT deductible. Mixed-use expenses must be apportioned.',
            application_logic: 'If expense has a personal element, only the business portion is deductible. If primarily personal, not deductible at all.'
          }
        ]
      }),
      content_type: 'tax_rule', tags: ['deduction', 'section 11', 'general'],
      citation_id: 'KB:LEGAL:section_11a_general_deductions:v1',
      status: 'APPROVED', version: 1, language: 'EN',
      created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 2, title: 'VAT Input/Output Cross-Reference',
      domain: 'VAT', layer: 'LEGAL', company_id: null,
      content: JSON.stringify({
        vat_cross_reference: {
          principle: 'VAT input claims require valid tax invoices and business purpose',
          rules: [
            {
              scenario: 'Entertainment expenses',
              vat_act: 'Section 17(2)(a) — VAT input on entertainment is denied unless provided to employees or at events',
              income_tax_interaction: 'Entertainment may be deductible under s11(a) for income tax even if VAT input is denied',
              sean_instruction: 'Deny VAT input claim on entertainment. Flag for potential s11(a) income tax deduction.'
            },
            {
              scenario: 'Motor vehicles — mixed use',
              vat_act: 'Section 17(1) — Input VAT must be apportioned for mixed business/private use',
              income_tax_interaction: 'Motor expenses must also be apportioned for income tax purposes per travel logbook',
              sean_instruction: 'Request business use percentage. Apply apportionment to both VAT and income tax.'
            },
            {
              scenario: 'Zero-rated supplies (exports)',
              vat_act: 'Section 11(1)(a) — Zero rate applies to exports of goods',
              income_tax_interaction: 'Export income is still taxable for income tax purposes',
              sean_instruction: 'Apply 0% VAT on qualifying exports. Income remains taxable.'
            }
          ]
        }
      }),
      content_type: 'vat_cross_reference', tags: ['vat', 'input', 'output', 'cross-reference'],
      citation_id: 'KB:LEGAL:vat_input_output_cross_ref:v1',
      status: 'APPROVED', version: 1, language: 'EN',
      created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 3, title: 'Allocation Decision Engine — Expense Classification',
      domain: 'ACCOUNTING_GENERAL', layer: 'FIRM', company_id: null,
      content: JSON.stringify({
        role: 'SEAN Expense Allocation Decision Engine',
        mandatory_decision_order: [
          { step: 1, action: 'Identify Merchant', details: 'Extract merchant name from bank transaction description' },
          { step: 2, action: 'Check Amount Range', details: 'Classify as small (<R50), medium (R50-R500), or large (>R500)' },
          { step: 3, action: 'Apply Learned Rules', details: 'Check company-specific and global allocation rules' },
          { step: 4, action: 'Keyword Match', details: 'Match against 40+ SA accounting categories with 500+ keywords' },
          { step: 5, action: 'Check VAT Implications', details: 'Determine if VAT input can be claimed on this expense' },
          { step: 6, action: 'Confirm or Ask', details: 'If confidence > 80% auto-allocate, otherwise ask user' }
        ],
        output_requirements: [
          'Category code and label',
          'Confidence score (0-100)',
          'Reasoning for allocation',
          'VAT input eligibility',
          'Alternative suggestions if low confidence'
        ],
        forbidden_behaviour: [
          'Never allocate without checking VAT status',
          'Never auto-allocate DRAWINGS without user confirmation',
          'Never mix business and private expenses without flagging',
          'Never reveal other companies\' allocation patterns'
        ]
      }),
      content_type: 'decision_engine', tags: ['allocation', 'expense', 'decision'],
      citation_id: 'KB:FIRM:allocation_decision_engine:v1',
      status: 'APPROVED', version: 1, language: 'EN',
      created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 4, title: 'SA Tax Thresholds 2024/2025 Lookup Table',
      domain: 'INCOME_TAX', layer: 'LEGAL', company_id: null,
      content: JSON.stringify({
        lookup_table: {
          name: 'SA Tax Thresholds 2024/2025',
          description: 'Tax thresholds, rebates, and medical credits for 2024/2025 tax year',
          entries: [
            { key: 'Tax Threshold (under 65)', value: 'R95,750', notes: 'No tax payable below this amount' },
            { key: 'Tax Threshold (65-74)', value: 'R148,217', notes: 'Including secondary rebate' },
            { key: 'Tax Threshold (75+)', value: 'R165,689', notes: 'Including tertiary rebate' },
            { key: 'Primary Rebate', value: 'R17,235', notes: 'All taxpayers' },
            { key: 'Secondary Rebate', value: 'R9,444', notes: '65 years and older' },
            { key: 'Tertiary Rebate', value: 'R3,145', notes: '75 years and older' },
            { key: 'Medical Credit (main member)', value: 'R364/month', notes: 'Per month' },
            { key: 'Medical Credit (first dependant)', value: 'R364/month', notes: 'Per month' },
            { key: 'Medical Credit (additional)', value: 'R246/month', notes: 'Per additional dependant per month' },
            { key: 'UIF Ceiling', value: 'R17,712/month', notes: 'Employee contribution capped' },
            { key: 'UIF Rate', value: '1%', notes: 'Employee + 1% employer' },
            { key: 'SDL Rate', value: '1%', notes: 'Skills Development Levy on payroll' },
            { key: 'VAT Rate', value: '15%', notes: 'Standard rate' }
          ]
        }
      }),
      content_type: 'lookup_table', tags: ['tax', 'thresholds', 'rebates', '2024', '2025'],
      citation_id: 'KB:LEGAL:sa_tax_thresholds_2024_2025:v1',
      status: 'APPROVED', version: 1, language: 'EN',
      created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 5, title: 'Home Office Deduction Rules',
      domain: 'INCOME_TAX', layer: 'LEGAL', company_id: null,
      content: JSON.stringify({
        codex_pack: 'SA Income Tax Act — Home Office',
        jurisdiction: 'South Africa',
        authority: 'SARS / Income Tax Act Section 11(e)',
        rules: [
          {
            section: 'Section 11(d)',
            type: 'Home Office Deduction',
            law_says: 'A deduction for expenses related to a home office is only allowed if the office is regularly and exclusively used for trade purposes, and the taxpayer derives more than 50% of income from that office.',
            interpretation: 'The home office must be a specific room (not a corner of a bedroom). It must be used exclusively for work. Salaried employees with an office provided by their employer generally do not qualify.',
            application_logic: 'If employee has an office at employer premises → NOT deductible. If self-employed or commission earner with dedicated room at home → deductible proportionally (area of office / total home area). Expenses that can be claimed: rent proportion, electricity, rates, cleaning (of office area only).'
          }
        ]
      }),
      content_type: 'tax_rule', tags: ['home office', 'deduction', 'section 11'],
      citation_id: 'KB:LEGAL:home_office_deduction:v1',
      status: 'APPROVED', version: 1, language: 'EN',
      created_at: '2024-02-01T00:00:00Z', updated_at: '2024-02-01T00:00:00Z'
    }
  ];

  // Sample allocation rules (learned by companies)
  seanData.allocationRules = [
    {
      id: 1, company_id: 1, is_global: false,
      normalized_pattern: 'telkom fibre monthly',
      category: 'TELEPHONE', confidence: 0.95, learned_from_count: 8,
      last_matched: '2025-02-01T00:00:00Z'
    },
    {
      id: 2, company_id: 1, is_global: false,
      normalized_pattern: 'eskom prepaid electricity',
      category: 'ELECTRICITY', confidence: 0.98, learned_from_count: 12,
      last_matched: '2025-02-05T00:00:00Z'
    },
    {
      id: 3, company_id: null, is_global: true,
      normalized_pattern: 'fnb service fee',
      category: 'BANK_CHARGES', confidence: 0.99, learned_from_count: 150,
      last_matched: '2025-02-09T00:00:00Z'
    },
    {
      id: 4, company_id: null, is_global: true,
      normalized_pattern: 'sars efiling vat',
      category: 'VAT_PAYMENT', confidence: 0.97, learned_from_count: 85,
      last_matched: '2025-01-31T00:00:00Z'
    },
    {
      id: 5, company_id: 1, is_global: false,
      normalized_pattern: 'builders warehouse materials',
      category: 'REPAIRS', confidence: 0.85, learned_from_count: 3,
      last_matched: '2025-01-20T00:00:00Z'
    }
  ];

  // Sample bank transactions
  seanData.bankTransactions = [
    {
      id: 1, company_id: 1, date: '2025-02-01',
      description: 'FNB SERVICE FEE FEB', amount: -69.00, type: 'debit',
      merchant: 'FNB', suggested_category: 'BANK_CHARGES', confirmed_category: 'BANK_CHARGES',
      confidence: 0.99, match_type: 'exact', allocated_by: 'sean',
      created_at: '2025-02-01T00:00:00Z'
    },
    {
      id: 2, company_id: 1, date: '2025-02-03',
      description: 'ENGEN SANDTON FUEL', amount: -850.00, type: 'debit',
      merchant: 'Engen Sandton', suggested_category: 'FUEL', confirmed_category: 'FUEL',
      confidence: 0.96, match_type: 'global_pattern', allocated_by: 'sean',
      created_at: '2025-02-03T00:00:00Z'
    },
    {
      id: 3, company_id: 1, date: '2025-02-04',
      description: 'WOOLWORTHS SANDTON CITY', amount: -345.50, type: 'debit',
      merchant: 'Woolworths Sandton City', suggested_category: 'GROCERIES', confirmed_category: null,
      confidence: 0.75, match_type: 'global_pattern', allocated_by: null,
      created_at: '2025-02-04T00:00:00Z'
    },
    {
      id: 4, company_id: 1, date: '2025-02-05',
      description: 'TELKOM FIBRE MONTHLY', amount: -999.00, type: 'debit',
      merchant: 'Telkom', suggested_category: 'TELEPHONE', confirmed_category: 'TELEPHONE',
      confidence: 0.95, match_type: 'exact', allocated_by: 'sean',
      created_at: '2025-02-05T00:00:00Z'
    },
    {
      id: 5, company_id: 1, date: '2025-02-06',
      description: 'CLIENT PAYMENT - SMITH & CO', amount: 15000.00, type: 'credit',
      merchant: null, suggested_category: 'REVENUE', confirmed_category: 'REVENUE',
      confidence: 0.85, match_type: 'keyword', allocated_by: 'sean',
      created_at: '2025-02-06T00:00:00Z'
    },
    {
      id: 6, company_id: 1, date: '2025-02-07',
      description: 'UBER EATS ORDER 84920', amount: -189.00, type: 'debit',
      merchant: 'Uber Eats', suggested_category: 'ENTERTAINMENT', confirmed_category: null,
      confidence: 0.90, match_type: 'global_pattern', allocated_by: null,
      created_at: '2025-02-07T00:00:00Z'
    },
    {
      id: 7, company_id: 1, date: '2025-02-08',
      description: 'DISCOVERY HEALTH PREMIUM', amount: -4500.00, type: 'debit',
      merchant: 'Discovery', suggested_category: 'MEDICAL', confirmed_category: 'MEDICAL',
      confidence: 0.92, match_type: 'keyword', allocated_by: 'user',
      created_at: '2025-02-08T00:00:00Z'
    },
    {
      id: 8, company_id: 1, date: '2025-02-09',
      description: 'UNKNOWN CC PURCHASE REF99182', amount: -267.00, type: 'debit',
      merchant: null, suggested_category: null, confirmed_category: null,
      confidence: 0, match_type: 'none', allocated_by: null,
      created_at: '2025-02-09T00:00:00Z'
    }
  ];

  console.log('  🧠 SEAN mock data loaded:');
  console.log(`     Global Patterns: ${seanData.globalPatterns.length}`);
  console.log(`     Knowledge Items: ${seanData.knowledgeItems.length}`);
  console.log(`     Allocation Rules: ${seanData.allocationRules.length}`);
  console.log(`     Bank Transactions: ${seanData.bankTransactions.length}`);
}

// ─── Mock Data Store Interface ───────────────────────────────────────────────
// Every method here must be matched by a real Supabase store for production.

const mockSeanStore = {

  // ── Codex (encrypted private entries) ──

  getCodexEntry(companyId, contextHash) {
    return seanData.codexEntries.find(
      e => e.company_id === companyId && e.context_hash === contextHash
    ) || null;
  },

  updateCodexUsage(entryId) {
    const entry = seanData.codexEntries.find(e => e.id === entryId);
    if (entry) {
      entry.times_used = (entry.times_used || 0) + 1;
      entry.last_used = new Date().toISOString();
    }
  },

  updateCodexEntry(entryId, updates) {
    const entry = seanData.codexEntries.find(e => e.id === entryId);
    if (entry) {
      Object.assign(entry, updates);
    }
  },

  createCodexEntry(data) {
    const entry = { id: nextId(), ...data, created_at: new Date().toISOString() };
    seanData.codexEntries.push(entry);
    return entry;
  },

  getCodexStats(companyId) {
    const entries = seanData.codexEntries.filter(e => e.company_id === companyId);
    return {
      totalEntries: entries.length,
      totalUsages: entries.reduce((sum, e) => sum + (e.times_used || 0), 0),
      avgConfidence: entries.length > 0
        ? Math.round(entries.reduce((sum, e) => sum + (e.confidence || 0), 0) / entries.length)
        : 0
    };
  },

  // ── Global Patterns ──

  getGlobalPatterns(merchant, amountRange) {
    const merchantLower = (merchant || '').toLowerCase();
    return seanData.globalPatterns
      .filter(p => {
        const patterns = (p.merchant_pattern || '').split('|').map(s => s.toLowerCase().trim());
        const merchantMatch = patterns.some(pat => merchantLower.includes(pat) || pat.includes(merchantLower));
        const rangeMatch = p.amount_range === 'any' || p.amount_range === amountRange;
        return merchantMatch && rangeMatch;
      })
      .sort((a, b) => b.confidence_score - a.confidence_score);
  },

  upsertGlobalPattern(patternKey, data) {
    const existing = seanData.globalPatterns.find(p => p.pattern_key === patternKey);
    if (existing) {
      const dist = existing.outcome_distribution || {};
      dist[data.outcome] = (dist[data.outcome] || 0) + 1;
      // Normalize to percentages
      const total = Object.values(dist).reduce((a, b) => a + b, 0);
      for (const key in dist) {
        dist[key] = Math.round((dist[key] / total) * 100);
      }
      existing.outcome_distribution = dist;
      existing.total_occurrences = (existing.total_occurrences || 0) + 1;
      existing.last_updated = new Date().toISOString();
    } else {
      seanData.globalPatterns.push({
        id: nextId(),
        pattern_type: data.pattern_type,
        pattern_key: patternKey,
        amount_range: data.amount_range,
        merchant_pattern: data.merchant_pattern,
        companies_contributed: 1,
        total_occurrences: 1,
        outcome_distribution: { [data.outcome]: 100 },
        confidence_score: 50,
        reasoning: 'Pattern learned from user allocations',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      });
    }
  },

  // ── Knowledge Items ──

  getKnowledgeItems(companyId) {
    return seanData.knowledgeItems.filter(
      item => item.status === 'APPROVED' && (item.company_id === null || item.company_id === companyId)
    );
  },

  addKnowledgeItem(data) {
    const item = {
      id: nextId(),
      ...data,
      citation_id: data.citation_id || `KB:${data.layer}:${Date.now()}:v1`,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    seanData.knowledgeItems.push(item);
    return item;
  },

  searchKnowledgeItems(query, domain) {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    return seanData.knowledgeItems
      .filter(item => {
        if (item.status !== 'APPROVED') return false;
        if (domain && item.domain !== domain && item.domain !== 'OTHER') return false;
        const text = `${item.title} ${typeof item.content === 'string' ? item.content : JSON.stringify(item.content)}`.toLowerCase();
        return keywords.some(kw => text.includes(kw));
      })
      .sort((a, b) => {
        const textA = `${a.title} ${typeof a.content === 'string' ? a.content : ''}`.toLowerCase();
        const textB = `${b.title} ${typeof b.content === 'string' ? b.content : ''}`.toLowerCase();
        const scoreA = keywords.filter(kw => textA.includes(kw)).length;
        const scoreB = keywords.filter(kw => textB.includes(kw)).length;
        return scoreB - scoreA;
      });
  },

  // ── Allocation Rules ──

  getAllocationRules(companyId) {
    return seanData.allocationRules.filter(
      r => r.is_global || r.company_id === companyId
    );
  },

  upsertAllocationRule(companyId, normalizedPattern, category) {
    const existing = seanData.allocationRules.find(
      r => r.company_id === companyId && r.normalized_pattern === normalizedPattern
    );
    if (existing) {
      existing.category = typeof category === 'string' ? category : category.category || category;
      existing.learned_from_count = (existing.learned_from_count || 0) + 1;
      existing.confidence = Math.min(0.99, (existing.confidence || 0.8) + 0.02);
      existing.last_matched = new Date().toISOString();
    } else {
      seanData.allocationRules.push({
        id: nextId(),
        company_id: companyId,
        is_global: false,
        normalized_pattern: normalizedPattern,
        category: typeof category === 'string' ? category : category.category || category,
        confidence: 0.80,
        learned_from_count: 1,
        last_matched: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
    }
  },

  // ── Bank Transactions ──

  getBankTransactions(companyId, filters = {}) {
    let txns = seanData.bankTransactions.filter(t => t.company_id === companyId);
    if (filters.unallocated) {
      txns = txns.filter(t => !t.confirmed_category);
    }
    if (filters.category) {
      txns = txns.filter(t => t.confirmed_category === filters.category);
    }
    return txns.sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  addBankTransaction(data) {
    const txn = { id: nextId(), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    seanData.bankTransactions.push(txn);
    return txn;
  },

  updateBankTransaction(id, companyId, updates) {
    const txn = seanData.bankTransactions.find(t => t.id === id && t.company_id === companyId);
    if (txn) {
      Object.assign(txn, updates, { updated_at: new Date().toISOString() });
    }
    return txn;
  },

  // ── Learning Log ──

  addLearningLog(data) {
    const log = { id: nextId(), ...data, created_at: new Date().toISOString() };
    seanData.learningLog.push(log);
    return log;
  },

  getLearningLog(companyId, limit = 50) {
    return seanData.learningLog
      .filter(l => l.company_id === companyId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  },

  // ── Stats ──

  getSeanStats(companyId) {
    const codexEntries = seanData.codexEntries.filter(e => e.company_id === companyId);
    const rules = seanData.allocationRules.filter(r => r.company_id === companyId && !r.is_global);
    const txns = seanData.bankTransactions.filter(t => t.company_id === companyId);
    const logs = seanData.learningLog.filter(l => l.company_id === companyId);

    const allocated = txns.filter(t => t.confirmed_category);
    const autoAllocated = txns.filter(t => t.allocated_by === 'sean');
    const unallocated = txns.filter(t => !t.confirmed_category);

    return {
      codex: {
        totalEntries: codexEntries.length,
        totalUsages: codexEntries.reduce((s, e) => s + (e.times_used || 0), 0),
        avgConfidence: codexEntries.length > 0
          ? Math.round(codexEntries.reduce((s, e) => s + (e.confidence || 0), 0) / codexEntries.length)
          : 0
      },
      rules: {
        companyRules: rules.length,
        globalRules: seanData.allocationRules.filter(r => r.is_global).length
      },
      transactions: {
        total: txns.length,
        allocated: allocated.length,
        autoAllocated: autoAllocated.length,
        unallocated: unallocated.length,
        allocationRate: txns.length > 0 ? Math.round((allocated.length / txns.length) * 100) : 0
      },
      knowledgeBase: {
        totalItems: seanData.knowledgeItems.filter(i => i.company_id === null || i.company_id === companyId).length,
        globalItems: seanData.knowledgeItems.filter(i => i.company_id === null).length,
        companyItems: seanData.knowledgeItems.filter(i => i.company_id === companyId).length
      },
      globalPatterns: seanData.globalPatterns.length,
      learningEvents: logs.length,
      imports: {
        total: seanData.importLogs.filter(l => l.company_id === companyId).length,
        completed: seanData.importLogs.filter(l => l.company_id === companyId && l.status === 'completed').length
      }
    };
  },

  // ── Import Logs ──

  addImportLog(data) {
    const log = { id: nextId(), ...data, created_at: new Date().toISOString() };
    seanData.importLogs.push(log);
    return log;
  },

  getImportLogs(companyId) {
    return seanData.importLogs
      .filter(l => l.company_id === companyId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getImportLog(companyId, importId) {
    return seanData.importLogs.find(
      l => l.company_id === companyId && l.import_id === importId
    ) || null;
  },

  // ── Inter-Company Invoices ──

  addInterCompanyInvoice(data) {
    const inv = { id: nextId(), ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    seanData.interCompanyInvoices.push(inv);
    return inv;
  },

  getInterCompanyInvoices(companyId, direction = 'all') {
    return seanData.interCompanyInvoices.filter(inv => {
      if (direction === 'sent') return inv.sender_company_id === companyId;
      if (direction === 'received') return inv.receiver_company_id === companyId;
      return inv.sender_company_id === companyId || inv.receiver_company_id === companyId;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getInterCompanyInvoice(invoiceId) {
    return seanData.interCompanyInvoices.find(inv => inv.id === invoiceId) || null;
  },

  updateInterCompanyInvoice(invoiceId, updates) {
    const inv = seanData.interCompanyInvoices.find(inv => inv.id === invoiceId);
    if (inv) {
      Object.assign(inv, updates, { updated_at: new Date().toISOString() });
    }
    return inv;
  },

  // ── Inter-Company Relationships ──

  addRelationship(data) {
    const rel = { id: nextId(), ...data, status: 'active', created_at: new Date().toISOString() };
    seanData.interCompanyRelationships.push(rel);
    return rel;
  },

  getRelationships(companyId) {
    return seanData.interCompanyRelationships.filter(
      r => (r.company_a_id === companyId || r.company_b_id === companyId) && r.status === 'active'
    );
  },

  findRelationship(companyAId, companyBId) {
    return seanData.interCompanyRelationships.find(
      r => (r.company_a_id === companyAId && r.company_b_id === companyBId) ||
           (r.company_a_id === companyBId && r.company_b_id === companyAId)
    ) || null;
  }
};

module.exports = {
  seanData,
  initSeanMockData,
  mockSeanStore
};
