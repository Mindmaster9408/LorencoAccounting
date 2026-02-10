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

module.exports = router;
