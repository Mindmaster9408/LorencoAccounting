const db = require('../config/database');

/**
 * Middleware to enforce company status restrictions
 * READ_ONLY mode: blocks writes but allows reads
 * INACTIVE/SUSPENDED: blocks most access except for global admins
 */
function enforceCompanyStatus(req, res, next) {
  // If req.user hasn't been set yet, skip this middleware.
  // Authentication is handled per-route by the authenticate() middleware,
  // which will reject unauthenticated requests before they reach handlers.
  if (!req.user) {
    return next();
  }

  const companyStatus = req.user.companyStatus || 'active';
  const isGlobalAdmin = req.user.isGlobalAdmin;

  // Global admins can always access
  if (isGlobalAdmin) {
    return next();
  }

  // INACTIVE or SUSPENDED companies - block all access except basic auth endpoints
  if (companyStatus === 'inactive' || companyStatus === 'suspended') {
    return res.status(403).json({ 
      error: `Company account is ${companyStatus}. Please contact support.`,
      companyStatus 
    });
  }

  // READ_ONLY mode - block write operations
  if (companyStatus === 'read_only') {
    const method = req.method;
    const path = req.path;

    // Block all write operations (POST, PUT, PATCH, DELETE)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      // Allow exceptions for auth/logout
      if (path === '/api/auth/logout') {
        return next();
      }

      return res.status(403).json({ 
        error: 'Company is in READ_ONLY mode. No changes allowed.',
        companyStatus: 'read_only',
        allowedActions: ['view', 'read', 'query']
      });
    }

    // Block specific read endpoints that generate output files
    const restrictedReadPaths = [
      '/api/reports/export',
      '/api/reports/download',
      '/api/bank/export',
      '/api/journals/export'
    ];

    if (restrictedReadPaths.some(p => path.startsWith(p))) {
      return res.status(403).json({ 
        error: 'Exports and downloads are disabled in READ_ONLY mode.',
        companyStatus: 'read_only'
      });
    }
  }

  next();
}

/**
 * Require company to be in ACTIVE status
 */
function requireActiveCompany(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const companyStatus = req.user.companyStatus || 'active';
  const isGlobalAdmin = req.user.isGlobalAdmin;

  // Global admins bypass
  if (isGlobalAdmin) {
    return next();
  }

  if (companyStatus !== 'active') {
    return res.status(403).json({ 
      error: `This action requires an ACTIVE company status. Current status: ${companyStatus}`,
      companyStatus 
    });
  }

  next();
}

module.exports = {
  enforceCompanyStatus,
  requireActiveCompany
};
