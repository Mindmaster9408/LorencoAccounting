/**
 * ============================================================================
 * UNIVERSAL CASH BOOK IMPORTER — Main Orchestrator
 * ============================================================================
 * Upload ANY Excel / CSV cash book → SEAN extracts & allocates everything.
 *
 * Pipeline:
 *   1. FORMAT DETECTION — What type of file? (Excel, CSV, PDF, Image)
 *   2. PARSING — Extract raw data from the file
 *   3. LAYOUT DETECTION — Which column is what? (date, description, debit...)
 *   4. BANK DETECTION — Which SA bank format?
 *   5. NORMALIZATION — Convert raw rows → standard transactions
 *   6. VALIDATION — Check for balance, missing data
 *   7. DUPLICATE DETECTION — Don't import twice
 *   8. BATCH ALLOCATION — SEAN allocates every transaction
 *   9. JOURNAL CREATION — Generate double-entry journals
 *
 * Works with:
 *   ✅ FNB, ABSA, Nedbank, Standard Bank, Capitec, Investec statements
 *   ✅ Any custom cash book spreadsheet (Afrikaans or English)
 *   ✅ CSV with any delimiter (comma, semicolon, tab, pipe)
 *   ✅ Multi-sheet Excel workbooks
 *   ✅ SA date formats (DD/MM/YYYY, Afrikaans months)
 *   ✅ SA number formats (R 1 234,56 or 1,234.56)
 *
 * Zero external API calls. 100% local intelligence.
 * ============================================================================
 */

const FormatDetector = require('./detectors/format-detector');
const LayoutDetector = require('./detectors/layout-detector');
const BankDetector = require('./detectors/bank-detector');
const ExcelParser = require('./parsers/excel-parser');
const CSVParser = require('./parsers/csv-parser');
const TransactionNormalizer = require('./normalizers/transaction-normalizer');
const BalanceValidator = require('./validators/balance-validator');
const DuplicateDetector = require('./validators/duplicate-detector');
const BatchAllocator = require('./processors/batch-allocator');
const JournalCreator = require('./processors/journal-creator');

class UniversalImporter {

