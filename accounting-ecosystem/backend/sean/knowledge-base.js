/**
 * ============================================================================
 * SEAN AI — Knowledge Base (Codex) Engine
 * ============================================================================
 * Ported from sean-webapp/lib/codex-engine.ts + lib/kb.ts
 * 100% LOCAL — Zero external API calls.
 *
 * Parses structured knowledge items (tax rules, VAT cross-references,
 * decision engines, lookup tables) and applies them to questions/transactions.
 *
 * Valid domains: VAT, INCOME_TAX, COMPANY_TAX, PAYROLL, CAPITAL_GAINS_TAX,
 *               WITHHOLDING_TAX, ACCOUNTING_GENERAL, OTHER
 * ============================================================================
 */

const VALID_DOMAINS = [
  'VAT', 'INCOME_TAX', 'COMPANY_TAX', 'PAYROLL', 'CAPITAL_GAINS_TAX',
  'WITHHOLDING_TAX', 'ACCOUNTING_GENERAL', 'OTHER'
];

// ─── Parse Codex Item ────────────────────────────────────────────────────────

/**
 * Parse a knowledge item's content and determine its structured type.
 * Returns null if content is not valid JSON.
 */
function parseCodexItem(item) {
  try {
    const content = JSON.parse(item.content || item.contentText || '{}');
    let type = 'general';

    if (content.codex_pack && content.rules && Array.isArray(content.rules)) {
      type = 'tax_rule';
    } else if (content.vat_cross_reference && content.vat_cross_reference.rules) {
      type = 'vat_cross_reference';
    } else if (content.mandatory_decision_order && content.output_requirements) {
      type = 'decision_engine';
    } else if (content.lookup_table && content.lookup_table.entries) {
      type = 'lookup_table';
    }

    return {
      id: item.id,
      citationId: item.citation_id || item.citationId || '',
      title: item.title,
      type,
      content,
      domain: item.domain || item.primaryDomain || 'OTHER',
      layer: item.layer || 'LEGAL'
    };
  } catch {
    return null; // Not JSON — plain text
  }
}

// ─── Keyword Matching ────────────────────────────────────────────────────────

/**
 * Match knowledge items by keyword relevance.
 * Used for searching codex without embeddings (Phase 0).
 */
