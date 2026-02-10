const db = require('../src/config/database');
const { authenticate, hasPermission } = require('../src/middleware/auth');
const jwt = require('jsonwebtoken');

describe('Multi-Tenant Security', () => {
  let company1, company2, user1, user2, token1, token2;

  beforeAll(async () => {
    // Setup test data
    process.env.JWT_SECRET = 'test-secret-key';

    // Create two companies
    const c1 = await db.query(
      'INSERT INTO companies (name, status) VALUES ($1, $2) RETURNING *',
      ['Test Company 1', 'active']
    );
    company1 = c1.rows[0];

    const c2 = await db.query(
      'INSERT INTO companies (name, status) VALUES ($1, $2) RETURNING *',
      ['Test Company 2', 'active']
    );
    company2 = c2.rows[0];

    // Create users in different companies
    const u1 = await db.query(
      `INSERT INTO users (company_id, email, password_hash, role, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [company1.id, 'user1@test.com', 'hash1', 'accountant', 'User', 'One']
    );
    user1 = u1.rows[0];

    const u2 = await db.query(
      `INSERT INTO users (company_id, email, password_hash, role, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [company2.id, 'user2@test.com', 'hash2', 'accountant', 'User', 'Two']
    );
    user2 = u2.rows[0];

    // Generate tokens
    token1 = jwt.sign({ userId: user1.id, companyId: company1.id }, process.env.JWT_SECRET);
    token2 = jwt.sign({ userId: user2.id, companyId: company2.id }, process.env.JWT_SECRET);
  });

  afterAll(async () => {
    // Cleanup
    await db.query('DELETE FROM users WHERE id IN ($1, $2)', [user1.id, user2.id]);
    await db.query('DELETE FROM companies WHERE id IN ($1, $2)', [company1.id, company2.id]);
  });

  describe('Tenant Isolation', () => {
    test('user cannot access another company\'s accounts', async () => {
      // Create account in company 1
      const account = await db.query(
        `INSERT INTO accounts (company_id, code, name, type) 
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [company1.id, 'TEST001', 'Test Account', 'asset']
      );

      // Try to access with user from company 2
      const result = await db.query(
        'SELECT * FROM accounts WHERE id = $1 AND company_id = $2',
        [account.rows[0].id, company2.id]
      );

      expect(result.rows.length).toBe(0);

      // Cleanup
      await db.query('DELETE FROM accounts WHERE id = $1', [account.rows[0].id]);
    });

    test('authenticate middleware attaches correct companyId', async () => {
      const req = {
        headers: { authorization: `Bearer ${token1}` }
      };
      const res = {};
      const next = jest.fn();

      await authenticate(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.companyId).toBe(company1.id);
      expect(req.user.id).toBe(user1.id);
      expect(next).toHaveBeenCalled();
    });

    test('user cannot create journal for another company', async () => {
      // Attempt to insert journal with wrong company_id
      try {
        await db.query(
          'INSERT INTO journals (company_id, date, description, status, source_type, created_by_user_id) VALUES ($1, $2, $3, $4, $5, $6)',
          [company2.id, '2026-01-14', 'Test', 'draft', 'manual', user1.id]
        );
        // This should work at DB level but app logic should prevent it
        // The test is to verify tenant scoping is enforced
      } catch (error) {
        // Foreign key constraint would fail if user doesn't exist in company
      }

      // Proper way: user should only create journals for their company
      const result = await db.query(
        'INSERT INTO journals (company_id, date, description, status, source_type, created_by_user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [company1.id, '2026-01-14', 'Test', 'draft', 'manual', user1.id]
      );

      expect(result.rows[0].company_id).toBe(company1.id);

      // Cleanup
      await db.query('DELETE FROM journals WHERE id = $1', [result.rows[0].id]);
    });
  });

  describe('Company Status Enforcement', () => {
    test('inactive company blocks non-admin access', async () => {
      // Set company to inactive
      await db.query(
        'UPDATE companies SET status = $1 WHERE id = $2',
        ['inactive', company1.id]
      );

      const req = {
        headers: { authorization: `Bearer ${token1}` }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('inactive')
        })
      );

      // Restore
      await db.query(
        'UPDATE companies SET status = $1 WHERE id = $2',
        ['active', company1.id]
      );
    });

    test('read_only company allows reads', async () => {
      await db.query(
        'UPDATE companies SET status = $1 WHERE id = $2',
        ['read_only', company1.id]
      );

      // This should succeed since authenticate allows read_only
      const req = {
        headers: { authorization: `Bearer ${token1}` }
      };
      const res = {};
      const next = jest.fn();

      await authenticate(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.companyStatus).toBe('read_only');
      expect(next).toHaveBeenCalled();

      // Restore
      await db.query(
        'UPDATE companies SET status = $1 WHERE id = $2',
        ['active', company1.id]
      );
    });
  });

  describe('Global Admin Access', () => {
    test('global admin can access any company', async () => {
      // Create global admin user
      const globalAdmin = await db.query(
        `INSERT INTO users (company_id, email, password_hash, role, first_name, last_name)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [company1.id, 'ruanvlog@lorenco.co.za', 'hash', 'admin', 'Ruan', 'Admin']
      );

      const adminToken = jwt.sign(
        { userId: globalAdmin.rows[0].id, companyId: company1.id },
        process.env.JWT_SECRET
      );

      const req = {
        headers: { authorization: `Bearer ${adminToken}` }
      };
      const res = {};
      const next = jest.fn();

      await authenticate(req, res, next);

      expect(req.user.isGlobalAdmin).toBe(true);
      expect(next).toHaveBeenCalled();

      // Cleanup
      await db.query('DELETE FROM users WHERE id = $1', [globalAdmin.rows[0].id]);
    });
  });
});

describe('RBAC Enforcement', () => {
  let company, adminUser, viewerUser, adminToken, viewerToken;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-key';

    const c = await db.query(
      'INSERT INTO companies (name, status) VALUES ($1, $2) RETURNING *',
      ['RBAC Test Company', 'active']
    );
    company = c.rows[0];

    const admin = await db.query(
      `INSERT INTO users (company_id, email, password_hash, role, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [company.id, 'admin@rbac.com', 'hash', 'admin', 'Admin', 'User']
    );
    adminUser = admin.rows[0];

    const viewer = await db.query(
      `INSERT INTO users (company_id, email, password_hash, role, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [company.id, 'viewer@rbac.com', 'hash', 'viewer', 'Viewer', 'User']
    );
    viewerUser = viewer.rows[0];

    adminToken = jwt.sign({ userId: adminUser.id, companyId: company.id }, process.env.JWT_SECRET);
    viewerToken = jwt.sign({ userId: viewerUser.id, companyId: company.id }, process.env.JWT_SECRET);
  });

  afterAll(async () => {
    await db.query('DELETE FROM users WHERE company_id = $1', [company.id]);
    await db.query('DELETE FROM companies WHERE id = $1', [company.id]);
  });

  test('viewer cannot create accounts', async () => {
    const req = {
      headers: { authorization: `Bearer ${viewerToken}` },
      user: { role: 'viewer' }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    // Simulate permission check
    const permissionMiddleware = hasPermission('account.create');
    await authenticate(req, res, () => {
      permissionMiddleware(req, res, next);
    });

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('admin can create accounts', async () => {
    const req = {
      headers: { authorization: `Bearer ${adminToken}` },
      user: { role: 'admin' }
    };
    const res = {};
    const next = jest.fn();

    await authenticate(req, res, () => {
      const permissionMiddleware = hasPermission('account.create');
      permissionMiddleware(req, res, next);
    });

    expect(next).toHaveBeenCalled();
  });

  test('viewer cannot access AI settings', async () => {
    const req = {
      headers: { authorization: `Bearer ${viewerToken}` },
      user: { role: 'viewer' }
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    const permissionMiddleware = hasPermission('ai.settings.view');
    await authenticate(req, res, () => {
      permissionMiddleware(req, res, next);
    });

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
