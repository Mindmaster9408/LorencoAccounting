// PAYE Reconciliation API routes
const express = require('express');
const router = express.Router();
const payeReconciliationService = require('../services/payeReconciliationService');
const { authenticate, requireRole } = require('../middleware/auth');

// Get reconciliation draft (per period)
router.get('/draft/:periodId', authenticate, payeReconciliationService.getDraft);
// Save reconciliation draft (per period)
router.put('/draft/:periodId', authenticate, requireRole(['ADMIN', 'ACCOUNTANT']), payeReconciliationService.saveDraft);
// Approve reconciliation
router.post('/approve/:reconId', authenticate, requireRole(['ADMIN', 'ACCOUNTANT']), payeReconciliationService.approve);
// Lock reconciliation
router.post('/lock/:reconId', authenticate, requireRole(['ADMIN', 'ACCOUNTANT']), payeReconciliationService.lock);
// Get reconciliation snapshot (view-only)
router.get('/snapshot/:reconId', authenticate, payeReconciliationService.getSnapshot);

module.exports = router;
