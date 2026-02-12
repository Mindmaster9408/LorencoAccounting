// PAYE Configuration API routes
const express = require('express');
const router = express.Router();
const payeConfigService = require('../services/payeConfigService');
const { authenticate, authorize } = require('../middleware/auth');

// Get PAYE configuration (income & deduction types)
router.get('/', authenticate, payeConfigService.getConfig);

// Update PAYE configuration (admin/accountant only)
router.put('/', authenticate, authorize('admin', 'accountant'), payeConfigService.updateConfig);

module.exports = router;
