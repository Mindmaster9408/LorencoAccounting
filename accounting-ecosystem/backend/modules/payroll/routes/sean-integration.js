/**
 * ============================================================================
 * PAYROLL × SEAN INTEGRATION ROUTES
 * ============================================================================
 * REST endpoints for SEAN-powered payroll intelligence.
 * All routes are prefixed with /api/payroll/sean and require authentication.
 *
 * Endpoints:
 *   POST /:periodId/preflight   — Pre-flight checks before payroll processing
 *   GET  /optimize-tax          — Tax optimization suggestions
 *   GET  /forecast/:months      — Cash flow forecasting
 *   GET  /compliance            — SA labour law compliance check
 *   GET  /employee-cost/:id     — Employee cost analysis
 *   POST /learn                 — Record payroll learning
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const { requireCompany, requirePermission } = require('../../../middleware/auth');
const PayrollIntelligence = require('../../../sean/payroll-intelligence');

const { supabase } = require('../../../config/database');

/**
 * Build Supabase data provider for PayrollIntelligence.
 * Provides employees and payroll data from real database.
 */
function getDataProvider() {
  return {
    supabase,
    async getEmployees(companyId) {
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true);
      return data || [];
    },
    async getPayrollPeriods(companyId) {
      const { data } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('company_id', companyId)
        .order('period_start', { ascending: false });
      return data || [];
    }
  };
}

/**
 * Build PayrollIntelligence instance for the request.
 */
function getIntelligence(req) {
  const companyId = req.companyId || req.user?.companyId || 1;
  const encryptionKey = process.env[`SEAN_KEY_COMPANY_${companyId}`]
    || process.env.SEAN_DEFAULT_KEY
    || 'a7f3b9d2e4c8f1a6d5e9b2c7f4a8d3e1b6c9f2a5d8e7b4c1f6a9d2e5b8c3f7a0';
  const data = getDataProvider();
  return new PayrollIntelligence(companyId, encryptionKey, data);
}

// ─── Middleware ───────────────────────────────────────────────────────────────
router.use(requireCompany);

// ─── POST /:periodId/preflight — Pre-flight checks ──────────────────────────

router.post('/:periodId/preflight', requirePermission('PAYROLL.VIEW'), async (req, res) => {
  try {
    const { periodId } = req.params;
    const intelligence = getIntelligence(req);
    const checks = await intelligence.preflightChecks(periodId);

    res.json({
      success: true,
      canProcess: checks.canProcess,
      checks
    });
  } catch (error) {
    console.error('SEAN preflight error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET /optimize-tax — Tax optimization suggestions ────────────────────────

router.get('/optimize-tax', requirePermission('PAYROLL.VIEW'), async (req, res) => {
  try {
    const intelligence = getIntelligence(req);
    const suggestions = await intelligence.suggestTaxOptimizations();

    res.json({ success: true, ...suggestions });
  } catch (error) {
    console.error('SEAN tax optimization error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET /forecast/:months — Cash flow forecasting ──────────────────────────

router.get('/forecast/:months?', requirePermission('PAYROLL.VIEW'), async (req, res) => {
  try {
    const months = parseInt(req.params.months) || 3;
    const intelligence = getIntelligence(req);
    const forecast = await intelligence.forecastCashFlow(Math.min(months, 12));

    res.json({ success: true, ...forecast });
  } catch (error) {
    console.error('SEAN forecast error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET /compliance — SA labour law compliance check ────────────────────────

router.get('/compliance', requirePermission('PAYROLL.VIEW'), async (req, res) => {
  try {
    const intelligence = getIntelligence(req);
    const compliance = await intelligence.checkCompliance();

    res.json({ success: true, ...compliance });
  } catch (error) {
    console.error('SEAN compliance error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET /employee-cost/:employeeId — Employee cost analysis ─────────────────

router.get('/employee-cost/:employeeId', requirePermission('PAYROLL.VIEW'), async (req, res) => {
  try {
    const intelligence = getIntelligence(req);
    const analysis = await intelligence.analyzeEmployeeCost(req.params.employeeId);

    if (analysis.error) {
      return res.status(404).json({ success: false, error: analysis.error });
    }

    res.json({ success: true, ...analysis });
  } catch (error) {
    console.error('SEAN employee cost error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /learn — Record learning from payroll processing ───────────────────

router.post('/learn', requirePermission('PAYROLL.CREATE'), async (req, res) => {
  try {
    const intelligence = getIntelligence(req);
    const result = await intelligence.learn(req.body.periodId, {
      employeeCount: req.body.employeeCount,
      totalPayout: req.body.totalPayout,
      issuesFound: req.body.issuesFound || 0,
      correctionsMade: req.body.correctionsMade || [],
      learned: req.body.learned || {}
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('SEAN learn error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
