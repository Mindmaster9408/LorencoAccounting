/**
 * ============================================================================
 * INTER-COMPANY — Express API Routes
 * ============================================================================
 * REST endpoints for inter-company invoice syncing.
 * All routes prefixed with /api/inter-company.
 *
 * Endpoints:
 *   POST   /enable                — Enable inter-company for a company
 *   POST   /find                  — Find companies on the platform
 *   POST   /relationships         — Create a relationship
 *   POST   /relationships/:id/confirm — Confirm a relationship
 *   GET    /relationships         — List active relationships
 *   POST   /invoices/send         — Send an invoice
 *   GET    /invoices/sent         — List sent invoices
 *   GET    /invoices/inbox        — Received invoices inbox
 *   POST   /invoices/:id/approve  — Approve a received invoice
 *   POST   /invoices/:id/reject   — Reject a received invoice
 *   POST   /invoices/:id/pay      — Record payment against invoice
 *   GET    /invoices/:id          — Get invoice details
 *   POST   /reconcile             — Auto-reconcile payments
 * ============================================================================
 */

const express = require('express');
const router = express.Router();

const InterCompanyNetwork = require('./network');
const InvoiceSender = require('./invoice-sender');
const InvoiceReceiver = require('./invoice-receiver');
const PaymentSync = require('./payment-sync');

// ─── Data Store ─────────────────────────────────────────────────────────

const { supabaseSeanStore } = require('../sean/supabase-store');
const dataStore = supabaseSeanStore;

// ─── Helpers ─────────────────────────────────────────────────────────────

function getCompanyId(req) {
  return req.companyId || req.user?.companyId || 1;
}

function getNetwork() {
  return new InterCompanyNetwork(dataStore);
}

function getSender() {
  return new InvoiceSender(dataStore);
}

function getReceiver() {
  return new InvoiceReceiver(dataStore);
}

function getPaymentSync() {
  return new PaymentSync(dataStore);
}

// ─── POST /enable — Enable inter-company features ──────────────────────

router.post('/enable', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { name, taxNumber, vatNumber, emailDomain } = req.body;

    const network = getNetwork();
    const result = await network.enable(companyId, { name, taxNumber, vatNumber, emailDomain });

    res.json(result);
  } catch (err) {
    console.error('Inter-Company /enable error:', err.message);
    res.status(500).json({ error: 'Failed to enable inter-company features' });
  }
});

// ─── POST /find — Find companies on the platform ───────────────────────

router.post('/find', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { name, taxNumber, vatNumber, emailDomain, invitationCode } = req.body;

    if (!name && !taxNumber && !vatNumber && !emailDomain && !invitationCode) {
      return res.status(400).json({ error: 'Provide at least one search parameter: name, taxNumber, vatNumber, emailDomain, or invitationCode' });
    }

    const network = getNetwork();
    const results = await network.findCompanies(
      { name, taxNumber, vatNumber, emailDomain, invitationCode },
      companyId
    );

    res.json({
      count: results.length,
      companies: results
    });
  } catch (err) {
    console.error('Inter-Company /find error:', err.message);
    res.status(500).json({ error: 'Failed to search for companies' });
  }
});

// ─── POST /relationships — Create a relationship ───────────────────────

router.post('/relationships', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { targetCompanyId } = req.body;

    if (!targetCompanyId) {
      return res.status(400).json({ error: 'targetCompanyId is required' });
    }

    const network = getNetwork();
    const result = await network.createRelationship(companyId, targetCompanyId, companyId);

    res.json(result);
  } catch (err) {
    console.error('Inter-Company /relationships error:', err.message);
    res.status(500).json({ error: 'Failed to create relationship' });
  }
});

// ─── POST /relationships/:id/confirm — Confirm a relationship ──────────

router.post('/relationships/:id/confirm', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;

    const network = getNetwork();
    const result = await network.confirmRelationship(parseInt(id), companyId);

    res.json(result);
  } catch (err) {
    console.error('Inter-Company /relationships/confirm error:', err.message);
    res.status(500).json({ error: 'Failed to confirm relationship' });
  }
});

// ─── GET /relationships — List active relationships ────────────────────

router.get('/relationships', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const network = getNetwork();
    const relationships = await network.getRelationships(companyId);

    res.json({
      count: relationships.length,
      relationships
    });
  } catch (err) {
    console.error('Inter-Company /relationships error:', err.message);
    res.status(500).json({ error: 'Failed to list relationships' });
  }
});

