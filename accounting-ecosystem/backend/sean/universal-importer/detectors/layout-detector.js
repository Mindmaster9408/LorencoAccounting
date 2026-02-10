/**
 * ============================================================================
 * Layout Detector — Intelligently identifies column structure
 * ============================================================================
 * Analyzes sample rows to detect which columns contain:
 *   - Dates, Descriptions, Debit/Credit amounts, Balance, References
 *
 * Uses heuristics, pattern matching, and SA-specific knowledge.
 * Handles Afrikaans & English column headers.
 * ============================================================================
 */

class LayoutDetector {

  /**
   * Detect column layout from parsed rows
   * @param {Array<Array>} rows   - 2D array of cell values
   * @param {object} options      - { companyId, fileName, sampleSize }
   * @returns {object} layout descriptor
   */
  static detectLayout(rows, options = {}) {
    if (!rows || rows.length < 2) {
      return { confidence: 0, error: 'Not enough rows to detect layout' };
    }

    const sampleSize = Math.min(options.sampleSize || 20, rows.length);

    // Step 1: Check if first row is a header
    const headerInfo = this.detectHeaderRow(rows);
    const headerRow = headerInfo.headerRow;
    const dataRows = rows.slice(headerInfo.dataStartRow, headerInfo.dataStartRow + sampleSize);

    const layout = {
      headerRow: headerInfo.headerRow,
      headerRowIndex: headerInfo.headerRowIndex,
      dataStartRow: headerInfo.dataStartRow,
      dateColumn: null,
      descriptionColumn: null,
      debitColumn: null,
      creditColumn: null,
      amountColumn: null,
      balanceColumn: null,
      referenceColumn: null,
      categoryColumn: null,
      vatColumn: null,
      columnCount: (rows[0] || []).length,
      confidence: 0,
      detectedColumns: {}
    };

    if (dataRows.length === 0) {
      return layout;
    }

    // Step 2: Try header-based detection first (most reliable)
    if (headerRow) {
      this.detectFromHeaders(headerRow, layout);
    }

    // Step 3: Content-based detection (fills in what headers missed)
    this.detectFromContent(dataRows, layout);

    // Step 4: Calculate overall confidence
    layout.confidence = this.calculateConfidence(layout);

    return layout;
  }

  // ─── Header Row Detection ────────────────────────────────────────────────

  static detectHeaderRow(rows) {
    // Try first 5 rows to find the header
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const textCells = row.filter(cell => {
        const val = String(cell || '').trim();
        return val.length > 0 && isNaN(parseFloat(val.replace(/[R$,\s]/g, '')));
      });

      // If most cells are text, likely a header
      const nonEmptyCells = row.filter(cell => String(cell || '').trim().length > 0);
      if (textCells.length >= nonEmptyCells.length * 0.6 && nonEmptyCells.length >= 2) {
        // Check for known header keywords
        const rowText = row.map(c => String(c || '').toLowerCase()).join(' ');
        const headerKeywords = [
          'date', 'datum', 'description', 'beskrywing', 'amount', 'bedrag',
          'debit', 'credit', 'krediet', 'balance', 'balans', 'saldo',
          'reference', 'verwysing', 'ref', 'category', 'kategorie',
          'vat', 'btw', 'total', 'totaal', 'account', 'rekening'
        ];

        const matchCount = headerKeywords.filter(kw => rowText.includes(kw)).length;
        if (matchCount >= 2 || (nonEmptyCells.length >= 3 && textCells.length >= nonEmptyCells.length * 0.8)) {
          return {
            headerRow: row.map(c => String(c || '').trim()),
            headerRowIndex: i,
            dataStartRow: i + 1
          };
        }
      }
    }

