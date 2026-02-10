/**
 * ============================================================================
 * MOCK POS ROUTES — In-Memory CRUD for Checkout Charlie
 * ============================================================================
 * Replaces Supabase-backed POS routes with in-memory data operations.
 * Response formats match original routes EXACTLY.
 * ============================================================================
 */

const express = require('express');
const { authenticateToken, requireCompany, requirePermission } = require('./middleware/auth');
const mock = require('./mock-data');

const router = express.Router();

router.use(authenticateToken);
router.use(requireCompany);

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/pos/products
 */
router.get('/products', requirePermission('PRODUCTS.VIEW'), (req, res) => {
  try {
    const { category_id, search, active_only } = req.query;
    let results = mock.products.filter(p => p.company_id === req.companyId);

    if (active_only !== 'false') results = results.filter(p => p.is_active);
    if (category_id) results = results.filter(p => p.category_id === parseInt(category_id));
    if (search) {
      const s = search.toLowerCase();
      results = results.filter(p =>
        (p.name && p.name.toLowerCase().includes(s)) ||
        (p.barcode && p.barcode.toLowerCase().includes(s)) ||
        (p.sku && p.sku.toLowerCase().includes(s))
      );
    }

    // Join category name
    results = results.map(p => {
      const cat = mock.categories.find(c => c.id === p.category_id);
      return { ...p, categories: cat ? { name: cat.name } : null };
    }).sort((a, b) => a.name.localeCompare(b.name));

    res.json({ products: results });
  } catch (err) {
    console.error('Mock GET /products error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/pos/products/:id
 */
router.get('/products/:id', requirePermission('PRODUCTS.VIEW'), (req, res) => {
  const product = mock.products.find(p => p.id === parseInt(req.params.id) && p.company_id === req.companyId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const cat = mock.categories.find(c => c.id === product.category_id);
  res.json({ product: { ...product, categories: cat ? { name: cat.name } : null } });
});

/**
 * POST /api/pos/products
 */
router.post('/products', requirePermission('PRODUCTS.CREATE'), (req, res) => {
  const { name, description, barcode, sku, category_id, cost_price, selling_price, stock_quantity, reorder_level, vat_inclusive, vat_rate, unit } = req.body;

  if (!name || selling_price === undefined) {
    return res.status(400).json({ error: 'name and selling_price are required' });
  }

  const product = {
    id: mock.nextId(),
    company_id: req.companyId,
    name, description: description || null, barcode: barcode || null, sku: sku || null,
    category_id: category_id || null,
    cost_price: cost_price || 0, selling_price,
    stock_quantity: stock_quantity || 0, reorder_level: reorder_level || 10,
    vat_inclusive: vat_inclusive !== false, vat_rate: vat_rate || 15,
    unit: unit || 'each', is_active: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  mock.products.push(product);

  mock.mockAuditFromReq(req, 'CREATE', 'product', product.id, { module: 'pos', newValue: { name, selling_price, barcode } });
  res.status(201).json({ product });
});

/**
 * PUT /api/pos/products/:id
 */
router.put('/products/:id', requirePermission('PRODUCTS.EDIT'), (req, res) => {
  const idx = mock.products.findIndex(p => p.id === parseInt(req.params.id) && p.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });

  const old = { ...mock.products[idx] };
  const allowed = ['name', 'description', 'barcode', 'sku', 'category_id', 'cost_price', 'selling_price', 'stock_quantity', 'reorder_level', 'vat_inclusive', 'vat_rate', 'unit', 'is_active'];

  for (const key of allowed) {
    if (req.body[key] !== undefined) mock.products[idx][key] = req.body[key];
  }
  mock.products[idx].updated_at = new Date().toISOString();

  // Price change audit
  if (req.body.selling_price !== undefined && old.selling_price !== req.body.selling_price) {
    mock.mockAuditFromReq(req, 'PRICE_CHANGE', 'product', old.id, { module: 'pos', fieldName: 'selling_price', oldValue: old.selling_price, newValue: req.body.selling_price, metadata: { product_name: old.name } });
  }
  if (req.body.cost_price !== undefined && old.cost_price !== req.body.cost_price) {
    mock.mockAuditFromReq(req, 'PRICE_CHANGE', 'product', old.id, { module: 'pos', fieldName: 'cost_price', oldValue: old.cost_price, newValue: req.body.cost_price, metadata: { product_name: old.name } });
  }

  mock.mockAuditFromReq(req, 'UPDATE', 'product', old.id, { module: 'pos', oldValue: old, newValue: mock.products[idx] });
  res.json({ product: mock.products[idx] });
});

/**
 * DELETE /api/pos/products/:id (soft)
 */
router.delete('/products/:id', requirePermission('PRODUCTS.DELETE'), (req, res) => {
  const idx = mock.products.findIndex(p => p.id === parseInt(req.params.id) && p.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  mock.products[idx].is_active = false;
  mock.products[idx].updated_at = new Date().toISOString();
  mock.mockAuditFromReq(req, 'DELETE', 'product', req.params.id, { module: 'pos' });
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/categories', (req, res) => {
  const results = mock.categories
    .filter(c => c.company_id === req.companyId && c.is_active)
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json({ categories: results });
});

router.post('/categories', requirePermission('PRODUCTS.CREATE'), (req, res) => {
  const { name, description, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const category = {
    id: mock.nextId(), company_id: req.companyId,
    name, description: description || null, color: color || '#667eea',
    is_active: true, created_at: new Date().toISOString(),
  };
  mock.categories.push(category);
  res.status(201).json({ category });
});

router.put('/categories/:id', requirePermission('PRODUCTS.EDIT'), (req, res) => {
  const idx = mock.categories.findIndex(c => c.id === parseInt(req.params.id) && c.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });

  if (req.body.name !== undefined) mock.categories[idx].name = req.body.name;
  if (req.body.description !== undefined) mock.categories[idx].description = req.body.description;
  if (req.body.color !== undefined) mock.categories[idx].color = req.body.color;
  if (req.body.is_active !== undefined) mock.categories[idx].is_active = req.body.is_active;

  res.json({ category: mock.categories[idx] });
});

router.delete('/categories/:id', requirePermission('PRODUCTS.DELETE'), (req, res) => {
  const idx = mock.categories.findIndex(c => c.id === parseInt(req.params.id) && c.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Category not found' });
  mock.categories[idx].is_active = false;
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/customers', requirePermission('CUSTOMERS.VIEW'), (req, res) => {
  const { search, active_only, group } = req.query;
  let results = mock.customers.filter(c => c.company_id === req.companyId);

  if (active_only !== 'false') results = results.filter(c => c.is_active);
  if (group) results = results.filter(c => c.customer_group === group);
  if (search) {
    const s = search.toLowerCase();
    results = results.filter(c =>
      (c.name && c.name.toLowerCase().includes(s)) ||
      (c.phone && c.phone.toLowerCase().includes(s)) ||
      (c.email && c.email && c.email.toLowerCase().includes(s))
    );
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  res.json({ customers: results });
});

router.get('/customers/:id', requirePermission('CUSTOMERS.VIEW'), (req, res) => {
  const customer = mock.customers.find(c => c.id === parseInt(req.params.id) && c.company_id === req.companyId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json({ customer });
});

router.post('/customers', requirePermission('CUSTOMERS.CREATE'), (req, res) => {
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
  mock.mockAuditFromReq(req, 'CREATE', 'customer', customer.id, { module: 'pos', newValue: customer });
  res.status(201).json({ customer });
});

router.put('/customers/:id', requirePermission('CUSTOMERS.EDIT'), (req, res) => {
  const idx = mock.customers.findIndex(c => c.id === parseInt(req.params.id) && c.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });

  const allowed = ['name', 'email', 'phone', 'address', 'id_number', 'customer_group', 'notes', 'is_active'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) mock.customers[idx][key] = req.body[key];
  }
  mock.customers[idx].updated_at = new Date().toISOString();

  mock.mockAuditFromReq(req, 'UPDATE', 'customer', req.params.id, { module: 'pos', newValue: mock.customers[idx] });
  res.json({ customer: mock.customers[idx] });
});

router.delete('/customers/:id', requirePermission('CUSTOMERS.DELETE'), (req, res) => {
  const idx = mock.customers.findIndex(c => c.id === parseInt(req.params.id) && c.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Customer not found' });
  mock.customers[idx].is_active = false;
  mock.mockAuditFromReq(req, 'DELETE', 'customer', req.params.id, { module: 'pos' });
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SALES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/sales', requirePermission('SALES.VIEW'), (req, res) => {
  const { from, to, status, cashier_id, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let results = mock.sales.filter(s => s.company_id === req.companyId);
  if (from) results = results.filter(s => s.created_at >= from);
  if (to) results = results.filter(s => s.created_at <= to);
  if (status) results = results.filter(s => s.status === status);
  if (cashier_id) results = results.filter(s => s.cashier_id === parseInt(cashier_id));

  results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const total = results.length;

  // Join items and payments
  results = results.slice(offset, offset + parseInt(limit)).map(s => ({
    ...s,
    sale_items: mock.saleItems.filter(i => i.sale_id === s.id),
    sale_payments: mock.salePayments.filter(p => p.sale_id === s.id),
  }));

  res.json({
    sales: results,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit)),
  });
});

router.get('/sales/:id', requirePermission('SALES.VIEW'), (req, res) => {
  const sale = mock.sales.find(s => s.id === parseInt(req.params.id) && s.company_id === req.companyId);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  const items = mock.saleItems.filter(i => i.sale_id === sale.id).map(i => {
    const prod = mock.products.find(p => p.id === i.product_id);
    return { ...i, products: prod ? { name: prod.name, barcode: prod.barcode } : null };
  });

  res.json({
    sale: {
      ...sale,
      sale_items: items,
      sale_payments: mock.salePayments.filter(p => p.sale_id === sale.id),
    },
  });
});

router.post('/sales', requirePermission('SALES.CREATE'), (req, res) => {
  try {
    const { items, payments, customer_id, discount_amount, discount_percent, notes, till_session_id } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    let subtotal = 0;
    let vat_total = 0;
    for (const item of items) {
      const lineTotal = item.quantity * item.unit_price;
      subtotal += lineTotal;
      if (item.vat_rate) vat_total += lineTotal * (item.vat_rate / (100 + item.vat_rate));
    }

    const discount = discount_amount || (discount_percent ? subtotal * discount_percent / 100 : 0);
    const total_amount = subtotal - discount;
    const receiptNumber = `RC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const sale = {
      id: mock.nextId(), company_id: req.companyId, cashier_id: req.user.userId,
      customer_id: customer_id || null, receipt_number: receiptNumber,
      subtotal, discount_amount: discount, vat_amount: vat_total, total_amount,
      status: 'completed', notes: notes || null, till_session_id: till_session_id || null,
      void_reason: null, voided_by: null, voided_at: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    mock.sales.push(sale);

    // Insert sale items
    for (const item of items) {
      mock.saleItems.push({
        id: mock.nextId(), sale_id: sale.id,
        product_id: item.product_id, product_name: item.product_name || item.name,
        quantity: item.quantity, unit_price: item.unit_price,
        discount_amount: item.discount_amount || 0,
        vat_rate: item.vat_rate || 15,
        line_total: item.quantity * item.unit_price - (item.discount_amount || 0),
      });

      // Decrement stock
      if (item.product_id) {
        const pIdx = mock.products.findIndex(p => p.id === item.product_id);
        if (pIdx !== -1) {
          mock.products[pIdx].stock_quantity = Math.max(0, mock.products[pIdx].stock_quantity - item.quantity);
        }
      }
    }

    // Insert payments
    if (payments && payments.length > 0) {
      for (const p of payments) {
        mock.salePayments.push({
          id: mock.nextId(), sale_id: sale.id,
          payment_method: p.payment_method || p.method,
          amount: p.amount, reference: p.reference || null,
        });
      }
    }

    mock.mockAuditFromReq(req, 'CREATE', 'sale', sale.id, {
      module: 'pos', newValue: { receiptNumber, total_amount, items: items.length },
    });

    res.status(201).json({ sale });
  } catch (err) {
    console.error('Mock POST /sales error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/sales/:id/void', requirePermission('SALES.VOID'), (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Void reason is required' });

  const idx = mock.sales.findIndex(s => s.id === parseInt(req.params.id) && s.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Sale not found' });
  if (mock.sales[idx].status === 'voided') return res.status(400).json({ error: 'Sale is already voided' });

  const old = { ...mock.sales[idx] };
  mock.sales[idx].status = 'voided';
  mock.sales[idx].void_reason = reason;
  mock.sales[idx].voided_by = req.user.userId;
  mock.sales[idx].voided_at = new Date().toISOString();

  mock.mockAuditFromReq(req, 'VOID', 'sale', req.params.id, {
    module: 'pos',
    oldValue: { status: old.status, total_amount: old.total_amount },
    newValue: { status: 'voided', void_reason: reason },
    metadata: { receipt_number: old.receipt_number, original_amount: old.total_amount, reason },
  });

  res.json({ sale: mock.sales[idx] });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/inventory', requirePermission('INVENTORY.VIEW'), (req, res) => {
  const { low_stock } = req.query;
  let results = mock.products
    .filter(p => p.company_id === req.companyId && p.is_active)
    .map(p => {
      const cat = mock.categories.find(c => c.id === p.category_id);
      return {
        id: p.id, name: p.name, barcode: p.barcode, sku: p.sku,
        stock_quantity: p.stock_quantity, reorder_level: p.reorder_level,
        cost_price: p.cost_price, selling_price: p.selling_price,
        category_id: p.category_id, categories: cat ? { name: cat.name } : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (low_stock === 'true') {
    results = results.filter(p => p.stock_quantity <= p.reorder_level);
  }

  res.json({ inventory: results });
});

router.post('/inventory/adjust', requirePermission('INVENTORY.ADJUST'), (req, res) => {
  const { product_id, quantity_change, reason, notes } = req.body;

  if (!product_id || quantity_change === undefined) {
    return res.status(400).json({ error: 'product_id and quantity_change are required' });
  }

  const pIdx = mock.products.findIndex(p => p.id === parseInt(product_id) && p.company_id === req.companyId);
  if (pIdx === -1) return res.status(404).json({ error: 'Product not found' });

  const oldQty = mock.products[pIdx].stock_quantity;
  const newQty = Math.max(0, oldQty + quantity_change);
  mock.products[pIdx].stock_quantity = newQty;

  const adjustment = {
    id: mock.nextId(), company_id: req.companyId, product_id: parseInt(product_id),
    adjusted_by: req.user.userId,
    quantity_before: oldQty, quantity_change, quantity_after: newQty,
    reason: reason || 'manual', notes: notes || null,
    created_at: new Date().toISOString(),
  };
  mock.inventoryAdjustments.push(adjustment);

  mock.mockAuditFromReq(req, 'UPDATE', 'inventory', product_id, {
    module: 'pos', fieldName: 'stock_quantity',
    oldValue: oldQty, newValue: newQty,
    metadata: { product_name: mock.products[pIdx].name, reason },
  });

  res.json({ adjustment });
});

router.get('/inventory/adjustments', requirePermission('INVENTORY.VIEW'), (req, res) => {
  const results = mock.inventoryAdjustments
    .filter(a => a.company_id === req.companyId)
    .map(a => {
      const prod = mock.products.find(p => p.id === a.product_id);
      return { ...a, products: prod ? { name: prod.name, barcode: prod.barcode } : null };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 100);

  res.json({ adjustments: results });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TILL SESSIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/sessions', (req, res) => {
  const { status } = req.query;
  let results = mock.tillSessions.filter(s => s.company_id === req.companyId);
  if (status) results = results.filter(s => s.status === status);
  results = results.map(s => {
    const till = mock.tills.find(t => t.id === s.till_id);
    return { ...s, till_name: till ? till.till_name : 'Unknown Till' };
  });
  res.json({ sessions: results });
});

router.post('/sessions/open', (req, res) => {
  const { till_id, opening_amount } = req.body;
  // Check for existing open session
  const existing = mock.tillSessions.find(s => s.company_id === req.companyId && s.cashier_id === req.user.userId && s.status === 'open');
  if (existing) return res.status(400).json({ error: 'You already have an open session', session: existing });

  const session = {
    id: mock.nextId(), company_id: req.companyId, till_id: till_id || 1,
    cashier_id: req.user.userId, opening_amount: opening_amount || 0,
    closing_amount: null, expected_amount: null, difference: null,
    status: 'open', opened_at: new Date().toISOString(), closed_at: null, notes: null,
    created_at: new Date().toISOString(),
  };
  mock.tillSessions.push(session);
  res.status(201).json({ session });
});

router.get('/sessions/current', (req, res) => {
  const session = mock.tillSessions.find(s => s.company_id === req.companyId && s.cashier_id === req.user.userId && s.status === 'open');
  if (!session) return res.json({ session: null });
  const sessionSales = mock.sales.filter(s => s.till_session_id === session.id && s.company_id === req.companyId);
  const till = mock.tills.find(t => t.id === session.till_id);
  res.json({ session: { ...session, till_name: till ? till.till_name : 'Unknown', sales_count: sessionSales.length, sales_total: sessionSales.reduce((sum, s) => sum + (s.status === 'completed' ? s.total_amount : 0), 0) } });
});

router.get('/sessions/pending-cashup', (req, res) => {
  const pending = mock.tillSessions.filter(s => s.company_id === req.companyId && (s.status === 'closed' || s.status === 'pending_cashup'));
  res.json({ sessions: pending });
});

router.post('/sessions/:id/close', (req, res) => {
  const idx = mock.tillSessions.findIndex(s => s.id === parseInt(req.params.id) && s.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Session not found' });
  const { closing_amount, notes } = req.body;

  const sessionSales = mock.sales.filter(s => s.till_session_id === mock.tillSessions[idx].id && s.status === 'completed');
  const expected = mock.tillSessions[idx].opening_amount + sessionSales.reduce((sum, s) => sum + s.total_amount, 0);

  mock.tillSessions[idx].closing_amount = closing_amount || 0;
  mock.tillSessions[idx].expected_amount = expected;
  mock.tillSessions[idx].difference = (closing_amount || 0) - expected;
  mock.tillSessions[idx].status = 'closed';
  mock.tillSessions[idx].closed_at = new Date().toISOString();
  mock.tillSessions[idx].notes = notes || null;

  res.json({ session: mock.tillSessions[idx] });
});

router.post('/sessions/:id/complete-cashup', (req, res) => {
  const idx = mock.tillSessions.findIndex(s => s.id === parseInt(req.params.id) && s.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Session not found' });
  const { counted_amount, notes } = req.body;

  mock.tillSessions[idx].closing_amount = counted_amount || mock.tillSessions[idx].closing_amount;
  mock.tillSessions[idx].status = 'completed';
  if (notes) mock.tillSessions[idx].notes = notes;

  res.json({ session: mock.tillSessions[idx] });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TILLS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/tills', (req, res) => {
  const results = mock.tills.filter(t => t.company_id === req.companyId && t.is_active);
  res.json({ tills: results });
});

router.post('/till/daily-reset', (req, res) => {
  res.json({ success: true, message: 'Till daily counts reset' });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK (alternate endpoint used by frontend)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/stock', (req, res) => {
  const { low_stock_only, category } = req.query;
  let results = mock.products.filter(p => p.company_id === req.companyId && p.is_active);
  if (category) results = results.filter(p => p.category_id === parseInt(category));
  if (low_stock_only === 'true') results = results.filter(p => p.stock_quantity <= p.reorder_level);

  results = results.map(p => {
    const cat = mock.categories.find(c => c.id === p.category_id);
    return { ...p, categories: cat ? { name: cat.name } : null };
  }).sort((a, b) => a.name.localeCompare(b.name));

  res.json({ products: results, inventory: results });
});

router.post('/stock/adjust', (req, res) => {
  const { product_id, quantity_change, adjustment_type, reason, notes } = req.body;
  if (!product_id || quantity_change === undefined) return res.status(400).json({ error: 'product_id and quantity_change required' });

  const pIdx = mock.products.findIndex(p => p.id === parseInt(product_id) && p.company_id === req.companyId);
  if (pIdx === -1) return res.status(404).json({ error: 'Product not found' });

  const oldQty = mock.products[pIdx].stock_quantity;
  const newQty = Math.max(0, oldQty + quantity_change);
  mock.products[pIdx].stock_quantity = newQty;

  const adjustment = {
    id: mock.nextId(), company_id: req.companyId, product_id: parseInt(product_id),
    adjusted_by: req.user.userId, quantity_before: oldQty, quantity_change, quantity_after: newQty,
    reason: reason || adjustment_type || 'manual', notes: notes || null,
    created_at: new Date().toISOString(),
  };
  mock.inventoryAdjustments.push(adjustment);
  res.json({ adjustment, product: mock.products[pIdx] });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY DISCOUNTS
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/daily-discounts', (req, res) => {
  const { product_id, discount_percent, discount_amount, start_date, end_date, reason } = req.body;
  const discount = {
    id: mock.nextId(), company_id: req.companyId, product_id, discount_percent, discount_amount,
    start_date: start_date || new Date().toISOString().split('T')[0],
    end_date: end_date || new Date().toISOString().split('T')[0],
    reason: reason || null, created_by: req.user.userId, is_active: true,
    created_at: new Date().toISOString(),
  };
  mock.dailyDiscounts.push(discount);
  res.status(201).json({ discount });
});

router.get('/daily-discounts', (req, res) => {
  const results = mock.dailyDiscounts.filter(d => d.company_id === req.companyId && d.is_active);
  res.json({ discounts: results });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POS SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/settings', (req, res) => {
  const settings = mock.posSettings.find(s => s.company_id === req.companyId);
  res.json({ settings: settings || {} });
});

router.put('/settings', (req, res) => {
  let idx = mock.posSettings.findIndex(s => s.company_id === req.companyId);
  if (idx === -1) {
    mock.posSettings.push({ id: mock.nextId(), company_id: req.companyId, ...req.body, created_at: new Date().toISOString() });
    idx = mock.posSettings.length - 1;
  } else {
    Object.assign(mock.posSettings[idx], req.body);
  }
  res.json({ settings: mock.posSettings[idx] });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS — Extra endpoints
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/products/next-code/:prefix', (req, res) => {
  const prefix = req.params.prefix || 'PRD';
  const existing = mock.products.filter(p => p.company_id === req.companyId && p.sku && p.sku.startsWith(prefix));
  const nextNum = existing.length + 1;
  res.json({ code: `${prefix}-${String(nextNum).padStart(3, '0')}` });
});

router.get('/products/:id/stock-by-location', (req, res) => {
  const product = mock.products.find(p => p.id === parseInt(req.params.id) && p.company_id === req.companyId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ locations: [{ location_id: 1, location_name: 'Main Store', stock_quantity: product.stock_quantity }] });
});

router.put('/products/:id/stock-by-location', (req, res) => {
  const pIdx = mock.products.findIndex(p => p.id === parseInt(req.params.id) && p.company_id === req.companyId);
  if (pIdx === -1) return res.status(404).json({ error: 'Product not found' });
  const { stock_quantity } = req.body;
  if (stock_quantity !== undefined) mock.products[pIdx].stock_quantity = stock_quantity;
  res.json({ success: true, product: mock.products[pIdx] });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SALES — Extra endpoints
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/sales/search', (req, res) => {
  const { query, date_from, date_to } = req.query;
  let results = mock.sales.filter(s => s.company_id === req.companyId);
  if (date_from) results = results.filter(s => s.created_at >= date_from);
  if (date_to) results = results.filter(s => s.created_at <= date_to);
  if (query) {
    const q = query.toLowerCase();
    results = results.filter(s =>
      (s.receipt_number && s.receipt_number.toLowerCase().includes(q)) ||
      mock.saleItems.some(i => i.sale_id === s.id && i.product_name && i.product_name.toLowerCase().includes(q))
    );
  }
  results = results.map(s => ({
    ...s,
    sale_items: mock.saleItems.filter(i => i.sale_id === s.id),
    sale_payments: mock.salePayments.filter(p => p.sale_id === s.id),
  })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({ sales: results, total: results.length });
});

router.post('/sales/split-payment', requirePermission('SALES.CREATE'), (req, res) => {
  // Split payment is essentially the same as a regular sale with multiple payment methods
  const { items, payments, customer_id, discount_amount, notes, till_session_id } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'At least one item is required' });
  if (!payments || payments.length < 2) return res.status(400).json({ error: 'Split payment requires at least 2 payment methods' });

  let subtotal = 0, vat_total = 0;
  for (const item of items) {
    const lineTotal = item.quantity * item.unit_price;
    subtotal += lineTotal;
    if (item.vat_rate) vat_total += lineTotal * (item.vat_rate / (100 + item.vat_rate));
  }
  const total_amount = subtotal - (discount_amount || 0);
  const receiptNumber = `RC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  const sale = {
    id: mock.nextId(), company_id: req.companyId, cashier_id: req.user.userId,
    customer_id: customer_id || null, receipt_number: receiptNumber,
    subtotal, discount_amount: discount_amount || 0, vat_amount: vat_total, total_amount,
    status: 'completed', notes: notes || 'Split payment', till_session_id: till_session_id || null,
    void_reason: null, voided_by: null, voided_at: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  mock.sales.push(sale);

  for (const item of items) {
    mock.saleItems.push({
      id: mock.nextId(), sale_id: sale.id, product_id: item.product_id,
      product_name: item.product_name || item.name, quantity: item.quantity,
      unit_price: item.unit_price, discount_amount: item.discount_amount || 0,
      vat_rate: item.vat_rate || 15, line_total: item.quantity * item.unit_price - (item.discount_amount || 0),
    });
    if (item.product_id) {
      const pIdx = mock.products.findIndex(p => p.id === item.product_id);
      if (pIdx !== -1) mock.products[pIdx].stock_quantity = Math.max(0, mock.products[pIdx].stock_quantity - item.quantity);
    }
  }
  for (const p of payments) {
    mock.salePayments.push({
      id: mock.nextId(), sale_id: sale.id, payment_method: p.payment_method || p.method, amount: p.amount, reference: p.reference || null,
    });
  }

  res.status(201).json({ sale });
});

router.post('/sales/:id/return', requirePermission('SALES.CREATE'), (req, res) => {
  const saleId = parseInt(req.params.id);
  const sale = mock.sales.find(s => s.id === saleId && s.company_id === req.companyId);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  const { items, reason } = req.body;
  const returnItems = items || mock.saleItems.filter(i => i.sale_id === saleId);

  let refund_total = 0;
  for (const item of returnItems) {
    refund_total += (item.quantity || 1) * (item.unit_price || 0);
    // Restore stock
    if (item.product_id) {
      const pIdx = mock.products.findIndex(p => p.id === item.product_id);
      if (pIdx !== -1) mock.products[pIdx].stock_quantity += (item.quantity || 1);
    }
  }

  const returnSale = {
    id: mock.nextId(), company_id: req.companyId, cashier_id: req.user.userId,
    customer_id: sale.customer_id, receipt_number: `RET-${Date.now()}`,
    subtotal: -refund_total, discount_amount: 0, vat_amount: 0, total_amount: -refund_total,
    status: 'returned', notes: reason || 'Return', till_session_id: null,
    original_sale_id: saleId, void_reason: null, voided_by: null, voided_at: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  mock.sales.push(returnSale);
  res.json({ return_sale: returnSale, refund_amount: refund_total });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/reports/:reportType', (req, res) => {
  const { reportType } = req.params;
  const { start_date, startDate, end_date, endDate } = req.query;
  const from = start_date || startDate || '2024-01-01';
  const to = end_date || endDate || new Date().toISOString().split('T')[0];

  const companySales = mock.sales.filter(s => s.company_id === req.companyId && s.status === 'completed' && s.created_at >= from && s.created_at <= to + 'T23:59:59');

  if (reportType === 'payment-methods') {
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
    return res.json({ report: Object.values(methods), period: { from, to } });
  }

  if (reportType === 'gross-profit' || reportType === 'daily-summary') {
    const totalRevenue = companySales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalCost = companySales.reduce((sum, s) => {
      const items = mock.saleItems.filter(i => i.sale_id === s.id);
      return sum + items.reduce((iSum, i) => {
        const product = mock.products.find(p => p.id === i.product_id);
        return iSum + (product ? product.cost_price * i.quantity : 0);
      }, 0);
    }, 0);
    return res.json({ report: { total_revenue: totalRevenue, total_cost: totalCost, gross_profit: totalRevenue - totalCost, sales_count: companySales.length, period: { from, to } } });
  }

  // Default: sales summary
  res.json({
    report: {
      total_sales: companySales.length,
      total_revenue: companySales.reduce((sum, s) => sum + s.total_amount, 0),
      total_vat: companySales.reduce((sum, s) => sum + s.vat_amount, 0),
      total_discounts: companySales.reduce((sum, s) => sum + s.discount_amount, 0),
      period: { from, to },
    }
  });
});

module.exports = router;
