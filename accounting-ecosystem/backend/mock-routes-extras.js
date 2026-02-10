/**
 * ============================================================================
 * MOCK EXTRA ROUTES — Customers, Receipts, Barcodes, Reports, Auth Admin
 * ============================================================================
 * These routes are mounted at TOP-LEVEL paths (not under /api/pos) and are
 * called directly by the POS frontend. In real mode they come from separate
 * route modules; in mock mode we need to provide them here.
 * ============================================================================
 */

const express = require('express');
const { authenticateToken, requireCompany, requirePermission } = require('./middleware/auth');
const mock = require('./mock-data');

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMERS ROUTER — /api/customers
// ═══════════════════════════════════════════════════════════════════════════════
const customersRouter = express.Router();
customersRouter.use(authenticateToken);
customersRouter.use(requireCompany);

customersRouter.get('/', (req, res) => {
  const { search, active_only, group, q } = req.query;
  let results = mock.customers.filter(c => c.company_id === req.companyId);
  if (active_only !== 'false') results = results.filter(c => c.is_active);
  if (group) results = results.filter(c => c.customer_group === group);
  const searchTerm = search || q;
  if (searchTerm) {
    const s = searchTerm.toLowerCase();
    results = results.filter(c =>
      (c.name && c.name.toLowerCase().includes(s)) ||
      (c.phone && c.phone.toLowerCase().includes(s)) ||
      (c.email && c.email && c.email.toLowerCase().includes(s)) ||
      (c.customer_number && c.customer_number.toLowerCase().includes(s))
    );
  }
  results.sort((a, b) => a.name.localeCompare(b.name));
  res.json({ customers: results });
});

customersRouter.get('/search', (req, res) => {
  const { q, query } = req.query;
  const searchTerm = q || query || '';
  const s = searchTerm.toLowerCase();
  let results = mock.customers.filter(c => c.company_id === req.companyId && c.is_active);
  if (s) {
    results = results.filter(c =>
      (c.name && c.name.toLowerCase().includes(s)) ||
      (c.phone && c.phone.toLowerCase().includes(s)) ||
      (c.email && c.email && c.email.toLowerCase().includes(s)) ||
      (c.customer_number && c.customer_number.toLowerCase().includes(s))
    );
  }
  res.json({ customers: results });
});

