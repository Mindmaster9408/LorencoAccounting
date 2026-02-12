const express = require('express');
const db = require('../config/database');
const { authenticate, hasPermission } = require('../middleware/auth');
const AIGuard = require('../services/aiGuard');
const JournalService = require('../services/journalService');
const AuditLogger = require('../services/auditLogger');

const router = express.Router();

/**
 * GET /api/ai/settings
 * Get AI settings for the company
 */
router.get('/settings', authenticate, hasPermission('ai.settings.view'), async (req, res) => {
  try {
    // Get company settings
    const companyResult = await db.query(
      'SELECT * FROM ai_settings_company WHERE company_id = $1',
      [req.user.companyId]
    );

    let companySettings = companyResult.rows[0];
    
    // Initialize if not exists
    if (!companySettings) {
      const initResult = await db.query(
        'INSERT INTO ai_settings_company (company_id, is_enabled) VALUES ($1, $2) RETURNING *',
        [req.user.companyId, false]
      );
      companySettings = initResult.rows[0];
    }

    // Get capability settings
    const capabilitiesResult = await db.query(
      'SELECT * FROM ai_settings_capabilities WHERE company_id = $1 ORDER BY capability_key',
      [req.user.companyId]
    );

    // Get user overrides
    const overridesResult = await db.query(
      'SELECT * FROM ai_settings_user_overrides WHERE company_id = $1 AND user_id = $2',
      [req.user.companyId, req.user.id]
    );

    res.json({
      company: companySettings,
      capabilities: capabilitiesResult.rows,
      userOverrides: overridesResult.rows
    });

  } catch (error) {
    console.error('Error fetching AI settings:', error);
    res.status(500).json({ error: 'Failed to fetch AI settings' });
  }
});

/**
 * PUT /api/ai/settings
 * Update AI settings
 */
