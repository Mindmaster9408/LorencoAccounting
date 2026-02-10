/**
 * ============================================================================
 * INTER-COMPANY — Invoice Sender
 * ============================================================================
 * Company A creates an invoice for Company B.
 * The invoice automatically appears in Company B's inbox.
 *
 * Flow:
 *   1. Company A creates invoice (with line items, VAT, total)
 *   2. System validates the relationship is active
 *   3. Invoice is stored with status 'sent'
 *   4. Company B sees it in their inbox as 'pending'
 *   5. Auto-creates a creditor entry in Company B's books
 *
 * SA-specific:
 *   - 15% VAT handling
 *   - Rand (ZAR) currency
 *   - SA invoice format (company reg, VAT number, etc.)
 * ============================================================================
 */

class InvoiceSender {

  /**
   * @param {object} dataStore - Mock or real data store
   */
  constructor(dataStore) {
    this.store = dataStore;
  }

  /**
   * Create and send an invoice to another company on the platform
   * @param {object} invoiceData
   * @param {number} invoiceData.senderCompanyId - Company creating the invoice
   * @param {number} invoiceData.receiverCompanyId - Company receiving the invoice
   * @param {string} invoiceData.invoiceNumber - Invoice number (e.g., INV-2025-001)
   * @param {string} invoiceData.date - Invoice date (YYYY-MM-DD)
   * @param {string} [invoiceData.dueDate] - Payment due date
   * @param {Array<object>} invoiceData.lineItems - Invoice line items
   * @param {string} [invoiceData.notes] - Additional notes
   * @param {boolean} [invoiceData.includesVAT=true] - Whether amounts include VAT
   * @returns {Promise<object>}
   */
  async send(invoiceData) {
    const {
      senderCompanyId,
      receiverCompanyId,
      invoiceNumber,
      date,
      dueDate,
      lineItems = [],
      notes = '',
      includesVAT = true
    } = invoiceData;

    // Validate required fields
    const errors = [];
    if (!senderCompanyId) errors.push('senderCompanyId is required');
    if (!receiverCompanyId) errors.push('receiverCompanyId is required');
    if (!invoiceNumber) errors.push('invoiceNumber is required');
    if (!date) errors.push('date is required');
    if (!lineItems || lineItems.length === 0) errors.push('At least one line item is required');

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Validate relationship exists and is active
    if (this.store && this.store.findRelationship) {
      const rel = this.store.findRelationship(senderCompanyId, receiverCompanyId);
      if (!rel || rel.status !== 'active') {
        return {
          success: false,
          errors: ['No active relationship with this company. Create a relationship first.']
        };
      }
    }

    // Calculate totals
    const calculated = this.calculateTotals(lineItems, includesVAT);

    // Create the invoice
    const invoice = {
      sender_company_id: senderCompanyId,
      receiver_company_id: receiverCompanyId,
      invoice_number: invoiceNumber,
      date,
      due_date: dueDate || this.addDays(date, 30),
      line_items: calculated.lineItems,
      subtotal: calculated.subtotal,
      vat_amount: calculated.vatAmount,
      total: calculated.total,
      includes_vat: includesVAT,
      notes,
      status: 'sent',
      sender_status: 'sent',         // Sender sees: sent → paid
      receiver_status: 'pending',     // Receiver sees: pending → approved → paid
      payment_status: 'unpaid',       // unpaid → partial → paid
      amount_paid: 0,
      created_at: new Date().toISOString()
    };

    // Store it
    let savedInvoice = invoice;
    if (this.store && this.store.addInterCompanyInvoice) {
      savedInvoice = this.store.addInterCompanyInvoice(invoice);
    }

    return {
      success: true,
      invoice: savedInvoice,
      message: `Invoice ${invoiceNumber} sent to company ${receiverCompanyId}. It will appear in their inbox.`,
      summary: {
        invoiceNumber,
        subtotal: calculated.subtotal,
        vat: calculated.vatAmount,
        total: calculated.total,
        dueDate: invoice.due_date,
        lineItemCount: lineItems.length
      }
    };
  }

  /**
   * Calculate invoice totals
   */
  calculateTotals(lineItems, includesVAT) {
    const VAT_RATE = 0.15;
    let subtotal = 0;
    let vatAmount = 0;

    const processedItems = lineItems.map((item, index) => {
      const qty = item.quantity || 1;
      const unitPrice = parseFloat(item.unitPrice || item.unit_price || 0);
      const lineTotal = Math.round(qty * unitPrice * 100) / 100;

      let lineExcl, lineVAT;
      if (includesVAT) {
        lineExcl = Math.round((lineTotal / (1 + VAT_RATE)) * 100) / 100;
        lineVAT = Math.round((lineTotal - lineExcl) * 100) / 100;
      } else {
        lineExcl = lineTotal;
        lineVAT = Math.round(lineTotal * VAT_RATE * 100) / 100;
      }

      subtotal += lineExcl;
      vatAmount += lineVAT;

      return {
        lineNumber: index + 1,
        description: item.description || '',
        quantity: qty,
        unitPrice,
        lineTotal,
        exclusiveAmount: lineExcl,
        vatAmount: lineVAT,
        account: item.account || null
      };
    });

    subtotal = Math.round(subtotal * 100) / 100;
    vatAmount = Math.round(vatAmount * 100) / 100;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;

    return {
      lineItems: processedItems,
      subtotal,
      vatAmount,
      total
    };
  }

  /**
   * Get sent invoices for a company
   */
  async getSentInvoices(companyId) {
    if (!this.store || !this.store.getInterCompanyInvoices) {
      return [];
    }
    return this.store.getInterCompanyInvoices(companyId, 'sent');
  }

  /**
   * Add days to a date string
   */
  addDays(dateStr, days) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }
}

module.exports = InvoiceSender;
