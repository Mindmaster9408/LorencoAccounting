/**
 * ============================================================================
 * Accounting Module — Supabase-backed Routes
 * ============================================================================
 * Chart of Accounts, Journal Entries, Bank Accounts/Transactions,
 * Financial Periods, and Financial Reports (TB, IS, BS, GL).
 * ============================================================================
 */

const express = require('express');
const { supabase } = require('../../config/database');
const { requireCompany } = require('../../middleware/auth');
const { auditFromReq } = require('../../middleware/audit');

const router = express.Router();

router.use(requireCompany);

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS / DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/status', async (req, res) => {
  try {
    const { count: acctCount } = await supabase.from('chart_of_accounts').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
    const { count: jnlCount } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
    const { count: bankCount } = await supabase.from('bank_accounts').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);

    res.json({
      module: 'accounting', status: 'active',
      summary: { total_accounts: acctCount || 0, total_journals: jnlCount || 0, bank_accounts: bankCount || 0 }
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

    res.json({
      summary: {
        total_assets: totalAssets, total_liabilities: totalLiabilities, total_equity: totalEquity,
        total_income: totalIncome, total_expenses: totalExpenses, net_profit: totalIncome - totalExpenses,
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
    const { status, search } = req.query;
    let query = supabase.from('journal_entries').select('*').eq('company_id', req.companyId);
    if (status) query = query.eq('status', status);
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

    const { count } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('company_id', req.companyId);
    const journalNumber = `JNL-${new Date(date).getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`;

    const { data: journal, error } = await supabase.from('journal_entries').insert({
      company_id: req.companyId, journal_number: journalNumber, date, description,
      reference: reference || null, type: type || 'general', status: 'draft',
      total_debit: totalDebit, total_credit: totalCredit, created_by: req.user.userId
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });

    const jnlLines = lines.map(l => ({
      journal_id: journal.id, account_id: parseInt(l.account_id),
      debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0, description: l.description || ''
    }));
    await supabase.from('journal_lines').insert(jnlLines);

    await auditFromReq(req, 'CREATE', 'journal', journal.id, { module: 'accounting', newValue: { journal_number: journalNumber, description, total: totalDebit.toFixed(2) } });
    res.status(201).json({ journal: { ...journal, lines: jnlLines } });
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
      total_debit: journal.total_credit, total_credit: journal.total_debit, created_by: req.user.userId
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
// BANK ACCOUNTS & TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/bank-accounts', async (req, res) => {
  try {
    const { data, error } = await supabase.from('bank_accounts').select('*').eq('company_id', req.companyId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ bank_accounts: data || [] });
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
      linked_account_id: linked_account_id || null, is_active: true
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ bank_account: data });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/bank-transactions', async (req, res) => {
  try {
    const { bank_account_id, reconciled, search } = req.query;
    let query = supabase.from('bank_transactions').select('*, bank_accounts!inner(company_id, bank_name)').eq('bank_accounts.company_id', req.companyId);
    if (bank_account_id) query = query.eq('bank_account_id', bank_account_id);
    if (reconciled !== undefined) query = query.eq('is_reconciled', reconciled === 'true');
    if (search) query = query.or(`description.ilike.%${search}%,reference.ilike.%${search}%`);
    query = query.order('date', { ascending: false });

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ transactions: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/bank-transactions/:id/allocate', async (req, res) => {
  try {
    const { account_id } = req.body;
    if (!account_id) return res.status(400).json({ error: 'account_id required' });
    const { data, error } = await supabase.from('bank_transactions').update({ allocated_account_id: parseInt(account_id) }).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ transaction: data, message: 'Transaction allocated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/bank-transactions/:id/reconcile', async (req, res) => {
  try {
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
    res.json({ report: 'Trial Balance', as_at: new Date().toISOString().split('T')[0], rows, totals: { debit: totalDebit, credit: totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 } });
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
    const grossProfit = totalIncome - costOfSales.reduce((s, e) => s + e.amount, 0);

    res.json({ report: 'Income Statement', period: 'Year to Date', income, cost_of_sales: costOfSales, gross_profit: grossProfit, operating_expenses: expenses.filter(e => e.sub_type === 'Operating Expense'), finance_costs: expenses.filter(e => e.sub_type === 'Finance Cost'), total_income: totalIncome, total_expenses: totalExpenses, net_profit: totalIncome - totalExpenses });
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
    const netProfit = accts.filter(a => a.account_type === 'Income').reduce((s, a) => s + parseFloat(a.current_balance || 0), 0) - accts.filter(a => a.account_type === 'Expense').reduce((s, a) => s + parseFloat(a.current_balance || 0), 0);
    const totalAssets = assets.reduce((s, a) => s + a.amount, 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + a.amount, 0);
    const totalEquity = equity.reduce((s, a) => s + a.amount, 0) + netProfit;

    res.json({ report: 'Balance Sheet', as_at: new Date().toISOString().split('T')[0], current_assets: assets.filter(a => a.sub_type === 'Current Asset'), non_current_assets: assets.filter(a => a.sub_type === 'Non-Current Asset'), total_assets: totalAssets, current_liabilities: liabilities.filter(a => a.sub_type === 'Current Liability'), non_current_liabilities: liabilities.filter(a => a.sub_type === 'Non-Current Liability'), total_liabilities: totalLiabilities, equity, net_profit_ytd: netProfit, total_equity: totalEquity, total_liabilities_and_equity: totalLiabilities + totalEquity, balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 });
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

    const { data: lines } = await supabase.from('journal_lines').select('*, journal_entries(journal_number, date, description, reference, status)').eq('account_id', account.id);
    const sorted = (lines || []).sort((a, b) => new Date(a.journal_entries?.date) - new Date(b.journal_entries?.date));
    let balance = parseFloat(account.opening_balance || 0);
    const entries = sorted.map(l => {
      const change = ['Asset', 'Expense'].includes(account.account_type) ? (l.debit - l.credit) : (l.credit - l.debit);
      balance += change;
      return { date: l.journal_entries?.date, journal_number: l.journal_entries?.journal_number, journal_description: l.journal_entries?.description, debit: l.debit, credit: l.credit, running_balance: balance };
    });

    res.json({ report: 'General Ledger', account: { account_number: account.account_number, account_name: account.account_name, account_type: account.account_type }, opening_balance: parseFloat(account.opening_balance || 0), entries, closing_balance: balance });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