router.put('/settings', authenticate, hasPermission('ai.settings.edit'), async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { companyEnabled, capabilities } = req.body;

    await client.query('BEGIN');

    // Update company setting
    if (companyEnabled !== undefined) {
      await client.query(
        `INSERT INTO ai_settings_company (company_id, is_enabled)
         VALUES ($1, $2)
         ON CONFLICT (company_id) DO UPDATE SET is_enabled = $2`,
        [req.user.companyId, companyEnabled]
      );
    }

    // Update capability settings
    if (capabilities && Array.isArray(capabilities)) {
      for (const cap of capabilities) {
        await client.query(
          `INSERT INTO ai_settings_capabilities (company_id, capability_key, mode, min_confidence, is_enabled)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (company_id, capability_key) 
           DO UPDATE SET mode = $3, min_confidence = $4, is_enabled = $5`,
          [req.user.companyId, cap.capabilityKey, cap.mode, cap.minConfidence, cap.isEnabled]
        );
      }
    }

    await AuditLogger.logUserAction(
      req,
      'UPDATE',
      'AI_SETTINGS',
      req.user.companyId,
      null,
      { companyEnabled, capabilitiesCount: capabilities?.length },
      'AI settings updated'
    );

    await client.query('COMMIT');

    res.json({ message: 'AI settings updated successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating AI settings:', error);
    res.status(500).json({ error: 'Failed to update AI settings' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/ai/actions
 * Submit an AI action request
 */
router.post('/actions', authenticate, hasPermission('ai.request'), async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { capabilityKey, inputRefs, metadata } = req.body;

    // Validate request
    const validation = AIGuard.validateRequest(capabilityKey, inputRefs);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Check permissions
    const aiPermission = await AIGuard.canUseAI(
      req.user.companyId,
      req.user.id,
      capabilityKey,
      req.user.role
    );

    if (!aiPermission.allowed) {
      return res.status(403).json({ 
        error: 'AI capability not available',
        reason: aiPermission.reason
      });
    }

    await client.query('BEGIN');

    // Create AI action record
    const result = await client.query(
      `INSERT INTO ai_actions 
       (company_id, requested_by_user_id, capability_key, mode_used, status, input_refs, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.companyId,
        req.user.id,
        capabilityKey,
        aiPermission.mode,
        'pending',
        JSON.stringify(inputRefs),
        JSON.stringify(metadata || {})
      ]
    );

    const aiAction = result.rows[0];

    // Log AI action request
    await AuditLogger.logAIAction(
      req.user.companyId,
      aiAction.id,
      'AI_REQUEST',
      'AI_ACTION',
      aiAction.id,
      null,
      { capabilityKey, mode: aiPermission.mode },
      `AI action requested: ${capabilityKey}`
    );

    await client.query('COMMIT');

    // In a real implementation, this would trigger async AI processing
    // For now, return the pending action
    res.status(202).json({
      message: 'AI action request submitted',
      action: aiAction,
      mode: aiPermission.mode,
      note: 'This is a framework. Actual AI processing would happen asynchronously.'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting AI action:', error);
    res.status(500).json({ error: 'Failed to submit AI action' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/ai/actions/:id
 * Get AI action status and result
 */
router.get('/actions/:id', authenticate, hasPermission('ai.request'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT aa.*, u.email as requested_by_email
       FROM ai_actions aa
       JOIN users u ON aa.requested_by_user_id = u.id
       WHERE aa.id = $1 AND aa.company_id = $2`,
      [req.params.id, req.user.companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'AI action not found' });
    }

    const action = result.rows[0];

    // Get action steps
    const stepsResult = await db.query(
      'SELECT * FROM ai_action_steps WHERE ai_action_id = $1 ORDER BY step_number',
      [req.params.id]
    );

    action.steps = stepsResult.rows;

    // Get approvals
    const approvalsResult = await db.query(
      `SELECT aa.*, u.email as approved_by_email
       FROM ai_approvals aa
       JOIN users u ON aa.approved_by_user_id = u.id
       WHERE aa.ai_action_id = $1
       ORDER BY aa.created_at DESC`,
      [req.params.id]
    );

    action.approvals = approvalsResult.rows;

    res.json(action);

  } catch (error) {
    console.error('Error fetching AI action:', error);
    res.status(500).json({ error: 'Failed to fetch AI action' });
  }
});

/**
 * GET /api/ai/review-queue
 * Get AI actions pending review
 */
router.get('/review-queue', authenticate, hasPermission('ai.approve'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT aa.*, u.email as requested_by_email, u.first_name, u.last_name
       FROM ai_actions aa
       JOIN users u ON aa.requested_by_user_id = u.id
       WHERE aa.company_id = $1 AND aa.status = 'ready_for_review'
       ORDER BY aa.created_at DESC`,
      [req.user.companyId]
    );

    res.json({
      queue: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error fetching review queue:', error);
    res.status(500).json({ error: 'Failed to fetch review queue' });
  }
});

/**
 * POST /api/ai/actions/:id/approve
 * Approve an AI action
 */
router.post('/actions/:id/approve', authenticate, hasPermission('ai.approve'), async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { decision, notes, editedOutput } = req.body;

    if (!['approve', 'reject', 'edit'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be approve, reject, or edit' });
    }

    await client.query('BEGIN');

    // Get AI action
    const actionResult = await client.query(
      'SELECT * FROM ai_actions WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.companyId]
    );

    if (actionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'AI action not found' });
    }

    const aiAction = actionResult.rows[0];

    if (aiAction.status !== 'ready_for_review') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Action is not ready for review' });
    }

    // Record approval
    await client.query(
      `INSERT INTO ai_approvals (ai_action_id, approved_by_user_id, decision, notes, edited_output)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, req.user.id, decision, notes, editedOutput ? JSON.stringify(editedOutput) : null]
    );

    // Update action status
    let newStatus;
    if (decision === 'approve' || decision === 'edit') {
      newStatus = 'approved';
      
      // If approved, execute the action (create journal, etc.)
      // This would be implemented based on capability type
      // For now, just mark as executed
      await client.query(
        'UPDATE ai_actions SET status = $1 WHERE id = $2',
        ['executed', req.params.id]
      );
    } else {
      newStatus = 'rejected';
      await client.query(
        'UPDATE ai_actions SET status = $1 WHERE id = $2',
        [newStatus, req.params.id]
      );
    }

    // Audit log
    await AuditLogger.logUserAction(
      req,
      decision.toUpperCase(),
      'AI_ACTION',
      aiAction.id,
      { status: aiAction.status },
      { status: newStatus, decision },
      `AI action ${decision}: ${notes || ''}`
    );

    await client.query('COMMIT');

    res.json({
      message: `AI action ${decision}d successfully`,
      status: newStatus
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing AI action approval:', error);
    res.status(500).json({ error: 'Failed to process approval' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/ai/actions/:id/reject
 * Reject an AI action (alias for approve with decision=reject)
 */
router.post('/actions/:id/reject', authenticate, hasPermission('ai.approve'), async (req, res) => {
  req.body.decision = 'reject';
  // Forward to the approve handler logic
  req.url = `/actions/${req.params.id}/approve`;
  req.method = 'POST';
  // Re-invoke via next route match won't work, so just call the handler directly
  const client = await db.getClient();
  try {
    const { notes } = req.body;
    await client.query('BEGIN');
    const actionResult = await client.query(
      'SELECT * FROM ai_actions WHERE id = $1 AND company_id = $2',
      [req.params.id, req.user.companyId]
    );
    if (actionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'AI action not found' });
    }
    const aiAction = actionResult.rows[0];
    if (aiAction.status !== 'ready_for_review') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Action is not ready for review' });
    }
    await client.query(
      `INSERT INTO ai_approvals (ai_action_id, approved_by_user_id, decision, notes) VALUES ($1, $2, 'reject', $3)`,
      [req.params.id, req.user.id, notes]
    );
    await client.query(
      'UPDATE ai_actions SET status = $1 WHERE id = $2',
      ['rejected', req.params.id]
    );
    await AuditLogger.logUserAction(req, 'REJECT', 'AI_ACTION', aiAction.id,
      { status: aiAction.status }, { status: 'rejected', decision: 'reject' },
      `AI action rejected: ${notes || ''}`
    );
    await client.query('COMMIT');
    res.json({ message: 'AI action rejected successfully', status: 'rejected' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error rejecting AI action:', error);
    res.status(500).json({ error: 'Failed to reject action' });
  } finally {
    client.release();
  }
});

module.exports = router;
