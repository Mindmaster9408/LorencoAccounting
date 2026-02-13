/**
 * ============================================================================
 * INTER-COMPANY NETWORK — Company Discovery & Matching
 * ============================================================================
 * Enables companies on the platform to discover and connect with each other.
 *
 * Matching strategies:
 *   1. Tax Number — Exact match on company registration / VAT number
 *   2. Email Domain — Match by email domain (e.g., @turkstra.co.za)
 *   3. Company Name — Fuzzy match on company name
 *   4. Invitation Code — Direct invite via unique code
 *
 * Both companies must opt-in. No data shared without consent.
 * ============================================================================
 */

const crypto = require('crypto');
const { supabase } = require('../config/database');

class InterCompanyNetwork {

  /**
   * @param {object} dataStore - Supabase data store for relationships/invoices
   */
  constructor(dataStore) {
    this.store = dataStore;
  }

  // ─── Enable Inter-Company for a Company ──────────────────────────────

  /**
   * Enable inter-company features for a company
   * Generates an invitation code other companies can use to connect
   */
  async enable(companyId, companyDetails = {}) {
    const invitationCode = this.generateInviteCode();

    // Store the enablement
    const record = {
      company_id: companyId,
      company_name: companyDetails.name || `Company ${companyId}`,
      tax_number: companyDetails.taxNumber || null,
      vat_number: companyDetails.vatNumber || null,
      email_domain: companyDetails.emailDomain || null,
      invitation_code: invitationCode,
      inter_company_enabled: true,
      enabled_at: new Date().toISOString()
    };

    return {
      success: true,
      invitationCode,
      message: 'Inter-company features enabled. Share your invitation code with trading partners.',
      record
    };
  }

  // ─── Find Companies on the Platform ──────────────────────────────────

  /**
   * Search for companies on the platform
   * @param {object} searchParams
   * @param {string} [searchParams.name] - Company name (fuzzy)
   * @param {string} [searchParams.taxNumber] - Tax/registration number (exact)
   * @param {string} [searchParams.vatNumber] - VAT number (exact)
   * @param {string} [searchParams.emailDomain] - Email domain (exact)
   * @param {string} [searchParams.invitationCode] - Direct invitation code
   * @param {number} requestingCompanyId - The company doing the search
   */
  async findCompanies(searchParams, requestingCompanyId) {
    // Query real companies from Supabase
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, company_name, trading_name, tax_number, vat_number, email_domain, invitation_code, inter_company_enabled, city, industry')
      .eq('is_active', true);

    if (error || !companies) {
      console.error('InterCompany findCompanies error:', error?.message);
      return [];
    }

    const results = [];

    for (const company of companies) {
      // Don't return the requesting company
      if (company.id === requestingCompanyId) continue;
      // Only return companies with inter-company enabled
      if (!company.inter_company_enabled) continue;

      let matchScore = 0;
      let matchType = null;

      // Invitation code — exact match (highest priority)
      if (searchParams.invitationCode && company.invitation_code === searchParams.invitationCode) {
        matchScore = 100;
        matchType = 'invitation_code';
      }

      // Tax number — exact match
      if (searchParams.taxNumber && company.tax_number &&
          company.tax_number.replace(/[\s/-]/g, '') === searchParams.taxNumber.replace(/[\s/-]/g, '')) {
        matchScore = Math.max(matchScore, 95);
        matchType = matchType || 'tax_number';
      }

      // VAT number — exact match
      if (searchParams.vatNumber && company.vat_number &&
          company.vat_number.replace(/[\s/-]/g, '') === searchParams.vatNumber.replace(/[\s/-]/g, '')) {
        matchScore = Math.max(matchScore, 95);
        matchType = matchType || 'vat_number';
      }

      // Email domain — exact match
      if (searchParams.emailDomain && company.email_domain &&
          company.email_domain.toLowerCase() === searchParams.emailDomain.toLowerCase()) {
        matchScore = Math.max(matchScore, 85);
        matchType = matchType || 'email_domain';
      }

      // Company name — fuzzy match
      const companyName = company.trading_name || company.company_name;
      if (searchParams.name && companyName) {
        const similarity = this.nameSimilarity(searchParams.name, companyName);
        if (similarity > 0.6) {
          const nameScore = Math.round(similarity * 80);
          if (nameScore > matchScore) {
            matchScore = nameScore;
            matchType = 'name_fuzzy';
          }
        }
      }

      if (matchScore > 0) {
        results.push({
          companyId: company.id,
          companyName: company.trading_name || company.company_name,
          matchScore,
          matchType,
          // Don't reveal sensitive info until connected
          preview: {
            city: company.city || null,
            industry: company.industry || null
          }
        });
      }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  // ─── Create Relationship ─────────────────────────────────────────────

  /**
   * Create a relationship between two companies
   * Both companies must confirm for invoices to flow
   */
  async createRelationship(companyAId, companyBId, initiatedBy) {
    // Check if relationship already exists
    if (this.store && this.store.findRelationship) {
      const existing = await this.store.findRelationship(companyAId, companyBId);
      if (existing) {
        return {
          success: false,
          error: 'Relationship already exists',
          relationship: existing
        };
      }
    }

    const relationship = {
      company_a_id: companyAId,
      company_b_id: companyBId,
      initiated_by: initiatedBy,
      status: 'pending',  // pending → active → suspended → terminated
      company_a_confirmed: initiatedBy === companyAId,
      company_b_confirmed: initiatedBy === companyBId,
      permissions: {
        send_invoices: true,
        receive_invoices: true,
        auto_match_payments: false  // Must be explicitly enabled
      },
      created_at: new Date().toISOString()
    };

    if (this.store && this.store.addRelationship) {
      const saved = await this.store.addRelationship(relationship);
      relationship.id = saved.id;
    }

    return {
      success: true,
      relationship,
      message: 'Relationship request sent. The other company must confirm to enable invoice syncing.'
    };
  }

  // ─── Confirm Relationship ────────────────────────────────────────────

  async confirmRelationship(relationshipId, companyId) {
    if (!this.store) {
      return { success: false, error: 'Data store not available' };
    }

    // Find the relationship in store
    const relationships = await this.store.getRelationships(companyId);
    const rel = relationships.find(r => r.id === relationshipId);

    if (!rel) {
      return { success: false, error: 'Relationship not found' };
    }

    // Mark this company as confirmed
    if (rel.company_a_id === companyId) {
      rel.company_a_confirmed = true;
    } else if (rel.company_b_id === companyId) {
      rel.company_b_confirmed = true;
    }

    // If both confirmed, activate
    if (rel.company_a_confirmed && rel.company_b_confirmed) {
      rel.status = 'active';
    }

    return {
      success: true,
      relationship: rel,
      message: rel.status === 'active'
        ? 'Relationship confirmed! You can now send and receive invoices.'
        : 'Your confirmation recorded. Waiting for the other company to confirm.'
    };
  }

  // ─── Get Active Relationships ────────────────────────────────────────

  async getRelationships(companyId) {
    if (!this.store || !this.store.getRelationships) {
      return [];
    }
    return await this.store.getRelationships(companyId);
  }

  // ─── Utilities ───────────────────────────────────────────────────────

  generateInviteCode() {
    return 'IC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  nameSimilarity(a, b) {
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().split(/\s+/);
    const wordsA = new Set(normalize(a));
    const wordsB = new Set(normalize(b));
    const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return union === 0 ? 0 : intersection / union;
  }
}

module.exports = InterCompanyNetwork;