customersRouter.get('/:id', (req, res) => {
  const customer = mock.customers.find(c => c.id === parseInt(req.params.id) && c.company_id === req.companyId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json({ customer });
});

customersRouter.post('/', (req, res) => {
  const { name, email, phone, address, id_number, customer_group, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const customer = {
    id: mock.nextId(), company_id: req.companyId,
    name, email: email || null, phone: phone || null, address: address || null,
    id_number: id_number || null,
    customer_number: `C-${Date.now().toString(36).toUpperCase()}`,
    customer_group: customer_group || 'retail',
    loyalty_points: 0, loyalty_tier: 'bronze', current_balance: 0,
    notes: notes || null, is_active: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  mock.customers.push(customer);
  res.status(201).json({ customer });
});

customersRouter.put('/:id', (req, res) => {
  const idx = mock.customers.findIndex(c => c.id === parseInt(req.params.id) && c.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
  const allowed = ['name', 'email', 'phone', 'address', 'id_number', 'customer_group', 'notes', 'is_active'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) mock.customers[idx][key] = req.body[key];
  }
  mock.customers[idx].updated_at = new Date().toISOString();
  res.json({ customer: mock.customers[idx] });
});

customersRouter.delete('/:id', (req, res) => {
  const idx = mock.customers.findIndex(c => c.id === parseInt(req.params.id) && c.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
  mock.customers[idx].is_active = false;
  res.json({ success: true });
});

// Loyalty
customersRouter.get('/:id/loyalty', (req, res) => {
  const customer = mock.customers.find(c => c.id === parseInt(req.params.id) && c.company_id === req.companyId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json({ loyalty: { points: customer.loyalty_points, tier: customer.loyalty_tier, history: [] } });
});

customersRouter.post('/:id/loyalty/earn', (req, res) => {
  const idx = mock.customers.findIndex(c => c.id === parseInt(req.params.id) && c.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
  const { points } = req.body;
  mock.customers[idx].loyalty_points += (points || 0);
  res.json({ loyalty: { points: mock.customers[idx].loyalty_points, tier: mock.customers[idx].loyalty_tier } });
});

customersRouter.post('/:id/loyalty/redeem', (req, res) => {
  const idx = mock.customers.findIndex(c => c.id === parseInt(req.params.id) && c.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
  const { points } = req.body;
  if ((points || 0) > mock.customers[idx].loyalty_points) return res.status(400).json({ error: 'Insufficient points' });
  mock.customers[idx].loyalty_points -= (points || 0);
  res.json({ loyalty: { points: mock.customers[idx].loyalty_points, tier: mock.customers[idx].loyalty_tier } });
});

// Account
customersRouter.get('/:id/account', (req, res) => {
  const customer = mock.customers.find(c => c.id === parseInt(req.params.id) && c.company_id === req.companyId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json({ account: { balance: customer.current_balance, credit_limit: 5000, transactions: [] } });
});

customersRouter.post('/:id/account/payment', (req, res) => {
  const idx = mock.customers.findIndex(c => c.id === parseInt(req.params.id) && c.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
  const { amount, method } = req.body;
  mock.customers[idx].current_balance += (amount || 0);
  res.json({ account: { balance: mock.customers[idx].current_balance }, payment: { amount, method, date: new Date().toISOString() } });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RECEIPTS ROUTER — /api/receipts
// ═══════════════════════════════════════════════════════════════════════════════
const receiptsRouter = express.Router();
receiptsRouter.use(authenticateToken);
receiptsRouter.use(requireCompany);

receiptsRouter.get('/preview/:saleId', (req, res) => {
  const sale = mock.sales.find(s => s.id === parseInt(req.params.saleId) && s.company_id === req.companyId);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  const items = mock.saleItems.filter(i => i.sale_id === sale.id);
  const payments = mock.salePayments.filter(p => p.sale_id === sale.id);
  const settings = mock.receiptSettings.find(s => s.company_id === req.companyId) || {};
  const company = mock.companies.find(c => c.id === req.companyId);

  res.json({
    receipt: {
      receipt_number: sale.receipt_number,
      company_name: company ? company.company_name : 'Unknown',
      company_address: company ? company.address : '',
      vat_number: company ? company.tax_number : '',
      date: sale.created_at,
      cashier: 'Staff',
      items: items.map(i => ({ name: i.product_name, qty: i.quantity, price: i.unit_price, total: i.line_total, vat_rate: i.vat_rate })),
      subtotal: sale.subtotal,
      discount: sale.discount_amount,
      vat: sale.vat_amount,
      total: sale.total_amount,
      payments: payments.map(p => ({ method: p.payment_method, amount: p.amount })),
      header: settings.header_text || '',
      footer: settings.footer_text || 'Thank you!',
    },
  });
});

receiptsRouter.post('/print/:saleId', (req, res) => {
  res.json({ success: true, message: 'Receipt sent to printer (mock)' });
});

receiptsRouter.post('/deliver/:saleId', (req, res) => {
  const { method, email, phone } = req.body;
  res.json({ success: true, message: `Receipt delivered via ${method || 'email'} (mock)`, delivered_to: email || phone || 'customer' });
});

receiptsRouter.get('/printers', (req, res) => {
  const results = mock.printers.filter(p => p.company_id === req.companyId);
  res.json({ printers: results });
});

receiptsRouter.post('/printers', (req, res) => {
  const { name, type, connection, ip_address, port, is_default } = req.body;
  const printer = {
    id: mock.nextId(), company_id: req.companyId,
    name: name || 'New Printer', type: type || 'thermal',
    connection: connection || 'usb', ip_address: ip_address || null,
    port: port || null, is_default: is_default || false,
    is_active: true, created_at: new Date().toISOString(),
  };
  mock.printers.push(printer);
  res.status(201).json({ printer });
});

receiptsRouter.put('/printers/:id', (req, res) => {
  const idx = mock.printers.findIndex(p => p.id === parseInt(req.params.id) && p.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Printer not found' });
  const allowed = ['name', 'type', 'connection', 'ip_address', 'port', 'is_default', 'is_active'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) mock.printers[idx][key] = req.body[key];
  }
  res.json({ printer: mock.printers[idx] });
});

receiptsRouter.delete('/printers/:id', (req, res) => {
  const idx = mock.printers.findIndex(p => p.id === parseInt(req.params.id) && p.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Printer not found' });
  mock.printers[idx].is_active = false;
  res.json({ success: true });
});

receiptsRouter.post('/printers/:id/test', (req, res) => {
  res.json({ success: true, message: 'Test page sent to printer (mock)' });
});

receiptsRouter.get('/settings', (req, res) => {
  const settings = mock.receiptSettings.find(s => s.company_id === req.companyId);
  res.json({ settings: settings || {} });
});

receiptsRouter.put('/settings', (req, res) => {
  let idx = mock.receiptSettings.findIndex(s => s.company_id === req.companyId);
  if (idx === -1) {
    mock.receiptSettings.push({ id: mock.nextId(), company_id: req.companyId, ...req.body, created_at: new Date().toISOString() });
    idx = mock.receiptSettings.length - 1;
  } else {
    Object.assign(mock.receiptSettings[idx], req.body);
  }
  res.json({ settings: mock.receiptSettings[idx] });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BARCODE ROUTER — /api/barcode
// ═══════════════════════════════════════════════════════════════════════════════
const barcodeRouter = express.Router();
barcodeRouter.use(authenticateToken);
barcodeRouter.use(requireCompany);

barcodeRouter.get('/check/:barcode', (req, res) => {
  const barcode = req.params.barcode;
  const product = mock.products.find(p => p.barcode === barcode && p.company_id === req.companyId);
  if (product) {
    return res.json({ exists: true, product });
  }
  res.json({ exists: false });
});

barcodeRouter.post('/generate', (req, res) => {
  const { prefix, product_id } = req.body;
  // Generate a unique EAN-13 style barcode
  const timestamp = Date.now().toString().slice(-10);
  const barcode = `${prefix || '690'}${timestamp}`;
  
  if (product_id) {
    const pIdx = mock.products.findIndex(p => p.id === parseInt(product_id) && p.company_id === req.companyId);
    if (pIdx !== -1) {
      mock.products[pIdx].barcode = barcode;
    }
  }

  res.json({ barcode, success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS ROUTER — /api/reports & /api/analytics
// ═══════════════════════════════════════════════════════════════════════════════
const reportsRouter = express.Router();
reportsRouter.use(authenticateToken);
reportsRouter.use(requireCompany);

reportsRouter.get('/dashboard', (req, res) => {
  const sales = mock.sales.filter(s => s.company_id === req.companyId && s.status === 'completed');
  const today = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter(s => s.created_at.startsWith(today));
  
  res.json({
    dashboard: {
      total_sales_today: todaySales.length,
      revenue_today: todaySales.reduce((sum, s) => sum + s.total_amount, 0),
      total_sales_all: sales.length,
      revenue_all: sales.reduce((sum, s) => sum + s.total_amount, 0),
      total_products: mock.products.filter(p => p.company_id === req.companyId && p.is_active).length,
      low_stock_count: mock.products.filter(p => p.company_id === req.companyId && p.is_active && p.stock_quantity <= p.reorder_level).length,
      total_customers: mock.customers.filter(c => c.company_id === req.companyId && c.is_active).length,
    },
  });
});

reportsRouter.get('/payment-methods', (req, res) => {
  const { start_date, end_date } = req.query;
  const from = start_date || '2024-01-01';
  const to = end_date || new Date().toISOString().split('T')[0];

  const companySales = mock.sales.filter(s => s.company_id === req.companyId && s.status === 'completed' && s.created_at >= from && s.created_at <= to + 'T23:59:59');
  const methods = {};
  for (const sale of companySales) {
    const payments = mock.salePayments.filter(p => p.sale_id === sale.id);
    for (const p of payments) {
      const method = p.payment_method || 'unknown';
      if (!methods[method]) methods[method] = { method, count: 0, total: 0 };
      methods[method].count++;
      methods[method].total += p.amount;
    }
  }
  res.json({ report: Object.values(methods), period: { from, to } });
});

reportsRouter.get('/:reportType', (req, res) => {
  const { reportType } = req.params;
  const { startDate, endDate, start_date, end_date } = req.query;
  const from = startDate || start_date || '2024-01-01';
  const to = endDate || end_date || new Date().toISOString().split('T')[0];

  const companySales = mock.sales.filter(s => s.company_id === req.companyId && s.status === 'completed' && s.created_at >= from && s.created_at <= to + 'T23:59:59');

  res.json({
    report: {
      type: reportType,
      total_sales: companySales.length,
      total_revenue: companySales.reduce((sum, s) => sum + s.total_amount, 0),
      total_vat: companySales.reduce((sum, s) => sum + s.vat_amount, 0),
      total_discounts: companySales.reduce((sum, s) => sum + s.discount_amount, 0),
      period: { from, to },
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT (FORENSIC) — Extra endpoint for /api/audit/forensic
// ═══════════════════════════════════════════════════════════════════════════════
const auditForensicRouter = express.Router();
auditForensicRouter.use(authenticateToken);
auditForensicRouter.use(requireCompany);

auditForensicRouter.get('/forensic', (req, res) => {
  const { limit, module, action_type, entity_type, from, to } = req.query;
  let results = mock.auditLog.filter(a => a.company_id === req.companyId);
  if (module) results = results.filter(a => a.module === module);
  if (action_type) results = results.filter(a => a.action_type === action_type);
  if (entity_type) results = results.filter(a => a.entity_type === entity_type);
  if (from) results = results.filter(a => a.created_at >= from);
  if (to) results = results.filter(a => a.created_at <= to);
  results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (limit) results = results.slice(0, parseInt(limit));
  res.json({ entries: results, total: results.length });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = {
  customersRouter,
  receiptsRouter,
  barcodeRouter,
  reportsRouter,
  auditForensicRouter,
};
