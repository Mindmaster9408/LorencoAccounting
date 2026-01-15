// PAYE Configuration API routes
const express = require('express');
const router = express.Router();
const payeConfigService = require('../services/payeConfigService');
const { authenticate, requireRole } = require('../middleware/auth');

// Get PAYE configuration (income & deduction types)
router.get('/', authenticate, payeConfigService.getConfig);

// Update PAYE configuration (admin/accountant only)
router.put('/', authenticate, requireRole(['ADMIN', 'ACCOUNTANT']), payeConfigService.updateConfig);

module.exports = router;