    // No header found — assume row 0 is data
    return { headerRow: null, headerRowIndex: -1, dataStartRow: 0 };
  }

  // ─── Header-Based Column Detection ───────────────────────────────────────

  static detectFromHeaders(headerRow, layout) {
    const dateHeaders = [
      'date', 'datum', 'transaction date', 'trans date', 'transaksie datum',
      'posting date', 'value date', 'boekingsdatum', 'day', 'dag'
    ];
    const descHeaders = [
      'description', 'beskrywing', 'details', 'besonderhede', 'narrative',
      'transaction', 'transaksie', 'particulars', 'memo', 'note',
      'payment to', 'betaling aan', 'supplier', 'verskaffer', 'payee'
    ];
    const debitHeaders = [
      'debit', 'debiet', 'payment', 'betaling', 'expense', 'uitgawe',
      'withdrawal', 'onttrekking', 'uit', 'out', 'paid', 'betaal',
      'payments', 'betalings', 'money out', 'geld uit', 'cheque'
    ];
    const creditHeaders = [
      'credit', 'krediet', 'receipt', 'ontvangste', 'income', 'inkomste',
      'deposit', 'deposito', 'in', 'received', 'ontvang', 'receipts',
      'money in', 'geld in'
    ];
    const amountHeaders = [
      'amount', 'bedrag', 'total', 'totaal', 'value', 'waarde',
      'net amount', 'netto bedrag'
    ];
    const balanceHeaders = [
      'balance', 'balans', 'saldo', 'running balance', 'lopende balans',
      'closing balance', 'sluitingsbalans', 'running total'
    ];
    const refHeaders = [
      'reference', 'verwysing', 'ref', 'ref no', 'ref nr', 'number',
      'nommer', 'invoice', 'faktuur', 'cheque no', 'tjek nr', 'doc no'
    ];
    const categoryHeaders = [
      'category', 'kategorie', 'account', 'rekening', 'gl account',
      'gl rekening', 'allocation', 'toewysing', 'type', 'tipe', 'code'
    ];
    const vatHeaders = [
      'vat', 'btw', 'tax', 'belasting', 'vat amount', 'btw bedrag',
      'vat %', 'btw %'
    ];

    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i].toLowerCase().trim();
      if (!h) continue;

      if (!layout.dateColumn && dateHeaders.some(dh => h.includes(dh)))              { layout.dateColumn = i;        layout.detectedColumns[i] = 'date'; }
      else if (!layout.descriptionColumn && descHeaders.some(dh => h.includes(dh)))  { layout.descriptionColumn = i;  layout.detectedColumns[i] = 'description'; }
      else if (!layout.debitColumn && debitHeaders.some(dh => h.includes(dh)))        { layout.debitColumn = i;        layout.detectedColumns[i] = 'debit'; }
      else if (!layout.creditColumn && creditHeaders.some(dh => h.includes(dh)))     { layout.creditColumn = i;       layout.detectedColumns[i] = 'credit'; }
      else if (!layout.amountColumn && amountHeaders.some(dh => h.includes(dh)))     { layout.amountColumn = i;       layout.detectedColumns[i] = 'amount'; }
      else if (!layout.balanceColumn && balanceHeaders.some(dh => h.includes(dh)))   { layout.balanceColumn = i;      layout.detectedColumns[i] = 'balance'; }
      else if (!layout.referenceColumn && refHeaders.some(dh => h.includes(dh)))     { layout.referenceColumn = i;    layout.detectedColumns[i] = 'reference'; }
      else if (!layout.categoryColumn && categoryHeaders.some(dh => h.includes(dh))) { layout.categoryColumn = i;     layout.detectedColumns[i] = 'category'; }
      else if (!layout.vatColumn && vatHeaders.some(dh => h.includes(dh)))           { layout.vatColumn = i;          layout.detectedColumns[i] = 'vat'; }
    }
  }

  // ─── Content-Based Column Detection ──────────────────────────────────────

  static detectFromContent(dataRows, layout) {
    if (dataRows.length === 0) return;
    const colCount = Math.max(...dataRows.map(r => (r || []).length));

    for (let col = 0; col < colCount; col++) {
      if (layout.detectedColumns[col]) continue; // Already detected by header

      const values = dataRows.map(r => (r && r[col] != null) ? String(r[col]).trim() : '').filter(v => v.length > 0);
      if (values.length === 0) continue;

      // Try date detection
      if (layout.dateColumn === null) {
        const dateScore = this.scoreDateColumn(values);
        if (dateScore > 0.6) {
          layout.dateColumn = col;
          layout.detectedColumns[col] = 'date';
          continue;
        }
      }

      // Try numeric detection (amount/debit/credit/balance)
      const numericScore = this.scoreNumericColumn(values);
      if (numericScore > 0.5) {
        // Determine which numeric column this is
        if (layout.amountColumn === null && layout.debitColumn === null) {
          // Check if values are all positive, all negative, or mixed
          const nums = values.map(v => parseFloat(v.replace(/[R$,\s()]/g, ''))).filter(n => !isNaN(n));
          const negCount = nums.filter(n => n < 0).length;
          const posCount = nums.filter(n => n > 0).length;
          const zeroes = nums.filter(n => n === 0).length;

          if (negCount > 0 && posCount > 0) {
            // Mixed signs → single amount column
            layout.amountColumn = col;
            layout.detectedColumns[col] = 'amount';
          } else if (zeroes > nums.length * 0.3) {
            // Lots of zeroes → likely debit or credit column (other column has the value)
            if (layout.debitColumn === null) {
              layout.debitColumn = col;
              layout.detectedColumns[col] = 'debit';
            } else if (layout.creditColumn === null) {
              layout.creditColumn = col;
              layout.detectedColumns[col] = 'credit';
            }
          } else {
            if (layout.debitColumn === null) {
              layout.debitColumn = col;
              layout.detectedColumns[col] = 'debit';
            } else if (layout.creditColumn === null) {
              layout.creditColumn = col;
              layout.detectedColumns[col] = 'credit';
            } else if (layout.balanceColumn === null) {
              layout.balanceColumn = col;
              layout.detectedColumns[col] = 'balance';
            }
          }
          continue;
        } else if (layout.creditColumn === null && layout.debitColumn !== null) {
          layout.creditColumn = col;
          layout.detectedColumns[col] = 'credit';
          continue;
        } else if (layout.balanceColumn === null) {
          layout.balanceColumn = col;
          layout.detectedColumns[col] = 'balance';
          continue;
        }
      }

      // Try description detection (long text with letters)
      if (layout.descriptionColumn === null) {
        const textScore = this.scoreTextColumn(values);
        if (textScore > 0.6) {
          layout.descriptionColumn = col;
          layout.detectedColumns[col] = 'description';
        }
      }
    }
  }

  // ─── Column Scorers ──────────────────────────────────────────────────────

  static scoreDateColumn(values) {
    const datePatterns = [
      /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/,           // 2025-01-15
      /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/,          // 15/01/2025 or 15-01-25
      /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des)/i,
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mrt|Mei|Okt|Des)\s+\d{1,2}/i,
      /^\d{5}$/,  // Excel serial date (e.g., 45670)
    ];

    let matches = 0;
    for (const v of values) {
      if (datePatterns.some(p => p.test(v))) matches++;
      // Check if it's an Excel serial date number
      else if (!isNaN(v) && parseInt(v) > 30000 && parseInt(v) < 60000) matches++;
      // Check if Date constructor can parse it
      else if (!isNaN(Date.parse(v)) && v.length >= 6) matches++;
    }
    return matches / values.length;
  }

  static scoreNumericColumn(values) {
    let matches = 0;
    for (const v of values) {
      const cleaned = v.replace(/[R$,\s()]/g, '').replace(/^-/, '');
      if (!isNaN(parseFloat(cleaned)) && cleaned.length > 0) matches++;
    }
    return matches / values.length;
  }

  static scoreTextColumn(values) {
    let textCount = 0;
    let totalLen = 0;
    for (const v of values) {
      if (/[a-zA-Z]/.test(v) && v.length > 3) textCount++;
      totalLen += v.length;
    }
    const avgLen = totalLen / values.length;
    // Description columns usually have avg length > 5 and mostly contain letters
    return (textCount / values.length) * (avgLen > 5 ? 1 : 0.5);
  }

  // ─── Confidence Calculator ───────────────────────────────────────────────

  static calculateConfidence(layout) {
    let score = 0;
    if (layout.dateColumn !== null) score += 25;
    if (layout.descriptionColumn !== null) score += 25;
    if (layout.amountColumn !== null) score += 30;
    else if (layout.debitColumn !== null && layout.creditColumn !== null) score += 30;
    else if (layout.debitColumn !== null || layout.creditColumn !== null) score += 15;
    if (layout.balanceColumn !== null) score += 10;
    if (layout.referenceColumn !== null) score += 5;
    if (layout.categoryColumn !== null) score += 5;
    return score;
  }
}

module.exports = LayoutDetector;
