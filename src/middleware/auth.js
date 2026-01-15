const jwt = require('jsonwebtoken');
const db = require('../config/database');

const GLOBAL_ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'ruanvlog@lorenco.co.za,antonjvr@lorenco.co.za')
  .split(',')
  .map(email => email.trim().toLowerCase());

/**
 * Authentication middleware - verifies JWT token
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Fetch full user details
      const result = await db.query(
        `SELECT u.*, c.status as company_status 
         FROM users u 
         JOIN companies c ON u.company_id = c.id 
         WHERE u.id = $1 AND u.is_active = true`,
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      const user = result.rows[0];
      
      // Check if company is active (inactive/suspended blocks access)
      if (user.company_status === 'inactive' || user.company_status === 'suspended') {
        // Global admins can still access
        if (!GLOBAL_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
          return res.status(403).json({ 
            error: `Company account is ${user.company_status}`,
            companyStatus: user.company_status
          });
        }
      }

      // Attach user info to request
      req.user = {
        id: user.id,
        companyId: user.company_id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        companyStatus: user.company_status,
        isGlobalAdmin: GLOBAL_ADMIN_EMAILS.includes(user.email.toLowerCase())
      };

      // Update last login
      await db.query(
        'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Role-based authorization middleware
 * @param {Array<string>} allowedRoles - Array of roles allowed to access the route
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Global admins bypass role checks
    if (req.user.isGlobalAdmin) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
}

/**
 * Permission-based authorization for specific actions
 */
const PERMISSIONS = {
  // Company management
  'company.view': ['admin', 'accountant', 'bookkeeper', 'viewer'],
  'company.edit': ['admin'],
  'company.delete': ['admin'],

  // User management
  'user.view': ['admin', 'accountant'],
  'user.create': ['admin'],
  'user.edit': ['admin'],
  'user.delete': ['admin'],

  // Accounts
  'account.view': ['admin', 'accountant', 'bookkeeper', 'viewer'],
  'account.create': ['admin', 'accountant'],
  'account.edit': ['admin', 'accountant'],
  'account.delete': ['admin', 'accountant'],

  // Journals
  'journal.view': ['admin', 'accountant', 'bookkeeper', 'viewer'],
  'journal.create': ['admin', 'accountant', 'bookkeeper'],
  'journal.edit': ['admin', 'accountant', 'bookkeeper'],
  'journal.post': ['admin', 'accountant'],
  'journal.reverse': ['admin', 'accountant'],
  'journal.delete': ['admin', 'accountant'],

  // Bank
  'bank.view': ['admin', 'accountant', 'bookkeeper', 'viewer'],
  'bank.import': ['admin', 'accountant', 'bookkeeper'],
  'bank.allocate': ['admin', 'accountant', 'bookkeeper'],
  'bank.reconcile': ['admin', 'accountant'],

  // Reports
  'report.view': ['admin', 'accountant', 'bookkeeper', 'viewer'],
  'report.export': ['admin', 'accountant', 'bookkeeper'],

  // AI
  'ai.settings.view': ['admin', 'accountant'],
  'ai.settings.edit': ['admin', 'accountant'],
  'ai.request': ['admin', 'accountant', 'bookkeeper'],
  'ai.approve': ['admin', 'accountant'],

  // Audit
  'audit.view': ['admin', 'accountant'],
};

/**
 * Check if user has permission for an action
 */
function hasPermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Global admins have all permissions
    if (req.user.isGlobalAdmin) {
      return next();
    }

    const allowedRoles = PERMISSIONS[permission];
    
    if (!allowedRoles) {
      console.warn(`Unknown permission: ${permission}`);
      return res.status(403).json({ error: 'Invalid permission' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        permission,
        role: req.user.role
      });
    }

    next();
  };
}

/**
 * Ensure user can only access their own company data
 */
function enforceCompanyScope(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Global admins can access any company
  if (req.user.isGlobalAdmin) {
    return next();
  }

  // Extract companyId from request (query, params, or body)
  const requestCompanyId = parseInt(
    req.params.companyId || 
    req.query.companyId || 
    req.body.companyId
  );

  if (requestCompanyId && requestCompanyId !== req.user.companyId) {
    return res.status(403).json({ error: 'Access denied to this company' });
  }

  next();
}

module.exports = {
  authenticate,
  authorize,
  hasPermission,
  enforceCompanyScope,
  PERMISSIONS,
  GLOBAL_ADMIN_EMAILS
};
