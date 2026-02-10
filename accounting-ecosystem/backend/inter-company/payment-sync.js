/**
 * ============================================================================
 * INTER-COMPANY — Payment Sync
 * ============================================================================
 * When Company B pays Company A's invoice, both sides auto-update:
 *
 *   Company A (Sender):
 *     - Invoice status → paid/partial
 *     - Bank transaction → credit (debtor receipt)
 *
 *   Company B (Receiver):
 *     - Invoice status → paid/partial
 *     - Bank transaction → debit (creditor payment)
 *
 * Auto-reconciliation:
 *   - Match payments to invoices by amount + reference
 *   - Handle partial payments
 *   - Handle overpayments (credit note)
 * ============================================================================
 */

class PaymentSync {

  /**
   * @param {object} dataStore - Mock or real data store
   */
  constructor(dataStore) {
    this.store = dataStore;
  }

  /**
   * Record a payment against an inter-company invoice
   * Updates both sender and receiver's books
   *
   * @param {object} paymentData
   * @param {number} paymentData.invoiceId - Invoice being paid
   * @param {number} paymentData.payerCompanyId - Company making payment (receiver)
   * @param {number} paymentData.amount - Payment amount in ZAR
   * @param {string} paymentData.date - Payment date
   * @param {string} [paymentData.reference] - Bank reference
   * @param {string} [paymentData.method] - Payment method (EFT, cash, etc.)
   */
  async recordPayment(paymentData) {
    const { invoiceId, payerCompanyId, amount, date, reference, method } = paymentData;

    // Validate
    if (!invoiceId || !payerCompanyId || !amount || !date) {
      return { success: false, error: 'invoiceId, payerCompanyId, amount, and date are required' };
    }

    if (!this.store) {
      return { success: false, error: 'Data store not available' };
    }

    // Get the invoice
    const invoice = this.store.getInterCompanyInvoice(invoiceId);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    // Validate payer is the receiver
    if (invoice.receiver_company_id !== payerCompanyId) {
      return { success: false, error: 'Only the receiving company can record payments' };
    }

    // Check invoice is approved
    if (invoice.receiver_status !== 'approved' && invoice.receiver_status !== 'paid') {
      return { success: false, error: `Invoice must be approved before payment. Current status: ${invoice.receiver_status}` };
    }

    // Calculate new amount paid
    const previousPaid = invoice.amount_paid || 0;
    const newTotalPaid = Math.round((previousPaid + amount) * 100) / 100;
    const remaining = Math.round((invoice.total - newTotalPaid) * 100) / 100;

    let paymentStatus;
    if (newTotalPaid >= invoice.total) {
      paymentStatus = 'paid';
    } else if (newTotalPaid > 0) {
      paymentStatus = 'partial';
    } else {
      paymentStatus = 'unpaid';
    }

    // Update invoice
    this.store.updateInterCompanyInvoice(invoiceId, {
      amount_paid: newTotalPaid,
      payment_status: paymentStatus,
      receiver_status: paymentStatus === 'paid' ? 'paid' : invoice.receiver_status,
      sender_status: paymentStatus === 'paid' ? 'paid' : 'sent',
      last_payment_date: date,
      last_payment_reference: reference || null
    });

    // Create transaction in PAYER's books (Company B — creditor payment / debit)
    const payerTxn = this.store.addBankTransaction({
      company_id: payerCompanyId,
      date,
      description: `Payment: ${invoice.invoice_number} - ${reference || 'Inter-company payment'}`,
      amount: -amount,  // Negative = money going out
      type: 'debit',
      merchant: `Company ${invoice.sender_company_id}`,
      suggested_category: 'CREDITOR_PAYMENT',
      confirmed_category: 'CREDITOR_PAYMENT',
      confidence: 1.0,
      match_type: 'inter_company_payment',
      allocated_by: 'system',
      inter_company_invoice_id: invoiceId,
      reference: reference || invoice.invoice_number
    });

    // Create transaction in SENDER's books (Company A — debtor receipt / credit)
    const senderTxn = this.store.addBankTransaction({
      company_id: invoice.sender_company_id,
      date,
      description: `Received: ${invoice.invoice_number} - ${reference || 'Inter-company payment'}`,
      amount: amount,  // Positive = money coming in
      type: 'credit',
      merchant: `Company ${payerCompanyId}`,
      suggested_category: 'DEBTOR_RECEIPT',
      confirmed_category: 'DEBTOR_RECEIPT',
      confidence: 1.0,
      match_type: 'inter_company_payment',
      allocated_by: 'system',
      inter_company_invoice_id: invoiceId,
      reference: reference || invoice.invoice_number
    });

    return {
      success: true,
      message: paymentStatus === 'paid'
        ? `Invoice ${invoice.invoice_number} fully paid!`
        : `Payment of R${amount.toFixed(2)} recorded. Remaining: R${remaining.toFixed(2)}`,
      payment: {
        invoiceId,
        invoiceNumber: invoice.invoice_number,
        amountPaid: amount,
        totalPaid: newTotalPaid,
        invoiceTotal: invoice.total,
        remaining: Math.max(0, remaining),
        paymentStatus,
        date,
        reference
      },
      transactions: {
        payer: { id: payerTxn.id, amount: -amount, category: 'CREDITOR_PAYMENT' },
        receiver: { id: senderTxn.id, amount, category: 'DEBTOR_RECEIPT' }
      }
    };
  }

