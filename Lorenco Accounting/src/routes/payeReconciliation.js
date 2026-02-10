// PAYE Reconciliation API routes
const express = require('express');
const router = express.Router();
const payeReconciliationService = require('../services/payeReconciliationService');
const { authenticate, authorize } = require('../middleware/auth');

// Get reconciliation draft (per period)
router.get('/draft/:periodId', authenticate, payeReconciliationService.getDraft);
// Save reconciliation draft (per period)
router.put('/draft/:periodId', authenticate, authorize('admin', 'accountant'), payeReconciliationService.saveDraft);
// Approve reconciliation
router.post('/approve/:reconId', authenticate, authorize('admin', 'accountant'), payeReconciliationService.approve);
// Lock reconciliation
router.post('/lock/:reconId', authenticate, authorize('admin', 'accountant'), payeReconciliationService.lock);
// Get reconciliation snapshot (view-only)
router.get('/snapshot/:reconId', authenticate, payeReconciliationService.getSnapshot);

module.exports = router;
