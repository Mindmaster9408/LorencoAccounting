/**
 * ============================================================================
 * MOCK SHARED ROUTES — Auth, Companies, Users, Employees, Audit
 * ============================================================================
 * Replaces Supabase-backed shared routes with in-memory data operations.
 * Response formats match original routes EXACTLY.
 * ============================================================================
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { authenticateToken, requireCompany, requirePermission, requireSuperAdmin, JWT_SECRET } = require('./middleware/auth');
const { getRolePermissions } = require('./config/permissions');
const mock = require('./mock-data');

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
const authRouter = express.Router();

/**
 * POST /api/auth/login
 */
authRouter.post('/login', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    const loginId = username || email;

    if (!loginId || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    // Find user by username or email
    const user = mock.users.find(u =>
      u.is_active && (u.username === loginId || u.email === loginId)
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Super admin path
    if (user.is_super_admin) {
      // Super admins get ALL companies
      const allCompanies = mock.companies.filter(c => c.is_active !== false).map(c => ({
        id: c.id,
        company_name: c.company_name,
        trading_name: c.trading_name,
        modules_enabled: c.modules_enabled,
        role: 'super_admin',
        is_primary: c.id === 1,
      }));

      const primaryCompany = allCompanies[0] || null;
      const token = jwt.sign({
        userId: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        isSuperAdmin: true,
        role: 'super_admin',
        companyId: primaryCompany ? primaryCompany.id : null,
      }, JWT_SECRET, { expiresIn: '24h' });

      mock.mockAuditFromReq(req, 'LOGIN', 'user', user.id, { module: 'shared', metadata: { isSuperAdmin: true } });

      return res.json({
        success: true,
        isSuperAdmin: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          email: user.email,
        },
        companies: allCompanies,
        selectedCompany: primaryCompany,
      });
    }

    // Get user's accessible companies
    const accessRecords = mock.userCompanyAccess.filter(a => a.user_id === user.id && a.is_active);
    const companyList = accessRecords
      .map(a => {
        const company = mock.companies.find(c => c.id === a.company_id);
        if (!company) return null;
        return {
          id: company.id,
          company_name: company.company_name,
          trading_name: company.trading_name,
          modules_enabled: company.modules_enabled,
          role: a.role,
          is_primary: a.is_primary,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));

    const tokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      companyId: null,
      role: null,
    };

    let selectedCompany = null;
    if (companyList.length === 1) {
      selectedCompany = companyList[0];
      tokenPayload.companyId = selectedCompany.id;
      tokenPayload.role = selectedCompany.role;
    } else if (companyList.length > 0) {
      // Auto-select primary
      const primary = companyList.find(c => c.is_primary);
      if (primary) {
        selectedCompany = primary;
        tokenPayload.companyId = primary.id;
        tokenPayload.role = primary.role;
      }
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

    mock.mockAuditFromReq(req, 'LOGIN', 'user', user.id, {
      module: 'shared', metadata: { companiesAvailable: companyList.length },
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
      },
      companies: companyList,
      selectedCompany,
      requiresCompanySelection: companyList.length > 1 && !selectedCompany,
    });
  } catch (err) {
    console.error('Mock login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

/**
 * POST /api/auth/register
 */
authRouter.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name, company_name, trading_name } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'Username, email, password, and full name are required' });
    }

    // Check existing
    const existing = mock.users.find(u => u.username === username || u.email === email);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const newUser = {
      id: mock.nextId(), username, email, password_hash, full_name,
      is_active: true, is_super_admin: false,
      created_at: new Date().toISOString(),
    };
    mock.users.push(newUser);

    let company = null;
    if (company_name) {
      company = {
        id: mock.nextId(),
        company_name, trading_name: trading_name || company_name,
        is_active: true, modules_enabled: ['pos'],
        subscription_status: 'active',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      mock.companies.push(company);
      mock.userCompanyAccess.push({
        user_id: newUser.id, company_id: company.id,
        role: 'business_owner', is_primary: true, is_active: true,
      });
    }

    const token = jwt.sign({
      userId: newUser.id, username: newUser.username, email: newUser.email,
      fullName: newUser.full_name, companyId: company ? company.id : null,
      role: company ? 'business_owner' : null,
    }, JWT_SECRET, { expiresIn: '8h' });

    res.status(201).json({
      success: true, token,
      user: { id: newUser.id, username: newUser.username, email: newUser.email, fullName: newUser.full_name },
      company: company ? { id: company.id, company_name: company.company_name } : null,
    });
  } catch (err) {
    console.error('Mock register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

/**
 * POST /api/auth/select-company
 */
authRouter.post('/select-company', authenticateToken, (req, res) => {
  const { companyId } = req.body;
  if (!companyId) return res.status(400).json({ error: 'companyId is required' });

  const access = mock.userCompanyAccess.find(
    a => a.user_id === req.user.userId && a.company_id === parseInt(companyId) && a.is_active
  );
  if (!access) return res.status(403).json({ error: 'You do not have access to this company' });

  const token = jwt.sign({
    userId: req.user.userId, username: req.user.username, email: req.user.email,
    fullName: req.user.fullName, companyId: parseInt(companyId), role: access.role,
  }, JWT_SECRET, { expiresIn: '8h' });

  res.json({ success: true, token, companyId: parseInt(companyId), role: access.role });
});

/**
 * GET /api/auth/me
 */
authRouter.get('/me', authenticateToken, (req, res) => {
  const user = mock.users.find(u => u.id === req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    user: {
      id: user.id, username: user.username, email: user.email,
      full_name: user.full_name, is_super_admin: user.is_super_admin,
      created_at: user.created_at,
    },
    companyId: req.companyId,
    role: req.user.role,
    permissions: req.user.role ? getRolePermissions(req.user.role) : null,
  });
});

/**
 * GET /api/auth/companies
 */
authRouter.get('/companies', authenticateToken, (req, res) => {
  const accessRecords = mock.userCompanyAccess.filter(a => a.user_id === req.user.userId && a.is_active);
  const list = accessRecords
    .map(a => {
      const company = mock.companies.find(c => c.id === a.company_id);
      if (!company) return null;
      return {
        id: company.id, company_name: company.company_name,
        trading_name: company.trading_name, modules_enabled: company.modules_enabled,
        role: a.role, is_primary: a.is_primary,
      };
    })
    .filter(Boolean);

  res.json({ companies: list });
});

/**
 * POST /api/auth/logout
 */
authRouter.post('/logout', authenticateToken, (req, res) => {
  mock.mockAuditFromReq(req, 'LOGOUT', 'user', req.user.userId, { module: 'shared' });
  res.json({ success: true, message: 'Logged out' });
});

/**
 * POST /api/auth/sso-launch
 * Ecosystem SSO — generates an app-specific token so the user
 * can launch into a specific app + company without re-logging in.
 * 
 * Body: { targetApp: 'pos'|'payroll'|'accounting'|'sean', companyId: number }
 * Returns: { appToken, user, company }
 */
authRouter.post('/sso-launch', authenticateToken, (req, res) => {
  try {
    const { targetApp, companyId } = req.body;
    const validApps = ['pos', 'payroll', 'accounting', 'sean'];

    if (!targetApp || !validApps.includes(targetApp)) {
      return res.status(400).json({ error: `Invalid targetApp. Must be one of: ${validApps.join(', ')}` });
    }

    const user = mock.users.find(u => u.id === req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine company access
    let resolvedCompanyId = companyId ? parseInt(companyId) : null;
    let role = req.user.role || 'admin';

    if (user.is_super_admin) {
      // Super admin can access any company
      role = 'super_admin';
      if (!resolvedCompanyId) {
        const firstCompany = mock.companies.find(c => c.is_active);
        resolvedCompanyId = firstCompany ? firstCompany.id : 1;
      }
    } else if (resolvedCompanyId) {
      // Verify the user has access to this company
      const access = mock.userCompanyAccess.find(
        a => a.user_id === user.id && a.company_id === resolvedCompanyId && a.is_active
      );
      if (!access) {
        return res.status(403).json({ error: 'You do not have access to this company' });
      }
      role = access.role;
    } else {
      // Pick primary or first company
      const accessRecords = mock.userCompanyAccess.filter(a => a.user_id === user.id && a.is_active);
      const primary = accessRecords.find(a => a.is_primary) || accessRecords[0];
      if (primary) {
        resolvedCompanyId = primary.company_id;
        role = primary.role;
      }
    }

    // Build the company object
    const company = mock.companies.find(c => c.id === resolvedCompanyId);

    // Generate app-specific token with targetApp embedded
    const appToken = jwt.sign({
      userId: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      companyId: resolvedCompanyId,
      role: role,
      isSuperAdmin: user.is_super_admin || false,
      ssoSource: 'ecosystem',
      targetApp: targetApp,
    }, JWT_SECRET, { expiresIn: '8h' });

    mock.mockAuditFromReq(req, 'SSO_LAUNCH', 'user', user.id, {
      module: 'shared',
      metadata: { targetApp, companyId: resolvedCompanyId },
    });

    res.json({
      success: true,
      appToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        isSuperAdmin: user.is_super_admin || false,
      },
      company: company ? {
        id: company.id,
        company_name: company.company_name,
        trading_name: company.trading_name,
        modules_enabled: company.modules_enabled,
        role: role,
      } : null,
      targetApp,
    });
  } catch (err) {
    console.error('Mock SSO launch error:', err);
    res.status(500).json({ error: 'SSO launch failed' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// COMPANIES ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
const companiesRouter = express.Router();

companiesRouter.get('/', (req, res) => {
  if (req.user.isSuperAdmin) {
    return res.json({ companies: mock.companies.filter(c => c.is_active) });
  }
  const accessRecords = mock.userCompanyAccess.filter(a => a.user_id === req.user.userId && a.is_active);
  const userCompanies = accessRecords
    .map(a => mock.companies.find(c => c.id === a.company_id && c.is_active))
    .filter(Boolean);
  res.json({ companies: userCompanies });
});

companiesRouter.get('/:id', (req, res) => {
  const company = mock.companies.find(c => c.id === parseInt(req.params.id));
  if (!company) return res.status(404).json({ error: 'Company not found' });
  res.json({ company });
});

companiesRouter.post('/', requirePermission('COMPANIES.CREATE'), (req, res) => {
  const { company_name, trading_name, registration_number, tax_number, address, phone, email, modules_enabled } = req.body;
  if (!company_name) return res.status(400).json({ error: 'company_name is required' });

  const company = {
    id: mock.nextId(), company_name, trading_name: trading_name || company_name,
    registration_number: registration_number || null, tax_number: tax_number || null,
    is_active: true, modules_enabled: modules_enabled || ['pos'],
    subscription_status: 'active',
    address: address || null, phone: phone || null, email: email || null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  mock.companies.push(company);
  res.status(201).json({ company });
});

companiesRouter.put('/:id', requirePermission('COMPANIES.EDIT'), (req, res) => {
  const idx = mock.companies.findIndex(c => c.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Company not found' });

  const allowed = ['company_name', 'trading_name', 'registration_number', 'tax_number', 'address', 'phone', 'email', 'modules_enabled', 'is_active'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) mock.companies[idx][key] = req.body[key];
  }
  mock.companies[idx].updated_at = new Date().toISOString();

  res.json({ company: mock.companies[idx] });
});


// ═══════════════════════════════════════════════════════════════════════════════
// USERS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
const usersRouter = express.Router();

usersRouter.get('/', requirePermission('USERS.VIEW'), (req, res) => {
  let results = mock.users.filter(u => u.is_active).map(u => ({
    id: u.id, username: u.username, email: u.email, full_name: u.full_name,
    is_super_admin: u.is_super_admin, created_at: u.created_at,
  }));
  res.json({ users: results });
});

usersRouter.get('/:id', requirePermission('USERS.VIEW'), (req, res) => {
  const user = mock.users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    user: {
      id: user.id, username: user.username, email: user.email,
      full_name: user.full_name, is_super_admin: user.is_super_admin,
      created_at: user.created_at,
    },
  });
});

usersRouter.post('/', requirePermission('USERS.CREATE'), async (req, res) => {
  const { username, email, password, full_name } = req.body;
  if (!username || !email || !password || !full_name) {
    return res.status(400).json({ error: 'username, email, password, and full_name are required' });
  }

  const exists = mock.users.find(u => u.username === username || u.email === email);
  if (exists) return res.status(409).json({ error: 'Username or email already exists' });

  const password_hash = await bcrypt.hash(password, 10);
  const user = {
    id: mock.nextId(), username, email, password_hash, full_name,
    is_active: true, is_super_admin: false, created_at: new Date().toISOString(),
  };
  mock.users.push(user);

  res.status(201).json({
    user: { id: user.id, username: user.username, email: user.email, full_name: user.full_name, created_at: user.created_at },
  });
});

usersRouter.put('/:id', requirePermission('USERS.EDIT'), (req, res) => {
  const idx = mock.users.findIndex(u => u.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'User not found' });

  const allowed = ['username', 'email', 'full_name', 'is_active'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) mock.users[idx][key] = req.body[key];
  }

  res.json({
    user: {
      id: mock.users[idx].id, username: mock.users[idx].username,
      email: mock.users[idx].email, full_name: mock.users[idx].full_name,
      created_at: mock.users[idx].created_at,
    },
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEES ROUTES (shared)
// ═══════════════════════════════════════════════════════════════════════════════
const employeesRouter = express.Router();

employeesRouter.use(requireCompany);

employeesRouter.get('/', requirePermission('EMPLOYEES.VIEW'), (req, res) => {
  const { active_only, search, department } = req.query;
  let results = mock.employees.filter(e => e.company_id === req.companyId);

  if (active_only !== 'false') results = results.filter(e => e.is_active);
  if (department) results = results.filter(e => e.department === department);
  if (search) {
    const s = search.toLowerCase();
    results = results.filter(e =>
      (e.full_name && e.full_name.toLowerCase().includes(s)) ||
      (e.employee_number && e.employee_number.toLowerCase().includes(s)) ||
      (e.email && e.email.toLowerCase().includes(s))
    );
  }

  results.sort((a, b) => a.full_name.localeCompare(b.full_name));
  res.json({ employees: results });
});

employeesRouter.get('/:id', requirePermission('EMPLOYEES.VIEW'), (req, res) => {
  const emp = mock.employees.find(e => e.id === parseInt(req.params.id) && e.company_id === req.companyId);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  res.json({ employee: emp });
});

employeesRouter.post('/', requirePermission('EMPLOYEES.CREATE'), (req, res) => {
  const { full_name, email, phone, id_number, tax_number, position, department, start_date, basic_salary, hourly_rate, payment_frequency } = req.body;
  if (!full_name) return res.status(400).json({ error: 'full_name is required' });

  const emp = {
    id: mock.nextId(), company_id: req.companyId, user_id: null,
    employee_number: `EMP-${String(mock.employees.length + 1).padStart(3, '0')}`,
    full_name, email: email || null, phone: phone || null,
    id_number: id_number || null, tax_number: tax_number || null,
    position: position || null, department: department || null,
    start_date: start_date || new Date().toISOString().split('T')[0],
    basic_salary: basic_salary || 0, hourly_rate: hourly_rate || null,
    payment_frequency: payment_frequency || 'monthly',
    is_active: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  mock.employees.push(emp);

  mock.mockAuditFromReq(req, 'CREATE', 'employee', emp.id, { module: 'shared', newValue: emp });
  res.status(201).json({ employee: emp });
});

employeesRouter.put('/:id', requirePermission('EMPLOYEES.EDIT'), (req, res) => {
  const idx = mock.employees.findIndex(e => e.id === parseInt(req.params.id) && e.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Employee not found' });

  const allowed = ['full_name', 'email', 'phone', 'id_number', 'tax_number', 'position', 'department', 'start_date', 'basic_salary', 'hourly_rate', 'payment_frequency', 'is_active'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) mock.employees[idx][key] = req.body[key];
  }
  mock.employees[idx].updated_at = new Date().toISOString();

  mock.mockAuditFromReq(req, 'UPDATE', 'employee', req.params.id, { module: 'shared', newValue: mock.employees[idx] });
  res.json({ employee: mock.employees[idx] });
});

employeesRouter.delete('/:id', requirePermission('EMPLOYEES.DELETE'), (req, res) => {
  const idx = mock.employees.findIndex(e => e.id === parseInt(req.params.id) && e.company_id === req.companyId);
  if (idx === -1) return res.status(404).json({ error: 'Employee not found' });
  mock.employees[idx].is_active = false;
  mock.employees[idx].updated_at = new Date().toISOString();
  mock.mockAuditFromReq(req, 'DELETE', 'employee', req.params.id, { module: 'shared' });
  res.json({ success: true });
});


// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
const auditRouter = express.Router();

auditRouter.get('/', requirePermission('AUDIT.VIEW'), (req, res) => {
  const { module, action_type, entity_type, from, to, user_id, limit: lim = 100 } = req.query;
  let results = mock.auditLog.filter(a => a.company_id === req.companyId || req.user.isSuperAdmin);

  if (module) results = results.filter(a => a.module === module);
  if (action_type) results = results.filter(a => a.action_type === action_type);
  if (entity_type) results = results.filter(a => a.entity_type === entity_type);
  if (user_id) results = results.filter(a => a.user_id === parseInt(user_id));
  if (from) results = results.filter(a => a.created_at >= from);
  if (to) results = results.filter(a => a.created_at <= to);

  results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  results = results.slice(0, parseInt(lim));

  res.json({ audit_log: results, total: results.length });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════
module.exports = {
  authRouter,
  companiesRouter,
  usersRouter,
  employeesRouter,
  auditRouter,
};
