/**
 * ============================================================================
 * INTER-COMPANY — Invoice Receiver (Inbox)
 * ============================================================================
 * Company B receives invoices from Company A.
 *
 * Flow:
 *   1. Invoice arrives in inbox (status: pending)
 *   2. Company B reviews and approves/rejects
 *   3. On approve → creditor entry created in Company B's books
 *   4. On reject → notification sent back to sender
 *
 * Auto-allocation:
 *   - SEAN looks at the invoice description and suggests account categories
 *   - If Company B has received similar invoices before, SEAN auto-allocates
 * ============================================================================
 */

const { suggestCategoryLocal } = require('../sean/allocations');

class InvoiceReceiver {

  /**
   * @param {object} dataStore - Mock or real data store
   */
  constructor(dataStore) {
    this.store = dataStore;
  }

  /**
   * Get inbox — all received invoices for a company
   * @param {number} companyId
   * @param {object} [filters]
   * @param {string} [filters.status] - pending, approved, rejected, paid
   */
  async getInbox(companyId, filters = {}) {
    if (!this.store || !this.store.getInterCompanyInvoices) {
      return [];
    }

    let invoices = this.store.getInterCompanyInvoices(companyId, 'received');

    if (filters.status) {
      invoices = invoices.filter(inv => inv.receiver_status === filters.status);
    }

    // Enrich with SEAN allocation suggestions
    return invoices.map(inv => {
      const suggestions = this.suggestAllocations(inv);
      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        senderCompanyId: inv.sender_company_id,
        date: inv.date,
        dueDate: inv.due_date,
        subtotal: inv.subtotal,
        vatAmount: inv.vat_amount,
        total: inv.total,
        lineItems: inv.line_items,
        notes: inv.notes,
        status: inv.receiver_status,
        paymentStatus: inv.payment_status,
        amountPaid: inv.amount_paid,
        seanSuggestions: suggestions,
        createdAt: inv.created_at
      };
    });
  }

  /**
   * Approve a received invoice
   * Creates creditor entries in the receiving company's books
   */
  async approve(invoiceId, companyId, allocationOverrides = {}) {
    if (!this.store) {
      return { success: false, error: 'Data store not available' };
    }

    const invoice = this.store.getInterCompanyInvoice(invoiceId);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.receiver_company_id !== companyId) {
      return { success: false, error: 'This invoice was not sent to your company' };
    }

    if (invoice.receiver_status !== 'pending') {
      return { success: false, error: `Invoice already ${invoice.receiver_status}` };
    }

    // Update invoice status
    this.store.updateInterCompanyInvoice(invoiceId, {
      receiver_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: allocationOverrides.userId || null
    });

    // Create bank transaction entries (creditor entries) in receiving company's books
    const transactions = [];
    for (const item of (invoice.line_items || [])) {
      const category = allocationOverrides[item.lineNumber] ||
                       this.suggestCategory(item.description);

      const txn = {
        company_id: companyId,
        date: invoice.date,
        description: `${invoice.invoice_number} - ${item.description}`,
        amount: -(item.lineTotal || 0),  // Negative = expense/creditor
        type: 'debit',
        merchant: `Company ${invoice.sender_company_id}`,
        suggested_category: category,
        confirmed_category: allocationOverrides[item.lineNumber] ? category : null,
        confidence: allocationOverrides[item.lineNumber] ? 1.0 : 0.7,
        match_type: allocationOverrides[item.lineNumber] ? 'user' : 'inter_company',
        allocated_by: allocationOverrides[item.lineNumber] ? 'user' : null,
        inter_company_invoice_id: invoiceId,
        reference: invoice.invoice_number
      };

      if (this.store.addBankTransaction) {
        const saved = this.store.addBankTransaction(txn);
        transactions.push(saved);
      }
    }

    return {
      success: true,
      message: `Invoice ${invoice.invoice_number} approved. ${transactions.length} creditor entries created.`,
      transactions: transactions.length,
      invoiceId,
      total: invoice.total
    };
  }

  /**
   * Reject a received invoice
   */
  async reject(invoiceId, companyId, reason = '') {
    if (!this.store) {
      return { success: false, error: 'Data store not available' };
    }

    const invoice = this.store.getInterCompanyInvoice(invoiceId);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.receiver_company_id !== companyId) {
      return { success: false, error: 'This invoice was not sent to your company' };
    }

    this.store.updateInterCompanyInvoice(invoiceId, {
      receiver_status: 'rejected',
      rejection_reason: reason,
      rejected_at: new Date().toISOString()
    });

    return {
      success: true,
      message: `Invoice ${invoice.invoice_number} rejected.`,
      reason
    };
  }

  /**
   * Suggest allocation category for an invoice line item
   */
  suggestCategory(description) {
    const result = suggestCategoryLocal(description || '', 0, []);
    return result.category || 'CREDITOR_PAYMENT';
  }

  /**
   * Suggest allocations for all line items in an invoice
   */
  suggestAllocations(invoice) {
    if (!invoice.line_items || invoice.line_items.length === 0) return [];

    return invoice.line_items.map(item => ({
      lineNumber: item.lineNumber,
      description: item.description,
      suggestedCategory: this.suggestCategory(item.description),
      confidence: 0.7
    }));
  }
}

module.exports = InvoiceReceiver;
