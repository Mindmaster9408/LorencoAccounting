/**
 * ============================================================================
 * MOCK ACCOUNTING ROUTES — In-Memory CRUD for Lorenco Accounting
 * ============================================================================
 * Replaces Supabase-backed accounting routes with in-memory data operations.
 * Provides: Chart of Accounts, Journal Entries, Bank Accounts,
 *           Bank Transactions, Financial Periods, Reports (TB, IS, BS).
 * ============================================================================
 */

const express = require('express');
const { authenticateToken, requireCompany, requirePermission } = require('./middleware/auth');
const mock = require('./mock-data');

const router = express.Router();

router.use(authenticateToken);
router.use(requireCompany);

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD / STATUS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/accounting/status
 */
router.get('/status', (req, res) => {
  const accounts = mock.chartOfAccounts.filter(a => a.company_id === req.companyId);
  const journals = mock.journalEntries.filter(j => j.company_id === req.companyId);
  const periods = mock.financialPeriods.filter(p => p.company_id === req.companyId);
  const banks = mock.bankAccounts.filter(b => b.company_id === req.companyId);

  const postedJournals = journals.filter(j => j.status === 'posted');
  const draftJournals = journals.filter(j => j.status === 'draft');
  const openPeriod = periods.find(p => p.status === 'open');

  res.json({
    module: 'accounting',
    status: 'active',
    summary: {
      total_accounts: accounts.length,
      active_accounts: accounts.filter(a => a.is_active).length,
      total_journals: journals.length,
      posted_journals: postedJournals.length,
      draft_journals: draftJournals.length,
      bank_accounts: banks.length,
      open_period: openPeriod ? openPeriod.period_name : 'None',
      financial_periods: periods.length,
    }
  });
});

/**
 * GET /api/accounting/dashboard
 */