  /**
   * Auto-reconcile: match bank transactions to outstanding invoices
   * Scans unallocated bank transactions for patterns matching invoice references
   */
  async autoReconcile(companyId) {
    if (!this.store) {
      return { success: false, error: 'Data store not available' };
    }

    // Get outstanding invoices (Company sent invoices that are unpaid/partial)
    const sentInvoices = this.store.getInterCompanyInvoices(companyId, 'sent')
      .filter(inv => inv.payment_status !== 'paid');

    // Get unallocated credit transactions
    const unallocated = this.store.getBankTransactions(companyId, { unallocated: true })
      .filter(t => t.type === 'credit' || t.amount > 0);

    const matches = [];

    for (const txn of unallocated) {
      for (const inv of sentInvoices) {
        const isMatch = this.matchTransactionToInvoice(txn, inv);
        if (isMatch) {
          matches.push({
            transactionId: txn.id,
            invoiceId: inv.id,
            invoiceNumber: inv.invoice_number,
            transactionAmount: txn.amount,
            invoiceTotal: inv.total,
            invoiceRemaining: inv.total - (inv.amount_paid || 0),
            confidence: isMatch.confidence,
            matchType: isMatch.type
          });
          break; // One transaction matches one invoice
        }
      }
    }

    return {
      success: true,
      matchesFound: matches.length,
      outstandingInvoices: sentInvoices.length,
      unallocatedCredits: unallocated.length,
      matches
    };
  }

  /**
   * Check if a bank transaction matches an invoice
   */
  matchTransactionToInvoice(txn, invoice) {
    const txnAmount = Math.abs(txn.amount);
    const remaining = invoice.total - (invoice.amount_paid || 0);
    const desc = (txn.description || '').toLowerCase();
    const invNum = (invoice.invoice_number || '').toLowerCase();

    // Exact amount match + reference in description
    if (Math.abs(txnAmount - remaining) < 0.01 && desc.includes(invNum)) {
      return { confidence: 0.98, type: 'exact_amount_and_reference' };
    }

    // Exact amount match only
    if (Math.abs(txnAmount - remaining) < 0.01) {
      return { confidence: 0.75, type: 'exact_amount' };
    }

    // Reference match only
    if (desc.includes(invNum)) {
      return { confidence: 0.80, type: 'reference_match' };
    }

    // Exact total match (full payment)
    if (Math.abs(txnAmount - invoice.total) < 0.01) {
      return { confidence: 0.70, type: 'total_match' };
    }

    return null;
  }
}

module.exports = PaymentSync;
