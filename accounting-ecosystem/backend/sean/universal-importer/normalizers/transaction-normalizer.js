/**
 * ============================================================================
 * Transaction Normalizer — Converts detected layout → standard transactions
 * ============================================================================
 * Takes raw rows + layout descriptor and produces normalized transactions:
 *   { date, description, amount, type ('debit'|'credit'), reference, category, vat, balance }
 * ============================================================================
 */

class TransactionNormalizer {

  /**
   * Normalize raw rows using detected layout
   * @param {Array<Array>} rows   - All rows (including header)
   * @param {object} layout       - Layout descriptor from LayoutDetector
   * @returns {Array<object>}     - Normalized transactions
   */
  static normalize(rows, layout) {
    const dataRows = rows.slice(layout.dataStartRow || 0);
    const transactions = [];
    let lineNumber = 0;

    for (const row of dataRows) {
      lineNumber++;
      if (!row || row.length === 0) continue;

      try {
        const txn = this.normalizeRow(row, layout, lineNumber);
        if (txn && (txn.description || txn.amount !== 0)) {
          transactions.push(txn);
        }
      } catch (err) {
        // Skip malformed rows but log
        transactions.push({
          lineNumber,
          error: err.message,
          raw: row,
          _skip: true
        });
      }
    }

    return transactions.filter(t => !t._skip);
  }

  /**
   * Normalize a single row
   */
  static normalizeRow(row, layout, lineNumber) {
    const txn = {
      lineNumber,
      date: null,
      description: '',
      amount: 0,
      type: 'debit',     // 'debit' or 'credit'
      reference: '',
      category: '',
      vat: null,
      balance: null,
      raw: row
    };

    // ── Date ──
    if (layout.dateColumn !== null && row[layout.dateColumn] != null) {
      txn.date = this.parseDate(row[layout.dateColumn]);
    }

    // ── Description ──
    if (layout.descriptionColumn !== null && row[layout.descriptionColumn] != null) {
      txn.description = String(row[layout.descriptionColumn]).trim();
    }

    // ── Amount ──
    if (layout.amountColumn !== null) {
      // Single amount column (positive = credit, negative = debit)
      const amount = this.parseAmount(row[layout.amountColumn]);
      txn.amount = Math.abs(amount);
      txn.type = amount < 0 ? 'debit' : 'credit';
    } else {
      // Separate debit/credit columns
      const debit = layout.debitColumn !== null ? this.parseAmount(row[layout.debitColumn]) : 0;
      const credit = layout.creditColumn !== null ? this.parseAmount(row[layout.creditColumn]) : 0;

      if (debit > 0 || (debit !== 0 && credit === 0)) {
        txn.amount = Math.abs(debit);
        txn.type = 'debit';
      } else if (credit > 0 || (credit !== 0 && debit === 0)) {
        txn.amount = Math.abs(credit);
        txn.type = 'credit';
      }
    }

    // ── Balance ──
    if (layout.balanceColumn !== null && row[layout.balanceColumn] != null) {
      txn.balance = this.parseAmount(row[layout.balanceColumn]);
    }

    // ── Reference ──
    if (layout.referenceColumn !== null && row[layout.referenceColumn] != null) {
      txn.reference = String(row[layout.referenceColumn]).trim();
    }

    // ── Category ──
    if (layout.categoryColumn !== null && row[layout.categoryColumn] != null) {
      txn.category = String(row[layout.categoryColumn]).trim();
    }

    // ── VAT ──
    if (layout.vatColumn !== null && row[layout.vatColumn] != null) {
      txn.vat = this.parseAmount(row[layout.vatColumn]);
    }

    // Skip rows that are just totals/headers
    if (this.isTotalRow(txn)) return null;

    return txn;
  }

  // ─── Date Parsing ─────────────────────────────────────────────────────────

  static parseDate(value) {
    if (!value) return null;
    const str = String(value).trim();

    // Already ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return str.split('T')[0];
    }