function matchRelevantItems(question, items) {
  const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  return items
    .map(item => {
      let score = 0;
      const content = (item.content || item.contentText || '').toLowerCase();
      const title = (item.title || '').toLowerCase();

      keywords.forEach(keyword => {
        if (title.includes(keyword)) score += 10;
        if (content.includes(keyword)) score += 1;
      });

      return { ...item, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// ─── Tax Rule Matching ───────────────────────────────────────────────────────

/**
 * Find applicable tax rules from parsed codex items.
 */
function findApplicableTaxRules(question, codexItems) {
  const matches = [];
  const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  for (const item of codexItems) {
    const parsed = parseCodexItem(item);
    if (!parsed || parsed.type !== 'tax_rule') continue;

    const taxCodex = parsed.content;
    for (const rule of (taxCodex.rules || [])) {
      const ruleText = `${rule.section || ''} ${rule.type || ''} ${rule.law_says || ''} ${rule.interpretation || ''} ${rule.application_logic || ''}`.toLowerCase();
      const matchCount = keywords.filter(k => ruleText.includes(k)).length;
      const score = keywords.length > 0 ? matchCount / keywords.length : 0;

      if (score >= 0.3) {
        matches.push({
          rule,
          codexPack: taxCodex.codex_pack,
          jurisdiction: taxCodex.jurisdiction,
          authority: taxCodex.authority,
          citationId: parsed.citationId,
          matchScore: score
        });
      }
    }
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
}

/**
 * Format tax rules into readable context.
 */
function formatTaxRulesContext(matches) {
  if (matches.length === 0) return '';

  let context = '📜 **Applicable Tax Rules:**\n\n';
  for (const match of matches) {
    context += `**${match.codexPack} - ${match.rule.section}** (${match.rule.type})\n`;
    context += `*Authority: ${match.authority}, ${match.jurisdiction}*\n\n`;
    context += `**The Law Says:** ${match.rule.law_says}\n\n`;
    context += `**Interpretation:** ${match.rule.interpretation}\n\n`;
    context += `**Application:** ${match.rule.application_logic}\n\n`;
    context += `📚 *[${match.citationId}]*\n\n---\n\n`;
  }
  return context;
}

// ─── VAT Cross-Reference Matching ────────────────────────────────────────────

function findApplicableVATRules(question, codexItems) {
  const matches = [];
  const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  for (const item of codexItems) {
    const parsed = parseCodexItem(item);
    if (!parsed || parsed.type !== 'vat_cross_reference') continue;

    const vatCodex = parsed.content.vat_cross_reference;
    for (const rule of (vatCodex.rules || [])) {
      const ruleText = `${rule.scenario || ''} ${rule.vat_act || ''} ${rule.income_tax_interaction || ''} ${rule.sean_instruction || ''}`.toLowerCase();
      const matchCount = keywords.filter(k => ruleText.includes(k)).length;
      const score = keywords.length > 0 ? matchCount / keywords.length : 0;

      if (score >= 0.3) {
        matches.push({
          rule,
          principle: vatCodex.principle,
          citationId: parsed.citationId,
          matchScore: score
        });
      }
    }
  }

  return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
}

function formatVATRulesContext(matches) {
  if (matches.length === 0) return '';

  let context = '📊 **VAT Cross-Reference:**\n\n';
  for (const match of matches) {
    context += `**Scenario:** ${match.rule.scenario}\n`;
    context += `**VAT Act:** ${match.rule.vat_act}\n`;
    context += `**Income Tax Interaction:** ${match.rule.income_tax_interaction}\n`;
    context += `**Sean\'s Instruction:** ${match.rule.sean_instruction}\n\n`;
    context += `📚 *[${match.citationId}]*\n\n---\n\n`;
  }
  return context;
}

// ─── Decision Engine Matching ────────────────────────────────────────────────

function findApplicableDecisionEngines(question, codexItems) {
  const engines = [];
  const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  for (const item of codexItems) {
    const parsed = parseCodexItem(item);
    if (!parsed || parsed.type !== 'decision_engine') continue;

    const engine = parsed.content;
    const engineText = `${engine.role || ''} ${(engine.mandatory_decision_order || []).map(s => s.action).join(' ')}`.toLowerCase();
    const matchCount = keywords.filter(k => engineText.includes(k)).length;
    const score = keywords.length > 0 ? matchCount / keywords.length : 0;

    if (score >= 0.2) {
      engines.push({
        engine,
        citationId: parsed.citationId,
        title: parsed.title,
        matchScore: score
      });
    }
  }

  return engines.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
}

function formatDecisionEngineContext(matches) {
  if (matches.length === 0) return '';

  let context = '🎯 **Decision Framework:**\n\n';
  for (const match of matches) {
    context += `**${match.engine.role}**\n\n`;
    context += '**Mandatory Steps:**\n';
    for (const step of (match.engine.mandatory_decision_order || [])) {
      context += `${step.step}. **${step.action}**: ${step.details}\n`;
    }
    context += '\n**Output Requirements:**\n';
    for (const req of (match.engine.output_requirements || [])) {
      context += `- ${req}\n`;
    }
    if ((match.engine.forbidden_behaviour || []).length > 0) {
      context += '\n**Forbidden:**\n';
      for (const fb of match.engine.forbidden_behaviour) {
        context += `- ❌ ${fb}\n`;
      }
    }
    context += `\n📚 *[${match.citationId}]*\n\n---\n\n`;
  }
  return context;
}

// ─── Lookup Tables ───────────────────────────────────────────────────────────

function searchLookupTables(searchKey, codexItems) {
  const matches = [];
  const normalizedKey = searchKey.toLowerCase();

  for (const item of codexItems) {
    const parsed = parseCodexItem(item);
    if (!parsed || parsed.type !== 'lookup_table') continue;

    const lookup = parsed.content.lookup_table;
    for (const entry of (lookup.entries || [])) {
      if (entry.key.toLowerCase().includes(normalizedKey) ||
          entry.value.toLowerCase().includes(normalizedKey)) {
        matches.push({
          key: entry.key,
          value: entry.value,
          notes: entry.notes,
          tableName: lookup.name,
          citationId: parsed.citationId
        });
      }
    }
  }

  return matches;
}

// ─── Deductibility Checker ───────────────────────────────────────────────────

/**
 * Check if an expense is deductible based on codex rules.
 * Returns null if no relevant rules found.
 */
function checkDeductibility(expenseType, expenseDescription, codexItems) {
  const taxRules = findApplicableTaxRules(
    `${expenseType} ${expenseDescription} deductible expense section 11`,
    codexItems.filter(i => {
      const d = (i.domain || i.primaryDomain || '').toUpperCase();
      return d === 'INCOME_TAX' || d === 'OTHER';
    })
  );

  const vatRules = findApplicableVATRules(
    `${expenseType} input tax claim`,
    codexItems.filter(i => {
      const d = (i.domain || i.primaryDomain || '').toUpperCase();
      return d === 'VAT' || d === 'OTHER';
    })
  );

  if (taxRules.length === 0) return null;

  const topRule = taxRules[0];
  const applicationLogic = (topRule.rule.application_logic || '').toLowerCase();

  let isDeductible = true;
  let percentage = 100;
  const conditions = [];
  const citations = [topRule.citationId];

  if (applicationLogic.includes('not deductible') || applicationLogic.includes('prohibited')) {
    isDeductible = false;
    percentage = 0;
  } else if (applicationLogic.includes('limited') || applicationLogic.includes('partial')) {
    const percentMatch = applicationLogic.match(/(\d+)%/);
    percentage = percentMatch ? parseInt(percentMatch[1]) : 50;
  }

  if (applicationLogic.includes('if ') || applicationLogic.includes('provided ')) {
    conditions.push(topRule.rule.interpretation);
  }

  let vatImplication = null;
  if (vatRules.length > 0) {
    vatImplication = vatRules[0].rule.sean_instruction;
    citations.push(vatRules[0].citationId);
  }

  return {
    isDeductible,
    percentage,
    reason: topRule.rule.interpretation,
    conditions,
    citations,
    vatImplication
  };
}

// ─── Master Query Function ───────────────────────────────────────────────────

/**
 * Query all codex sources for a question.
 * Runs tax rules, VAT rules, and decision engine matching in parallel.
 */
function queryCodex(question, domain, codexItems) {
  const taxRules = findApplicableTaxRules(
    question,
    codexItems.filter(i => {
      const d = (i.domain || i.primaryDomain || '').toUpperCase();
      return d === domain || d === 'OTHER';
    })
  );

  const vatRules = domain === 'VAT'
    ? findApplicableVATRules(
        question,
        codexItems.filter(i => {
          const d = (i.domain || i.primaryDomain || '').toUpperCase();
          return d === 'VAT' || d === 'OTHER';
        })
      )
    : [];

  const decisionEngines = findApplicableDecisionEngines(question, codexItems);

  // Build formatted context
  let formattedContext = '';
  if (decisionEngines.length > 0) formattedContext += formatDecisionEngineContext(decisionEngines);
  if (taxRules.length > 0) formattedContext += formatTaxRulesContext(taxRules);
  if (vatRules.length > 0) formattedContext += formatVATRulesContext(vatRules);

  return {
    taxRules,
    vatRules,
    decisionEngines,
    formattedContext,
    hasCodifiedKnowledge: taxRules.length > 0 || vatRules.length > 0 || decisionEngines.length > 0
  };
}

// ─── Teach Message Parser ────────────────────────────────────────────────────

/**
 * Parse LEER:/TEACH:/SAVE TO CODEX: prefixed messages.
 * Extracts metadata (layer, title, domain, tags, language).
 */
function parseTeachMessage(content) {
  const teachMatch = content.match(/^(LEER:|TEACH:|SAVE TO CODEX:)/i);
  if (!teachMatch) {
    return { success: false, error: 'Not a teach message' };
  }

  const afterPrefix = content.substring(teachMatch[0].length).trim();
  const lines = afterPrefix.split('\n');

  let layer = 'FIRM';
  let scopeType = 'GLOBAL';
  let scopeCompanyId = null;
  let title = '';
  let language = 'EN';
  let tags = [];
  let primaryDomain = 'OTHER';
  let secondaryDomains = [];
  let contentText = '';
  let contentStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('LAYER:')) {
      const layerValue = line.substring(6).trim().toUpperCase();
      if (['LEGAL', 'FIRM', 'CLIENT'].includes(layerValue)) layer = layerValue;
    } else if (line.startsWith('CLIENT:') || line.startsWith('COMPANY:')) {
      scopeType = 'CLIENT';
      scopeCompanyId = line.substring(line.indexOf(':') + 1).trim();
    } else if (line.startsWith('TITLE:')) {
      title = line.substring(6).trim();
    } else if (line.startsWith('TAGS:')) {
      tags = line.substring(5).trim().split(',').map(t => t.trim()).filter(t => t);
    } else if (line.startsWith('LANGUAGE:')) {
      const langValue = line.substring(9).trim().toUpperCase();
      if (['AF', 'EN', 'MIXED'].includes(langValue)) language = langValue;
    } else if (line.startsWith('DOMAIN:')) {
      const domainValue = line.substring(7).trim().toUpperCase();
      if (VALID_DOMAINS.includes(domainValue)) primaryDomain = domainValue;
    } else if (line.startsWith('SECONDARY_DOMAINS:')) {
      secondaryDomains = line.substring(18).trim()
        .split(',').map(d => d.trim().toUpperCase()).filter(d => d && VALID_DOMAINS.includes(d));
    } else if (line.startsWith('CONTENT:')) {
      contentText = line.substring(8).trim();
      contentStart = i + 1;
      break;
    } else if (line === '') {
      contentStart = i + 1;
      break;
    } else {
      contentStart = i;
      break;
    }
  }

  if (contentStart < lines.length && !contentText) {
    contentText = lines.slice(contentStart).join('\n').trim();
  }

  if (!title) {
    const firstLine = contentText.split('\n')[0].substring(0, 60);
    title = firstLine.endsWith('.') ? firstLine : firstLine + '...';
  }

  if (!contentText) {
    return { success: false, error: 'No content provided. Add content after CONTENT: or after metadata.' };
  }

  return {
    success: true,
    data: { layer, scopeType, scopeCompanyId, title, contentText, language, tags, primaryDomain, secondaryDomains }
  };
}

// ─── Citation ID Generator ───────────────────────────────────────────────────

function generateSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 50);
}

function generateCitationId(layer, slug, version = 1) {
  return `KB:${layer}:${slug}:v${version}`;
}

// ─── Format Answer with Citations ────────────────────────────────────────────

function formatAnswerWithCitations(outcome, reason, citations) {
  let answer = `**Outcome:** ${outcome}\n\n`;
  answer += `**Reason:** ${reason}\n\n`;

  if (citations && citations.length > 0) {
    answer += '**Citations:**\n';
    citations.forEach(cit => {
      answer += `- [${cit.citationId}] ${cit.title}\n`;
    });
  } else {
    answer += '**Note:** No approved codex items found for this query.';
  }

  return answer;
}

module.exports = {
  VALID_DOMAINS,
  parseCodexItem,
  matchRelevantItems,
  findApplicableTaxRules,
  formatTaxRulesContext,
  findApplicableVATRules,
  formatVATRulesContext,
  findApplicableDecisionEngines,
  formatDecisionEngineContext,
  searchLookupTables,
  checkDeductibility,
  queryCodex,
  parseTeachMessage,
  generateSlug,
  generateCitationId,
  formatAnswerWithCitations
};
