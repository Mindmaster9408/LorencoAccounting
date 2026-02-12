const db = require('../config/database');

/**
 * AI Guard Service
 * Enforces AI capability modes and permissions
 */
class AIGuard {
  /**
   * Get effective AI mode for a capability
   * Takes into account company settings, capability settings, and user overrides
   */
  static async getEffectiveMode(companyId, userId, capabilityKey) {
    // Check if AI is enabled for company
    const companySettingsResult = await db.query(
      'SELECT is_enabled FROM ai_settings_company WHERE company_id = $1',
      [companyId]
    );

    if (companySettingsResult.rows.length === 0 || !companySettingsResult.rows[0].is_enabled) {
      return {
        mode: 'off',
        reason: 'AI is disabled for this company',
        isEnabled: false
      };
    }

    // Check capability settings
    const capabilityResult = await db.query(
      `SELECT mode, min_confidence, is_enabled 
       FROM ai_settings_capabilities 
       WHERE company_id = $1 AND capability_key = $2`,
      [companyId, capabilityKey]
    );

    if (capabilityResult.rows.length === 0) {
      return {
        mode: 'off',
        reason: 'Capability not configured',
        isEnabled: false
      };
    }

    const capabilitySetting = capabilityResult.rows[0];

    if (!capabilitySetting.is_enabled) {
      return {
        mode: 'off',
        reason: 'Capability is disabled',
        isEnabled: false,
        minConfidence: capabilitySetting.min_confidence
      };
    }

    // Check user overrides
    const userOverrideResult = await db.query(
      `SELECT mode_override, is_enabled_override
       FROM ai_settings_user_overrides
       WHERE company_id = $1 AND user_id = $2 AND capability_key = $3`,
      [companyId, userId, capabilityKey]
    );

    if (userOverrideResult.rows.length > 0) {
      const override = userOverrideResult.rows[0];
      
      // User disabled it
      if (override.is_enabled_override === false) {
        return {
          mode: 'off',
          reason: 'Capability disabled by user override',
          isEnabled: false,
          minConfidence: capabilitySetting.min_confidence
        };
      }

      // User has mode override
      if (override.mode_override) {
        return {
          mode: override.mode_override,
          reason: 'User override',
          isEnabled: true,
          minConfidence: capabilitySetting.min_confidence
        };
      }
    }

    // Return company/capability setting
    return {
      mode: capabilitySetting.mode,
      reason: 'Company setting',
      isEnabled: true,
      minConfidence: capabilitySetting.min_confidence
    };
  }

  /**
   * Check if user can use AI for a specific capability
   */
  static async canUseAI(companyId, userId, capabilityKey, userRole) {
    const effectiveMode = await this.getEffectiveMode(companyId, userId, capabilityKey);

    if (!effectiveMode.isEnabled || effectiveMode.mode === 'off') {
      return {
        allowed: false,
        mode: 'off',
        reason: effectiveMode.reason
      };
    }

    // Check role permissions for AI usage
    const aiRoles = ['admin', 'accountant', 'bookkeeper'];
    if (!aiRoles.includes(userRole)) {
      return {
        allowed: false,
        mode: effectiveMode.mode,
        reason: 'Insufficient role permissions for AI usage'
      };
    }

    return {
      allowed: true,
      mode: effectiveMode.mode,
      minConfidence: effectiveMode.minConfidence,
      reason: effectiveMode.reason
    };
  }

  /**
   * Determine action based on mode, confidence, and permissions
   * @returns {string} - 'suggest', 'draft', or 'auto'
   */
  static determineAction(mode, confidence, minConfidence, userRole) {
    // Suggest mode always returns suggestions only
    if (mode === 'suggest') {
      return 'suggest';
    }

    // Draft mode creates drafts for review
    if (mode === 'draft') {
      return 'draft';
    }

    // Auto mode - check confidence and permissions
    if (mode === 'auto') {
      // Only accountants and admins can use auto mode
      if (!['admin', 'accountant'].includes(userRole)) {
        return 'draft'; // Fallback to draft for bookkeepers
      }

      // Check confidence threshold
      if (confidence >= minConfidence) {
        return 'auto';
      } else {
        return 'draft'; // Fallback to draft if confidence too low
      }
    }

    // Default to suggest
    return 'suggest';
  }

  /**
   * Validate AI request
   */
  static validateRequest(capabilityKey, inputRefs) {
    const validCapabilities = [
      'BANK_ALLOCATION',
      'BANK_RECONCILIATION',
      'JOURNAL_PREP',
      'REPORT_PREP',
      'PAYROLL_RECON',
      'VAT_RECON'
    ];

    if (!validCapabilities.includes(capabilityKey)) {
      return {
        valid: false,
        error: `Invalid capability: ${capabilityKey}. Must be one of: ${validCapabilities.join(', ')}`
      };
    }

    if (!inputRefs || typeof inputRefs !== 'object') {
      return {
        valid: false,
        error: 'inputRefs must be provided as an object'
      };
    }

    return { valid: true };
  }
}

module.exports = AIGuard;
