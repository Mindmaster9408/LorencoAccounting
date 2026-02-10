/**
 * ============================================================================
 * Accounting Module — Supabase-backed Routes
 * ============================================================================
 * Complete double-entry accounting with proper flow:
 *   Bank Transaction → Allocation → Journal Entry → GL Update → Trial Balance
 *
 * Chart of Accounts, Journal Entries, Bank Accounts/Transactions,
 * Financial Periods, Customer/Supplier Ledgers,
 * and Financial Reports (TB, IS, BS, GL).
 * ============================================================================
 */

const express = require('express');
const { supabase } = require('../../config/database');
const { requireCompany } = require('../../middleware/auth');
const { auditFromReq } = require('../../middleware/audit');

const router = express.Router();

router.use(requireCompany);

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER: Auto-create & post a journal from bank allocation
// ═══════════════════════════════════════════════════════════════════════════════

async function createAllocationJournal(companyId, userId, bankTxn, bankAccount, allocatedAccount) {
  const amount = Math.abs(parseFloat(bankTxn.amount));
  const isDeposit = parseFloat(bankTxn.amount) > 0; // positive = money IN

  // Find the bank's linked GL account (or use bank account name as fallback description)
  const bankGlAccountId = bankAccount.linked_account_id;
  if (!bankGlAccountId) return null; // Can't create journal without linked GL account

  // Generate journal number
  const { count } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', companyId);
  const jnlNum = `JNL-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`;

  // Find open period
  const { data: openPeriod } = await supabase.from('financial_periods').select('id')
    .eq('company_id', companyId).eq('status', 'open').limit(1).single();

  // For a DEPOSIT (money in): DR Bank, CR Allocated Account
  // For a PAYMENT (money out): DR Allocated Account, CR Bank
  const bankDebit = isDeposit ? amount : 0;
  const bankCredit = isDeposit ? 0 : amount;
  const allocDebit = isDeposit ? 0 : amount;
  const allocCredit = isDeposit ? amount : 0;

  const description = `Bank ${isDeposit ? 'receipt' : 'payment'}: ${bankTxn.description || bankTxn.reference || 'Allocation'}`;

  // Create journal entry
  const { data: journal, error: jnlError } = await supabase.from('journal_entries').insert({
    company_id: companyId, journal_number: jnlNum,
    date: bankTxn.date, description,
    reference: bankTxn.reference || null, type: 'general', status: 'draft',
    total_debit: amount, total_credit: amount,
    period_id: openPeriod ? openPeriod.id : null,
    created_by: userId
  }).select().single();

  if (jnlError) return null;

  // Create journal lines
  const lines = [
    { journal_id: journal.id, account_id: bankGlAccountId, debit: bankDebit, credit: bankCredit, description: `${bankAccount.bank_name} - ${bankAccount.account_name}` },
    { journal_id: journal.id, account_id: parseInt(allocatedAccount.id), debit: allocDebit, credit: allocCredit, description: allocatedAccount.account_name }
  ];
  await supabase.from('journal_lines').insert(lines);

  // Auto-post the journal — update GL account balances
  for (const line of lines) {
    const { data: acct } = await supabase.from('chart_of_accounts').select('current_balance, account_type').eq('id', line.account_id).single();
    if (acct) {
      const change = ['Asset', 'Expense'].includes(acct.account_type)
        ? (line.debit - line.credit)
        : (line.credit - line.debit);
      await supabase.from('chart_of_accounts').update({
        current_balance: parseFloat(acct.current_balance) + change
      }).eq('id', line.account_id);
    }
  }

  // Mark journal as posted
  await supabase.from('journal_entries').update({
    status: 'posted', posted_by: userId, posted_at: new Date().toISOString()
  }).eq('id', journal.id);

  return journal;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS / DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/status', async (req, res) => {
  try {
    const { count: acctCount } = await supabase.from('chart_of_accounts').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
    const { count: activeAcctCount } = await supabase.from('chart_of_accounts').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId).eq('is_active', true);
    const { count: jnlCount } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
    const { count: postedCount } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId).eq('status', 'posted');
    const { count: draftCount } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId).eq('status', 'draft');
    const { count: bankCount } = await supabase.from('bank_accounts').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
    const { count: periodCount } = await supabase.from('financial_periods').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
    const { data: openPeriod } = await supabase.from('financial_periods').select('period_name').eq('company_id', req.companyId).eq('status', 'open').limit(1).single();

    res.json({
      module: 'accounting', status: 'active',
      summary: {
        total_accounts: acctCount || 0,
        active_accounts: activeAcctCount || 0,
        total_journals: jnlCount || 0,
        posted_journals: postedCount || 0,
        draft_journals: draftCount || 0,
        bank_accounts: bankCount || 0,
        open_period: openPeriod ? openPeriod.period_name : 'None',
        financial_periods: periodCount || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const { data: accounts } = await supabase.from('chart_of_accounts').select('*').eq('company_id', req.companyId).eq('is_active', true);
    const accts = accounts || [];

    const totalAssets = accts.filter(a => a.account_type === 'Asset').reduce((s, a) => s + parseFloat(a.current_balance || 0), 0);
    const totalLiabilities = accts.filter(a => a.account_type === 'Liability').reduce((s, a) => s + parseFloat(a.current_balance || 0), 0);
    const totalEquity = accts.filter(a => a.account_type === 'Equity').reduce((s, a) => s + parseFloat(a.current_balance || 0), 0);
    const totalIncome = accts.filter(a => a.account_type === 'Income').reduce((s, a) => s + parseFloat(a.current_balance || 0), 0);
    const totalExpenses = accts.filter(a => a.account_type === 'Expense').reduce((s, a) => s + parseFloat(a.current_balance || 0), 0);

    const { data: recentJournals } = await supabase.from('journal_entries').select('*').eq('company_id', req.companyId).order('created_at', { ascending: false }).limit(5);
    const { count: draftCount } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId).eq('status', 'draft');

    // Count unreconciled bank transactions
    const { data: companyBanks } = await supabase.from('bank_accounts').select('id').eq('company_id', req.companyId);
    let unreconciledCount = 0;
    if (companyBanks && companyBanks.length > 0) {
      const bankIds = companyBanks.map(b => b.id);
      const { count } = await supabase.from('bank_transactions').select('*', { count: 'exact', head: true })
        .in('bank_account_id', bankIds).eq('is_reconciled', false);
      unreconciledCount = count || 0;
    }

    res.json({
      summary: {
        total_assets: totalAssets, total_liabilities: totalLiabilities, total_equity: totalEquity,
        total_income: totalIncome, total_expenses: totalExpenses,
        net_profit: totalIncome - totalExpenses,
        unreconciled_transactions: unreconciledCount,
        draft_journals: draftCount || 0
      },
      recent_journals: recentJournals || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHART OF ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/accounts', async (req, res) => {
  try {
    const { type, active_only, search } = req.query;
    let query = supabase.from('chart_of_accounts').select('*').eq('company_id', req.companyId);
    if (active_only !== 'false') query = query.eq('is_active', true);
    if (type) query = query.ilike('account_type', type);
    if (search) query = query.or(`account_name.ilike.%${search}%,account_number.ilike.%${search}%`);
    query = query.order('account_number');

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ accounts: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/accounts/:id', async (req, res) => {
  try {
    const { data: account, error } = await supabase.from('chart_of_accounts').select('*').eq('id', req.params.id).eq('company_id', req.companyId).single();
    if (error || !account) return res.status(404).json({ error: 'Account not found' });

    const { data: lines } = await supabase.from('journal_lines').select('*, journal_entries(journal_number, date, description, status)').eq('account_id', account.id);
    res.json({ account, ledger_entries: lines || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/accounts', async (req, res) => {
  try {
    const { account_number, account_name, account_type, sub_type, description, opening_balance } = req.body;
    if (!account_number || !account_name || !account_type) {
      return res.status(400).json({ error: 'account_number, account_name, and account_type are required' });
    }

    const { data, error } = await supabase.from('chart_of_accounts').insert({
      company_id: req.companyId, account_number, account_name, account_type,
      sub_type: sub_type || account_type, description: description || '',
      opening_balance: parseFloat(opening_balance) || 0, current_balance: parseFloat(opening_balance) || 0,
      is_active: true, is_system: false
    }).select().single();

    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.message });
    await auditFromReq(req, 'CREATE', 'account', data.id, { module: 'accounting', newValue: { account_number, account_name, account_type } });
    res.status(201).json({ account: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/accounts/:id', async (req, res) => {
  try {
    const allowed = ['account_name', 'sub_type', 'description', 'is_active'];
    const updates = {};
    for (const key of allowed) { if (req.body[key] !== undefined) updates[key] = req.body[key]; }

    const { data, error } = await supabase.from('chart_of_accounts').update(updates).eq('id', req.params.id).eq('company_id', req.companyId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ account: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// JOURNAL ENTRIES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/journals', async (req, res) => {
  try {
    const { status, period_id, search } = req.query;
    let query = supabase.from('journal_entries').select('*').eq('company_id', req.companyId);
    if (status) query = query.eq('status', status);
    if (period_id) query = query.eq('period_id', parseInt(period_id));
    if (search) query = query.or(`journal_number.ilike.%${search}%,description.ilike.%${search}%`);
    query = query.order('date', { ascending: false });

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ journals: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/journals/:id', async (req, res) => {
  try {
    const { data: journal, error } = await supabase.from('journal_entries').select('*').eq('id', req.params.id).eq('company_id', req.companyId).single();
    if (error || !journal) return res.status(404).json({ error: 'Journal not found' });

    const { data: lines } = await supabase.from('journal_lines').select('*, chart_of_accounts(account_number, account_name)').eq('journal_id', journal.id);
    res.json({ journal, lines: lines || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/journals', async (req, res) => {
  try {
    const { date, description, reference, type, lines } = req.body;
    if (!date || !description || !lines || lines.length < 2) {
      return res.status(400).json({ error: 'date, description, and at least 2 lines required' });
    }

    const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ error: `Debits (${totalDebit.toFixed(2)}) must equal credits (${totalCredit.toFixed(2)})` });
    }

    // Find open period
    const { data: openPeriod } = await supabase.from('financial_periods').select('id')
      .eq('company_id', req.companyId).eq('status', 'open').limit(1).single();

    const { count } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
    const journalNumber = `JNL-${new Date(date).getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`;

    const { data: journal, error } = await supabase.from('journal_entries').insert({
      company_id: req.companyId, journal_number: journalNumber, date, description,
      reference: reference || null, type: type || 'general', status: 'draft',
      total_debit: totalDebit, total_credit: totalCredit,
      period_id: openPeriod ? openPeriod.id : null,
      created_by: req.user.userId
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    const jnlLines = lines.map(l => ({
      journal_id: journal.id, account_id: parseInt(l.account_id),
      debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0, description: l.description || ''
    }));
    await supabase.from('journal_lines').insert(jnlLines);

    await auditFromReq(req, 'CREATE', 'journal', journal.id, { module: 'accounting', newValue: { journal_number: journalNumber, description, total: totalDebit.toFixed(2) } });
    res.status(201).json({ journal: { ...journal, lines: jnlLines, total_debit: totalDebit, total_credit: totalCredit } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/journals/:id/post', async (req, res) => {
  try {
    const { data: journal } = await supabase.from('journal_entries').select('*').eq('id', req.params.id).eq('company_id', req.companyId).single();
    if (!journal) return res.status(404).json({ error: 'Journal not found' });
    if (journal.status === 'posted') return res.status(400).json({ error: 'Already posted' });

    const { data: lines } = await supabase.from('journal_lines').select('*').eq('journal_id', journal.id);
    for (const line of (lines || [])) {
      const { data: acct } = await supabase.from('chart_of_accounts').select('current_balance, account_type').eq('id', line.account_id).single();
      if (acct) {
        const change = ['Asset', 'Expense'].includes(acct.account_type) ? (line.debit - line.credit) : (line.credit - line.debit);
        await supabase.from('chart_of_accounts').update({ current_balance: parseFloat(acct.current_balance) + change }).eq('id', line.account_id);
      }
    }

    const { data, error } = await supabase.from('journal_entries').update({ status: 'posted', posted_by: req.user.userId, posted_at: new Date().toISOString() }).eq('id', journal.id).select().single();
    if (error) return res.status(500).json({ error: error.message });

    await auditFromReq(req, 'POST', 'journal', journal.id, { module: 'accounting', newValue: { journal_number: journal.journal_number, status: 'posted' } });
    res.json({ journal: data, message: 'Journal posted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/journals/:id/reverse', async (req, res) => {
  try {
    const { data: journal } = await supabase.from('journal_entries').select('*').eq('id', req.params.id).eq('company_id', req.companyId).single();
    if (!journal) return res.status(404).json({ error: 'Journal not found' });
    if (journal.status !== 'posted') return res.status(400).json({ error: 'Only posted journals can be reversed' });

    const { count } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
    const reversalNumber = `JNL-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`;

    const { data: reversal, error } = await supabase.from('journal_entries').insert({
      company_id: req.companyId, journal_number: reversalNumber,
      date: new Date().toISOString().split('T')[0],
      description: `REVERSAL of ${journal.journal_number}: ${journal.description}`,
      reference: journal.journal_number, type: 'reversal', status: 'draft',
      total_debit: journal.total_credit, total_credit: journal.total_debit,
      period_id: journal.period_id,
      created_by: req.user.userId
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    const { data: origLines } = await supabase.from('journal_lines').select('*').eq('journal_id', journal.id);
    const reversalLines = (origLines || []).map(l => ({ journal_id: reversal.id, account_id: l.account_id, debit: l.credit, credit: l.debit, description: `Reversal: ${l.description}` }));
    await supabase.from('journal_lines').insert(reversalLines);

    res.status(201).json({ reversal: { ...reversal, lines: reversalLines }, message: 'Reversal journal created (draft)' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BANK ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/bank-accounts', async (req, res) => {
  try {
    const { data: banks, error } = await supabase.from('bank_accounts').select('*, chart_of_accounts(account_name, account_number)').eq('company_id', req.companyId);
    if (error) return res.status(500).json({ error: error.message });

    // Enrich with transaction counts
    const enriched = [];
    for (const b of (banks || [])) {
      const { count: txnCount } = await supabase.from('bank_transactions').select('*', { count: 'exact', head: true }).eq('bank_account_id', b.id);
      const { count: unreconciledCount } = await supabase.from('bank_transactions').select('*', { count: 'exact', head: true }).eq('bank_account_id', b.id).eq('is_reconciled', false);
      enriched.push({
        ...b,
        linked_account_name: b.chart_of_accounts ? b.chart_of_accounts.account_name : null,
        linked_account_number: b.chart_of_accounts ? b.chart_of_accounts.account_number : null,
        transaction_count: txnCount || 0,
        unreconciled_count: unreconciledCount || 0
      });
    }

    res.json({ bank_accounts: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/bank-accounts', async (req, res) => {
  try {
    const { bank_name, account_name, account_number, branch_code, account_type, linked_account_id } = req.body;
    if (!bank_name || !account_name || !account_number) {
      return res.status(400).json({ error: 'bank_name, account_name, account_number required' });
    }

    const { data, error } = await supabase.from('bank_accounts').insert({
      company_id: req.companyId, bank_name, account_name, account_number,
      branch_code: branch_code || '', account_type: account_type || 'current',
      linked_account_id: linked_account_id ? parseInt(linked_account_id) : null, is_active: true
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    await auditFromReq(req, 'CREATE', 'bank_account', data.id, { module: 'accounting', newValue: { bank_name, account_name } });
    res.status(201).json({ bank_account: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BANK TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/bank-transactions', async (req, res) => {
  try {
    const { bank_account_id, reconciled, search } = req.query;

    // Get this company's bank account IDs
    const { data: companyBanks } = await supabase.from('bank_accounts').select('id, bank_name').eq('company_id', req.companyId);
    if (!companyBanks || companyBanks.length === 0) return res.json({ transactions: [] });

    const bankIds = companyBanks.map(b => b.id);
    const bankMap = Object.fromEntries(companyBanks.map(b => [b.id, b.bank_name]));

    let query = supabase.from('bank_transactions').select('*').in('bank_account_id', bankIds);
    if (bank_account_id) query = query.eq('bank_account_id', parseInt(bank_account_id));
    if (reconciled !== undefined) query = query.eq('is_reconciled', reconciled === 'true');
    if (search) query = query.or(`description.ilike.%${search}%,reference.ilike.%${search}%`);
    query = query.order('date', { ascending: false });

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    // Enrich with allocated account names
    const allocIds = [...new Set((data || []).filter(t => t.allocated_account_id).map(t => t.allocated_account_id))];
    let allocMap = {};
    if (allocIds.length > 0) {
      const { data: allocAccts } = await supabase.from('chart_of_accounts').select('id, account_name, account_number').in('id', allocIds);
      allocMap = Object.fromEntries((allocAccts || []).map(a => [a.id, a]));
    }

    const enriched = (data || []).map(t => ({
      ...t,
      bank_name: bankMap[t.bank_account_id] || null,
      allocated_account_name: allocMap[t.allocated_account_id]?.account_name || null,
      allocated_account_number: allocMap[t.allocated_account_id]?.account_number || null
    }));

    res.json({ transactions: enriched });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/accounting/bank-transactions
 * Create/import bank transactions
 */
router.post('/bank-transactions', async (req, res) => {
  try {
    const { bank_account_id, transactions } = req.body;
    if (!bank_account_id) return res.status(400).json({ error: 'bank_account_id required' });

    // Verify bank account belongs to company
    const { data: bank } = await supabase.from('bank_accounts').select('id')
      .eq('id', bank_account_id).eq('company_id', req.companyId).single();
    if (!bank) return res.status(404).json({ error: 'Bank account not found' });

    // Accept single transaction or array
    const txns = Array.isArray(transactions) ? transactions : [req.body];
    const records = txns.map(t => ({
      bank_account_id: parseInt(bank_account_id),
      date: t.date || new Date().toISOString().split('T')[0],
      description: t.description || '',
      reference: t.reference || null,
      amount: parseFloat(t.amount) || 0,
      is_reconciled: false
    }));

    const { data, error } = await supabase.from('bank_transactions').insert(records).select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ transactions: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PATCH /api/accounting/bank-transactions/:id/allocate
 * Allocate a bank transaction to a GL account AND create a journal entry
 */
router.patch('/bank-transactions/:id/allocate', async (req, res) => {
  try {
    const { account_id } = req.body;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });

    // Get the bank transaction
    const { data: txn } = await supabase.from('bank_transactions').select('*').eq('id', req.params.id).single();
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    // Get the bank account (verify company ownership)
    const { data: bankAccount } = await supabase.from('bank_accounts').select('*')
      .eq('id', txn.bank_account_id).eq('company_id', req.companyId).single();
    if (!bankAccount) return res.status(403).json({ error: 'Bank account not in your company' });

    // Get the allocated GL account
    const { data: allocAccount } = await supabase.from('chart_of_accounts').select('*')
      .eq('id', parseInt(account_id)).eq('company_id', req.companyId).single();
    if (!allocAccount) return res.status(404).json({ error: 'Account not found' });

    // Save allocation on the bank transaction
    const { data, error } = await supabase.from('bank_transactions')
      .update({ allocated_account_id: parseInt(account_id) })
      .eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Create and auto-post journal entry for this allocation
    let journal = null;
    if (bankAccount.linked_account_id) {
      journal = await createAllocationJournal(
        req.companyId, req.user.userId,
        txn, bankAccount, allocAccount
      );
    }

    await auditFromReq(req, 'ALLOCATE', 'bank_transaction', txn.id, {
      module: 'accounting',
      newValue: { account_id, account_name: allocAccount.account_name, journal_created: !!journal }
    });

    res.json({
      transaction: { ...data, allocated_account_name: allocAccount.account_name, allocated_account_number: allocAccount.account_number },
      journal: journal ? { id: journal.id, journal_number: journal.journal_number } : null,
      message: journal ? 'Transaction allocated and journal posted' : 'Transaction allocated (link a GL account to the bank account to auto-create journals)'
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/bank-transactions/:id/reconcile', async (req, res) => {
  try {
    // Verify company ownership through bank account
    const { data: txn } = await supabase.from('bank_transactions').select('*, bank_accounts!inner(company_id)').eq('id', req.params.id).single();
    if (!txn || txn.bank_accounts.company_id !== req.companyId) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const { data, error } = await supabase.from('bank_transactions').update({ is_reconciled: true }).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ transaction: data, message: 'Transaction reconciled' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// FINANCIAL PERIODS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/periods', async (req, res) => {
  try {
    const { data, error } = await supabase.from('financial_periods').select('*').eq('company_id', req.companyId).order('start_date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ periods: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/accounting/periods
 * Create a new financial period
 */
router.post('/periods', async (req, res) => {
  try {
    const { period_name, start_date, end_date } = req.body;
    if (!period_name || !start_date || !end_date) {
      return res.status(400).json({ error: 'period_name, start_date, end_date required' });
    }

    const { data, error } = await supabase.from('financial_periods').insert({
      company_id: req.companyId, period_name, start_date, end_date, status: 'open'
    }).select().single();

    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.message });
    await auditFromReq(req, 'CREATE', 'financial_period', data.id, { module: 'accounting', newValue: { period_name } });
    res.status(201).json({ period: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/periods/:id/close', async (req, res) => {
  try {
    const { data: period } = await supabase.from('financial_periods').select('*').eq('id', req.params.id).eq('company_id', req.companyId).single();
    if (!period) return res.status(404).json({ error: 'Period not found' });
    if (period.status === 'closed') return res.status(400).json({ error: 'Period already closed' });

    const { count: draftCount } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId).eq('period_id', period.id).eq('status', 'draft');
    if (draftCount > 0) return res.status(400).json({ error: `Cannot close — ${draftCount} draft journal(s) remain` });

    const { data, error } = await supabase.from('financial_periods').update({ status: 'closed', closed_by: req.user.userId, closed_at: new Date().toISOString() }).eq('id', period.id).select().single();
    if (error) return res.status(500).json({ error: error.message });

    await auditFromReq(req, 'CLOSE', 'financial_period', period.id, { module: 'accounting', newValue: { period_name: period.period_name } });
    res.json({ period: data, message: 'Period closed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/reports/trial-balance', async (req, res) => {
  try {
    const { data: accounts } = await supabase.from('chart_of_accounts').select('*').eq('company_id', req.companyId).eq('is_active', true).order('account_number');
    const rows = (accounts || []).map(a => {
      const bal = parseFloat(a.current_balance || 0);
      const isDebitNormal = ['Asset', 'Expense'].includes(a.account_type);
      return {
        account_number: a.account_number, account_name: a.account_name, account_type: a.account_type,
        debit: (isDebitNormal && bal > 0) || (!isDebitNormal && bal < 0) ? Math.abs(bal) : 0,
        credit: (!isDebitNormal && bal > 0) || (isDebitNormal && bal < 0) ? Math.abs(bal) : 0,
      };
    }).filter(r => r.debit > 0 || r.credit > 0);

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
    res.json({
      report: 'Trial Balance', as_at: new Date().toISOString().split('T')[0],
      rows,
      totals: { debit: totalDebit, credit: totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/reports/income-statement', async (req, res) => {
  try {
    const { data: accounts } = await supabase.from('chart_of_accounts').select('*').eq('company_id', req.companyId).eq('is_active', true);
    const accts = accounts || [];
    const mapA = a => ({ account_number: a.account_number, account_name: a.account_name, sub_type: a.sub_type, amount: parseFloat(a.current_balance || 0) });

    const income = accts.filter(a => a.account_type === 'Income').map(mapA);
    const expenses = accts.filter(a => a.account_type === 'Expense').map(mapA);
    const totalIncome = income.reduce((s, a) => s + a.amount, 0);
    const totalExpenses = expenses.reduce((s, a) => s + a.amount, 0);
    const costOfSales = expenses.filter(e => e.sub_type === 'Cost of Sales');
    const operatingExpenses = expenses.filter(e => e.sub_type === 'Operating Expense');
    const financeCosts = expenses.filter(e => e.sub_type === 'Finance Cost');
    const grossProfit = totalIncome - costOfSales.reduce((s, e) => s + e.amount, 0);

    res.json({
      report: 'Income Statement', period: 'Year to Date',
      income, cost_of_sales: costOfSales, gross_profit: grossProfit,
      operating_expenses: operatingExpenses, finance_costs: financeCosts,
      total_income: totalIncome, total_expenses: totalExpenses,
      net_profit: totalIncome - totalExpenses
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/reports/balance-sheet', async (req, res) => {
  try {
    const { data: accounts } = await supabase.from('chart_of_accounts').select('*').eq('company_id', req.companyId).eq('is_active', true);
    const accts = accounts || [];
    const mapA = a => ({ account_number: a.account_number, account_name: a.account_name, sub_type: a.sub_type, amount: parseFloat(a.current_balance || 0) });

    const assets = accts.filter(a => a.account_type === 'Asset').map(mapA);
    const liabilities = accts.filter(a => a.account_type === 'Liability').map(mapA);
    const equity = accts.filter(a => a.account_type === 'Equity').map(mapA);
    const netProfit = accts.filter(a => a.account_type === 'Income').reduce((s, a) => s + parseFloat(a.current_balance || 0), 0) -
      accts.filter(a => a.account_type === 'Expense').reduce((s, a) => s + parseFloat(a.current_balance || 0), 0);

    const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + a.amount, 0);
    const totalEquity = equity.reduce((s, a) => s + a.amount, 0) + netProfit;

    res.json({
      report: 'Balance Sheet', as_at: new Date().toISOString().split('T')[0],
      current_assets: assets.filter(a => a.sub_type === 'Current Asset'),
      non_current_assets: assets.filter(a => a.sub_type === 'Non-Current Asset'),
      total_assets: totalAssets,
      current_liabilities: liabilities.filter(a => a.sub_type === 'Current Liability'),
      non_current_liabilities: liabilities.filter(a => a.sub_type === 'Non-Current Liability'),
      total_liabilities: totalLiabilities,
      equity, net_profit_ytd: netProfit,
      total_equity: totalEquity,
      total_liabilities_and_equity: totalLiabilities + totalEquity,
      balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/reports/general-ledger', async (req, res) => {
  try {
    const { account_id } = req.query;
    if (!account_id) return res.status(400).json({ error: 'account_id query parameter required' });

    const { data: account } = await supabase.from('chart_of_accounts').select('*').eq('id', account_id).eq('company_id', req.companyId).single();
    if (!account) return res.status(404).json({ error: 'Account not found' });

    // Get all journal lines for this account, with journal details
    const { data: lines } = await supabase.from('journal_lines')
      .select('*, journal_entries(journal_number, date, description, reference, status)')
      .eq('account_id', account.id);

    // Only include lines from posted journals
    const postedLines = (lines || []).filter(l => l.journal_entries?.status === 'posted');

    const sorted = postedLines.sort((a, b) => new Date(a.journal_entries?.date) - new Date(b.journal_entries?.date));
    let balance = parseFloat(account.opening_balance || 0);
    const entries = sorted.map(l => {
      const change = ['Asset', 'Expense'].includes(account.account_type) ? (l.debit - l.credit) : (l.credit - l.debit);
      balance += change;
      return {
        date: l.journal_entries?.date,
        journal_number: l.journal_entries?.journal_number,
        journal_description: l.journal_entries?.description,
        reference: l.journal_entries?.reference || '',
        line_description: l.description,
        debit: l.debit,
        credit: l.credit,
        running_balance: balance
      };
    });

    res.json({
      report: 'General Ledger',
      account: { account_number: account.account_number, account_name: account.account_name, account_type: account.account_type },
      opening_balance: parseFloat(account.opening_balance || 0),
      entries,
      closing_balance: balance
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIERS (Trade Creditors)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/suppliers', async (req, res) => {
  try {
    const { search, active_only } = req.query;
    let query = supabase.from('suppliers').select('*').eq('company_id', req.companyId);
    if (active_only !== 'false') query = query.eq('is_active', true);
    if (search) query = query.or(`supplier_name.ilike.%${search}%,supplier_code.ilike.%${search}%`);
    query = query.order('supplier_name');

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ suppliers: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/suppliers/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('suppliers').select('*').eq('id', req.params.id).eq('company_id', req.companyId).single();
    if (error || !data) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ supplier: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/suppliers', async (req, res) => {
  try {
    const { supplier_code, supplier_name, contact_name, contact_email, contact_phone, address, payment_terms, tax_reference, bank_name, bank_account, bank_branch_code } = req.body;
    if (!supplier_code || !supplier_name) return res.status(400).json({ error: 'supplier_code and supplier_name required' });

    const { data, error } = await supabase.from('suppliers').insert({
      company_id: req.companyId, supplier_code, supplier_name, contact_name, contact_email, contact_phone,
      address, payment_terms: payment_terms || 30, tax_reference,
      bank_name, bank_account, bank_branch_code, is_active: true
    }).select().single();

    if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.message });
    await auditFromReq(req, 'CREATE', 'supplier', data.id, { module: 'accounting', newValue: { supplier_code, supplier_name } });
    res.status(201).json({ supplier: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/suppliers/:id', async (req, res) => {
  try {
    const allowed = ['supplier_name', 'contact_name', 'contact_email', 'contact_phone', 'address', 'payment_terms', 'tax_reference', 'bank_name', 'bank_account', 'bank_branch_code', 'is_active'];
    const updates = {};
    for (const key of allowed) { if (req.body[key] !== undefined) updates[key] = req.body[key]; }

    const { data, error } = await supabase.from('suppliers').update(updates).eq('id', req.params.id).eq('company_id', req.companyId).select().single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ supplier: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER INVOICES (Trade Debtors → GL)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/customer-invoices', async (req, res) => {
  try {
    const { customer_id, status, search } = req.query;
    let query = supabase.from('customer_invoices').select('*, customers(name, customer_number)').eq('company_id', req.companyId);
    if (customer_id) query = query.eq('customer_id', parseInt(customer_id));
    if (status) query = query.eq('status', status);
    if (search) query = query.or(`invoice_number.ilike.%${search}%`);
    query = query.order('date', { ascending: false });

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ invoices: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/customer-invoices/:id', async (req, res) => {
  try {
    const { data: invoice, error } = await supabase.from('customer_invoices')
      .select('*, customers(name, customer_number), customer_invoice_lines(*)').eq('id', req.params.id).eq('company_id', req.companyId).single();
    if (error || !invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ invoice });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/accounting/customer-invoices
 * Creates invoice AND auto-creates journal: DR Trade Debtors, CR Revenue (+ VAT)
 */
router.post('/customer-invoices', async (req, res) => {
  try {
    const { customer_id, date, due_date, lines, notes, sale_id } = req.body;
    if (!customer_id || !date || !lines || lines.length === 0) {
      return res.status(400).json({ error: 'customer_id, date, and lines required' });
    }

    // Calculate totals
    let subtotal = 0, vatTotal = 0;
    for (const line of lines) {
      const lt = (parseFloat(line.quantity) || 1) * (parseFloat(line.unit_price) || 0);
      subtotal += lt;
      vatTotal += lt * ((parseFloat(line.vat_rate) || 15) / (100 + (parseFloat(line.vat_rate) || 15)));
    }
    const totalAmount = subtotal;

    // Generate invoice number
    const { count } = await supabase.from('customer_invoices').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
    const invoiceNumber = `INV-${new Date(date).getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`;

    // Create invoice
    const { data: invoice, error: invError } = await supabase.from('customer_invoices').insert({
      company_id: req.companyId, customer_id: parseInt(customer_id), invoice_number: invoiceNumber,
      date, due_date: due_date || null, status: 'sent',
      subtotal, vat_amount: vatTotal, total_amount: totalAmount,
      amount_paid: 0, balance_due: totalAmount, notes,
      sale_id: sale_id || null, created_by: req.user.userId
    }).select().single();

    if (invError) return res.status(500).json({ error: invError.message });

    // Insert invoice lines
    const invLines = lines.map(l => ({
      invoice_id: invoice.id, account_id: l.account_id ? parseInt(l.account_id) : null,
      description: l.description || '', quantity: parseFloat(l.quantity) || 1,
      unit_price: parseFloat(l.unit_price) || 0, vat_rate: parseFloat(l.vat_rate) || 15,
      line_total: (parseFloat(l.quantity) || 1) * (parseFloat(l.unit_price) || 0)
    }));
    await supabase.from('customer_invoice_lines').insert(invLines);

    // Auto-create journal: DR Trade Debtors, CR Revenue accounts
    // Find Trade Debtors account (account type Asset, typically 1100 or similar)
    const { data: debtorAcct } = await supabase.from('chart_of_accounts').select('id, account_name')
      .eq('company_id', req.companyId).ilike('account_name', '%trade debtor%').limit(1).single();

    let journal = null;
    if (debtorAcct) {
      // Build journal lines: DR Trade Debtors for full amount, CR each revenue line account
      const { count: jnlCount } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
      const jnlNum = `JNL-${new Date(date).getFullYear()}-${String((jnlCount || 0) + 1).padStart(3, '0')}`;

      const { data: openPeriod } = await supabase.from('financial_periods').select('id')
        .eq('company_id', req.companyId).eq('status', 'open').limit(1).single();

      const { data: jnl, error: jnlError } = await supabase.from('journal_entries').insert({
        company_id: req.companyId, journal_number: jnlNum, date,
        description: `Customer Invoice ${invoiceNumber}`, reference: invoiceNumber,
        type: 'general', status: 'draft', total_debit: totalAmount, total_credit: totalAmount,
        period_id: openPeriod ? openPeriod.id : null, created_by: req.user.userId
      }).select().single();

      if (!jnlError && jnl) {
        journal = jnl;

        // DR Trade Debtors
        const journalLines = [
          { journal_id: jnl.id, account_id: debtorAcct.id, debit: totalAmount, credit: 0, description: `Invoice ${invoiceNumber}` }
        ];

        // CR Revenue accounts (from each line) — if no account_id on line, find a default revenue account
        const revenueTotal = totalAmount;
        const lineAccounts = lines.filter(l => l.account_id);
        if (lineAccounts.length > 0) {
          for (const l of lineAccounts) {
            const lt = (parseFloat(l.quantity) || 1) * (parseFloat(l.unit_price) || 0);
            journalLines.push({ journal_id: jnl.id, account_id: parseInt(l.account_id), debit: 0, credit: lt, description: l.description || 'Revenue' });
          }
        } else {
          // Find default revenue account
          const { data: revAcct } = await supabase.from('chart_of_accounts').select('id')
            .eq('company_id', req.companyId).eq('account_type', 'Income').limit(1).single();
          if (revAcct) {
            journalLines.push({ journal_id: jnl.id, account_id: revAcct.id, debit: 0, credit: revenueTotal, description: 'Sales Revenue' });
          }
        }

        await supabase.from('journal_lines').insert(journalLines);

        // Link journal to invoice
        await supabase.from('customer_invoices').update({ journal_id: jnl.id }).eq('id', invoice.id);
      }
    }

    // Update customer balance
    await supabase.from('customers').select('current_balance').eq('id', customer_id).eq('company_id', req.companyId).single()
      .then(({ data: cust }) => {
        if (cust) {
          supabase.from('customers').update({ current_balance: parseFloat(cust.current_balance || 0) + totalAmount }).eq('id', customer_id).eq('company_id', req.companyId).then(() => {});
        }
      });

    await auditFromReq(req, 'CREATE', 'customer_invoice', invoice.id, { module: 'accounting', newValue: { invoice_number: invoiceNumber, total: totalAmount } });
    res.status(201).json({ invoice, journal: journal ? { id: journal.id, journal_number: journal.journal_number } : null });
  } catch (err) {
    console.error('Create customer invoice error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/accounting/customer-invoices/:id/pay
 * Record payment → DR Bank/Cash, CR Trade Debtors → update invoice + customer balance
 */
router.post('/customer-invoices/:id/pay', async (req, res) => {
  try {
    const { amount, payment_date, bank_account_id, reference } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount required' });

    const { data: invoice } = await supabase.from('customer_invoices').select('*')
      .eq('id', req.params.id).eq('company_id', req.companyId).single();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const payAmount = parseFloat(amount);
    const newPaid = parseFloat(invoice.amount_paid) + payAmount;
    const newBalance = parseFloat(invoice.total_amount) - newPaid;
    const newStatus = newBalance <= 0.01 ? 'paid' : 'partial';

    await supabase.from('customer_invoices').update({
      amount_paid: newPaid, balance_due: Math.max(0, newBalance), status: newStatus
    }).eq('id', invoice.id);

    // Create payment journal: DR Bank/Cash, CR Trade Debtors
    const { data: debtorAcct } = await supabase.from('chart_of_accounts').select('id')
      .eq('company_id', req.companyId).ilike('account_name', '%trade debtor%').limit(1).single();

    let bankGlId = null;
    if (bank_account_id) {
      const { data: bank } = await supabase.from('bank_accounts').select('linked_account_id')
        .eq('id', bank_account_id).eq('company_id', req.companyId).single();
      bankGlId = bank ? bank.linked_account_id : null;
    }
    if (!bankGlId) {
      // Fallback: find Cash/Bank asset account
      const { data: cashAcct } = await supabase.from('chart_of_accounts').select('id')
        .eq('company_id', req.companyId).eq('account_type', 'Asset').ilike('account_name', '%bank%').limit(1).single();
      bankGlId = cashAcct ? cashAcct.id : null;
    }

    let journal = null;
    if (debtorAcct && bankGlId) {
      const { count } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
      const jnlNum = `JNL-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`;
      const pDate = payment_date || new Date().toISOString().split('T')[0];

      const { data: openPeriod } = await supabase.from('financial_periods').select('id')
        .eq('company_id', req.companyId).eq('status', 'open').limit(1).single();

      const { data: jnl } = await supabase.from('journal_entries').insert({
        company_id: req.companyId, journal_number: jnlNum, date: pDate,
        description: `Payment received: Invoice ${invoice.invoice_number}`, reference: reference || invoice.invoice_number,
        type: 'general', status: 'posted', total_debit: payAmount, total_credit: payAmount,
        period_id: openPeriod ? openPeriod.id : null,
        created_by: req.user.userId, posted_by: req.user.userId, posted_at: new Date().toISOString()
      }).select().single();

      if (jnl) {
        journal = jnl;
        const jLines = [
          { journal_id: jnl.id, account_id: bankGlId, debit: payAmount, credit: 0, description: `Payment - ${invoice.invoice_number}` },
          { journal_id: jnl.id, account_id: debtorAcct.id, debit: 0, credit: payAmount, description: `Payment - ${invoice.invoice_number}` }
        ];
        await supabase.from('journal_lines').insert(jLines);

        // Update GL balances
        for (const line of jLines) {
          const { data: acct } = await supabase.from('chart_of_accounts').select('current_balance, account_type').eq('id', line.account_id).single();
          if (acct) {
            const change = ['Asset', 'Expense'].includes(acct.account_type) ? (line.debit - line.credit) : (line.credit - line.debit);
            await supabase.from('chart_of_accounts').update({ current_balance: parseFloat(acct.current_balance) + change }).eq('id', line.account_id);
          }
        }

        await supabase.from('customer_invoices').update({ payment_journal_id: jnl.id }).eq('id', invoice.id);
      }
    }

    // Update customer balance
    await supabase.from('customers').select('current_balance').eq('id', invoice.customer_id).eq('company_id', req.companyId).single()
      .then(({ data: cust }) => {
        if (cust) {
          supabase.from('customers').update({ current_balance: Math.max(0, parseFloat(cust.current_balance || 0) - payAmount) }).eq('id', invoice.customer_id).eq('company_id', req.companyId).then(() => {});
        }
      });

    res.json({ success: true, status: newStatus, journal: journal ? { id: journal.id, journal_number: journal.journal_number } : null });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIER INVOICES (Trade Creditors → GL)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/supplier-invoices', async (req, res) => {
  try {
    const { supplier_id, status, search } = req.query;
    let query = supabase.from('supplier_invoices').select('*, suppliers(supplier_name, supplier_code)').eq('company_id', req.companyId);
    if (supplier_id) query = query.eq('supplier_id', parseInt(supplier_id));
    if (status) query = query.eq('status', status);
    if (search) query = query.or(`invoice_number.ilike.%${search}%,supplier_ref.ilike.%${search}%`);
    query = query.order('date', { ascending: false });

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ invoices: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/supplier-invoices/:id', async (req, res) => {
  try {
    const { data: invoice, error } = await supabase.from('supplier_invoices')
      .select('*, suppliers(supplier_name, supplier_code), supplier_invoice_lines(*)').eq('id', req.params.id).eq('company_id', req.companyId).single();
    if (error || !invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ invoice });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/accounting/supplier-invoices
 * Creates invoice AND auto-creates journal: DR Expense accounts, CR Trade Creditors
 */
router.post('/supplier-invoices', async (req, res) => {
  try {
    const { supplier_id, date, due_date, supplier_ref, lines, notes } = req.body;
    if (!supplier_id || !date || !lines || lines.length === 0) {
      return res.status(400).json({ error: 'supplier_id, date, and lines required' });
    }

    let subtotal = 0, vatTotal = 0;
    for (const line of lines) {
      const lt = (parseFloat(line.quantity) || 1) * (parseFloat(line.unit_price) || 0);
      subtotal += lt;
      vatTotal += lt * ((parseFloat(line.vat_rate) || 15) / (100 + (parseFloat(line.vat_rate) || 15)));
    }
    const totalAmount = subtotal;

    const { count } = await supabase.from('supplier_invoices').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
    const invoiceNumber = `SINV-${new Date(date).getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`;

    const { data: invoice, error: invError } = await supabase.from('supplier_invoices').insert({
      company_id: req.companyId, supplier_id: parseInt(supplier_id), invoice_number: invoiceNumber,
      supplier_ref: supplier_ref || null, date, due_date: due_date || null, status: 'approved',
      subtotal, vat_amount: vatTotal, total_amount: totalAmount,
      amount_paid: 0, balance_due: totalAmount, notes,
      created_by: req.user.userId
    }).select().single();

    if (invError) return res.status(500).json({ error: invError.message });

    const invLines = lines.map(l => ({
      invoice_id: invoice.id, account_id: l.account_id ? parseInt(l.account_id) : null,
      description: l.description || '', quantity: parseFloat(l.quantity) || 1,
      unit_price: parseFloat(l.unit_price) || 0, vat_rate: parseFloat(l.vat_rate) || 15,
      line_total: (parseFloat(l.quantity) || 1) * (parseFloat(l.unit_price) || 0)
    }));
    await supabase.from('supplier_invoice_lines').insert(invLines);

    // Auto-create journal: DR Expense/Asset accounts, CR Trade Creditors
    const { data: creditorAcct } = await supabase.from('chart_of_accounts').select('id, account_name')
      .eq('company_id', req.companyId).ilike('account_name', '%trade creditor%').limit(1).single();

    let journal = null;
    if (creditorAcct) {
      const { count: jnlCount } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
      const jnlNum = `JNL-${new Date(date).getFullYear()}-${String((jnlCount || 0) + 1).padStart(3, '0')}`;

      const { data: openPeriod } = await supabase.from('financial_periods').select('id')
        .eq('company_id', req.companyId).eq('status', 'open').limit(1).single();

      const { data: jnl } = await supabase.from('journal_entries').insert({
        company_id: req.companyId, journal_number: jnlNum, date,
        description: `Supplier Invoice ${invoiceNumber}`, reference: supplier_ref || invoiceNumber,
        type: 'general', status: 'draft', total_debit: totalAmount, total_credit: totalAmount,
        period_id: openPeriod ? openPeriod.id : null, created_by: req.user.userId
      }).select().single();

      if (jnl) {
        journal = jnl;
        const journalLines = [];

        // DR Expense accounts from each line
        const lineAccounts = lines.filter(l => l.account_id);
        if (lineAccounts.length > 0) {
          for (const l of lineAccounts) {
            const lt = (parseFloat(l.quantity) || 1) * (parseFloat(l.unit_price) || 0);
            journalLines.push({ journal_id: jnl.id, account_id: parseInt(l.account_id), debit: lt, credit: 0, description: l.description || 'Expense' });
          }
        } else {
          const { data: expAcct } = await supabase.from('chart_of_accounts').select('id')
            .eq('company_id', req.companyId).eq('account_type', 'Expense').limit(1).single();
          if (expAcct) {
            journalLines.push({ journal_id: jnl.id, account_id: expAcct.id, debit: totalAmount, credit: 0, description: 'Purchase Expense' });
          }
        }

        // CR Trade Creditors
        journalLines.push({ journal_id: jnl.id, account_id: creditorAcct.id, debit: 0, credit: totalAmount, description: `Supplier Invoice ${invoiceNumber}` });

        await supabase.from('journal_lines').insert(journalLines);
        await supabase.from('supplier_invoices').update({ journal_id: jnl.id }).eq('id', invoice.id);
      }
    }

    await auditFromReq(req, 'CREATE', 'supplier_invoice', invoice.id, { module: 'accounting', newValue: { invoice_number: invoiceNumber, total: totalAmount } });
    res.status(201).json({ invoice, journal: journal ? { id: journal.id, journal_number: journal.journal_number } : null });
  } catch (err) {
    console.error('Create supplier invoice error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/accounting/supplier-invoices/:id/pay
 * Record payment → DR Trade Creditors, CR Bank → update invoice
 */
router.post('/supplier-invoices/:id/pay', async (req, res) => {
  try {
    const { amount, payment_date, bank_account_id, reference } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount required' });

    const { data: invoice } = await supabase.from('supplier_invoices').select('*')
      .eq('id', req.params.id).eq('company_id', req.companyId).single();
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const payAmount = parseFloat(amount);
    const newPaid = parseFloat(invoice.amount_paid) + payAmount;
    const newBalance = parseFloat(invoice.total_amount) - newPaid;
    const newStatus = newBalance <= 0.01 ? 'paid' : 'partial';

    await supabase.from('supplier_invoices').update({
      amount_paid: newPaid, balance_due: Math.max(0, newBalance), status: newStatus
    }).eq('id', invoice.id);

    // Create payment journal: DR Trade Creditors, CR Bank
    const { data: creditorAcct } = await supabase.from('chart_of_accounts').select('id')
      .eq('company_id', req.companyId).ilike('account_name', '%trade creditor%').limit(1).single();

    let bankGlId = null;
    if (bank_account_id) {
      const { data: bank } = await supabase.from('bank_accounts').select('linked_account_id')
        .eq('id', bank_account_id).eq('company_id', req.companyId).single();
      bankGlId = bank ? bank.linked_account_id : null;
    }
    if (!bankGlId) {
      const { data: cashAcct } = await supabase.from('chart_of_accounts').select('id')
        .eq('company_id', req.companyId).eq('account_type', 'Asset').ilike('account_name', '%bank%').limit(1).single();
      bankGlId = cashAcct ? cashAcct.id : null;
    }

    let journal = null;
    if (creditorAcct && bankGlId) {
      const { count } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
      const jnlNum = `JNL-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`;
      const pDate = payment_date || new Date().toISOString().split('T')[0];

      const { data: openPeriod } = await supabase.from('financial_periods').select('id')
        .eq('company_id', req.companyId).eq('status', 'open').limit(1).single();

      const { data: jnl } = await supabase.from('journal_entries').insert({
        company_id: req.companyId, journal_number: jnlNum, date: pDate,
        description: `Payment to supplier: Invoice ${invoice.invoice_number}`, reference: reference || invoice.invoice_number,
        type: 'general', status: 'posted', total_debit: payAmount, total_credit: payAmount,
        period_id: openPeriod ? openPeriod.id : null,
        created_by: req.user.userId, posted_by: req.user.userId, posted_at: new Date().toISOString()
      }).select().single();

      if (jnl) {
        journal = jnl;
        const jLines = [
          { journal_id: jnl.id, account_id: creditorAcct.id, debit: payAmount, credit: 0, description: `Payment - ${invoice.invoice_number}` },
          { journal_id: jnl.id, account_id: bankGlId, debit: 0, credit: payAmount, description: `Payment - ${invoice.invoice_number}` }
        ];
        await supabase.from('journal_lines').insert(jLines);

        // Update GL balances
        for (const line of jLines) {
          const { data: acct } = await supabase.from('chart_of_accounts').select('current_balance, account_type').eq('id', line.account_id).single();
          if (acct) {
            const change = ['Asset', 'Expense'].includes(acct.account_type) ? (line.debit - line.credit) : (line.credit - line.debit);
            await supabase.from('chart_of_accounts').update({ current_balance: parseFloat(acct.current_balance) + change }).eq('id', line.account_id);
          }
        }

        await supabase.from('supplier_invoices').update({ payment_journal_id: jnl.id }).eq('id', invoice.id);
      }
    }

    res.json({ success: true, status: newStatus, journal: journal ? { id: journal.id, journal_number: journal.journal_number } : null });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER/SUPPLIER LEDGER REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/accounting/reports/debtors-age
 * Debtors Age Analysis — outstanding customer invoices grouped by age
 */
router.get('/reports/debtors-age', async (req, res) => {
  try {
    const { data: invoices } = await supabase.from('customer_invoices')
      .select('*, customers(name, customer_number)')
      .eq('company_id', req.companyId)
      .in('status', ['sent', 'partial', 'overdue'])
      .order('customer_id');

    const today = new Date();
    const aging = {};

    for (const inv of (invoices || [])) {
      const custId = inv.customer_id;
      if (!aging[custId]) {
        aging[custId] = {
          customer_id: custId,
          customer_name: inv.customers?.name || 'Unknown',
          customer_number: inv.customers?.customer_number || '',
          current: 0, days_30: 0, days_60: 0, days_90: 0, over_90: 0, total: 0
        };
      }
      const daysOld = Math.floor((today - new Date(inv.date)) / (1000 * 60 * 60 * 24));
      const balance = parseFloat(inv.balance_due) || 0;

      if (daysOld <= 30) aging[custId].current += balance;
      else if (daysOld <= 60) aging[custId].days_30 += balance;
      else if (daysOld <= 90) aging[custId].days_60 += balance;
      else if (daysOld <= 120) aging[custId].days_90 += balance;
      else aging[custId].over_90 += balance;
      aging[custId].total += balance;
    }

    const rows = Object.values(aging);
    res.json({
      report: 'Debtors Age Analysis', as_at: today.toISOString().split('T')[0],
      rows,
      totals: {
        current: rows.reduce((s, r) => s + r.current, 0),
        days_30: rows.reduce((s, r) => s + r.days_30, 0),
        days_60: rows.reduce((s, r) => s + r.days_60, 0),
        days_90: rows.reduce((s, r) => s + r.days_90, 0),
        over_90: rows.reduce((s, r) => s + r.over_90, 0),
        total: rows.reduce((s, r) => s + r.total, 0)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/accounting/reports/creditors-age
 * Creditors Age Analysis — outstanding supplier invoices grouped by age
 */
router.get('/reports/creditors-age', async (req, res) => {
  try {
    const { data: invoices } = await supabase.from('supplier_invoices')
      .select('*, suppliers(supplier_name, supplier_code)')
      .eq('company_id', req.companyId)
      .in('status', ['approved', 'partial', 'overdue'])
      .order('supplier_id');

    const today = new Date();
    const aging = {};

    for (const inv of (invoices || [])) {
      const suppId = inv.supplier_id;
      if (!aging[suppId]) {
        aging[suppId] = {
          supplier_id: suppId,
          supplier_name: inv.suppliers?.supplier_name || 'Unknown',
          supplier_code: inv.suppliers?.supplier_code || '',
          current: 0, days_30: 0, days_60: 0, days_90: 0, over_90: 0, total: 0
        };
      }
      const daysOld = Math.floor((today - new Date(inv.date)) / (1000 * 60 * 60 * 24));
      const balance = parseFloat(inv.balance_due) || 0;

      if (daysOld <= 30) aging[suppId].current += balance;
      else if (daysOld <= 60) aging[suppId].days_30 += balance;
      else if (daysOld <= 90) aging[suppId].days_60 += balance;
      else if (daysOld <= 120) aging[suppId].days_90 += balance;
      else aging[suppId].over_90 += balance;
      aging[suppId].total += balance;
    }

    const rows = Object.values(aging);
    res.json({
      report: 'Creditors Age Analysis', as_at: today.toISOString().split('T')[0],
      rows,
      totals: {
        current: rows.reduce((s, r) => s + r.current, 0),
        days_30: rows.reduce((s, r) => s + r.days_30, 0),
        days_60: rows.reduce((s, r) => s + r.days_60, 0),
        days_90: rows.reduce((s, r) => s + r.days_90, 0),
        over_90: rows.reduce((s, r) => s + r.over_90, 0),
        total: rows.reduce((s, r) => s + r.total, 0)
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