// ─── POST /invoices/send — Send an invoice ──────────────────────────────

router.post('/invoices/send', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { receiverCompanyId, invoiceNumber, date, dueDate, lineItems, notes, includesVAT } = req.body;

    const sender = getSender();
    const result = await sender.send({
      senderCompanyId: companyId,
      receiverCompanyId,
      invoiceNumber,
      date,
      dueDate,
      lineItems,
      notes,
      includesVAT
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('Inter-Company /invoices/send error:', err.message);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

// ─── GET /invoices/sent — List sent invoices ────────────────────────────

router.get('/invoices/sent', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const sender = getSender();
    const invoices = await sender.getSentInvoices(companyId);

    res.json({
      count: invoices.length,
      invoices: invoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        receiverCompanyId: inv.receiver_company_id,
        date: inv.date,
        dueDate: inv.due_date,
        total: inv.total,
        status: inv.sender_status,
        paymentStatus: inv.payment_status,
        amountPaid: inv.amount_paid
      }))
    });
  } catch (err) {
    console.error('Inter-Company /invoices/sent error:', err.message);
    res.status(500).json({ error: 'Failed to list sent invoices' });
  }
});

// ─── GET /invoices/inbox — Received invoices inbox ──────────────────────

router.get('/invoices/inbox', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { status } = req.query;
    const receiver = getReceiver();

    const invoices = await receiver.getInbox(companyId, { status });

    res.json({
      count: invoices.length,
      invoices
    });
  } catch (err) {
    console.error('Inter-Company /invoices/inbox error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve inbox' });
  }
});

// ─── POST /invoices/:id/approve — Approve a received invoice ────────────

router.post('/invoices/:id/approve', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { allocations } = req.body;  // Optional category overrides per line item

    const receiver = getReceiver();
    const result = await receiver.approve(parseInt(id), companyId, allocations || {});

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('Inter-Company /invoices/approve error:', err.message);
    res.status(500).json({ error: 'Failed to approve invoice' });
  }
});

// ─── POST /invoices/:id/reject — Reject a received invoice ─────────────

router.post('/invoices/:id/reject', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { reason } = req.body;

    const receiver = getReceiver();
    const result = await receiver.reject(parseInt(id), companyId, reason || '');

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('Inter-Company /invoices/reject error:', err.message);
    res.status(500).json({ error: 'Failed to reject invoice' });
  }
});

// ─── POST /invoices/:id/pay — Record payment ───────────────────────────

router.post('/invoices/:id/pay', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { id } = req.params;
    const { amount, date, reference, method } = req.body;

    if (!amount || !date) {
      return res.status(400).json({ error: 'amount and date are required' });
    }

    const paymentSync = getPaymentSync();
    const result = await paymentSync.recordPayment({
      invoiceId: parseInt(id),
      payerCompanyId: companyId,
      amount: parseFloat(amount),
      date,
      reference,
      method
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('Inter-Company /invoices/pay error:', err.message);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// ─── GET /invoices/:id — Get invoice details ────────────────────────────

router.get('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!dataStore) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = dataStore.getInterCompanyInvoice(parseInt(id));
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      senderCompanyId: invoice.sender_company_id,
      receiverCompanyId: invoice.receiver_company_id,
      date: invoice.date,
      dueDate: invoice.due_date,
      lineItems: invoice.line_items,
      subtotal: invoice.subtotal,
      vatAmount: invoice.vat_amount,
      total: invoice.total,
      notes: invoice.notes,
      senderStatus: invoice.sender_status,
      receiverStatus: invoice.receiver_status,
      paymentStatus: invoice.payment_status,
      amountPaid: invoice.amount_paid,
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at
    });
  } catch (err) {
    console.error('Inter-Company /invoices/:id error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve invoice' });
  }
});

// ─── POST /reconcile — Auto-reconcile payments ─────────────────────────

router.post('/reconcile', async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const paymentSync = getPaymentSync();
    const result = await paymentSync.autoReconcile(companyId);

    res.json(result);
  } catch (err) {
    console.error('Inter-Company /reconcile error:', err.message);
    res.status(500).json({ error: 'Failed to auto-reconcile' });
  }
});

module.exports = router;