    // DD/MM/YYYY or DD-MM-YYYY (SA standard)
    const ddmmyyyy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (ddmmyyyy) {
      const [, d, m, y] = ddmmyyyy;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // DD/MM/YY
    const ddmmyy = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
    if (ddmmyy) {
      const [, d, m, y] = ddmmyy;
      const fullYear = parseInt(y) > 50 ? `19${y}` : `20${y}`;
      return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // YYYY/MM/DD
    const yyyymmdd = str.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (yyyymmdd) {
      const [, y, m, d] = yyyymmdd;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    // "15 Jan 2025" / "Jan 15, 2025"
    const months = {
      jan: '01', feb: '02', mar: '03', mrt: '03', apr: '04',
      may: '05', mei: '05', jun: '06', jul: '07', aug: '08',
      sep: '09', oct: '10', okt: '10', nov: '11', dec: '12', des: '12'
    };

    const textDate1 = str.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Mrt|Apr|May|Mei|Jun|Jul|Aug|Sep|Oct|Okt|Nov|Dec|Des)\w*\s+(\d{4})$/i);
    if (textDate1) {
      const [, d, m, y] = textDate1;
      return `${y}-${months[m.toLowerCase().slice(0, 3)]}-${d.padStart(2, '0')}`;
    }

    const textDate2 = str.match(/^(Jan|Feb|Mar|Mrt|Apr|May|Mei|Jun|Jul|Aug|Sep|Oct|Okt|Nov|Dec|Des)\w*\s+(\d{1,2}),?\s+(\d{4})$/i);
    if (textDate2) {
      const [, m, d, y] = textDate2;
      return `${y}-${months[m.toLowerCase().slice(0, 3)]}-${d.padStart(2, '0')}`;
    }

    // Excel serial date number
    const num = parseFloat(str);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const date = new Date((num - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }

    // Fallback: try Date.parse
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString().split('T')[0];
    }

    return str; // Return as-is if we can't parse
  }

  // ─── Amount Parsing ────────────────────────────────────────────────────────

  static parseAmount(value) {
    if (value === null || value === undefined || value === '') return 0;
    const str = String(value).trim();
    if (str === '' || str === '-') return 0;

    // Handle parentheses as negative: (1,234.56) → -1234.56
    let negative = false;
    let cleaned = str;
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      negative = true;
      cleaned = cleaned.slice(1, -1);
    }
    if (cleaned.startsWith('-')) {
      negative = true;
      cleaned = cleaned.slice(1);
    }

    // Remove currency symbols, spaces
    cleaned = cleaned.replace(/[R$€£¥\s]/g, '');

    // Handle SA number format: 1 234 567,89 (spaces as thousands, comma as decimal)
    if (/\d{1,3}(\s\d{3})+,\d{2}$/.test(cleaned)) {
      cleaned = cleaned.replace(/\s/g, '').replace(',', '.');
    }
    // Handle: 1,234,567.89 (commas as thousands, dot as decimal)
    else if (/\d{1,3}(,\d{3})+\.\d{2}$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, '');
    }
    // Handle: 1.234.567,89 (dots as thousands, comma as decimal)
    else if (/\d{1,3}(\.\d{3})+,\d{2}$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
    // Simple comma as decimal: 1234,56
    else if (/^\d+,\d{2}$/.test(cleaned)) {
      cleaned = cleaned.replace(',', '.');
    }
    // Remove remaining commas (thousands separators)
    else {
      cleaned = cleaned.replace(/,/g, '');
    }

    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return negative ? -num : num;
  }

  // ─── Total Row Detection ──────────────────────────────────────────────────

  static isTotalRow(txn) {
    const desc = (txn.description || '').toLowerCase();
    const totalKeywords = [
      'total', 'totaal', 'sub-total', 'subtotal', 'sub total',
      'grand total', 'groot totaal', 'balance forward', 'balans vooruit',
      'opening balance', 'openingsbalans', 'closing balance', 'sluitingsbalans',
      'brought forward', 'carried forward', 'oorgedra'
    ];
    return totalKeywords.some(kw => desc.includes(kw));
  }
}

module.exports = TransactionNormalizer;