router.get('/dashboard', (req, res) => {
  try {
    const accounts = mock.chartOfAccounts.filter(a => a.company_id === req.companyId && a.is_active);
    const journals = mock.journalEntries.filter(j => j.company_id === req.companyId);
    const bankTxns = mock.bankTransactions.filter(t => {
      const bank = mock.bankAccounts.find(b => b.id === t.bank_account_id);
      return bank && bank.company_id === req.companyId;
    });

    // Calculate totals by account type
    const totalAssets = accounts.filter(a => a.account_type === 'Asset').reduce((s, a) => s + a.current_balance, 0);
    const totalLiabilities = accounts.filter(a => a.account_type === 'Liability').reduce((s, a) => s + a.current_balance, 0);
    const totalEquity = accounts.filter(a => a.account_type === 'Equity').reduce((s, a) => s + a.current_balance, 0);
    const totalIncome = accounts.filter(a => a.account_type === 'Income').reduce((s, a) => s + a.current_balance, 0);
    const totalExpenses = accounts.filter(a => a.account_type === 'Expense').reduce((s, a) => s + a.current_balance, 0);
    const netProfit = totalIncome - totalExpenses;

    // Unreconciled bank transactions
    const unreconciledCount = bankTxns.filter(t => !t.is_reconciled).length;

    // Recent activity
    const recentJournals = journals
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);

    res.json({
      summary: {
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        total_equity: totalEquity,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        unreconciled_transactions: unreconciledCount,
        draft_journals: journals.filter(j => j.status === 'draft').length,
      },
      recent_journals: recentJournals,
    });
  } catch (err) {
    console.error('Mock GET /dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// CHART OF ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/accounting/accounts
 */
router.get('/accounts', requirePermission('ACCOUNTS.VIEW'), (req, res) => {
  try {
    const { type, active_only, search } = req.query;
    let results = mock.chartOfAccounts.filter(a => a.company_id === req.companyId);

    if (active_only !== 'false') results = results.filter(a => a.is_active);
    if (type) results = results.filter(a => a.account_type.toLowerCase() === type.toLowerCase());
    if (search) {
      const s = search.toLowerCase();
      results = results.filter(a =>
        a.account_name.toLowerCase().includes(s) ||
        a.account_number.includes(s) ||
        (a.description && a.description.toLowerCase().includes(s))
      );
    }

    results.sort((a, b) => a.account_number.localeCompare(b.account_number));
    res.json({ accounts: results });
  } catch (err) {
    console.error('Mock GET /accounts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/accounting/accounts/:id
 */
router.get('/accounts/:id', requirePermission('ACCOUNTS.VIEW'), (req, res) => {
  const account = mock.chartOfAccounts.find(a => a.id === parseInt(req.params.id) && a.company_id === req.companyId);
  if (!account) return res.status(404).json({ error: 'Account not found' });

  // Get journal lines for this account
  const lines = mock.journalLines
    .filter(l => l.account_id === account.id)
    .map(l => {
      const journal = mock.journalEntries.find(j => j.id === l.journal_id);
      return { ...l, journal };
    });

  res.json({ account, ledger_entries: lines });
});

/**
 * POST /api/accounting/accounts
 */
router.post('/accounts', requirePermission('ACCOUNTS.CREATE'), (req, res) => {
  try {
    const { account_number, account_name, account_type, sub_type, description, opening_balance } = req.body;

    if (!account_number || !account_name || !account_type) {
      return res.status(400).json({ error: 'account_number, account_name, and account_type are required' });
    }

    // Check duplicate account number
    const exists = mock.chartOfAccounts.find(a => a.company_id === req.companyId && a.account_number === account_number);
    if (exists) return res.status(409).json({ error: 'Account number already exists' });

    const account = {
      id: mock.nextId(),
      company_id: req.companyId,
      account_number,
      account_name,
      account_type,
      sub_type: sub_type || account_type,
      is_active: true,
      is_system: false,
      opening_balance: parseFloat(opening_balance) || 0,
      current_balance: parseFloat(opening_balance) || 0,
      description: description || '',
      created_at: new Date().toISOString(),
    };

    mock.chartOfAccounts.push(account);
    mock.mockAuditFromReq(req, 'CREATE', 'account', account.id, { module: 'accounting', newValue: { account_number, account_name, account_type } });

    res.status(201).json({ account });
  } catch (err) {
    console.error('Mock POST /accounts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/accounting/accounts/:id
 */
router.put('/accounts/:id', requirePermission('ACCOUNTS.EDIT'), (req, res) => {
  const idx = mock.chartOfAccounts.findIndex(a => a.id === parseInt(req.params.id) && a.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Account not found' });

  const old = { ...mock.chartOfAccounts[idx] };
  const { account_name, sub_type, description, is_active } = req.body;

  if (account_name !== undefined) mock.chartOfAccounts[idx].account_name = account_name;
  if (sub_type !== undefined) mock.chartOfAccounts[idx].sub_type = sub_type;
  if (description !== undefined) mock.chartOfAccounts[idx].description = description;
  if (is_active !== undefined) mock.chartOfAccounts[idx].is_active = is_active;

  mock.mockAuditFromReq(req, 'UPDATE', 'account', old.id, { module: 'accounting', oldValue: old, newValue: mock.chartOfAccounts[idx] });
  res.json({ account: mock.chartOfAccounts[idx] });
});


// ═══════════════════════════════════════════════════════════════════════════════
// JOURNAL ENTRIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/accounting/journals
 */
router.get('/journals', requirePermission('JOURNALS.VIEW'), (req, res) => {
  try {
    const { status, period_id, search } = req.query;
    let results = mock.journalEntries.filter(j => j.company_id === req.companyId);

    if (status) results = results.filter(j => j.status === status);
    if (period_id) results = results.filter(j => j.period_id === parseInt(period_id));
    if (search) {
      const s = search.toLowerCase();
      results = results.filter(j =>
        j.journal_number.toLowerCase().includes(s) ||
        j.description.toLowerCase().includes(s) ||
        (j.reference && j.reference.toLowerCase().includes(s))
      );
    }

    // Attach line totals
    results = results.map(j => {
      const lines = mock.journalLines.filter(l => l.journal_id === j.id);
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      return { ...j, total_debit: totalDebit, total_credit: totalCredit, line_count: lines.length };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ journals: results });
  } catch (err) {
    console.error('Mock GET /journals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/accounting/journals/:id
 */
router.get('/journals/:id', requirePermission('JOURNALS.VIEW'), (req, res) => {
  const journal = mock.journalEntries.find(j => j.id === parseInt(req.params.id) && j.company_id === req.companyId);
  if (!journal) return res.status(404).json({ error: 'Journal not found' });

  const lines = mock.journalLines
    .filter(l => l.journal_id === journal.id)
    .map(l => {
      const account = mock.chartOfAccounts.find(a => a.id === l.account_id);
      return { ...l, account_number: account ? account.account_number : '?', account_name: account ? account.account_name : 'Unknown' };
    });

  res.json({ journal, lines });
});

/**
 * POST /api/accounting/journals
 */
router.post('/journals', requirePermission('JOURNALS.CREATE'), (req, res) => {
  try {
    const { date, description, reference, type, lines } = req.body;

    if (!date || !description || !lines || !Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ error: 'date, description, and at least 2 lines required' });
    }

    // Validate double-entry
    const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ error: `Debits (${totalDebit.toFixed(2)}) must equal credits (${totalCredit.toFixed(2)})` });
    }

    // Find open period
    const openPeriod = mock.financialPeriods.find(p => p.company_id === req.companyId && p.status === 'open');

    // Generate journal number
    const existingCount = mock.journalEntries.filter(j => j.company_id === req.companyId).length;
    const journalNumber = `JNL-${new Date(date).getFullYear()}-${String(existingCount + 1).padStart(3, '0')}`;

    const journal = {
      id: mock.nextId(),
      company_id: req.companyId,
      journal_number: journalNumber,
      date,
      description,
      reference: reference || null,
      type: type || 'general',
      status: 'draft',
      created_by: req.user.userId,
      posted_by: null,
      posted_at: null,
      period_id: openPeriod ? openPeriod.id : null,
      created_at: new Date().toISOString(),
    };

    mock.journalEntries.push(journal);

    // Create lines
    const newLines = lines.map(l => ({
      id: mock.nextId(),
      journal_id: journal.id,
      account_id: parseInt(l.account_id),
      debit: parseFloat(l.debit) || 0,
      credit: parseFloat(l.credit) || 0,
      description: l.description || '',
    }));
    mock.journalLines.push(...newLines);

    mock.mockAuditFromReq(req, 'CREATE', 'journal', journal.id, {
      module: 'accounting',
      newValue: { journal_number: journalNumber, description, total: totalDebit.toFixed(2) }
    });

    res.status(201).json({ journal: { ...journal, lines: newLines, total_debit: totalDebit, total_credit: totalCredit } });
  } catch (err) {
    console.error('Mock POST /journals error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/accounting/journals/:id/post
 */
router.post('/journals/:id/post', requirePermission('JOURNALS.POST'), (req, res) => {
  const idx = mock.journalEntries.findIndex(j => j.id === parseInt(req.params.id) && j.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Journal not found' });

  const journal = mock.journalEntries[idx];
  if (journal.status === 'posted') return res.status(400).json({ error: 'Journal already posted' });

  // Update account balances
  const lines = mock.journalLines.filter(l => l.journal_id === journal.id);
  for (const line of lines) {
    const acct = mock.chartOfAccounts.find(a => a.id === line.account_id);
    if (acct) {
      // Assets & Expenses: debit increases, credit decreases
      // Liabilities, Equity & Income: credit increases, debit decreases
      if (['Asset', 'Expense'].includes(acct.account_type)) {
        acct.current_balance += (line.debit - line.credit);
      } else {
        acct.current_balance += (line.credit - line.debit);
      }
    }
  }

  mock.journalEntries[idx].status = 'posted';
  mock.journalEntries[idx].posted_by = req.user.userId;
  mock.journalEntries[idx].posted_at = new Date().toISOString();

  mock.mockAuditFromReq(req, 'POST', 'journal', journal.id, {
    module: 'accounting',
    newValue: { journal_number: journal.journal_number, status: 'posted' }
  });

  res.json({ journal: mock.journalEntries[idx], message: 'Journal posted successfully' });
});

/**
 * POST /api/accounting/journals/:id/reverse
 */
router.post('/journals/:id/reverse', requirePermission('JOURNALS.POST'), (req, res) => {
  const journal = mock.journalEntries.find(j => j.id === parseInt(req.params.id) && j.company_id === req.companyId);
  if (!journal) return res.status(404).json({ error: 'Journal not found' });
  if (journal.status !== 'posted') return res.status(400).json({ error: 'Only posted journals can be reversed' });

  // Create reversal journal
  const existingCount = mock.journalEntries.filter(j => j.company_id === req.companyId).length;
  const reversalNumber = `JNL-${new Date().getFullYear()}-${String(existingCount + 1).padStart(3, '0')}`;

  const reversal = {
    id: mock.nextId(),
    company_id: req.companyId,
    journal_number: reversalNumber,
    date: new Date().toISOString().split('T')[0],
    description: `REVERSAL of ${journal.journal_number}: ${journal.description}`,
    reference: journal.journal_number,
    type: 'reversal',
    status: 'draft',
    created_by: req.user.userId,
    posted_by: null,
    posted_at: null,
    period_id: journal.period_id,
    created_at: new Date().toISOString(),
  };

  mock.journalEntries.push(reversal);

  // Swap debits and credits
  const originalLines = mock.journalLines.filter(l => l.journal_id === journal.id);
  const reversalLines = originalLines.map(l => ({
    id: mock.nextId(),
    journal_id: reversal.id,
    account_id: l.account_id,
    debit: l.credit,
    credit: l.debit,
    description: `Reversal: ${l.description}`,
  }));
  mock.journalLines.push(...reversalLines);

  mock.mockAuditFromReq(req, 'REVERSE', 'journal', journal.id, {
    module: 'accounting',
    newValue: { original: journal.journal_number, reversal: reversalNumber }
  });

  res.status(201).json({ reversal: { ...reversal, lines: reversalLines }, message: 'Reversal journal created (draft)' });
});


// ═══════════════════════════════════════════════════════════════════════════════
// BANK ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/accounting/bank-accounts
 */
router.get('/bank-accounts', requirePermission('BANK.VIEW'), (req, res) => {
  const results = mock.bankAccounts
    .filter(b => b.company_id === req.companyId)
    .map(b => {
      const linkedAccount = mock.chartOfAccounts.find(a => a.id === b.linked_account_id);
      const txnCount = mock.bankTransactions.filter(t => t.bank_account_id === b.id).length;
      const unreconciledCount = mock.bankTransactions.filter(t => t.bank_account_id === b.id && !t.is_reconciled).length;
      return { ...b, linked_account_name: linkedAccount ? linkedAccount.account_name : null, transaction_count: txnCount, unreconciled_count: unreconciledCount };
    });
  res.json({ bank_accounts: results });
});

/**
 * POST /api/accounting/bank-accounts
 */
router.post('/bank-accounts', requirePermission('BANK.CREATE'), (req, res) => {
  try {
    const { bank_name, account_name, account_number, branch_code, account_type, linked_account_id } = req.body;
    if (!bank_name || !account_name || !account_number) {
      return res.status(400).json({ error: 'bank_name, account_name, account_number required' });
    }

    const bankAccount = {
      id: mock.nextId(),
      company_id: req.companyId,
      bank_name, account_name, account_number,
      branch_code: branch_code || '',
      account_type: account_type || 'current',
      linked_account_id: linked_account_id ? parseInt(linked_account_id) : null,
      is_active: true,
      last_reconciled_date: null,
      last_reconciled_balance: 0,
      created_at: new Date().toISOString(),
    };

    mock.bankAccounts.push(bankAccount);
    mock.mockAuditFromReq(req, 'CREATE', 'bank_account', bankAccount.id, { module: 'accounting', newValue: { bank_name, account_name } });
    res.status(201).json({ bank_account: bankAccount });
  } catch (err) {
    console.error('Mock POST /bank-accounts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// BANK TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/accounting/bank-transactions
 */
router.get('/bank-transactions', requirePermission('BANK.VIEW'), (req, res) => {
  try {
    const { bank_account_id, reconciled, search } = req.query;
    const companyBanks = mock.bankAccounts.filter(b => b.company_id === req.companyId).map(b => b.id);
    let results = mock.bankTransactions.filter(t => companyBanks.includes(t.bank_account_id));

    if (bank_account_id) results = results.filter(t => t.bank_account_id === parseInt(bank_account_id));
    if (reconciled !== undefined) results = results.filter(t => t.is_reconciled === (reconciled === 'true'));
    if (search) {
      const s = search.toLowerCase();
      results = results.filter(t => t.description.toLowerCase().includes(s) || (t.reference && t.reference.toLowerCase().includes(s)));
    }

    // Attach account name
    results = results.map(t => {
      const acct = mock.chartOfAccounts.find(a => a.id === t.allocated_account_id);
      const bank = mock.bankAccounts.find(b => b.id === t.bank_account_id);
      return {
        ...t,
        allocated_account_name: acct ? acct.account_name : null,
        allocated_account_number: acct ? acct.account_number : null,
        bank_name: bank ? bank.bank_name : null,
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ transactions: results });
  } catch (err) {
    console.error('Mock GET /bank-transactions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PATCH /api/accounting/bank-transactions/:id/allocate
 */
router.patch('/bank-transactions/:id/allocate', requirePermission('BANK.ALLOCATE'), (req, res) => {
  const idx = mock.bankTransactions.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });

  const { account_id } = req.body;
  if (!account_id) return res.status(400).json({ error: 'account_id required' });

  const account = mock.chartOfAccounts.find(a => a.id === parseInt(account_id));
  if (!account) return res.status(404).json({ error: 'Account not found' });

  mock.bankTransactions[idx].allocated_account_id = parseInt(account_id);
  mock.mockAuditFromReq(req, 'ALLOCATE', 'bank_transaction', mock.bankTransactions[idx].id, {
    module: 'accounting',
    newValue: { account_id, account_name: account.account_name }
  });

  res.json({ transaction: mock.bankTransactions[idx], message: 'Transaction allocated' });
});

/**
 * PATCH /api/accounting/bank-transactions/:id/reconcile
 */
router.patch('/bank-transactions/:id/reconcile', requirePermission('BANK.RECONCILE'), (req, res) => {
  const idx = mock.bankTransactions.findIndex(t => t.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Transaction not found' });

  mock.bankTransactions[idx].is_reconciled = true;
  res.json({ transaction: mock.bankTransactions[idx], message: 'Transaction reconciled' });
});


// ═══════════════════════════════════════════════════════════════════════════════
// FINANCIAL PERIODS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/accounting/periods
 */
router.get('/periods', requirePermission('ACCOUNTS.VIEW'), (req, res) => {
  const results = mock.financialPeriods
    .filter(p => p.company_id === req.companyId)
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
  res.json({ periods: results });
});

/**
 * POST /api/accounting/periods/:id/close
 */
router.post('/periods/:id/close', requirePermission('GL_REPORTS.CLOSE_PERIOD'), (req, res) => {
  const idx = mock.financialPeriods.findIndex(p => p.id === parseInt(req.params.id) && p.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Period not found' });
  if (mock.financialPeriods[idx].status === 'closed') return res.status(400).json({ error: 'Period already closed' });

  // Check no draft journals in this period
  const drafts = mock.journalEntries.filter(j => j.company_id === req.companyId && j.period_id === mock.financialPeriods[idx].id && j.status === 'draft');
  if (drafts.length > 0) {
    return res.status(400).json({ error: `Cannot close period — ${drafts.length} draft journal(s) remain`, draft_journals: drafts.map(d => d.journal_number) });
  }

  mock.financialPeriods[idx].status = 'closed';
  mock.financialPeriods[idx].closed_by = req.user.userId;
  mock.financialPeriods[idx].closed_at = new Date().toISOString();

  mock.mockAuditFromReq(req, 'CLOSE', 'financial_period', mock.financialPeriods[idx].id, {
    module: 'accounting',
    newValue: { period_name: mock.financialPeriods[idx].period_name }
  });

  res.json({ period: mock.financialPeriods[idx], message: 'Period closed successfully' });
});


// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/accounting/reports/trial-balance
 */
router.get('/reports/trial-balance', requirePermission('GL_REPORTS.VIEW'), (req, res) => {
  try {
    const accounts = mock.chartOfAccounts.filter(a => a.company_id === req.companyId && a.is_active);

    const rows = accounts.map(a => {
      const debit = (['Asset', 'Expense'].includes(a.account_type) && a.current_balance > 0)
        ? a.current_balance
        : (['Liability', 'Equity', 'Income'].includes(a.account_type) && a.current_balance < 0)
          ? Math.abs(a.current_balance)
          : 0;
      const credit = (['Liability', 'Equity', 'Income'].includes(a.account_type) && a.current_balance > 0)
        ? a.current_balance
        : (['Asset', 'Expense'].includes(a.account_type) && a.current_balance < 0)
          ? Math.abs(a.current_balance)
          : 0;
      return {
        account_number: a.account_number,
        account_name: a.account_name,
        account_type: a.account_type,
        debit,
        credit,
      };
    }).filter(r => r.debit > 0 || r.credit > 0)
      .sort((a, b) => a.account_number.localeCompare(b.account_number));

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

    res.json({
      report: 'Trial Balance',
      as_at: new Date().toISOString().split('T')[0],
      rows,
      totals: { debit: totalDebit, credit: totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 },
    });
  } catch (err) {
    console.error('Mock GET /reports/trial-balance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/accounting/reports/income-statement
 */
router.get('/reports/income-statement', requirePermission('GL_REPORTS.VIEW'), (req, res) => {
  try {
    const accounts = mock.chartOfAccounts.filter(a => a.company_id === req.companyId && a.is_active);

    const income = accounts.filter(a => a.account_type === 'Income').map(a => ({
      account_number: a.account_number,
      account_name: a.account_name,
      sub_type: a.sub_type,
      amount: a.current_balance,
    }));

    const expenses = accounts.filter(a => a.account_type === 'Expense').map(a => ({
      account_number: a.account_number,
      account_name: a.account_name,
      sub_type: a.sub_type,
      amount: a.current_balance,
    }));

    const totalIncome = income.reduce((s, a) => s + a.amount, 0);
    const totalExpenses = expenses.reduce((s, a) => s + a.amount, 0);
    const netProfit = totalIncome - totalExpenses;

    // Group expenses by sub_type
    const costOfSales = expenses.filter(e => e.sub_type === 'Cost of Sales');
    const operatingExpenses = expenses.filter(e => e.sub_type === 'Operating Expense');
    const financeCosts = expenses.filter(e => e.sub_type === 'Finance Cost');

    const grossProfit = totalIncome - costOfSales.reduce((s, e) => s + e.amount, 0);

    res.json({
      report: 'Income Statement',
      period: 'Year to Date',
      income,
      cost_of_sales: costOfSales,
      gross_profit: grossProfit,
      operating_expenses: operatingExpenses,
      finance_costs: financeCosts,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      net_profit: netProfit,
    });
  } catch (err) {
    console.error('Mock GET /reports/income-statement error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/accounting/reports/balance-sheet
 */
router.get('/reports/balance-sheet', requirePermission('GL_REPORTS.VIEW'), (req, res) => {
  try {
    const accounts = mock.chartOfAccounts.filter(a => a.company_id === req.companyId && a.is_active);

    const assets = accounts.filter(a => a.account_type === 'Asset').map(a => ({
      account_number: a.account_number,
      account_name: a.account_name,
      sub_type: a.sub_type,
      amount: a.current_balance,
    }));

    const liabilities = accounts.filter(a => a.account_type === 'Liability').map(a => ({
      account_number: a.account_number,
      account_name: a.account_name,
      sub_type: a.sub_type,
      amount: a.current_balance,
    }));

    const equity = accounts.filter(a => a.account_type === 'Equity').map(a => ({
      account_number: a.account_number,
      account_name: a.account_name,
      sub_type: a.sub_type,
      amount: a.current_balance,
    }));

    // Net profit from income statement adds to equity
    const incomeAccounts = accounts.filter(a => a.account_type === 'Income');
    const expenseAccounts = accounts.filter(a => a.account_type === 'Expense');
    const netProfit = incomeAccounts.reduce((s, a) => s + a.current_balance, 0) - expenseAccounts.reduce((s, a) => s + a.current_balance, 0);

    const currentAssets = assets.filter(a => a.sub_type === 'Current Asset');
    const nonCurrentAssets = assets.filter(a => a.sub_type === 'Non-Current Asset');
    const currentLiabilities = liabilities.filter(a => a.sub_type === 'Current Liability');
    const nonCurrentLiabilities = liabilities.filter(a => a.sub_type === 'Non-Current Liability');

    const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + a.amount, 0);
    const totalEquity = equity.reduce((s, a) => s + a.amount, 0) + netProfit;

    res.json({
      report: 'Balance Sheet',
      as_at: new Date().toISOString().split('T')[0],
      current_assets: currentAssets,
      non_current_assets: nonCurrentAssets,
      total_assets: totalAssets,
      current_liabilities: currentLiabilities,
      non_current_liabilities: nonCurrentLiabilities,
      total_liabilities: totalLiabilities,
      equity,
      net_profit_ytd: netProfit,
      total_equity: totalEquity,
      total_liabilities_and_equity: totalLiabilities + totalEquity,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
    });
  } catch (err) {
    console.error('Mock GET /reports/balance-sheet error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/accounting/reports/general-ledger
 */
router.get('/reports/general-ledger', requirePermission('GL_REPORTS.VIEW'), (req, res) => {
  try {
    const { account_id } = req.query;
    if (!account_id) return res.status(400).json({ error: 'account_id query parameter required' });

    const account = mock.chartOfAccounts.find(a => a.id === parseInt(account_id) && a.company_id === req.companyId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const lines = mock.journalLines
      .filter(l => l.account_id === account.id)
      .map(l => {
        const journal = mock.journalEntries.find(j => j.id === l.journal_id);
        return {
          date: journal ? journal.date : null,
          journal_number: journal ? journal.journal_number : '?',
          journal_description: journal ? journal.description : '',
          reference: journal ? journal.reference : '',
          status: journal ? journal.status : '',
          line_description: l.description,
          debit: l.debit,
          credit: l.credit,
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Running balance
    let balance = account.opening_balance;
    const entries = lines.map(l => {
      if (['Asset', 'Expense'].includes(account.account_type)) {
        balance += (l.debit - l.credit);
      } else {
        balance += (l.credit - l.debit);
      }
      return { ...l, running_balance: balance };
    });

    res.json({
      report: 'General Ledger',
      account: { account_number: account.account_number, account_name: account.account_name, account_type: account.account_type },
      opening_balance: account.opening_balance,
      entries,
      closing_balance: balance,
    });
  } catch (err) {
    console.error('Mock GET /reports/general-ledger error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// STUB ROUTES — New Lorenco Accounting features (VAT, PAYE, AI, etc.)
// These return empty/default data for mock mode development.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── VAT Reconciliation ─────────────────────────────────────────────────────
router.get('/vat-recon/periods', (req, res) => {
  res.json({ periods: [], count: 0 });
});

router.get('/vat-recon/periods/:periodId', (req, res) => {
  res.status(404).json({ error: 'Period not found' });
});

router.post('/vat-recon/periods', (req, res) => {
  res.json({ period: { id: mock.nextId(), ...req.body, status: 'open' } });
});

router.get('/vat-recon/reconciliations/period/:periodId', (req, res) => {
  res.json({ reconciliation: null });
});

router.post('/vat-recon/reconciliations/draft', (req, res) => {
  res.json({ reconciliation: { id: mock.nextId(), status: 'draft', ...req.body } });
});

router.get('/vat-recon/submissions', (req, res) => {
  res.json({ submissions: [], count: 0 });
});

router.get('/vat-recon/trial-balance', (req, res) => {
  res.json({ rows: [], totals: { debit: 0, credit: 0 } });
});

// ─── PAYE ───────────────────────────────────────────────────────────────────
router.get('/paye/config', (req, res) => {
  res.json({ config: { incomeTypes: [], deductionTypes: [] } });
});

router.put('/paye/config', (req, res) => {
  res.json({ config: req.body, message: 'Config updated' });
});

router.get('/paye/reconciliation/draft/:periodId', (req, res) => {
  res.json({ reconciliation: null });
});

router.put('/paye/reconciliation/draft/:periodId', (req, res) => {
  res.json({ reconciliation: { id: mock.nextId(), status: 'draft', ...req.body } });
});

// ─── AI Features ────────────────────────────────────────────────────────────
router.get('/ai/settings', (req, res) => {
  res.json({ settings: { enabled: false, mode: 'off', capabilities: {} } });
});

router.put('/ai/settings', (req, res) => {
  res.json({ settings: req.body, message: 'AI settings updated' });
});

router.get('/ai/review-queue', (req, res) => {
  res.json({ actions: [], count: 0 });
});

router.post('/ai/actions', (req, res) => {
  res.json({ action: { id: mock.nextId(), status: 'pending', ...req.body } });
});

// ─── Audit Log ──────────────────────────────────────────────────────────────
router.get('/audit', (req, res) => {
  res.json({ entries: [], count: 0, page: 1, totalPages: 0 });
});

// ─── Company (Accounting-specific) ──────────────────────────────────────────
router.get('/company/list', (req, res) => {
  const companies = [{ id: req.companyId, name: 'Mock Company', tradingName: 'Mock Co', status: 'active' }];
  res.json({ companies });
});

router.get('/company/:id', (req, res) => {
  res.json({ company: { id: parseInt(req.params.id), name: 'Mock Company', tradingName: 'Mock Co', status: 'active', vatNumber: '', taxId: '' } });
});

router.put('/company/:id', (req, res) => {
  res.json({ company: { id: parseInt(req.params.id), ...req.body }, message: 'Company updated' });
});

// ─── Employees (for PAYE) ───────────────────────────────────────────────────
router.get('/employees', (req, res) => {
  res.json({ employees: [], count: 0 });
});

router.put('/employees', (req, res) => {
  res.json({ employees: req.body.employees || [], message: 'Employees updated' });
});

// ─── Integrations API ───────────────────────────────────────────────────────
router.get('/integrations', (req, res) => {
  res.json({ integrations: [], count: 0 });
});

router.post('/integrations', (req, res) => {
  res.json({ integration: { id: mock.nextId(), ...req.body, apiKey: 'mock-api-key-' + Date.now() }, message: 'Integration created' });
});


module.exports = router;