  /**
   * @param {object} options
   * @param {number} options.companyId
   * @param {object} [options.decisionEngine] - SeanDecisionEngine instance
   * @param {object} [options.dataStore] - Mock or real data store
   * @param {number} [options.autoConfirmThreshold] - Confidence % for auto-confirm (default 85)
   * @param {boolean} [options.extractVAT] - Extract VAT at 15% (default true)
   * @param {boolean} [options.createJournals] - Create journal entries (default true)
   * @param {boolean} [options.checkDuplicates] - Check for duplicates (default true)
   */
  constructor(options = {}) {
    this.companyId = options.companyId || 1;
    this.decisionEngine = options.decisionEngine || null;
    this.dataStore = options.dataStore || null;
    this.autoConfirmThreshold = options.autoConfirmThreshold || 85;
    this.extractVAT = options.extractVAT !== false;
    this.createJournals = options.createJournals !== false;
    this.checkDuplicates = options.checkDuplicates !== false;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * MAIN IMPORT METHOD — The full pipeline
   * ═══════════════════════════════════════════════════════════════════════
   */
  async import(fileBuffer, originalFilename) {
    const startTime = Date.now();
    const result = {
      success: false,
      importId: `IMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      filename: originalFilename,
      pipeline: {},
      transactions: [],
      journals: [],
      summary: {},
      errors: [],
      warnings: [],
      timing: {}
    };

    try {

      // ── STEP 1: FORMAT DETECTION ──────────────────────────────────────
      const formatStart = Date.now();
      const format = FormatDetector.detect(fileBuffer, originalFilename);
      result.pipeline.format = format;
      result.timing.formatDetection = Date.now() - formatStart;

      if (!['excel', 'csv'].includes(format.type)) {
        result.errors.push(`Unsupported file type: ${format.type}. Only Excel (.xlsx, .xls) and CSV files are supported.`);
        return result;
      }

      // ── STEP 2: PARSING ───────────────────────────────────────────────
      const parseStart = Date.now();
      let rawData;

      if (format.type === 'excel') {
        rawData = ExcelParser.parse(fileBuffer);
      } else if (format.type === 'csv') {
        rawData = CSVParser.parse(fileBuffer);
      }
      result.timing.parsing = Date.now() - parseStart;

      if (!rawData || !rawData.rows || rawData.rows.length === 0) {
        result.errors.push('No data found in file. The file appears to be empty.');
        return result;
      }

      result.pipeline.parsing = {
        rows: rawData.rows.length,
        sheets: rawData.sheets || 1
      };

      // ── STEP 3: LAYOUT DETECTION ──────────────────────────────────────
      const layoutStart = Date.now();
      const layout = LayoutDetector.detectLayout(rawData.rows);
      result.pipeline.layout = layout;
      result.timing.layoutDetection = Date.now() - layoutStart;

      if (!layout.dateColumn && layout.dateColumn !== 0) {
        result.warnings.push('Could not detect a date column — dates may be missing.');
      }
      if (layout.descriptionColumn === null && layout.descriptionColumn !== 0) {
        result.warnings.push('Could not detect a description column — descriptions may be missing.');
      }

      // ── STEP 4: BANK DETECTION ────────────────────────────────────────
      const bankStart = Date.now();
      const headerRow = layout.headerRow || rawData.rows[0] || [];
      const sampleRows = rawData.rows.slice(layout.dataStartRow || 1, (layout.dataStartRow || 1) + 5);
      const bank = BankDetector.detect(headerRow, sampleRows, originalFilename);
      result.pipeline.bank = bank;
      result.timing.bankDetection = Date.now() - bankStart;

      // ── STEP 5: NORMALIZATION ─────────────────────────────────────────
      const normalizeStart = Date.now();
      // Pass ALL rows — normalizer uses layout.dataStartRow to skip headers itself
      const normalizedTxns = TransactionNormalizer.normalize(rawData.rows, layout);
      result.timing.normalization = Date.now() - normalizeStart;

      if (!normalizedTxns || normalizedTxns.length === 0) {
        result.errors.push('No transactions could be extracted from the file.');
        return result;
      }

      result.pipeline.normalization = {
        transactionsExtracted: normalizedTxns.length,
        skippedRows: rawData.rows.length - normalizedTxns.length - (layout.dataStartRow || 1),
        dateRange: normalizedTxns.length > 0 ? {
          from: normalizedTxns[0].date,
          to: normalizedTxns[normalizedTxns.length - 1].date
        } : null
      };

      // ── STEP 6: VALIDATION ────────────────────────────────────────────
      const validateStart = Date.now();
      const validation = BalanceValidator.validate(normalizedTxns);
      result.pipeline.validation = validation;
      result.timing.validation = Date.now() - validateStart;

      if (validation.errors && validation.errors.length > 0) {
        result.warnings.push(...validation.errors.map(e => `Validation: ${e}`));
      }

      // ── STEP 7: DUPLICATE DETECTION ───────────────────────────────────
      let transactionsToProcess = normalizedTxns;

      if (this.checkDuplicates && this.dataStore) {
        const dupeStart = Date.now();
        let existingTransactions = [];
        try {
          existingTransactions = this.dataStore.getBankTransactions(this.companyId);
        } catch (e) { /* no existing data */ }

        const dupeResult = DuplicateDetector.detect(transactionsToProcess, existingTransactions);
        result.pipeline.duplicates = {
          exact: dupeResult.duplicates.length,
          fuzzy: dupeResult.warnings.length,
          unique: dupeResult.unique.length
        };
        result.timing.duplicateDetection = Date.now() - dupeStart;

        if (dupeResult.duplicates.length > 0) {
          result.warnings.push(`${dupeResult.duplicates.length} duplicate transaction(s) found and excluded.`);
        }
        if (dupeResult.warnings.length > 0) {
          result.warnings.push(`${dupeResult.warnings.length} possible duplicate(s) — please review.`);
        }

        transactionsToProcess = dupeResult.unique;
      }

      if (transactionsToProcess.length === 0) {
        result.errors.push('All transactions are duplicates — nothing to import.');
        return result;
      }

      // ── STEP 8: BATCH ALLOCATION ──────────────────────────────────────
      const allocateStart = Date.now();
      const allocation = await BatchAllocator.allocate(transactionsToProcess, {
        companyId: this.companyId,
        decisionEngine: this.decisionEngine,
        dataStore: this.dataStore,
        autoConfirmThreshold: this.autoConfirmThreshold
      });
      result.timing.allocation = Date.now() - allocateStart;

      result.pipeline.allocation = allocation.stats;
      result.transactions = [...allocation.allocated, ...allocation.needsReview];

      // ── STEP 9: JOURNAL CREATION ──────────────────────────────────────
      if (this.createJournals && allocation.allocated.length > 0) {
        const journalStart = Date.now();
        const journalResult = JournalCreator.create(allocation.allocated, {
          companyId: this.companyId,
          extractVAT: this.extractVAT,
          bankAccount: 'Bank',
          journal: 'CB'
        });
        result.timing.journalCreation = Date.now() - journalStart;

        result.journals = journalResult.journals;
        result.pipeline.journals = {
          created: journalResult.journals.length,
          allBalanced: journalResult.journals.every(j => j.balanced),
          vatSummary: journalResult.vatSummary,
          periodSummary: journalResult.periodSummary
        };
      }

      // ── STEP 10: STORE IMPORTED TRANSACTIONS ──────────────────────────
      if (this.dataStore) {
        const storeStart = Date.now();
        for (const txn of allocation.allocated) {
          try {
            this.dataStore.addBankTransaction({
              company_id: this.companyId,
              date: txn.date,
              description: txn.description,
              amount: txn.amount,
              type: txn.type,
              merchant: txn.description,
              suggested_category: txn.allocation?.suggestedCategory,
              confirmed_category: txn.confirmedCategory || null,
              confidence: (txn.allocation?.confidence || 0) / 100,
              match_type: txn.allocation?.method || 'import',
              allocated_by: txn.allocation?.autoConfirmed ? 'sean' : null,
              import_id: result.importId,
              reference: txn.reference || ''
            });
          } catch (e) {
            result.warnings.push(`Failed to store transaction: ${e.message}`);
          }
        }
        result.timing.storage = Date.now() - storeStart;
      }

      // ── BUILD SUMMARY ─────────────────────────────────────────────────
      result.success = true;
      result.summary = {
        filename: originalFilename,
        fileType: format.type,
        bank: bank.bank || 'Unknown',
        totalRows: rawData.rows.length,
        transactionsExtracted: normalizedTxns.length,
        duplicatesRemoved: normalizedTxns.length - transactionsToProcess.length,
        autoAllocated: allocation.stats.autoAllocated,
        needsReview: allocation.stats.needsReview,
        avgConfidence: allocation.stats.avgConfidence,
        journalsCreated: result.journals.length,
        topCategories: Object.entries(allocation.stats.byCategory)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([cat, count]) => ({ category: cat, count })),
        totalTime: Date.now() - startTime
      };

      // Log import
      if (this.dataStore && this.dataStore.addImportLog) {
        this.dataStore.addImportLog({
          company_id: this.companyId,
          import_id: result.importId,
          filename: originalFilename,
          file_type: format.type,
          bank_detected: bank.bank,
          total_rows: rawData.rows.length,
          transactions_extracted: normalizedTxns.length,
          auto_allocated: allocation.stats.autoAllocated,
          needs_review: allocation.stats.needsReview,
          journals_created: result.journals.length,
          status: 'completed',
          processing_time_ms: Date.now() - startTime
        });
      }

    } catch (error) {
      result.errors.push(`Import failed: ${error.message}`);
      result.summary.totalTime = Date.now() - startTime;

      // Log failed import
      if (this.dataStore && this.dataStore.addImportLog) {
        this.dataStore.addImportLog({
          company_id: this.companyId,
          import_id: result.importId,
          filename: originalFilename,
          status: 'failed',
          error: error.message,
          processing_time_ms: Date.now() - startTime
        });
      }
    }

    return result;
  }

  /**
   * Preview import without storing or creating journals
   * Quick preview — format + layout detection + first 10 rows
   */
  async preview(fileBuffer, originalFilename) {
    const format = FormatDetector.detect(fileBuffer, originalFilename);
    if (!['excel', 'csv'].includes(format.type)) {
      return { success: false, error: `Unsupported: ${format.type}` };
    }

    let rawData;
    if (format.type === 'excel') {
      rawData = ExcelParser.parse(fileBuffer);
    } else {
      rawData = CSVParser.parse(fileBuffer);
    }

    if (!rawData || !rawData.rows || rawData.rows.length === 0) {
      return { success: false, error: 'No data found' };
    }

    const layout = LayoutDetector.detectLayout(rawData.rows);
    const headerRow = layout.headerRow || rawData.rows[0] || [];
    const sampleRows = rawData.rows.slice(layout.dataStartRow || 1, (layout.dataStartRow || 1) + 5);
    const bank = BankDetector.detect(headerRow, sampleRows, originalFilename);
    // Pass all rows — normalizer handles slicing via layout.dataStartRow
    const previewTxns = TransactionNormalizer.normalize(rawData.rows, layout).slice(0, 10);

    return {
      success: true,
      format,
      layout,
      bank,
      totalRows: rawData.rows.length,
      headers: layout.headerRow || rawData.rows[0],
      sampleTransactions: previewTxns,
      columns: layout.detectedColumns
    };
  }

  /**
   * Confirm user allocations and learn from them
   */
  async confirmAllocations(importId, confirmedTransactions) {
    if (!this.decisionEngine) {
      return { success: false, error: 'No decision engine available' };
    }

    // Update stored transactions
    if (this.dataStore) {
      for (const txn of confirmedTransactions) {
        if (txn.id && txn.confirmedCategory) {
          this.dataStore.updateBankTransaction(txn.id, this.companyId, {
            confirmed_category: txn.confirmedCategory,
            allocated_by: 'user'
          });
        }
      }
    }

    // Learn from confirmations
    const learnResult = await BatchAllocator.learnFromConfirmations(
      confirmedTransactions, this.decisionEngine
    );

    // Create journals for newly confirmed transactions
    let journals = [];
    if (this.createJournals) {
      const journalResult = JournalCreator.create(confirmedTransactions, {
        companyId: this.companyId,
        extractVAT: this.extractVAT
      });
      journals = journalResult.journals;
    }

    return {
      success: true,
      confirmed: confirmedTransactions.length,
      learned: learnResult.learned,
      journalsCreated: journals.length,
      journals
    };
  }
}

module.exports = UniversalImporter;
